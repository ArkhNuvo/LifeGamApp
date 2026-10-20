import { addDays, createSubscription, materializeSubscriptions } from './ledger'
import type { FinanceBook, LedgerEvent, Recurrence } from './types'

/** A recurring payment found in the history, not yet turned into a subscription. */
export interface SubscriptionCandidate {
  key: string
  title: string
  every: Recurrence
  /** The latest amount; the history may vary a little (foreign-currency bills). */
  amount: number
  minAmount: number
  maxAmount: number
  count: number
  firstDate: string
  lastDate: string
  accountId: string
  category: string
  eventIds: string[]
  /** The last payment is recent enough that the subscription is probably still running. */
  active: boolean
}

/** Well-known services: several spellings of the same merchant share one key and a readable name. */
const BRANDS: { re: RegExp; key: string; name: string }[] = [
  { re: /anthropic|claude/i, key: 'anthropic', name: 'Claude (Anthropic)' },
  { re: /openai|chatgpt/i, key: 'openai', name: 'ChatGPT (OpenAI)' },
  { re: /youtube/i, key: 'youtube', name: 'YouTube Premium' },
  { re: /microsoft/i, key: 'microsoft', name: 'Microsoft 365' },
  { re: /vultr/i, key: 'vultr', name: 'Vultr' },
  { re: /trello|atlassian/i, key: 'atlassian', name: 'Trello (Atlassian)' },
  { re: /zoom/i, key: 'zoom', name: 'Zoom' },
  { re: /ccleaner|piriform/i, key: 'ccleaner', name: 'CCleaner' },
  { re: /netflix/i, key: 'netflix', name: 'Netflix' },
  { re: /spotify/i, key: 'spotify', name: 'Spotify' },
  { re: /vectra/i, key: 'vectra', name: 'Интернет (Vectra)' },
  { re: /icloud|apple\.com/i, key: 'apple', name: 'Apple' }
]

const NOISE = new Set(['pol', 'usa', 'irl', 'gbr', 'deu', 'grc', 'nld', 'com', 'www', 'sp', 'sa', 'ltd', 'inc', 'limited'])

/** A stable key for "the same merchant": a known brand, else the first two meaningful words. */
function merchantKey(title: string): { key: string; name: string | null } {
  for (const brand of BRANDS) if (brand.re.test(title)) return { key: brand.key, name: brand.name }
  const words = title
    .toLowerCase()
    .replace(/[^a-zа-яё\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !NOISE.has(w))
  return { key: words.slice(0, 2).join(' '), name: null }
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const PERIODS: { every: Recurrence; min: number; max: number }[] = [
  { every: 'week', min: 6, max: 8 },
  { every: 'month', min: 26, max: 35 },
  { every: 'year', min: 350, max: 380 }
]

/**
 * Looks through confirmed expenses that aren't part of a subscription yet for
 * payments to the same merchant that repeat at a regular interval for
 * (almost) the same amount.
 */
export function detectSubscriptions(
  data: Pick<FinanceBook, 'ledger'>,
  todayIso: string
): SubscriptionCandidate[] {
  const known = new Set(data.ledger.subscriptions.map((s) => merchantKey(s.title).key))
  const dismissed = new Set(data.ledger.dismissedSubscriptions ?? [])
  const groups = new Map<string, LedgerEvent[]>()
  for (const ev of data.ledger.events) {
    if (ev.type !== 'expense' || !ev.confirmed || ev.subscriptionId) continue
    const { key } = merchantKey(ev.title)
    if (!key) continue
    const groupKey = `${key}|${ev.accountId}`
    const list = groups.get(groupKey)
    if (list) list.push(ev)
    else groups.set(groupKey, [ev])
  }

  const out: SubscriptionCandidate[] = []
  for (const [groupKey, events] of groups) {
    const key = groupKey.split('|')[0]
    if (known.has(key) || dismissed.has(key)) continue
    const brand = merchantKey(events[0].title).name
    // Two payments are enough for a service we know; unknown merchants need three to rule out coincidence.
    if (events.length < (brand ? 2 : 3)) continue
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))
    const gaps = sorted.slice(1).map((e, i) => daysBetween(sorted[i].date, e.date)).filter((g) => g > 0)
    if (gaps.length === 0) continue
    const mid = median(gaps)
    const period = PERIODS.find((p) => mid >= p.min && mid <= p.max)
    if (!period) continue
    const regular = gaps.filter((g) => g >= period.min && g <= period.max).length / gaps.length
    if (regular < 0.7) continue
    const amounts = sorted.map((e) => e.amount)
    const typical = median(amounts)
    // Bills in a foreign currency drift a little with the exchange rate.
    const tolerance = /usa|irl|gbr|deu|nld|\.com/i.test(sorted[sorted.length - 1].title) || brand ? 0.15 : 0.05
    if ((Math.max(...amounts) - Math.min(...amounts)) / typical > tolerance) continue

    const last = sorted[sorted.length - 1]
    const categories = new Map<string, number>()
    for (const e of sorted) if (e.category) categories.set(e.category, (categories.get(e.category) ?? 0) + 1)
    const category = [...categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    const title =
      brand ?? last.title.replace(/\s+\d{4}-\d{2}-\d{2}$/, '').replace(/\s{2,}/g, ' ').trim()
    out.push({
      key,
      title,
      every: period.every,
      amount: last.amount,
      minAmount: Math.min(...amounts),
      maxAmount: Math.max(...amounts),
      count: sorted.length,
      firstDate: sorted[0].date,
      lastDate: last.date,
      accountId: last.accountId,
      category,
      eventIds: sorted.map((e) => e.id),
      active: last.date >= addDays(todayIso, -Math.round(mid * 1.6))
    })
  }
  return out.sort((a, b) => Number(b.active) - Number(a.active) || b.lastDate.localeCompare(a.lastDate))
}

/** Turns a candidate into a subscription: past payments are linked to it and the schedule continues from the last one. */
export function adoptCandidate(draft: FinanceBook, candidate: SubscriptionCandidate, todayIso: string): void {
  const sub = createSubscription(draft, {
    title: candidate.title,
    amount: candidate.amount,
    accountId: candidate.accountId,
    category: candidate.category,
    counterpartyId: null,
    every: candidate.every,
    startDate: candidate.lastDate
  })
  sub.generated = 1
  sub.active = candidate.active
  const linked = new Set(candidate.eventIds)
  for (const ev of draft.ledger.events) if (linked.has(ev.id)) ev.subscriptionId = sub.id
  materializeSubscriptions(draft, todayIso)
}

export function dismissCandidate(draft: FinanceBook, key: string): void {
  const list = draft.ledger.dismissedSubscriptions ?? []
  if (!list.includes(key)) draft.ledger.dismissedSubscriptions = [...list, key]
}
