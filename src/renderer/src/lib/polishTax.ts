import type { FirmTax, TaxParams } from './types'

/**
 * Polish rules for a sole proprietorship (JDG): ZUS, health contribution, PIT
 * advances and VAT. Yearly amounts are defaults that the user can override per
 * year in the firm's tax settings — they change every January.
 */

export const DEFAULT_PARAMS: Record<string, TaxParams> = {
  '2025': {
    minimumWage: 4666,
    zusFullBase: 5203.8,
    zusPreferentialBase: 1399.8,
    healthMin: 314.96,
    healthRyczalt: [461.66, 769.43, 1384.97],
    liniowyHealthDeductionLimit: 12900
  },
  '2026': {
    minimumWage: 4806,
    zusFullBase: 5652,
    zusPreferentialBase: 1441.8,
    healthMin: 324.41,
    healthRyczalt: [498.35, 830.58, 1495.04],
    liniowyHealthDeductionLimit: 14100
  }
}

/** Fixed by statute (percent). */
export const ZUS_RATES = { pension: 19.52, disability: 8, sickness: 2.45, accident: 1.67, labourFund: 2.45 }
export const PIT = {
  skalaThreshold: 120000,
  skalaLow: 12,
  skalaHigh: 32,
  taxReducingAmount: 3600,
  liniowy: 19,
  /** Health contribution rates (percent of income). */
  healthSkala: 9,
  healthLiniowy: 4.9,
  /** Ryczałt revenue tiers for the flat health contribution. */
  ryczaltTiers: [60000, 300000] as const
}
export const VAT_EXEMPTION_LIMIT: Record<string, number> = { '2025': 200000, '2026': 240000 }
export const RYCZALT_RATES = [17, 15, 14, 12, 10, 8.5, 5.5, 3, 2]

export const DEFAULT_TAX: FirmTax = {
  form: 'skala',
  ryczaltRate: 12,
  zus: 'full',
  smallPlusBase: null,
  sickness: true,
  vatPayer: false,
  vatPeriod: 'month',
  params: {}
}

export function paramsFor(tax: FirmTax, year: number): TaxParams {
  const known = Object.keys(DEFAULT_PARAMS).sort()
  const base = DEFAULT_PARAMS[String(year)] ?? DEFAULT_PARAMS[known[known.length - 1]]
  return { ...base, ...(tax.params[String(year)] ?? {}) }
}

const r2 = (n: number): number => Math.round(n * 100) / 100

export interface SocialZus {
  base: number
  pension: number
  disability: number
  sickness: number
  accident: number
  labourFund: number
  /** Deductible part (everything but the Labour Fund). */
  social: number
  total: number
}

/** Monthly social contributions for the firm's ZUS scheme. */
export function socialZus(tax: FirmTax, params: TaxParams): SocialZus {
  const base =
    tax.zus === 'full'
      ? params.zusFullBase
      : tax.zus === 'preferential'
        ? params.zusPreferentialBase
        : tax.zus === 'small_plus'
          ? Math.max(params.zusPreferentialBase, Math.min(params.zusFullBase, tax.smallPlusBase ?? params.zusPreferentialBase))
          : 0
  const pct = (rate: number): number => r2((base * rate) / 100)
  const pension = pct(ZUS_RATES.pension)
  const disability = pct(ZUS_RATES.disability)
  const sickness = tax.sickness && base > 0 ? pct(ZUS_RATES.sickness) : 0
  const accident = pct(ZUS_RATES.accident)
  // The Labour Fund is due only on a base of at least the minimum wage (not on preferential/small bases).
  const labourFund = base >= params.minimumWage ? pct(ZUS_RATES.labourFund) : 0
  const social = r2(pension + disability + sickness + accident)
  return { base, pension, disability, sickness, accident, labourFund, social, total: r2(social + labourFund) }
}

/** Monthly health contribution. `income` = the month's income (revenue for ryczałt: the year's revenue so far). */
export function healthContribution(tax: FirmTax, params: TaxParams, monthIncome: number, yearRevenue: number): number {
  if (tax.form === 'ryczalt') {
    const [low, high] = PIT.ryczaltTiers
    return yearRevenue <= low ? params.healthRyczalt[0] : yearRevenue <= high ? params.healthRyczalt[1] : params.healthRyczalt[2]
  }
  const rate = tax.form === 'liniowy' ? PIT.healthLiniowy : PIT.healthSkala
  return r2(Math.max(params.healthMin, (Math.max(0, monthIncome) * rate) / 100))
}

/** Tax due from the beginning of the year on a cumulative base (before subtracting advances already paid). */
function cumulativeTax(tax: FirmTax, base: number): number {
  if (base <= 0) return 0
  if (tax.form === 'liniowy') return (base * PIT.liniowy) / 100
  if (tax.form === 'ryczalt') return (base * tax.ryczaltRate) / 100
  const low = Math.min(base, PIT.skalaThreshold) * (PIT.skalaLow / 100)
  const high = Math.max(0, base - PIT.skalaThreshold) * (PIT.skalaHigh / 100)
  return Math.max(0, low + high - PIT.taxReducingAmount)
}

export interface MonthFigures {
  revenue: number
  costs: number
  income: number
  vatOut: number
  vatIn: number
}

export interface MonthTax {
  month: string
  revenue: number
  costs: number
  income: number
  social: SocialZus
  health: number
  /** PIT advance for the month, whole złoty. */
  pitAdvance: number
  vat: number
  /** VAT shown on the month's documents (sales + purchases) — a statistic for firms outside VAT. */
  vatInfo: number
  /** Base the advance was computed on, from the start of the year. */
  ytdBase: number
  ytdRevenue: number
  ytdIncome: number
  ytdPit: number
}

/**
 * Month-by-month figures for a year, January to `upTo` (1–12). Contributions are
 * counted for the month they concern (an estimate: the law deducts them when paid).
 */
export function yearTax(tax: FirmTax, year: number, months: MonthFigures[], upTo: number): MonthTax[] {
  const params = paramsFor(tax, year)
  const zus = socialZus(tax, params)
  const out: MonthTax[] = []
  let ytdRevenue = 0
  let ytdIncome = 0
  let ytdSocial = 0
  let ytdHealth = 0
  let paid = 0
  for (let m = 1; m <= upTo; m++) {
    const f = months[m - 1] ?? { revenue: 0, costs: 0, income: 0, vatOut: 0, vatIn: 0 }
    ytdRevenue += f.revenue
    ytdIncome += f.income
    const health = healthContribution(tax, params, f.income, ytdRevenue)
    ytdSocial += zus.social
    ytdHealth += health
    let base: number
    if (tax.form === 'liniowy') base = ytdIncome - ytdSocial - Math.min(ytdHealth, params.liniowyHealthDeductionLimit)
    else if (tax.form === 'ryczalt') base = ytdRevenue - ytdSocial - ytdHealth / 2
    else base = ytdIncome - ytdSocial
    const due = Math.round(cumulativeTax(tax, Math.round(base)))
    const advance = Math.max(0, due - paid)
    paid += advance
    out.push({
      month: `${year}-${String(m).padStart(2, '0')}`,
      revenue: r2(f.revenue),
      costs: r2(f.costs),
      income: r2(f.income),
      social: zus,
      health,
      pitAdvance: advance,
      vat: tax.vatPayer ? r2(f.vatOut - f.vatIn) : 0,
      vatInfo: r2(f.vatOut + f.vatIn),
      ytdBase: r2(base),
      ytdRevenue: r2(ytdRevenue),
      ytdIncome: r2(ytdIncome),
      ytdPit: paid
    })
  }
  return out
}

/** Deadline for the month's payment: ZUS and PIT on the 20th, VAT on the 25th of the next month. */
export function dueDate(month: string, day: 20 | 25): string {
  const [y, m] = month.split('-').map(Number)
  const next = new Date(y, m, day, 12)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** NIP checksum (10 digits, weights 6 5 7 2 3 4 5 6 7). */
export function isValidNip(raw: string): boolean {
  const d = raw.replace(/[\s-]/g, '')
  if (!/^\d{10}$/.test(d)) return false
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const sum = weights.reduce((s, w, i) => s + w * Number(d[i]), 0)
  return sum % 11 === Number(d[9])
}

export function formatNip(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}` : raw
}
