/**
 * Types of payroll-pl-2026.js — the calculation module of the "Składki ZUS 2026 — методика и код"
 * artifact (v1.0.0, verified against Płatnik). The module itself is kept as published.
 */

export interface PayrollParams {
  year: number
  minWage: number
  minHourly: number
  forecastAvgWage: number
  zusLimit30x: number
  rates: {
    emerytalne: number
    emerytalneHalf: number
    rentoweJdg: number
    rentoweEmployee: number
    rentoweEmployer: number
    chorobowe: number
    wypadkowe: number
    fp: number
    fgsp: number
    fep: number
    health: number
    healthLinear: number
    employeeSocialTotal: number
  }
  jdg: { fullBase: number; prefBase: number; malyZusPlusRevenueLimit: number }
  health: {
    minBase: number
    minBasePrevYear: number
    ryczaltAvgWage: number
    ryczaltTiers: readonly { upTo: number; factor: number }[]
    linearDeductionLimit: number
  }
  pit: {
    threshold: number
    rate1: number
    rate2: number
    reductionAnnual: number
    pit2Reduction: Record<number, number>
    linearRate: number
    solidarityThreshold: number
    solidarityRate: number
    kupStandard: number
    kupElevated: number
    contractKupRate: number
    authorKupRate: number
    authorKupLimit: number
    youngLimit: number
    smallContractLimit: number
    smallContractRate: number
    oldRulesRate: number
    oldRulesReduction: number
  }
  ppk: { employee: number; employer: number }
}

export const PARAMS_2026: PayrollParams

export function r2(x: number): number
export function roundPLN(x: number): number
export function scaleTax(base: number, ytdBase?: number, p?: PayrollParams): number
export function parseEtat(v: number | string | null | undefined): { value: number; label: string } | null

export interface SickPay {
  days: number
  base: number
  dailyBase: number
  daily: number
  rate: number
  amount: number
}
export function calcSickPay(input: { days?: number; avgGross?: number; rate?: number }, p?: PayrollParams): SickPay

export type EmploymentContract = 'uop' | 'zlecenie' | 'dzielo'

export interface EmploymentYtd {
  zusBase: number
  taxBase: number
  youngRevenue: number
  authorKup: number
}

export interface EmploymentInput {
  contract: EmploymentContract
  gross: number
  bonus?: number
  /** 0 = none, 1 = full 300 zł, 2 = half (150), 3 = third (100). */
  pit2?: 0 | 1 | 2 | 3
  kup?: 'standard' | 'elevated'
  authorShare?: number
  under26?: boolean
  student?: boolean
  chorobowe?: boolean
  otherTitleZus?: boolean
  ownEmployee?: boolean
  fpExempt?: boolean
  fgspExempt?: boolean
  fep?: boolean
  wypadkoweRate?: number
  etat?: number | string
  hours?: number
  ppk?: null | { employee?: number; employer?: number }
  sickness?: null | { days: number; avgGross: number; rate?: number }
  fpMonthlyBase?: number
  healthCapOldRules?: boolean
  ytd?: Partial<EmploymentYtd>
}

export interface ContributionsEmployee {
  emerytalne: number
  rentowe: number
  chorobowe: number
  total: number
}

export interface ContributionsEmployer {
  emerytalne: number
  rentowe: number
  wypadkowe: number
  fp: number
  fgsp: number
  fep: number
  total: number
}

export interface EmploymentResult {
  contract: EmploymentContract
  etat: { value: number; label: string; minWage: number } | null
  gross: number
  salary: { base: number; absenceDeduction: number; bonus: number; sickPay: number; sick: SickPay | null; zusBase: number }
  revenue: number
  insured: { social: boolean; health: boolean; chorobowe: boolean }
  zusBases: { emRent: number; chorobowe: number; wypadkowe: number }
  employee: ContributionsEmployee
  health: number
  healthBase: number
  healthCapped: boolean
  young: { exempt: number; taxable: number }
  kup: number
  kupDetail: { standard: number; author: number }
  taxBase: number
  taxMethod: 'skala' | 'zaliczka12' | 'ryczalt'
  reduction: number
  pitAdvance: number
  ppk: { employee: number; employer: number }
  net: number
  employer: ContributionsEmployer
  employerCost: number
  warnings: string[]
  ytd: EmploymentYtd
}

export function calcEmployment(input: EmploymentInput, p?: PayrollParams): EmploymentResult

export type JdgZusVariant = 'start' | 'preferencyjny' | 'malyZusPlus' | 'pelny'

export interface JdgZus {
  variant: JdgZusVariant
  base: number
  baseEmRent: number
  emerytalne: number
  rentowe: number
  chorobowe: number
  wypadkowe: number
  fp: number
  social: number
  total: number
  wakacje?: boolean
}

export function calcJdgZus(
  input?: {
    variant?: JdgZusVariant
    base?: number
    chorobowe?: boolean
    wypadkoweRate?: number
    fpExempt?: boolean
    wakacje?: boolean
    ytdBase?: number
  },
  p?: PayrollParams
): JdgZus

export interface JdgHealth {
  base: number
  amount: number
  minApplied: boolean
  tier?: number
}

export function calcJdgHealth(
  input?: { taxForm?: 'skala' | 'liniowy' | 'ryczalt'; month?: number; incomeBase?: number; ryczaltRevenueYtd?: number },
  p?: PayrollParams
): JdgHealth

export interface JdgYearRow {
  month: number
  revenue: number
  costs: number
  zus: JdgZus
  zusDeductible: number
  monthIncome: number
  health: number
  healthBase: number
  healthMinApplied: boolean
  healthTier?: number
  taxBaseYtd: number
  healthDeductionYtd: number
  pitAdvance: number
  cashLeft: number
}

export interface JdgYearConfig {
  taxForm?: 'skala' | 'liniowy' | 'ryczalt'
  ryczaltRate?: number
  zusVariant?: JdgZusVariant | JdgZusVariant[]
  declaredBase?: number
  malyZusPlusBase?: number
  chorobowe?: boolean
  wypadkoweRate?: number
  fpExempt?: boolean
  wakacjeMonth?: number | null
  prevDecIncome?: number
  months: { revenue: number; costs?: number }[]
}

export function calcJdgYear(
  cfg: JdgYearConfig,
  p?: PayrollParams
): {
  config: JdgYearConfig
  rows: JdgYearRow[]
  totals: {
    revenue: number
    costs: number
    zusSocial: number
    fp: number
    zus: number
    health: number
    pit: number
    cashLeft: number
    burden: number
    solidarity: number
    healthJanNextYear: number | null
  }
}

export interface ZestawienieColumn {
  name: string
  kod: string
  wymiar: string
  emRentBase: number
  em: { ub: number; pl: number }
  rent: { ub: number; pl: number }
  chorBase: number
  chor: { ub: number; pl: number }
  wypBase: number
  wyp: { ub: number; pl: number }
  total: number
  healthBase: number
  health: number
  fp: number
  fgsp: number
  fep: number
}

export function formatWymiar(etat: { label: string } | null | undefined): string
export function zestawienieForJdg(zus: JdgZus, health: { base: number; amount: number }, name?: string): ZestawienieColumn
export function zestawienieForEmployee(r: EmploymentResult, name: string): ZestawienieColumn | null
export function buildZestawienie(columns: ZestawienieColumn[]): { columns: ZestawienieColumn[]; total: ZestawienieColumn }
