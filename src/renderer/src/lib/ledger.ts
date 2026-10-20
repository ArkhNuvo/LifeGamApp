import { newId } from './ids'
import { convert } from './currency'
import type {
  CurrencyCode,
  Counterparty,
  LedgerEvent,
  Recurrence,
  Subscription,
  FinanceBook
} from './types'

/** Account id of the general (uncategorised) checking balance. */
export const GENERAL_ACCOUNT_ID = '__general__'

export interface LedgerAccount {
  id: string
  name: string
  kind: 'general' | 'category' | 'savings'
  group: 'checking' | 'savings'
  currency: CurrencyCode
  balance: number
  /** A coin portfolio: its balance is computed from live prices, so events can't touch it. */
  crypto: boolean
}

/** Every account events can touch: the general checking balance, its categories, and savings entries. */
export function listAccounts(data: Pick<FinanceBook, 'finance'>, generalName: string): LedgerAccount[] {
  const { checking, savings } = data.finance
  return [
    {
      id: GENERAL_ACCOUNT_ID,
      name: generalName,
      kind: 'general',
      group: 'checking',
      currency: checking.currency,
      balance: checking.balance,
      crypto: false
    },
    ...checking.categories.map(
      (c): LedgerAccount => ({
        id: c.id,
        name: c.name,
        kind: 'category',
        group: 'checking',
        currency: c.currency,
        balance: c.balance,
        crypto: false
      })
    ),
    ...savings.map(
      (e): LedgerAccount => ({
        id: e.id,
        name: e.name,
        kind: 'savings',
        group: 'savings',
        currency: e.currency,
        balance: e.amount,
        crypto: !!e.holdings
      })
    )
  ]
}

/** Adds to a balance, keeping it at cent precision (avoids 1010.0100000000002 drift). */
function addCents(value: number, delta: number): number {
  return Math.round((value + delta) * 100) / 100
}

function applyAccountDelta(draft: FinanceBook, accountId: string, delta: number): void {
  if (accountId === GENERAL_ACCOUNT_ID) {
    draft.finance.checking.balance = addCents(draft.finance.checking.balance, delta)
    return
  }
  const category = draft.finance.checking.categories.find((c) => c.id === accountId)
  if (category) {
    category.balance = addCents(category.balance, delta)
    return
  }
  const entry = draft.finance.savings.find((e) => e.id === accountId)
  if (entry) entry.amount = addCents(entry.amount, delta)
}

/** Shifts an account balance directly, outside any event (used to keep balances unchanged by back-filled history). */
export function adjustAccountBalance(draft: FinanceBook, accountId: string, delta: number): void {
  applyAccountDelta(draft, accountId, delta)
}

/** Current balance of an account (0 for an unknown id). */
export function accountBalance(draft: FinanceBook, accountId: string): number {
  if (accountId === GENERAL_ACCOUNT_ID) return draft.finance.checking.balance
  return (
    draft.finance.checking.categories.find((c) => c.id === accountId)?.balance ??
    draft.finance.savings.find((e) => e.id === accountId)?.amount ??
    0
  )
}

function eventDeltas(ev: LedgerEvent): { accountId: string; delta: number }[] {
  if (ev.type === 'income') return [{ accountId: ev.accountId, delta: ev.amount }]
  if (ev.type === 'expense') return [{ accountId: ev.accountId, delta: -ev.amount }]
  const out = [{ accountId: ev.accountId, delta: -ev.amount }]
  if (ev.toAccountId) out.push({ accountId: ev.toAccountId, delta: ev.toAmount ?? ev.amount })
  return out
}

/** A coin payment changes the portfolio's holdings (and its cached USD value right away, until live prices refresh it). */
function applyCryptoDelta(draft: FinanceBook, ev: LedgerEvent, sign: 1 | -1): void {
  const entry = draft.finance.savings.find((e) => e.id === ev.accountId)
  if (!entry?.holdings || !ev.crypto) return
  const direction = ev.type === 'income' ? 1 : -1
  let holding = entry.holdings.find((h) => h.ticker === ev.crypto?.ticker)
  if (!holding) {
    holding = { ticker: ev.crypto.ticker, amount: 0 }
    entry.holdings.push(holding)
  }
  holding.amount = Math.round((holding.amount + sign * direction * ev.crypto.amount) * 1e8) / 1e8
  entry.amount = addCents(entry.amount, sign * direction * ev.amount)
}

function applyEventEffects(draft: FinanceBook, ev: LedgerEvent): void {
  if (ev.crypto && ev.type !== 'transfer') {
    applyCryptoDelta(draft, ev, 1)
    ev.effectsApplied = true
    return
  }
  for (const { accountId, delta } of eventDeltas(ev)) applyAccountDelta(draft, accountId, delta)
  ev.effectsApplied = true
}

function revertEventEffects(draft: FinanceBook, ev: LedgerEvent): void {
  if (ev.crypto && ev.type !== 'transfer') {
    applyCryptoDelta(draft, ev, -1)
    ev.effectsApplied = false
    return
  }
  for (const { accountId, delta } of eventDeltas(ev)) applyAccountDelta(draft, accountId, -delta)
  ev.effectsApplied = false
}

/** Brings a card's balance effects in line with its `confirmed` flag. */
function syncEffects(draft: FinanceBook, ev: LedgerEvent): void {
  if (ev.confirmed && !ev.effectsApplied) applyEventEffects(draft, ev)
  else if (!ev.confirmed && ev.effectsApplied) revertEventEffects(draft, ev)
}

export type NewLedgerEvent = Omit<LedgerEvent, 'id' | 'effectsApplied'>

export function addEvent(draft: FinanceBook, fields: NewLedgerEvent): LedgerEvent {
  const ev: LedgerEvent = { ...fields, id: newId(), effectsApplied: false }
  draft.ledger.events.push(ev)
  syncEffects(draft, ev)
  return ev
}

/** Edits an event; if its amount was already applied, it is reverted with the old values and re-applied with the new. */
export function editEvent(
  draft: FinanceBook,
  id: string,
  patch: Partial<Omit<LedgerEvent, 'id' | 'effectsApplied'>>
): void {
  const ev = draft.ledger.events.find((e) => e.id === id)
  if (!ev) return
  if (ev.effectsApplied) revertEventEffects(draft, ev)
  Object.assign(ev, patch)
  syncEffects(draft, ev)
}

export function setEventConfirmed(draft: FinanceBook, id: string, confirmed: boolean): void {
  const ev = draft.ledger.events.find((e) => e.id === id)
  if (!ev) return
  ev.confirmed = confirmed
  syncEffects(draft, ev)
}

export function deleteEvent(draft: FinanceBook, id: string): void {
  const ev = draft.ledger.events.find((e) => e.id === id)
  if (!ev) return
  if (ev.effectsApplied) revertEventEffects(draft, ev)
  draft.ledger.events = draft.ledger.events.filter((e) => e.id !== id)
}

// ---- dates -----------------------------------------------------------------

function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, days: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

/** The n-th occurrence of a recurrence that starts on `startIso` (n = 0 is the start itself); month-end days are clamped. */
export function occurrenceDate(startIso: string, n: number, every: Recurrence): string {
  if (every === 'week') return addDays(startIso, 7 * n)
  const start = fromISO(startIso)
  const monthsToAdd = every === 'month' ? n : 12 * n
  const target = new Date(start.getFullYear(), start.getMonth() + monthsToAdd, 1, 12)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(start.getDate(), lastDay))
  return toISO(target)
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1, 12)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ---- subscriptions ---------------------------------------------------------

/** How far ahead recurring payments are shown as planned events. */
const HORIZON_DAYS = 120

/**
 * Generates planned (unconfirmed) events for every active subscription up to
 * the horizon — or up to `until`, when the user is looking at a month beyond
 * it (capped at two years). Idempotent — safe to call whenever the finance
 * module opens or the viewed month changes.
 */
export function materializeSubscriptions(draft: FinanceBook, todayIso: string, until?: string): void {
  const defaultHorizon = addDays(todayIso, HORIZON_DAYS)
  const cap = addDays(todayIso, 730)
  const horizon = until && until > defaultHorizon ? (until < cap ? until : cap) : defaultHorizon
  for (const sub of draft.ledger.subscriptions) {
    if (!sub.active) continue
    for (;;) {
      const date = occurrenceDate(sub.startDate, sub.generated, sub.every)
      if (date > horizon) break
      draft.ledger.events.push({
        id: newId(),
        type: 'expense',
        title: sub.title,
        amount: sub.amount,
        accountId: sub.accountId,
        toAccountId: null,
        toAmount: null,
        date,
        category: sub.category,
        counterpartyId: sub.counterpartyId,
        subscriptionId: sub.id,
        confirmed: false,
        effectsApplied: false,
        attachments: []
      })
      sub.generated += 1
    }
  }
}

export function nextSubscriptionDate(sub: Subscription): string {
  return occurrenceDate(sub.startDate, sub.generated, sub.every)
}

function occurrenceIndex(sub: Subscription, date: string): number {
  for (let i = 0; i < sub.generated; i++) {
    if (occurrenceDate(sub.startDate, i, sub.every) === date) return i
  }
  return sub.generated
}

/**
 * Updates a template and the planned (unconfirmed) events it already
 * generated; confirmed history is untouched. Pausing drops future planned
 * payments; resuming continues from the next occurrence that is still ahead.
 */
export function updateSubscription(
  draft: FinanceBook,
  id: string,
  patch: Partial<Pick<Subscription, 'title' | 'amount' | 'accountId' | 'category' | 'counterpartyId' | 'active'>>,
  todayIso: string
): void {
  const sub = draft.ledger.subscriptions.find((s) => s.id === id)
  if (!sub) return
  const wasActive = sub.active
  Object.assign(sub, patch)
  for (const ev of draft.ledger.events) {
    if (ev.subscriptionId !== id || ev.confirmed) continue
    ev.title = sub.title
    ev.amount = sub.amount
    ev.accountId = sub.accountId
    ev.category = sub.category
    ev.counterpartyId = sub.counterpartyId
  }
  if (wasActive && !sub.active) {
    const future = draft.ledger.events.filter(
      (e) => e.subscriptionId === id && !e.confirmed && e.date > todayIso
    )
    if (future.length > 0) {
      const firstIndex = Math.min(...future.map((e) => occurrenceIndex(sub, e.date)))
      const dropped = new Set(future.map((e) => e.id))
      draft.ledger.events = draft.ledger.events.filter((e) => !dropped.has(e.id))
      sub.generated = firstIndex
    }
  } else if (!wasActive && sub.active) {
    while (occurrenceDate(sub.startDate, sub.generated, sub.every) < todayIso) sub.generated += 1
  }
}

/**
 * Changes when a subscription is paid: drops its unpaid planned events and
 * restarts the schedule from `nextDate` with the new period. Confirmed
 * payments (history) are kept as they are.
 */
export function rescheduleSubscription(draft: FinanceBook, id: string, every: Recurrence, nextDate: string): void {
  const sub = draft.ledger.subscriptions.find((s) => s.id === id)
  if (!sub) return
  draft.ledger.events = draft.ledger.events.filter((e) => !(e.subscriptionId === id && !e.confirmed))
  sub.every = every
  sub.startDate = nextDate
  sub.generated = 0
}

/** The date of the next payment still waiting to be made (planned event), else the next one to be generated. */
export function nextPaymentDate(draft: Pick<FinanceBook, 'ledger'>, sub: Subscription): string {
  const planned = draft.ledger.events
    .filter((e) => e.subscriptionId === sub.id && !e.confirmed)
    .map((e) => e.date)
    .sort()[0]
  return planned ?? nextSubscriptionDate(sub)
}

export function deleteSubscription(draft: FinanceBook, id: string): void {
  draft.ledger.events = draft.ledger.events.filter((e) => !(e.subscriptionId === id && !e.confirmed))
  for (const ev of draft.ledger.events) if (ev.subscriptionId === id) ev.subscriptionId = null
  draft.ledger.subscriptions = draft.ledger.subscriptions.filter((s) => s.id !== id)
}

export function createSubscription(
  draft: FinanceBook,
  fields: Pick<Subscription, 'title' | 'amount' | 'accountId' | 'category' | 'counterpartyId' | 'every' | 'startDate'>
): Subscription {
  const sub: Subscription = { ...fields, id: newId(), generated: 0, active: true }
  draft.ledger.subscriptions.push(sub)
  return sub
}

// ---- counterparties --------------------------------------------------------

export function deleteCounterparty(draft: FinanceBook, id: string): void {
  for (const ev of draft.ledger.events) if (ev.counterpartyId === id) ev.counterpartyId = null
  for (const sub of draft.ledger.subscriptions) if (sub.counterpartyId === id) sub.counterpartyId = null
  draft.ledger.counterparties = draft.ledger.counterparties.filter((c) => c.id !== id)
}

export function counterpartyName(counterparties: Counterparty[], id: string | null): string | null {
  return counterparties.find((c) => c.id === id)?.name ?? null
}

// ---- keeping events consistent with account changes ------------------------

/**
 * When an account's currency changes (amounts are converted), the event
 * amounts tied to it must be converted too — otherwise reverting an applied
 * event later would move the old number in the new currency.
 */
export function convertEventsForAccount(
  draft: FinanceBook,
  accountId: string,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<string, number> | null
): void {
  const round = (n: number): number => Math.round(convert(n, from, to, rates) * 100) / 100
  for (const ev of draft.ledger.events) {
    if (ev.accountId === accountId) ev.amount = round(ev.amount)
    if (ev.toAccountId === accountId && ev.toAmount !== null) ev.toAmount = round(ev.toAmount)
  }
  for (const sub of draft.ledger.subscriptions) {
    if (sub.accountId === accountId) sub.amount = round(sub.amount)
  }
}

/** A checking category was deleted (its balance merged into the general one): point its events there. */
export function retargetEventsToGeneral(
  draft: FinanceBook,
  removedAccountId: string,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<string, number> | null
): void {
  convertEventsForAccount(draft, removedAccountId, from, to, rates)
  for (const ev of draft.ledger.events) {
    if (ev.accountId === removedAccountId) ev.accountId = GENERAL_ACCOUNT_ID
    if (ev.toAccountId === removedAccountId) ev.toAccountId = GENERAL_ACCOUNT_ID
  }
  for (const sub of draft.ledger.subscriptions) {
    if (sub.accountId === removedAccountId) sub.accountId = GENERAL_ACCOUNT_ID
  }
}

// ---- metrics (confirmed events only) ---------------------------------------

export interface MonthSummary {
  income: number
  expense: number
  result: number
  plannedIncome: number
  plannedExpense: number
}

/** All amounts converted to the main currency. Transfers between own accounts are neither income nor expense. */
export function summarizeMonth(
  events: LedgerEvent[],
  accounts: LedgerAccount[],
  monthKey: string,
  rates: Record<string, number> | null,
  main: CurrencyCode
): MonthSummary {
  const currencyOf = (id: string): CurrencyCode => accounts.find((a) => a.id === id)?.currency ?? 'USD'
  const out: MonthSummary = { income: 0, expense: 0, result: 0, plannedIncome: 0, plannedExpense: 0 }
  for (const ev of events) {
    if (monthOf(ev.date) !== monthKey || ev.type === 'transfer') continue
    const usd = convert(ev.amount, currencyOf(ev.accountId), main, rates)
    if (ev.confirmed) {
      if (ev.type === 'income') out.income += usd
      else out.expense += usd
    } else if (ev.type === 'income') out.plannedIncome += usd
    else out.plannedExpense += usd
  }
  out.result = out.income - out.expense
  return out
}

/** Approximate monthly cost of a subscription template, in the main currency. */
export function monthlyCost(
  sub: Subscription,
  accounts: LedgerAccount[],
  rates: Record<string, number> | null,
  main: CurrencyCode
): number {
  const currency = accounts.find((a) => a.id === sub.accountId)?.currency ?? 'USD'
  const usd = convert(sub.amount, currency, main, rates)
  if (sub.every === 'week') return (usd * 52) / 12
  if (sub.every === 'year') return usd / 12
  return usd
}
