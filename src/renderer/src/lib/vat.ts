import { convert } from './currency'
import { bookingDate, defaultColumn, type KpirContext } from './kpir'
import type { CurrencyCode, LedgerEvent } from './types'

const r2 = (n: number): number => Math.round(n * 100) / 100

export interface VatByRate {
  /** Rate in percent; null = exempt / not subject (zw / np). */
  rate: number | null
  net: number
  vat: number
}

export interface VatEntry {
  eventId: string
  date: string
  docNumber: string
  counterparty: string
  nip: string
  net: number
  vat: number
  gross: number
}

export interface VatRegister {
  /** Sales register: output VAT (należny). */
  sales: VatEntry[]
  salesByRate: VatByRate[]
  /** Purchase register: input VAT (naliczony). */
  purchases: VatEntry[]
  purchasesByRate: VatByRate[]
  outputVat: number
  inputVat: number
  /** Positive = to pay, negative = excess to carry over / refund. */
  due: number
  /** Events of the period without lines, so without VAT data. */
  missing: number
}

const RATE_ORDER = [23, 8, 5, 0, null]

/**
 * VAT registers of a period (ISO dates, inclusive), built from the lines of
 * confirmed income (sales) and expense (purchase) events. The basis for the
 * JPK_V7 file; the owner's ZUS/PIT/VAT payments carry no VAT and drop out.
 */
export function vatRegister(ctx: KpirContext, events: LedgerEvent[], from: string, to: string): VatRegister {
  const toPln = (amount: number, accountId: string): number => {
    const currency: CurrencyCode = ctx.accounts.find((a) => a.id === accountId)?.currency ?? 'PLN'
    return convert(amount, currency, 'PLN', ctx.rates)
  }
  const sales: VatEntry[] = []
  const purchases: VatEntry[] = []
  const salesRates = new Map<string, VatByRate>()
  const purchaseRates = new Map<string, VatByRate>()
  let missing = 0
  const inPeriod = events
    .filter((e) => e.confirmed && e.type !== 'transfer' && bookingDate(e) >= from && bookingDate(e) <= to)
    .sort((a, b) => bookingDate(a).localeCompare(bookingDate(b)))
  for (const ev of inPeriod) {
    const lines = (ev.items ?? []).filter((it) => it.kpir !== '-')
    if (lines.length === 0) {
      // The owner's ZUS / tax payments carry no VAT, so they aren't "missing" anything.
      if ((!ev.items || ev.items.length === 0) && defaultColumn(ev.type, ev) !== '-') missing += 1
      continue
    }
    const target = ev.type === 'income' ? sales : purchases
    const rates = ev.type === 'income' ? salesRates : purchaseRates
    let net = 0
    let vat = 0
    for (const it of lines) {
      const n = toPln(it.net, ev.accountId)
      const v = toPln(it.vat, ev.accountId)
      net += n
      vat += v
      const key = String(it.vatRate)
      const bucket = rates.get(key) ?? { rate: it.vatRate, net: 0, vat: 0 }
      bucket.net += n
      bucket.vat += v
      rates.set(key, bucket)
    }
    target.push({
      eventId: ev.id,
      date: bookingDate(ev),
      docNumber: ev.doc?.number ?? '',
      counterparty: ev.doc?.counterpartyName ?? ev.title,
      nip: ev.doc?.counterpartyNip ?? '',
      net: r2(net),
      vat: r2(vat),
      gross: r2(net + vat)
    })
  }
  const ordered = (m: Map<string, VatByRate>): VatByRate[] =>
    RATE_ORDER.map((r) => m.get(String(r)))
      .filter((b): b is VatByRate => !!b)
      .map((b) => ({ rate: b.rate, net: r2(b.net), vat: r2(b.vat) }))
  const outputVat = r2(sales.reduce((s, e) => s + e.vat, 0))
  const inputVat = r2(purchases.reduce((s, e) => s + e.vat, 0))
  return {
    sales,
    salesByRate: ordered(salesRates),
    purchases,
    purchasesByRate: ordered(purchaseRates),
    outputVat,
    inputVat,
    due: r2(outputVat - inputVat),
    missing
  }
}

/** VAT amounts printed on the period's documents — for a firm outside VAT, a statistic only. */
export function documentVat(ctx: KpirContext, events: LedgerEvent[], from: string, to: string): number {
  const reg = vatRegister(ctx, events, from, to)
  return r2(reg.inputVat + reg.outputVat)
}
