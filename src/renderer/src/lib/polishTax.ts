import { PARAMS_2026, calcJdgYear, r2, type JdgZus, type JdgZusVariant, type PayrollParams } from './payroll-pl-2026'
import type { FirmTax, TaxParams, ZusScheme } from './types'

/**
 * Polish rules for a sole proprietorship (JDG): ZUS, health contribution, PIT
 * advances and VAT. The calculation itself is payroll-pl-2026 (calcJdgYear);
 * this file feeds it the firm's settings and the KPiR figures. Yearly amounts are
 * defaults that the user can override per year in the firm's tax settings.
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
    // 9% of the minimum wage, from February; January still uses the previous year's amount.
    healthMin: 432.54,
    healthRyczalt: [498.35, 830.58, 1495.04],
    liniowyHealthDeductionLimit: 14100
  }
}

export const PIT = {
  skalaThreshold: PARAMS_2026.pit.threshold
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

/** Yearly amounts the user doesn't edit: bases behind the editable amounts, limits and the zlecenie hourly minimum. */
interface YearConstants {
  zusLimit30x: number
  minHourly: number
  youngLimit: number
  /** Base of the minimum health contribution of skala / liniowy (its 9% is TaxParams.healthMin). */
  healthMinBase: number
  /** Average wage of Q4 of the previous year — the ryczałt health bases are 60/100/180% of it. */
  ryczaltAvgWage: number
}

const YEAR_CONSTANTS: Record<string, YearConstants> = {
  '2024': { zusLimit30x: 234720, minHourly: 28.1, youngLimit: 85528, healthMinBase: 4242, ryczaltAvgWage: 7767.85 },
  '2025': { zusLimit30x: 260190, minHourly: 30.5, youngLimit: 85528, healthMinBase: 3499.5, ryczaltAvgWage: 8549.18 },
  '2026': {
    zusLimit30x: PARAMS_2026.zusLimit30x,
    minHourly: PARAMS_2026.minHourly,
    youngLimit: PARAMS_2026.pit.youngLimit,
    healthMinBase: PARAMS_2026.health.minBase,
    ryczaltAvgWage: PARAMS_2026.health.ryczaltAvgWage
  }
}

function yearConstants(year: number): YearConstants {
  const known = Object.keys(YEAR_CONSTANTS).sort()
  return YEAR_CONSTANTS[String(year)] ?? YEAR_CONSTANTS[known[year < Number(known[0]) ? 0 : known.length - 1]]
}

/**
 * Parameters of the calculation module for the firm's year: the 2026 statutory rates with the year's
 * amounts, the firm's own overrides and its accident rate.
 */
export function calcParams(tax: FirmTax, year: number): PayrollParams {
  const params = paramsFor(tax, year)
  const c = yearConstants(year)
  const H = PARAMS_2026.rates.health
  // A health amount the user typed by hand is turned back into its base (the base goes on the DRA).
  const baseOf = (amount: number | undefined, known: number): number =>
    amount === undefined || r2(known * H) === amount ? known : r2(amount / H)
  const ryczalt = tax.params[String(year)]?.healthRyczalt
  return {
    ...PARAMS_2026,
    year,
    minWage: params.minimumWage,
    minHourly: c.minHourly,
    forecastAvgWage: r2(params.zusFullBase / 0.6),
    zusLimit30x: c.zusLimit30x,
    rates: { ...PARAMS_2026.rates, wypadkowe: (tax.accidentRate ?? 1.67) / 100 },
    jdg: { ...PARAMS_2026.jdg, fullBase: params.zusFullBase, prefBase: params.zusPreferentialBase },
    health: {
      ...PARAMS_2026.health,
      minBase: baseOf(tax.params[String(year)]?.healthMin, c.healthMinBase),
      minBasePrevYear: baseOf(tax.params[String(year - 1)]?.healthMin, yearConstants(year - 1).healthMinBase),
      ryczaltAvgWage: ryczalt ? r2(ryczalt[1] / H) : c.ryczaltAvgWage,
      linearDeductionLimit: params.liniowyHealthDeductionLimit
    },
    pit: { ...PARAMS_2026.pit, youngLimit: c.youngLimit }
  }
}

/** The owner's social contributions of a month. */
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

const socialOf = (z: JdgZus): SocialZus => ({
  base: z.base,
  pension: z.emerytalne,
  disability: z.rentowe,
  sickness: z.chorobowe,
  accident: z.wypadkowe,
  labourFund: z.fp,
  social: z.social,
  total: z.total
})

/** "none" (insured elsewhere) pays no social contributions, like ulga na start — only health. */
const ZUS_VARIANT: Record<ZusScheme, JdgZusVariant> = {
  full: 'pelny',
  preferential: 'preferencyjny',
  small_plus: 'malyZusPlus',
  start: 'start',
  none: 'start'
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
  /** The module's own figures, for the DRA summary. */
  zus: JdgZus
  health: number
  /** Base of the health contribution (the previous month's income, the minimum base or the ryczałt tier base). */
  healthBase: number
  healthMinApplied: boolean
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

function jdgYear(tax: FirmTax, year: number, months: MonthFigures[], prevDecIncome: number): ReturnType<typeof calcJdgYear> {
  const holiday = tax.zusHoliday?.startsWith(`${year}-`) ? Number(tax.zusHoliday.slice(5, 7)) : null
  return calcJdgYear(
    {
      taxForm: tax.form,
      ryczaltRate: tax.ryczaltRate / 100,
      zusVariant: ZUS_VARIANT[tax.zus],
      malyZusPlusBase: tax.smallPlusBase ?? undefined,
      chorobowe: tax.sickness,
      wakacjeMonth: tax.zus === 'none' ? null : holiday,
      prevDecIncome,
      months: months.map((f) => ({ revenue: f.revenue, costs: f.costs }))
    },
    calcParams(tax, year)
  )
}

/**
 * Month-by-month figures for a year, January to `upTo` (1–12). The health contribution of a month
 * is computed from the previous month's income, so January needs last December (`prevMonths`).
 * Contributions are counted in the month they concern (paid by the 20th of the next one).
 */
export function yearTax(tax: FirmTax, year: number, months: MonthFigures[], upTo: number, prevMonths?: MonthFigures[]): MonthTax[] {
  const prevDecIncome = prevMonths ? (jdgYear(tax, year - 1, prevMonths, 0).rows[11]?.monthIncome ?? 0) : 0
  const { rows } = jdgYear(tax, year, months, prevDecIncome)
  const empty: MonthFigures = { revenue: 0, costs: 0, income: 0, vatOut: 0, vatIn: 0 }
  let ytdRevenue = 0
  let ytdIncome = 0
  let ytdPit = 0
  return rows.slice(0, upTo).map((r, i) => {
    const f = months[i] ?? empty
    ytdRevenue += f.revenue
    ytdIncome += f.income
    ytdPit += r.pitAdvance
    return {
      month: `${year}-${String(i + 1).padStart(2, '0')}`,
      revenue: r2(f.revenue),
      costs: r2(f.costs),
      income: r2(f.income),
      social: socialOf(r.zus),
      zus: r.zus,
      health: r.health,
      healthBase: r.healthBase,
      healthMinApplied: r.healthMinApplied,
      pitAdvance: r.pitAdvance,
      vat: tax.vatPayer ? r2(f.vatOut - f.vatIn) : 0,
      vatInfo: r2(f.vatOut + f.vatIn),
      ytdBase: r.taxBaseYtd,
      ytdRevenue: r2(ytdRevenue),
      ytdIncome: r2(ytdIncome),
      ytdPit
    }
  })
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
