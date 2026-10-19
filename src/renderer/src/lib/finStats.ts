import { convert } from './currency'
import { addDays, monthOf, monthlyCost, shiftMonth, type LedgerAccount } from './ledger'
import { localeOf, type StatsLabel } from './statsLabels'
import type { Counterparty, CurrencyCode, FinWidgetConfig, LedgerEvent, Subscription } from './types'

// ---- catalog ---------------------------------------------------------------

export type ChartType =
  | 'tile'
  | 'line'
  | 'area'
  | 'bar'
  | 'stacked'
  | 'hbar'
  | 'donut'
  | 'treemap'
  | 'heat'
  | 'sankey'
  | 'progress'
  | 'table'
  | 'diverging'

export type Period = 'month' | '3m' | '6m' | '12m' | 'all'
export const PERIODS: Period[] = ['month', '3m', '6m', '12m', 'all']

export type GroupId = 'expenses' | 'income' | 'transfers' | 'totals' | 'subs' | 'crypto' | 'quality'

export interface MetricDef {
  id: string
  group: GroupId
  /** Charts that suit the metric; the first is the default. */
  charts: ChartType[]
  /** Size a new widget starts with (grid units). */
  size: { w: number; h: number }
  /** Lets the widget be narrowed to one account. */
  accountFilter?: boolean
  /** Set when the metric can't be shown yet: the key of the reason label. */
  unavailable?: string
}

const M = (
  id: string,
  group: GroupId,
  charts: ChartType[],
  size: { w: number; h: number } = { w: 4, h: 4 },
  extra: Partial<MetricDef> = {}
): MetricDef => ({ id, group, charts, size, ...extra })

export const METRICS: MetricDef[] = [
  // expenses
  M('expense_by_category', 'expenses', ['donut', 'hbar', 'treemap', 'table'], { w: 4, h: 4 }, { accountFilter: true }),
  M('category_by_month', 'expenses', ['stacked', 'area'], { w: 6, h: 4 }, { accountFilter: true }),
  M('category_trend', 'expenses', ['diverging', 'table'], { w: 6, h: 4 }, { accountFilter: true }),
  M('top_expenses', 'expenses', ['table', 'hbar'], { w: 6, h: 4 }, { accountFilter: true }),
  M('avg_check', 'expenses', ['tile', 'bar', 'line'], { w: 3, h: 2 }, { accountFilter: true }),
  M('expense_by_weekday', 'expenses', ['bar', 'heat'], { w: 4, h: 4 }, { accountFilter: true }),
  M('expense_by_account', 'expenses', ['donut', 'hbar'], { w: 4, h: 4 }),
  M('small_share', 'expenses', ['tile', 'donut', 'line'], { w: 3, h: 2 }, { accountFilter: true }),
  M('expense_forecast', 'expenses', ['tile', 'line'], { w: 4, h: 3 }, { accountFilter: true }),
  M('budget', 'expenses', ['progress'], { w: 4, h: 4 }, { unavailable: 'why.budget' }),
  M('mandatory_split', 'expenses', ['stacked'], { w: 4, h: 4 }, { unavailable: 'why.mandatory_split' }),
  // income
  M('income_by_category', 'income', ['donut', 'hbar', 'treemap'], { w: 4, h: 4 }, { accountFilter: true }),
  M('income_sources', 'income', ['hbar', 'donut', 'table'], { w: 4, h: 4 }, { accountFilter: true }),
  M('income_trend', 'income', ['line', 'bar'], { w: 6, h: 4 }, { accountFilter: true }),
  // transfers
  M('transfer_flows', 'transfers', ['sankey', 'table'], { w: 6, h: 4 }),
  M('account_net_flow', 'transfers', ['diverging', 'hbar', 'table'], { w: 6, h: 4 }),
  M('fx_conversions', 'transfers', ['table', 'line'], { w: 6, h: 4 }),
  M('savings_transfers', 'transfers', ['area', 'bar'], { w: 6, h: 4 }),
  // totals
  M('kpi_income', 'totals', ['tile', 'bar', 'line'], { w: 3, h: 2 }, { accountFilter: true }),
  M('kpi_expense', 'totals', ['tile', 'bar', 'line'], { w: 3, h: 2 }, { accountFilter: true }),
  M('kpi_result', 'totals', ['tile', 'diverging', 'line'], { w: 3, h: 2 }, { accountFilter: true }),
  M('savings_rate', 'totals', ['tile', 'line'], { w: 3, h: 2 }, { accountFilter: true }),
  M('income_expense', 'totals', ['bar', 'line', 'area'], { w: 8, h: 4 }, { accountFilter: true }),
  M('cashflow', 'totals', ['diverging', 'line', 'area'], { w: 6, h: 4 }, { accountFilter: true }),
  M('net_worth', 'totals', ['area', 'line'], { w: 6, h: 4 }),
  M('asset_structure', 'totals', ['donut', 'treemap', 'hbar'], { w: 4, h: 4 }),
  M('runway', 'totals', ['tile', 'progress'], { w: 3, h: 2 }),
  M('yoy_expense', 'totals', ['bar', 'line'], { w: 6, h: 4 }),
  M('annual_summary', 'totals', ['table'], { w: 8, h: 5 }),
  // subscriptions
  M('subs_cost', 'subs', ['hbar', 'donut', 'tile'], { w: 4, h: 4 }),
  M('subs_share', 'subs', ['tile', 'progress'], { w: 3, h: 2 }),
  M('subs_upcoming', 'subs', ['table'], { w: 4, h: 4 }),
  M('subs_forgotten', 'subs', ['table'], { w: 4, h: 3 }),
  // crypto
  M('crypto_share', 'crypto', ['donut', 'treemap', 'hbar'], { w: 4, h: 4 }),
  M('portfolio_history', 'crypto', ['area', 'line'], { w: 6, h: 4 }),
  M('crypto_pnl', 'crypto', ['diverging'], { w: 6, h: 4 }, { unavailable: 'why.crypto_pnl' }),
  // data quality
  M('review_count', 'quality', ['tile', 'table'], { w: 3, h: 2 }),
  M('uncategorized', 'quality', ['donut', 'tile'], { w: 3, h: 3 }),
  M('overdue_planned', 'quality', ['table'], { w: 4, h: 3 })
]

export const GROUP_ORDER: GroupId[] = ['expenses', 'income', 'transfers', 'totals', 'subs', 'crypto', 'quality']

export function metricDef(id: string): MetricDef | undefined {
  return METRICS.find((m) => m.id === id)
}

// ---- results ----------------------------------------------------------------

export interface Part {
  name: string
  value: number
}

export interface SeriesData {
  labels: string[]
  series: { key: string; name: string; values: (number | null)[] }[]
}

export interface ValueData {
  value: number
  format: 'money' | 'percent' | 'number' | 'months'
  /** Change versus the previous period, in percent. */
  delta?: number | null
  spark?: number[]
  target?: number
}

export interface TableData {
  columns: { label: string; align?: 'right' }[]
  rows: (string | number)[][]
}

export interface HeatData {
  xLabels: string[]
  yLabels: string[]
  /** [row][column] */
  cells: number[][]
}

export interface FlowData {
  nodes: string[]
  links: { source: number; target: number; value: number }[]
}

export interface MetricResult {
  value?: ValueData
  parts?: Part[]
  series?: SeriesData
  table?: TableData
  heat?: HeatData
  flows?: FlowData
  note?: string
}

export interface StatsContext {
  events: LedgerEvent[]
  accounts: LedgerAccount[]
  subscriptions: Subscription[]
  counterparties: Counterparty[]
  rates: Record<string, number> | null
  main: CurrencyCode
  today: string
  /** The month picked in the module's stepper. */
  month: string
  prices: Record<string, number | null>
  holdings: { account: string; ticker: string; amount: number }[]
  snapshots: Record<string, { total: number; crypto: number }>
  lang: string
  L: StatsLabel
}

// ---- helpers ----------------------------------------------------------------

const PALETTE_LIMIT = 8

function currencyOf(ctx: StatsContext, accountId: string): CurrencyCode {
  return ctx.accounts.find((a) => a.id === accountId)?.currency ?? 'USD'
}

function toMain(ctx: StatsContext, amount: number, currency: CurrencyCode): number {
  return convert(amount, currency, ctx.main, ctx.rates)
}

function evMain(ctx: StatsContext, ev: LedgerEvent): number {
  return toMain(ctx, ev.amount, currencyOf(ctx, ev.accountId))
}

function accountName(ctx: StatsContext, id: string | null): string {
  return ctx.accounts.find((a) => a.id === id)?.name ?? '?'
}

function fmt(ctx: StatsContext, n: number): string {
  return `${Math.round(n).toLocaleString(localeOf(ctx.lang))} ${new Intl.NumberFormat('en', { style: 'currency', currency: ctx.main }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? ctx.main}`
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

export function periodMonths(ctx: StatsContext, period: Period): string[] {
  const count = period === 'month' ? 1 : period === '3m' ? 3 : period === '6m' ? 6 : period === '12m' ? 12 : 0
  if (count > 0) return Array.from({ length: count }, (_, i) => shiftMonth(ctx.month, i - count + 1))
  const first = ctx.events.map((e) => monthOf(e.date)).sort()[0] ?? ctx.month
  const months: string[] = []
  for (let m = first; m <= ctx.month && months.length < 60; m = shiftMonth(m, 1)) months.push(m)
  return months.length > 0 ? months : [ctx.month]
}

function daysIn(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function monthShort(ctx: StatsContext, month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString(localeOf(ctx.lang), { month: 'short' }).replace('.', '')
}

interface Buckets {
  keys: string[]
  labels: string[]
  keyOf: (date: string) => string
}

/** Days for a single month, months otherwise. */
function buckets(ctx: StatsContext, w: FinWidgetConfig): Buckets {
  const months = periodMonths(ctx, w.period as Period)
  if (w.period === 'month') {
    const month = months[0]
    const keys = Array.from({ length: daysIn(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
    return { keys, labels: keys.map((k) => String(Number(k.slice(8)))), keyOf: (d) => d }
  }
  return { keys: months, labels: months.map((m) => monthShort(ctx, m)), keyOf: (d) => monthOf(d) }
}

function scoped(ctx: StatsContext, w: FinWidgetConfig, types: LedgerEvent['type'][]): LedgerEvent[] {
  const months = new Set(periodMonths(ctx, w.period as Period))
  return ctx.events.filter(
    (e) =>
      e.confirmed &&
      types.includes(e.type) &&
      months.has(monthOf(e.date)) &&
      (!w.accountId || e.accountId === w.accountId || e.toAccountId === w.accountId)
  )
}

function groupSum(items: LedgerEvent[], key: (e: LedgerEvent) => string, value: (e: LedgerEvent) => number): Map<string, number> {
  const out = new Map<string, number>()
  for (const e of items) out.set(key(e), (out.get(key(e)) ?? 0) + value(e))
  return out
}

function toParts(ctx: StatsContext, map: Map<string, number>, top = PALETTE_LIMIT): Part[] {
  const sorted = [...map.entries()].filter(([, v]) => v !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const head = sorted.slice(0, top).map(([name, value]) => ({ name, value: round(value) }))
  const rest = sorted.slice(top).reduce((s, [, v]) => s + v, 0)
  return rest !== 0 ? [...head, { name: ctx.L('d.other'), value: round(rest) }] : head
}

function sumBy(items: LedgerEvent[], b: Buckets, value: (e: LedgerEvent) => number): number[] {
  const out = b.keys.map(() => 0)
  const index = new Map(b.keys.map((k, i) => [k, i]))
  for (const e of items) {
    const i = index.get(b.keyOf(e.date))
    if (i !== undefined) out[i] += value(e)
  }
  return out.map(round)
}

function pctChange(now: number, before: number): number | null {
  return before > 0 ? ((now - before) / before) * 100 : null
}

function previousWindow(ctx: StatsContext, w: FinWidgetConfig): StatsContext {
  const n = periodMonths(ctx, w.period as Period).length
  return { ...ctx, month: shiftMonth(ctx.month, -n) }
}

const categoryOf = (ctx: StatsContext) => (e: LedgerEvent) => e.category || ctx.L('d.noCategory')

function totalFor(ctx: StatsContext, w: FinWidgetConfig, type: 'income' | 'expense'): number {
  return scoped(ctx, w, [type]).reduce((s, e) => s + evMain(ctx, e), 0)
}

function kpi(ctx: StatsContext, w: FinWidgetConfig, kind: 'income' | 'expense' | 'result'): MetricResult {
  const b = buckets(ctx, w)
  const inc = sumBy(scoped(ctx, w, ['income']), b, (e) => evMain(ctx, e))
  const exp = sumBy(scoped(ctx, w, ['expense']), b, (e) => evMain(ctx, e))
  const series = kind === 'income' ? inc : kind === 'expense' ? exp : inc.map((v, i) => round(v - exp[i]))
  const sum = (x: number[]): number => x.reduce((s, v) => s + v, 0)
  const prevCtx = previousWindow(ctx, w)
  const prevInc = totalFor(prevCtx, w, 'income')
  const prevExp = totalFor(prevCtx, w, 'expense')
  const prev = kind === 'income' ? prevInc : kind === 'expense' ? prevExp : prevInc - prevExp
  const name = ctx.L(`d.${kind === 'result' ? 'result' : kind}`)
  return {
    value: { value: round(sum(series)), format: 'money', delta: kind === 'result' ? null : pctChange(sum(series), prev), spark: series },
    series: { labels: b.labels, series: [{ key: kind, name, values: series }] }
  }
}

// ---- metrics ----------------------------------------------------------------

type Compute = (ctx: StatsContext, w: FinWidgetConfig) => MetricResult

const COMPUTE: Record<string, Compute> = {
  expense_by_category: (ctx, w) => {
    const items = scoped(ctx, w, ['expense'])
    const parts = toParts(ctx, groupSum(items, categoryOf(ctx), (e) => evMain(ctx, e)))
    return {
      parts,
      table: {
        columns: [{ label: ctx.L('d.category') }, { label: ctx.L('d.amount'), align: 'right' }],
        rows: parts.map((p) => [p.name, fmt(ctx, p.value)])
      }
    }
  },

  category_by_month: (ctx, w) => {
    const items = scoped(ctx, w, ['expense'])
    const b = buckets(ctx, w)
    const top = toParts(ctx, groupSum(items, categoryOf(ctx), (e) => evMain(ctx, e)), 5).map((p) => p.name)
    const other = ctx.L('d.other')
    const byName = new Map<string, LedgerEvent[]>()
    for (const e of items) {
      const c = categoryOf(ctx)(e)
      const key = top.includes(c) ? c : other
      byName.set(key, [...(byName.get(key) ?? []), e])
    }
    return {
      series: {
        labels: b.labels,
        series: [...byName.entries()].map(([name, evs]) => ({ key: name, name, values: sumBy(evs, b, (e) => evMain(ctx, e)) }))
      }
    }
  },

  category_trend: (ctx, w) => {
    const sumFor = (month: string): Map<string, number> =>
      groupSum(
        ctx.events.filter(
          (e) => e.confirmed && e.type === 'expense' && monthOf(e.date) === month && (!w.accountId || e.accountId === w.accountId)
        ),
        categoryOf(ctx),
        (e) => evMain(ctx, e)
      )
    const now = sumFor(ctx.month)
    const prev = sumFor(shiftMonth(ctx.month, -1))
    const older = [2, 3, 4].map((n) => sumFor(shiftMonth(ctx.month, -n)))
    const names = new Set([...now.keys(), ...prev.keys()])
    const rows = [...names]
      .map((name) => {
        const a = now.get(name) ?? 0
        const p = prev.get(name) ?? 0
        const avg = ([prev, ...older].reduce((s, m) => s + (m.get(name) ?? 0), 0)) / 4
        return { name, a, p, avg, change: pctChange(a, p) }
      })
      .filter((r) => r.a > 0 || r.p > 0)
      .sort((x, y) => Math.max(y.a, y.p) - Math.max(x.a, x.p))
      .slice(0, 12)
    return {
      parts: rows.filter((r) => r.change !== null).map((r) => ({ name: r.name, value: round(r.change as number) })),
      table: {
        columns: [
          { label: ctx.L('d.category') },
          { label: ctx.L('d.thisPeriod'), align: 'right' },
          { label: ctx.L('d.prevPeriod'), align: 'right' },
          { label: ctx.L('d.avg3'), align: 'right' },
          { label: ctx.L('d.change'), align: 'right' }
        ],
        rows: rows.map((r) => [
          r.name,
          fmt(ctx, r.a),
          fmt(ctx, r.p),
          fmt(ctx, r.avg),
          r.change === null ? '—' : `${r.change > 0 ? '▲' : r.change < 0 ? '▼' : ''} ${Math.round(Math.abs(r.change))}%`
        ])
      }
    }
  },

  top_expenses: (ctx, w) => {
    const top = scoped(ctx, w, ['expense'])
      .map((e) => ({ e, v: evMain(ctx, e) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 10)
    return {
      parts: top.map(({ e, v }) => ({ name: e.title || e.category || '—', value: round(v) })),
      table: {
        columns: [
          { label: ctx.L('d.date') },
          { label: ctx.L('d.title') },
          { label: ctx.L('d.category') },
          { label: ctx.L('d.amount'), align: 'right' }
        ],
        rows: top.map(({ e, v }) => [e.date.slice(5).split('-').reverse().join('.'), e.title || '—', e.category || '—', fmt(ctx, v)])
      }
    }
  },

  avg_check: (ctx, w) => {
    const items = scoped(ctx, w, ['expense'])
    const b = buckets(ctx, w)
    const sums = sumBy(items, b, (e) => evMain(ctx, e))
    const counts = sumBy(items, b, () => 1)
    const avgs = sums.map((s, i) => (counts[i] > 0 ? round(s / counts[i]) : 0))
    const total = sums.reduce((s, v) => s + v, 0)
    const n = counts.reduce((s, v) => s + v, 0)
    return {
      value: { value: n > 0 ? round(total / n) : 0, format: 'money', spark: avgs },
      series: { labels: b.labels, series: [{ key: 'avg', name: ctx.L('m.avg_check'), values: avgs }] },
      note: `${ctx.L('d.count')}: ${n}`
    }
  },

  expense_by_weekday: (ctx, w) => {
    const items = scoped(ctx, w, ['expense'])
    const weekday = (d: string): number => (new Date(d + 'T12:00:00').getDay() + 6) % 7
    const names = Array.from({ length: 7 }, (_, i) =>
      new Date(2024, 0, 1 + i, 12).toLocaleString(localeOf(ctx.lang), { weekday: 'short' })
    )
    const totals = Array(7).fill(0) as number[]
    const b = buckets(ctx, w)
    const weekCols = w.period === 'month' ? 5 : b.keys.length
    const cells = Array.from({ length: 7 }, () => Array(weekCols).fill(0) as number[])
    for (const e of items) {
      const v = evMain(ctx, e)
      const wd = weekday(e.date)
      totals[wd] += v
      const col = w.period === 'month' ? Math.min(4, Math.floor((Number(e.date.slice(8)) - 1) / 7)) : b.keys.indexOf(monthOf(e.date))
      if (col >= 0) cells[wd][col] += v
    }
    return {
      parts: names.map((name, i) => ({ name, value: round(totals[i]) })),
      heat: {
        yLabels: names,
        xLabels: w.period === 'month' ? ['1', '2', '3', '4', '5'] : b.labels,
        cells: cells.map((row) => row.map(round))
      }
    }
  },

  expense_by_account: (ctx, w) => ({
    parts: toParts(ctx, groupSum(scoped(ctx, { ...w, accountId: null }, ['expense']), (e) => accountName(ctx, e.accountId), (e) => evMain(ctx, e)))
  }),

  small_share: (ctx, w) => {
    const items = scoped(ctx, w, ['expense'])
    const small = (e: LedgerEvent): boolean => e.amount < 100
    const smallSum = items.filter(small).reduce((s, e) => s + evMain(ctx, e), 0)
    const total = items.reduce((s, e) => s + evMain(ctx, e), 0)
    const b = buckets(ctx, w)
    const smallBy = sumBy(items.filter(small), b, (e) => evMain(ctx, e))
    const allBy = sumBy(items, b, (e) => evMain(ctx, e))
    const share = allBy.map((v, i) => (v > 0 ? round((smallBy[i] / v) * 100) : 0))
    return {
      value: { value: total > 0 ? round((smallSum / total) * 100) : 0, format: 'percent', spark: share },
      parts: [
        { name: ctx.L('d.small'), value: round(smallSum) },
        { name: ctx.L('d.large'), value: round(total - smallSum) }
      ],
      series: { labels: b.labels, series: [{ key: 'share', name: ctx.L('m.small_share'), values: share }] },
      note: `${items.filter(small).length} / ${items.length}`
    }
  },

  expense_forecast: (ctx, w) => {
    const month = ctx.month
    const isCurrent = monthOf(ctx.today) === month
    const total = daysIn(month)
    const elapsed = isCurrent ? Number(ctx.today.slice(8)) : total
    const items = ctx.events.filter(
      (e) => e.confirmed && e.type === 'expense' && monthOf(e.date) === month && (!w.accountId || e.accountId === w.accountId)
    )
    const perDay = Array(total).fill(0) as number[]
    for (const e of items) perDay[Number(e.date.slice(8)) - 1] += evMain(ctx, e)
    let running = 0
    const cumulative = perDay.map((v) => (running += v))
    const spent = cumulative[elapsed - 1] ?? 0
    const forecast = isCurrent && elapsed > 0 ? (spent / elapsed) * total : spent
    const labels = Array.from({ length: total }, (_, i) => String(i + 1))
    return {
      value: { value: round(forecast), format: 'money', delta: null },
      series: {
        labels,
        series: [
          { key: 'actual', name: ctx.L('d.actual'), values: cumulative.map((v, i) => (i < elapsed ? round(v) : null)) },
          {
            key: 'forecast',
            name: ctx.L('d.forecast'),
            values: cumulative.map((_, i) => (i >= elapsed - 1 && isCurrent ? round(spent + ((forecast - spent) * (i - (elapsed - 1))) / Math.max(1, total - elapsed)) : null))
          }
        ]
      },
      note: isCurrent ? undefined : ctx.L('d.forecastNote')
    }
  },

  income_by_category: (ctx, w) => ({
    parts: toParts(ctx, groupSum(scoped(ctx, w, ['income']), categoryOf(ctx), (e) => evMain(ctx, e)))
  }),

  income_sources: (ctx, w) => {
    const items = scoped(ctx, w, ['income'])
    const who = (e: LedgerEvent): string =>
      ctx.counterparties.find((c) => c.id === e.counterpartyId)?.name ?? (e.title.split(' — ')[0] || ctx.L('d.noCategory'))
    const parts = toParts(ctx, groupSum(items, who, (e) => evMain(ctx, e)))
    return {
      parts,
      table: {
        columns: [{ label: ctx.L('d.title') }, { label: ctx.L('d.amount'), align: 'right' }],
        rows: parts.map((p) => [p.name, fmt(ctx, p.value)])
      }
    }
  },

  income_trend: (ctx, w) => {
    const b = buckets(ctx, w)
    const inc = sumBy(scoped(ctx, w, ['income']), b, (e) => evMain(ctx, e))
    const avg = inc.map((_, i) => {
      const win = inc.slice(Math.max(0, i - 2), i + 1)
      return round(win.reduce((s, v) => s + v, 0) / win.length)
    })
    return {
      series: {
        labels: b.labels,
        series: [
          { key: 'income', name: ctx.L('d.income'), values: inc },
          { key: 'avg', name: ctx.L('d.movingAvg'), values: avg }
        ]
      }
    }
  },

  transfer_flows: (ctx, w) => {
    const items = scoped(ctx, { ...w, accountId: null }, ['transfer'])
    const pairs = new Map<string, number>()
    for (const e of items) {
      const key = `${e.accountId}|${e.toAccountId}`
      pairs.set(key, (pairs.get(key) ?? 0) + evMain(ctx, e))
    }
    const sources: string[] = []
    const targets: string[] = []
    const links: FlowData['links'] = []
    for (const [key, value] of pairs) {
      const [from, to] = key.split('|')
      let s = sources.indexOf(from)
      if (s < 0) s = sources.push(from) - 1
      let t = targets.indexOf(to)
      if (t < 0) t = targets.push(to) - 1
      links.push({ source: s, target: sources.length + t, value: round(value) })
    }
    // Sources and targets are separate node columns, so back-and-forth transfers never form a cycle.
    const fixed = links.map((l) => ({ ...l, target: l.target - 0 }))
    return {
      flows: { nodes: [...sources, ...targets].map((id) => accountName(ctx, id)), links: fixed },
      table: {
        columns: [{ label: ctx.L('d.fromTo') }, { label: ctx.L('d.amount'), align: 'right' }],
        rows: [...pairs.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([key, v]) => {
            const [from, to] = key.split('|')
            return [`${accountName(ctx, from)} → ${accountName(ctx, to)}`, fmt(ctx, v)]
          })
      }
    }
  },

  account_net_flow: (ctx, w) => {
    const months = new Set(periodMonths(ctx, w.period as Period))
    const net = new Map<string, number>()
    const add = (id: string | null, v: number): void => {
      if (id) net.set(accountName(ctx, id), (net.get(accountName(ctx, id)) ?? 0) + v)
    }
    for (const e of ctx.events) {
      if (!e.confirmed || !months.has(monthOf(e.date)) || e.crypto) continue
      if (e.type === 'income') add(e.accountId, evMain(ctx, e))
      else if (e.type === 'expense') add(e.accountId, -evMain(ctx, e))
      else {
        add(e.accountId, -evMain(ctx, e))
        add(e.toAccountId, toMain(ctx, e.toAmount ?? e.amount, currencyOf(ctx, e.toAccountId ?? '')))
      }
    }
    const parts = [...net.entries()].map(([name, value]) => ({ name, value: round(value) })).sort((a, b) => b.value - a.value)
    return {
      parts,
      table: {
        columns: [{ label: ctx.L('d.account') }, { label: ctx.L('d.amount'), align: 'right' }],
        rows: parts.map((p) => [p.name, fmt(ctx, p.value)])
      }
    }
  },

  fx_conversions: (ctx, w) => {
    const items = scoped(ctx, { ...w, accountId: null }, ['transfer'])
      .filter((e) => e.toAccountId && currencyOf(ctx, e.accountId) !== currencyOf(ctx, e.toAccountId))
      .sort((a, b) => a.date.localeCompare(b.date))
    const rate = (e: LedgerEvent): number => (e.toAmount ?? e.amount) / e.amount
    return {
      table: {
        columns: [
          { label: ctx.L('d.date') },
          { label: ctx.L('d.fromTo') },
          { label: ctx.L('d.amount'), align: 'right' },
          { label: ctx.L('d.rate'), align: 'right' }
        ],
        rows: items.map((e) => [
          e.date.slice(5).split('-').reverse().join('.'),
          `${currencyOf(ctx, e.accountId)} → ${currencyOf(ctx, e.toAccountId ?? '')}`,
          `${e.amount} → ${e.toAmount ?? e.amount}`,
          round(rate(e) * 10000) / 10000
        ])
      },
      series: {
        labels: items.map((e) => e.date.slice(5).split('-').reverse().join('.')),
        series: [{ key: 'rate', name: ctx.L('d.rate'), values: items.map((e) => round(rate(e) * 10000) / 10000) }]
      }
    }
  },

  savings_transfers: (ctx, w) => {
    const savingsIds = new Set(ctx.accounts.filter((a) => a.group === 'savings').map((a) => a.id))
    const b = buckets(ctx, w)
    const items = scoped(ctx, { ...w, accountId: null }, ['transfer']).filter((e) => e.toAccountId && savingsIds.has(e.toAccountId))
    const per = sumBy(items, b, (e) => toMain(ctx, e.toAmount ?? e.amount, currencyOf(ctx, e.toAccountId ?? '')))
    let run = 0
    return {
      series: {
        labels: b.labels,
        series: [
          { key: 'per', name: ctx.L('d.amount'), values: per },
          { key: 'cum', name: ctx.L('d.cumulative'), values: per.map((v) => round((run += v))) }
        ]
      }
    }
  },

  kpi_income: (ctx, w) => kpi(ctx, w, 'income'),
  kpi_expense: (ctx, w) => kpi(ctx, w, 'expense'),
  kpi_result: (ctx, w) => kpi(ctx, w, 'result'),

  savings_rate: (ctx, w) => {
    const b = buckets(ctx, w)
    const inc = sumBy(scoped(ctx, w, ['income']), b, (e) => evMain(ctx, e))
    const exp = sumBy(scoped(ctx, w, ['expense']), b, (e) => evMain(ctx, e))
    const rates = inc.map((v, i) => (v > 0 ? round(((v - exp[i]) / v) * 100) : 0))
    const ti = inc.reduce((s, v) => s + v, 0)
    const te = exp.reduce((s, v) => s + v, 0)
    return {
      value: { value: ti > 0 ? round(((ti - te) / ti) * 100) : 0, format: 'percent', spark: rates },
      series: { labels: b.labels, series: [{ key: 'rate', name: ctx.L('m.savings_rate'), values: rates }] }
    }
  },

  income_expense: (ctx, w) => {
    const b = buckets(ctx, w)
    return {
      series: {
        labels: b.labels,
        series: [
          { key: 'income', name: ctx.L('d.income'), values: sumBy(scoped(ctx, w, ['income']), b, (e) => evMain(ctx, e)) },
          { key: 'expense', name: ctx.L('d.expense'), values: sumBy(scoped(ctx, w, ['expense']), b, (e) => evMain(ctx, e)) }
        ]
      }
    }
  },

  cashflow: (ctx, w) => {
    const b = buckets(ctx, w)
    const inc = sumBy(scoped(ctx, w, ['income']), b, (e) => evMain(ctx, e))
    const exp = sumBy(scoped(ctx, w, ['expense']), b, (e) => evMain(ctx, e))
    const result = inc.map((v, i) => round(v - exp[i]))
    let run = 0
    return {
      series: {
        labels: b.labels,
        series: [
          { key: 'result', name: ctx.L('d.result'), values: result },
          { key: 'cum', name: ctx.L('d.cumulative'), values: result.map((v) => round((run += v))) }
        ]
      }
    }
  },

  net_worth: (ctx, w) => {
    const months = new Set(periodMonths(ctx, w.period as Period))
    const live = ctx.accounts.reduce((s, a) => s + toMain(ctx, a.balance, a.currency), 0)
    const dates = Object.keys(ctx.snapshots).filter((d) => months.has(monthOf(d))).sort()
    const points = dates.map((d) => ({ label: d.slice(5).split('-').reverse().join('.'), v: ctx.snapshots[d].total }))
    if (monthOf(ctx.today) === ctx.month && !dates.includes(ctx.today)) points.push({ label: ctx.today.slice(5).split('-').reverse().join('.'), v: live })
    return {
      value: { value: round(live), format: 'money', spark: points.map((p) => p.v) },
      series: { labels: points.map((p) => p.label), series: [{ key: 'nw', name: ctx.L('m.net_worth'), values: points.map((p) => round(p.v)) }] },
      note: points.length < 2 ? ctx.L('d.noHistory') : undefined
    }
  },

  asset_structure: (ctx) => ({
    parts: toParts(
      ctx,
      new Map(ctx.accounts.filter((a) => a.balance > 0).map((a) => [a.name, toMain(ctx, a.balance, a.currency)]))
    )
  }),

  runway: (ctx) => {
    const liquid = ctx.accounts.filter((a) => a.group === 'checking').reduce((s, a) => s + toMain(ctx, a.balance, a.currency), 0)
    const months = [0, 1, 2].map((n) => shiftMonth(ctx.month, -n))
    const spent = ctx.events
      .filter((e) => e.confirmed && e.type === 'expense' && months.includes(monthOf(e.date)))
      .reduce((s, e) => s + evMain(ctx, e), 0)
    const avg = spent / 3
    return { value: { value: avg > 0 ? round(liquid / avg) : 0, format: 'months', target: 6 } }
  },

  yoy_expense: (ctx) => {
    const year = Number(ctx.month.slice(0, 4))
    const perYear = (y: number): number[] => {
      const out = Array(12).fill(0) as number[]
      for (const e of ctx.events) {
        if (e.confirmed && e.type === 'expense' && e.date.startsWith(String(y))) out[Number(e.date.slice(5, 7)) - 1] += evMain(ctx, e)
      }
      return out.map(round)
    }
    return {
      series: {
        labels: Array.from({ length: 12 }, (_, i) => monthShort(ctx, `${year}-${String(i + 1).padStart(2, '0')}`)),
        series: [
          { key: 'cur', name: `${ctx.L('d.thisYear')} ${year}`, values: perYear(year) },
          { key: 'prev', name: `${ctx.L('d.prevYear')} ${year - 1}`, values: perYear(year - 1) }
        ]
      }
    }
  },

  annual_summary: (ctx) => {
    const year = ctx.month.slice(0, 4)
    const rows = Array.from({ length: 12 }, (_, i) => {
      const m = `${year}-${String(i + 1).padStart(2, '0')}`
      const inMonth = ctx.events.filter((e) => e.confirmed && monthOf(e.date) === m)
      const inc = inMonth.filter((e) => e.type === 'income').reduce((s, e) => s + evMain(ctx, e), 0)
      const exp = inMonth.filter((e) => e.type === 'expense').reduce((s, e) => s + evMain(ctx, e), 0)
      return [monthShort(ctx, m), fmt(ctx, inc), fmt(ctx, exp), fmt(ctx, inc - exp), inc > 0 ? `${Math.round(((inc - exp) / inc) * 100)}%` : '—']
    })
    return {
      table: {
        columns: [
          { label: year },
          { label: ctx.L('d.income'), align: 'right' },
          { label: ctx.L('d.expense'), align: 'right' },
          { label: ctx.L('d.result'), align: 'right' },
          { label: '%', align: 'right' }
        ],
        rows
      }
    }
  },

  subs_cost: (ctx) => {
    const active = ctx.subscriptions.filter((s) => s.active)
    const parts = active.map((s) => ({ name: s.title, value: round(monthlyCost(s, ctx.accounts, ctx.rates, ctx.main)) })).sort((a, b) => b.value - a.value)
    return { parts, value: { value: round(parts.reduce((s, p) => s + p.value, 0)), format: 'money' }, note: ctx.L('d.perMonth') }
  },

  subs_share: (ctx) => {
    const cost = ctx.subscriptions.filter((s) => s.active).reduce((s, sub) => s + monthlyCost(sub, ctx.accounts, ctx.rates, ctx.main), 0)
    const months = [0, 1, 2].map((n) => shiftMonth(ctx.month, -n))
    const income = ctx.events.filter((e) => e.confirmed && e.type === 'income' && months.includes(monthOf(e.date))).reduce((s, e) => s + evMain(ctx, e), 0) / 3
    return { value: { value: income > 0 ? round((cost / income) * 100) : 0, format: 'percent', target: 10 } }
  },

  subs_upcoming: (ctx) => {
    const end = addDays(ctx.today, 30)
    const items = ctx.events
      .filter((e) => e.subscriptionId && !e.confirmed && e.date >= ctx.today && e.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date))
    return {
      table: {
        columns: [{ label: ctx.L('d.date') }, { label: ctx.L('d.title') }, { label: ctx.L('d.amount'), align: 'right' }],
        rows: items.map((e) => [e.date.slice(5).split('-').reverse().join('.'), e.title, fmt(ctx, evMain(ctx, e))])
      }
    }
  },

  subs_forgotten: (ctx) => {
    const rows = ctx.subscriptions
      .filter((s) => s.active)
      .map((s) => {
        const paid = ctx.events.filter((e) => e.subscriptionId === s.id && e.confirmed).map((e) => e.date).sort().pop() ?? null
        return { s, paid }
      })
      .filter(({ s, paid }) => {
        const gap = s.every === 'week' ? 12 : s.every === 'month' ? 50 : 400
        return !paid || paid < addDays(ctx.today, -gap)
      })
    return {
      table: {
        columns: [{ label: ctx.L('d.title') }, { label: ctx.L('d.lastPaid') }, { label: ctx.L('d.perMonth'), align: 'right' }],
        rows: rows.map(({ s, paid }) => [s.title, paid ?? ctx.L('d.never'), fmt(ctx, monthlyCost(s, ctx.accounts, ctx.rates, ctx.main))])
      }
    }
  },

  crypto_share: (ctx) => ({
    parts: toParts(
      ctx,
      ctx.holdings.reduce((m, h) => {
        const usd = h.amount * (ctx.prices[h.ticker] ?? 0)
        return usd > 0 ? m.set(h.ticker, (m.get(h.ticker) ?? 0) + toMain(ctx, usd, 'USD')) : m
      }, new Map<string, number>())
    )
  }),

  portfolio_history: (ctx, w) => {
    const months = new Set(periodMonths(ctx, w.period as Period))
    const dates = Object.keys(ctx.snapshots).filter((d) => months.has(monthOf(d))).sort()
    return {
      series: {
        labels: dates.map((d) => d.slice(5).split('-').reverse().join('.')),
        series: [{ key: 'crypto', name: ctx.L('m.portfolio_history'), values: dates.map((d) => round(ctx.snapshots[d].crypto)) }]
      },
      note: dates.length < 2 ? ctx.L('d.noHistory') : undefined
    }
  },

  review_count: (ctx) => {
    const items = ctx.events.filter((e) => e.review)
    return {
      value: { value: items.length, format: 'number' },
      table: {
        columns: [{ label: ctx.L('d.date') }, { label: ctx.L('d.title') }, { label: ctx.L('d.amount'), align: 'right' }],
        rows: items.slice(0, 30).map((e) => [e.date.slice(5).split('-').reverse().join('.'), e.title || '—', fmt(ctx, evMain(ctx, e))])
      }
    }
  },

  uncategorized: (ctx, w) => {
    const items = scoped(ctx, w, ['expense', 'income'])
    const without = items.filter((e) => !e.category).length
    return {
      value: { value: items.length > 0 ? round((without / items.length) * 100) : 0, format: 'percent' },
      parts: [
        { name: ctx.L('d.noCategory'), value: without },
        { name: ctx.L('d.large'), value: items.length - without }
      ]
    }
  },

  overdue_planned: (ctx) => {
    const items = ctx.events.filter((e) => !e.confirmed && e.date < ctx.today).sort((a, b) => a.date.localeCompare(b.date))
    return {
      table: {
        columns: [{ label: ctx.L('d.date') }, { label: ctx.L('d.title') }, { label: ctx.L('d.amount'), align: 'right' }],
        rows: items.slice(0, 40).map((e) => [e.date.slice(5).split('-').reverse().join('.'), e.title || '—', fmt(ctx, evMain(ctx, e))])
      }
    }
  }
}

export function computeMetric(ctx: StatsContext, w: FinWidgetConfig): MetricResult {
  const fn = COMPUTE[w.metric]
  if (!fn) return {}
  try {
    return fn(ctx, w)
  } catch {
    return {}
  }
}

export function formatValue(ctx: Pick<StatsContext, 'main' | 'lang' | 'L'>, v: ValueData): string {
  if (v.format === 'percent') return `${Math.round(v.value)}%`
  if (v.format === 'months') return `${v.value.toLocaleString(localeOf(ctx.lang), { maximumFractionDigits: 1 })} ${ctx.L('d.months')}`
  if (v.format === 'number') return String(Math.round(v.value))
  const symbol = new Intl.NumberFormat('en', { style: 'currency', currency: ctx.main }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? ctx.main
  return `${Math.round(v.value).toLocaleString(localeOf(ctx.lang))} ${symbol}`
}

// ---- defaults ---------------------------------------------------------------

let counter = 0
export function widgetId(): string {
  counter += 1
  return `w${Date.now().toString(36)}${counter}`
}

export function defaultWidgets(): FinWidgetConfig[] {
  const mk = (metric: string, chart: ChartType, period: Period, x: number, y: number, w: number, h: number): FinWidgetConfig => ({
    id: widgetId(),
    metric,
    chart,
    period,
    accountId: null,
    title: '',
    x,
    y,
    w,
    h
  })
  return [
    mk('kpi_income', 'tile', 'month', 0, 0, 3, 2),
    mk('kpi_expense', 'tile', 'month', 3, 0, 3, 2),
    mk('kpi_result', 'tile', 'month', 6, 0, 3, 2),
    mk('savings_rate', 'tile', 'month', 9, 0, 3, 2),
    mk('income_expense', 'bar', '6m', 0, 2, 8, 4),
    mk('expense_by_category', 'donut', 'month', 8, 2, 4, 4),
    mk('category_trend', 'diverging', 'month', 0, 6, 6, 4),
    mk('top_expenses', 'table', 'month', 6, 6, 6, 4),
    mk('net_worth', 'area', '12m', 0, 10, 6, 4),
    mk('subs_cost', 'hbar', 'month', 6, 10, 3, 4),
    mk('subs_upcoming', 'table', 'month', 9, 10, 3, 4)
  ]
}
