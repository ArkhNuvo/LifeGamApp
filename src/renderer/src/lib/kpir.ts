import { convert } from './currency'
import { monthOf, type LedgerAccount } from './ledger'
import type { MonthFigures } from './polishTax'
import type { CurrencyCode, Firm, KpirColumn, LedgerEvent, LedgerItem } from './types'

/** Columns a line can be booked in, with their official KPiR headings. */
export const KPIR_COLUMNS: { id: BookColumn; label: string; side: 'revenue' | 'cost' }[] = [
  { id: '7', label: 'Wartość sprzedanych towarów i usług', side: 'revenue' },
  { id: '8', label: 'Pozostałe przychody', side: 'revenue' },
  { id: '10', label: 'Zakup towarów handlowych i materiałów', side: 'cost' },
  { id: '11', label: 'Koszty uboczne zakupu', side: 'cost' },
  { id: '12', label: 'Wynagrodzenia w gotówce i w naturze', side: 'cost' },
  { id: '13', label: 'Pozostałe wydatki', side: 'cost' },
  { id: '16', label: 'Koszty działalności badawczo-rozwojowej', side: 'cost' }
]

export const VAT_RATES: (number | null)[] = [23, 8, 5, 0, null]

/** The owner's own ZUS, income tax and VAT payments are settled outside the book. */
const OUTSIDE_BOOK = /zus|składk|skladk|zaliczk|pit-|pit|podatek dochodow|vat-7|jpk|urząd skarbowy|urzad skarbowy/i

export function defaultColumn(type: LedgerEvent['type'], ev?: Pick<LedgerEvent, 'title' | 'category'>): KpirColumn {
  if (ev && type === 'expense' && OUTSIDE_BOOK.test(`${ev.title} ${ev.category}`)) return '-'
  return type === 'income' ? '7' : '13'
}

type BookColumn = Exclude<KpirColumn, '-'>

export interface KpirRow {
  lp: number
  eventId: string
  date: string
  docNumber: string
  counterparty: string
  address: string
  description: string
  cols: Record<BookColumn, number>
  /** Column 9: total revenue (7 + 8). */
  revenue: number
  /** Column 14: 12 + 13. */
  expenses: number
  vat: number
  /** The event has no lines of its own — it was booked in its default column. */
  defaulted: boolean
  /** Nothing of it goes into the book (e.g. the owner's ZUS payment). */
  outside: boolean
}

const emptyCols = (): Record<BookColumn, number> => ({ '7': 0, '8': 0, '10': 0, '11': 0, '12': 0, '13': 0, '16': 0 })
const r2 = (n: number): number => Math.round(n * 100) / 100

export interface KpirContext {
  accounts: LedgerAccount[]
  rates: Record<string, number> | null
  vatPayer: boolean
}

function toPln(ctx: KpirContext, amount: number, accountId: string): number {
  const currency: CurrencyCode = ctx.accounts.find((a) => a.id === accountId)?.currency ?? 'PLN'
  return convert(amount, currency, 'PLN', ctx.rates)
}

/** The lines of an event as booked: its own lines, or one line in the default column. */
export function bookedItems(ev: LedgerEvent): { items: LedgerItem[]; defaulted: boolean } {
  if (ev.items && ev.items.length > 0) return { items: ev.items, defaulted: false }
  return {
    items: [{ id: 'auto', description: ev.title, net: ev.amount, vatRate: null, vat: 0, gross: ev.amount, kpir: defaultColumn(ev.type, ev) }],
    defaulted: true
  }
}

/** Events that belong in the book: confirmed income and expenses (transfers between own accounts don't). */
export function bookable(events: LedgerEvent[]): LedgerEvent[] {
  return events.filter((e) => e.confirmed && e.type !== 'transfer').sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

/** KPiR rows for one year, numbered from 1 in date order. */
export function kpirRows(ctx: KpirContext, events: LedgerEvent[], year: string): KpirRow[] {
  return allRows(ctx, events, year)
    .filter((r) => !r.outside)
    .map((r, i) => ({ ...r, lp: i + 1 }))
}

function allRows(ctx: KpirContext, events: LedgerEvent[], year: string): KpirRow[] {
  return bookable(events)
    .filter((e) => e.date.startsWith(year))
    .map((ev, i): KpirRow => {
      const { items, defaulted } = bookedItems(ev)
      const cols = emptyCols()
      let vat = 0
      for (const item of items) {
        // A VAT payer books net amounts; everyone else the gross ones.
        const amount = toPln(ctx, ctx.vatPayer && !defaulted ? item.net : item.gross, ev.accountId)
        const column = item.kpir ?? defaultColumn(ev.type, ev)
        if (column === '-') continue
        cols[column] += amount
        vat += toPln(ctx, item.vat, ev.accountId)
      }
      for (const k of Object.keys(cols) as BookColumn[]) cols[k] = r2(cols[k])
      return {
        lp: i + 1,
        outside: items.every((it) => (it.kpir ?? defaultColumn(ev.type, ev)) === '-'),
        eventId: ev.id,
        date: ev.date,
        docNumber: ev.doc?.number ?? '',
        counterparty: ev.doc?.counterpartyName ?? '',
        address: [ev.doc?.counterpartyNip ? `NIP ${ev.doc.counterpartyNip}` : '', ev.doc?.counterpartyAddress ?? ''].filter(Boolean).join(', '),
        description: ev.title,
        cols,
        revenue: r2(cols['7'] + cols['8']),
        expenses: r2(cols['12'] + cols['13']),
        vat: r2(vat),
        defaulted
      }
    })
}

export interface KpirTotals {
  cols: Record<BookColumn, number>
  revenue: number
  expenses: number
}

export function totals(rows: KpirRow[]): KpirTotals {
  const cols = emptyCols()
  for (const r of rows) for (const k of Object.keys(cols) as BookColumn[]) cols[k] += r.cols[k]
  for (const k of Object.keys(cols) as BookColumn[]) cols[k] = r2(cols[k])
  return { cols, revenue: r2(cols['7'] + cols['8']), expenses: r2(cols['12'] + cols['13']) }
}

/** All costs of a period: purchases (10, 11) plus expenses (12, 13) plus R&D (16). */
export function allCosts(t: KpirTotals): number {
  return r2(t.cols['10'] + t.cols['11'] + t.cols['12'] + t.cols['13'] + t.cols['16'])
}

/** Revenue, costs, income and VAT of each month of the year — the input of the tax calculation. */
export function monthFigures(ctx: KpirContext, events: LedgerEvent[], year: string): MonthFigures[] {
  const rows = kpirRows(ctx, events, year)
  const out: MonthFigures[] = Array.from({ length: 12 }, () => ({ revenue: 0, costs: 0, income: 0, vatOut: 0, vatIn: 0 }))
  const typeOf = new Map(events.map((e) => [e.id, e.type]))
  for (const r of rows) {
    const m = Number(r.date.slice(5, 7)) - 1
    const t = totals([r])
    out[m].revenue += t.revenue
    out[m].costs += allCosts(t)
    if (typeOf.get(r.eventId) === 'income') out[m].vatOut += r.vat
    else out[m].vatIn += r.vat
  }
  for (const f of out) {
    f.revenue = r2(f.revenue)
    f.costs = r2(f.costs)
    f.income = r2(f.revenue - f.costs)
  }
  return out
}

// ---- RZiS (profit and loss, comparative variant, Załącznik nr 1 UoR, simplified) ----

export type RzisLine =
  | 'A_I'
  | 'A_IV'
  | 'B_I'
  | 'B_II'
  | 'B_III'
  | 'B_IV'
  | 'B_V'
  | 'B_VI'
  | 'B_VII'
  | 'B_VIII'
  | 'D'
  | 'E'
  | 'G'
  | 'H'

export const RZIS_LINES: { id: RzisLine; label: string }[] = [
  { id: 'A_I', label: 'Przychody netto ze sprzedaży produktów (usług)' },
  { id: 'A_IV', label: 'Przychody netto ze sprzedaży towarów i materiałów' },
  { id: 'B_I', label: 'Amortyzacja' },
  { id: 'B_II', label: 'Zużycie materiałów i energii' },
  { id: 'B_III', label: 'Usługi obce' },
  { id: 'B_IV', label: 'Podatki i opłaty' },
  { id: 'B_V', label: 'Wynagrodzenia' },
  { id: 'B_VI', label: 'Ubezpieczenia społeczne i inne świadczenia' },
  { id: 'B_VII', label: 'Pozostałe koszty rodzajowe' },
  { id: 'B_VIII', label: 'Wartość sprzedanych towarów i materiałów' },
  { id: 'D', label: 'Pozostałe przychody operacyjne' },
  { id: 'E', label: 'Pozostałe koszty operacyjne' },
  { id: 'G', label: 'Przychody finansowe' },
  { id: 'H', label: 'Koszty finansowe' }
]

/** Where a booked line lands in the profit and loss account, unless the user chose a line for it. */
export function rzisLineOf(item: LedgerItem, ev: LedgerEvent): RzisLine {
  if (item.rzis) return item.rzis as RzisLine
  const text = `${item.description} ${ev.title} ${ev.category}`.toLowerCase()
  const column = item.kpir ?? defaultColumn(ev.type, ev)
  if (column === '7') return /towar|goods|товар/.test(text) ? 'A_IV' : 'A_I'
  if (column === '8') return /odset|interest|процент|lokat|dywiden/.test(text) ? 'G' : 'D'
  if (column === '10' || column === '11') return 'B_VIII'
  if (column === '12') return 'B_V'
  if (column === '16') return 'B_VII'
  if (/zus|składk|skladk|ubezpiecz|insurance|страхов/.test(text)) return 'B_VI'
  if (/amortyz|depreciat|амортиз/.test(text)) return 'B_I'
  if (/podat|opłat|oplat|urząd|urzad|tax|налог|пошлин/.test(text)) return 'B_IV'
  if (/odset|prowizj|bank|interest|комисс|процент/.test(text)) return 'H'
  if (/paliw|benzyn|diesel|orlen|shell|energi|prąd|prad|gaz|materiał|material|fuel|топлив|бензин/.test(text)) return 'B_II'
  if (/usług|uslug|abonament|subskrypc|subscription|internet|telefon|hosting|serwis|księgow|ksiegow|transport|подпис|услуг|связь/.test(text)) return 'B_III'
  return 'B_VII'
}

export interface RzisReport {
  lines: Record<RzisLine, number>
  A: number
  B: number
  C: number
  F: number
  I: number
  J: number
  L: number
}

/** P&L for events within [from, to] (ISO dates, inclusive). `incomeTax` = the PIT for the period (line J). */
export function rzis(ctx: KpirContext, events: LedgerEvent[], from: string, to: string, incomeTax: number): RzisReport {
  const lines = Object.fromEntries(RZIS_LINES.map((l) => [l.id, 0])) as Record<RzisLine, number>
  for (const ev of bookable(events)) {
    if (ev.date < from || ev.date > to) continue
    const { items, defaulted } = bookedItems(ev)
    for (const item of items) {
      if ((item.kpir ?? defaultColumn(ev.type, ev)) === '-') continue
      const amount = toPln(ctx, ctx.vatPayer && !defaulted ? item.net : item.gross, ev.accountId)
      lines[rzisLineOf(item, ev)] += amount
    }
  }
  for (const k of Object.keys(lines) as RzisLine[]) lines[k] = r2(lines[k])
  const A = r2(lines.A_I + lines.A_IV)
  const B = r2(lines.B_I + lines.B_II + lines.B_III + lines.B_IV + lines.B_V + lines.B_VI + lines.B_VII + lines.B_VIII)
  const C = r2(A - B)
  const F = r2(C + lines.D - lines.E)
  const I = r2(F + lines.G - lines.H)
  const J = r2(incomeTax)
  return { lines, A, B, C, F, I, J, L: r2(I - J) }
}

export function firmMonthsOfYear(firm: Firm, year: string): string[] {
  return [...new Set(firm.ledger.events.filter((e) => e.date.startsWith(year)).map((e) => monthOf(e.date)))].sort()
}
