import { paramsFor } from './polishTax'
import type { FirmTax, StaffMember } from './types'

/**
 * Polish payroll for a small employer (JDG): employment contracts (UoP),
 * mandate (zlecenie) and specific-task (dzieło) contracts, and B2B contractors.
 *
 * Rates are statutory; yearly amounts come from the year tables below (minimum
 * wage via the firm's tax parameters). Simplifications: a month is counted in
 * full when the contract runs on any day of it; sick pay, overtime, bonuses,
 * benefits in kind and FP/FGŚP exemptions (age, return from leave) are not
 * modelled; health contribution and advances follow the rules in force since 2022.
 */

export interface PayrollYear {
  /** Minimum hourly rate for zlecenie. */
  minHourly: number
  /** Yearly cap of the pension and disability contribution base (30× the forecast average wage). */
  zusCap: number
  /** Yearly limit of the PIT exemption for people under 26. */
  youthLimit: number
}

export const PAYROLL_YEARS: Record<string, PayrollYear> = {
  '2025': { minHourly: 30.5, zusCap: 260190, youthLimit: 85528 },
  '2026': { minHourly: 31.4, zusCap: 282600, youthLimit: 85528 }
}

export const PAYROLL_RATES = {
  /** Employee side. */
  pensionEe: 9.76,
  disabilityEe: 1.5,
  sicknessEe: 2.45,
  health: 9,
  /** Employer side. */
  pensionEr: 9.76,
  disabilityEr: 6.5,
  labourFund: 2.45,
  fgsp: 0.1,
  defaultAccident: 1.67,
  /** PPK basic contributions. */
  ppkEe: 2,
  ppkEr: 1.5,
  /** PIT. */
  pitLow: 12,
  pitHigh: 32,
  pitThreshold: 120000,
  monthlyReducing: 300,
  kup: 250,
  kupCommuting: 300,
  kupCivil: 20,
  kupCopyright: 50,
  /** Civil contracts up to this amount a month are taxed with a flat 12%. */
  smallContract: 200
}

export function payrollYear(year: number): PayrollYear {
  const known = Object.keys(PAYROLL_YEARS).sort()
  return PAYROLL_YEARS[String(year)] ?? PAYROLL_YEARS[known[known.length - 1]]
}

const r2 = (n: number): number => Math.round(n * 100) / 100
const pct = (base: number, rate: number): number => r2((base * rate) / 100)

// ---- PESEL ----------------------------------------------------------------

/** PESEL checksum (11 digits, weights 1 3 7 9 1 3 7 9 1 3). */
export function isValidPesel(raw: string): boolean {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 11) return false
  const w = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3]
  const sum = w.reduce((s, x, i) => s + x * Number(d[i]), 0)
  return (10 - (sum % 10)) % 10 === Number(d[10])
}

/** Date of birth encoded in a PESEL (the month carries the century), or null. */
export function birthDateFromPesel(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 11) return null
  const yy = Number(d.slice(0, 2))
  let mm = Number(d.slice(2, 4))
  const dd = Number(d.slice(4, 6))
  let century = 1900
  if (mm > 80) {
    century = 1800
    mm -= 80
  } else if (mm > 60) {
    century = 2200
    mm -= 60
  } else if (mm > 40) {
    century = 2100
    mm -= 40
  } else if (mm > 20) {
    century = 2000
    mm -= 20
  }
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  return `${century + yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/** Whether the person is still under 26 on the last day of the month. */
export function under26(member: StaffMember, month: string): boolean {
  const birth = birthDateFromPesel(member.pesel)
  if (!birth) return false
  const [y, m] = month.split('-').map(Number)
  const lastDay = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
  const turns26 = `${Number(birth.slice(0, 4)) + 26}${birth.slice(4)}`
  return lastDay < turns26
}

// ---- monthly calculation ----------------------------------------------------

export interface PayslipMonth {
  month: string
  member: StaffMember
  /** Gross pay (net invoice amount for B2B). */
  gross: number
  employee: { pension: number; disability: number; sickness: number; health: number; ppk: number }
  employer: { pension: number; disability: number; accident: number; labourFund: number; fgsp: number; ppk: number }
  deductibleCosts: number
  taxBase: number
  pit: number
  /** Paid out to the person (or the gross invoice to a B2B contractor). */
  net: number
  /** Everything the firm spends on the person this month. */
  cost: number
  /** Social contributions, both sides, plus health — what goes to ZUS. */
  zus: number
  /** B2B: VAT on the contractor's invoice. */
  vat: number
  /** Notes about the calculation (flat tax on a small contract, minimum wage, youth relief…). */
  flags: string[]
}

export function isActive(member: StaffMember, month: string): boolean {
  const start = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const end = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
  if (member.payType === 'once') {
    const pay = member.payDate ?? member.endDate ?? member.startDate
    return pay >= start && pay <= end
  }
  return member.startDate <= end && (!member.endDate || member.endDate >= start)
}

function grossOf(member: StaffMember): number {
  return r2(member.payType === 'hourly' ? member.rate * (member.hours || 0) : member.rate)
}

interface YearState {
  zusBase: number
  taxIncome: number
  youthIncome: number
}

/** One month of one person, given what they earned earlier in the year (for the ZUS cap, 32% bracket and youth limit). */
function payslip(member: StaffMember, month: string, tax: FirmTax, state: YearState): PayslipMonth {
  const year = Number(month.slice(0, 4))
  const params = paramsFor(tax, year)
  const py = payrollYear(year)
  const R = PAYROLL_RATES
  const gross = grossOf(member)
  const flags: string[] = []
  const employee = { pension: 0, disability: 0, sickness: 0, health: 0, ppk: 0 }
  const employer = { pension: 0, disability: 0, accident: 0, labourFund: 0, fgsp: 0, ppk: 0 }
  const accidentRate = tax.accidentRate ?? R.defaultAccident

  if (member.contract === 'b2b') {
    const vat = member.vatRate === null ? 0 : pct(gross, member.vatRate)
    return {
      month, member, gross, employee, employer, deductibleCosts: 0, taxBase: 0, pit: 0,
      net: r2(gross + vat), cost: r2(gross + vat), zus: 0, vat, flags: ['b2b']
    }
  }

  // ---- social contributions
  const insured =
    member.contract === 'uop' || (member.contract === 'zlecenie' && !member.student && !member.otherTitle)
  if (insured) {
    // Pension and disability stop once the year's base reaches 30× the average wage.
    const capped = Math.max(0, Math.min(gross, py.zusCap - state.zusBase))
    if (capped < gross) flags.push('zusCap')
    employee.pension = pct(capped, R.pensionEe)
    employee.disability = pct(capped, R.disabilityEe)
    employer.pension = pct(capped, R.pensionEr)
    employer.disability = pct(capped, R.disabilityEr)
    employer.accident = pct(gross, accidentRate)
    if (member.contract === 'uop' || member.sickness) employee.sickness = pct(gross, R.sicknessEe)
    // FP and FGŚP: due when the pay reaches the minimum wage (FGŚP for every employee).
    if (gross >= params.minimumWage) employer.labourFund = pct(gross, R.labourFund)
    employer.fgsp = pct(gross, R.fgsp)
    state.zusBase += capped
  }
  const social = r2(employee.pension + employee.disability + employee.sickness)

  // ---- health contribution: everyone except dzieło and pupils/students on zlecenie
  const healthDue = member.contract === 'uop' || (member.contract === 'zlecenie' && !member.student)
  if (healthDue) employee.health = pct(gross - social, R.health)

  // ---- PPK
  if (member.ppk && member.contract !== 'dzielo') {
    employee.ppk = pct(gross, R.ppkEe)
    employer.ppk = pct(gross, R.ppkEr)
  }

  // ---- PIT advance
  let deductibleCosts = 0
  let taxBase = 0
  let pit = 0
  const youth = member.youthRelief && member.contract !== 'dzielo' && under26(member, month)
  const smallCivil = member.contract !== 'uop' && gross <= R.smallContract
  if (youth && state.youthIncome + gross <= py.youthLimit) {
    // PIT-0 for the young: no advance (and no deductible costs) up to the yearly limit.
    flags.push('youth')
    state.youthIncome += gross
  } else if (smallCivil) {
    // A civil contract of up to 200 zł a month: flat 12% of the gross, no costs.
    flags.push('flat')
    taxBase = Math.round(gross)
    pit = Math.round((taxBase * R.pitLow) / 100)
  } else {
    if (member.contract === 'uop') deductibleCosts = member.commuting ? R.kupCommuting : R.kup
    else deductibleCosts = r2(((gross - social) * (member.copyright ? R.kupCopyright : R.kupCivil)) / 100)
    // Employer PPK is taxable income of the employee.
    taxBase = Math.max(0, Math.round(gross - social - deductibleCosts + employer.ppk))
    const rate = state.taxIncome + taxBase > R.pitThreshold ? R.pitHigh : R.pitLow
    if (rate === R.pitHigh) flags.push('pit32')
    const reducing = member.pit2 ? R.monthlyReducing : 0
    pit = Math.max(0, Math.round((taxBase * rate) / 100 - reducing))
    state.taxIncome += taxBase
  }

  // ---- checks
  if (member.contract === 'uop' && gross < params.minimumWage * (member.fte || 1) - 0.005) flags.push('belowMinWage')
  if (member.contract === 'zlecenie' && member.payType === 'hourly' && member.rate < py.minHourly) flags.push('belowMinHourly')

  const net = r2(gross - social - employee.health - pit - employee.ppk)
  const employerSum = r2(employer.pension + employer.disability + employer.accident + employer.labourFund + employer.fgsp)
  return {
    month,
    member,
    gross,
    employee,
    employer,
    deductibleCosts,
    taxBase,
    pit,
    net,
    cost: r2(gross + employerSum + employer.ppk),
    zus: r2(social + employerSum + employee.health),
    vat: 0,
    flags
  }
}

/** Payslips of every active person for every month of the year up to `upTo` (1–12). */
export function payrollYearRun(staff: StaffMember[], tax: FirmTax, year: number, upTo: number): PayslipMonth[][] {
  const states = new Map(staff.map((s) => [s.id, { zusBase: 0, taxIncome: 0, youthIncome: 0 }]))
  const out: PayslipMonth[][] = []
  for (let m = 1; m <= upTo; m++) {
    const month = `${year}-${String(m).padStart(2, '0')}`
    out.push(staff.filter((s) => isActive(s, month)).map((s) => payslip(s, month, tax, states.get(s.id) as YearState)))
  }
  return out
}

export interface PayrollTotals {
  gross: number
  net: number
  /** ZUS for employees and contractors on civil contracts (both sides + health) — goes on the firm's DRA. */
  zus: number
  /** PIT advances withheld — paid by the firm as PIT-4. */
  pit: number
  ppk: number
  /** Gross wages + employer contributions + employer PPK (without B2B). */
  cost: number
  /** B2B invoices (gross). */
  b2b: number
  b2bNet: number
  b2bVat: number
  /** People paid this month on UoP / zlecenie, i.e. the firm is a ZUS payer for others. */
  insuredCount: number
}

export function payrollTotals(slips: PayslipMonth[]): PayrollTotals {
  const t: PayrollTotals = { gross: 0, net: 0, zus: 0, pit: 0, ppk: 0, cost: 0, b2b: 0, b2bNet: 0, b2bVat: 0, insuredCount: 0 }
  for (const s of slips) {
    if (s.member.contract === 'b2b') {
      t.b2b += s.net
      t.b2bNet += s.gross
      t.b2bVat += s.vat
      continue
    }
    t.gross += s.gross
    t.net += s.net
    t.zus += s.zus
    t.pit += s.pit
    t.ppk += s.employee.ppk + s.employer.ppk
    t.cost += s.cost
    if (s.zus > 0) t.insuredCount += 1
  }
  for (const k of Object.keys(t) as (keyof PayrollTotals)[]) if (k !== 'insuredCount') t[k] = r2(t[k])
  return t
}

export function blankMember(contract: StaffMember['contract']): StaffMember {
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: '',
    firstName: '',
    lastName: '',
    pesel: '',
    position: '',
    contract,
    startDate: today,
    endDate: null,
    payType: contract === 'dzielo' ? 'once' : 'monthly',
    rate: 0,
    hours: 160,
    payDate: contract === 'dzielo' ? today : null,
    fte: 1,
    youthRelief: true,
    student: false,
    pit2: contract === 'uop',
    commuting: false,
    sickness: false,
    otherTitle: false,
    copyright: false,
    ppk: false,
    vatRate: contract === 'b2b' ? 23 : null,
    note: ''
  }
}
