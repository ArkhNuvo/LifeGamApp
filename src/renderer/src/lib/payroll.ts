import { calcParams } from './polishTax'
import {
  calcEmployment,
  r2,
  roundPLN,
  scaleTax,
  type EmploymentInput,
  type EmploymentResult,
  type EmploymentYtd,
  type PayrollParams
} from './payroll-pl-2026'
import type { FirmTax, PayslipOverride, StaffMember } from './types'

/**
 * Polish payroll for a small employer (JDG): employment contracts (UoP),
 * mandate (zlecenie) and specific-task (dzieło) contracts, and B2B contractors.
 *
 * The calculation is payroll-pl-2026 (calcEmployment, verified against Płatnik);
 * this file maps the firm's people and the month's hand-entered figures onto it,
 * carries the yearly totals (30× cap, 32% bracket, youth and author-cost limits)
 * from month to month and handles B2B invoices, which the module doesn't cover.
 * A month is counted in full when the contract runs on any day of it.
 */

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
  employer: { pension: number; disability: number; accident: number; labourFund: number; fgsp: number; fep: number; ppk: number }
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
  /** The contract's own pay, and the month's extras that make up the gross. */
  basePay: number
  bonus: number
  /** Pay withheld for the days of sick leave (UoP). */
  absence: number
  sickPay: number
  /** Withheld after tax (alimony, bailiff). */
  deductions: number
  /** Set when the health contribution was lowered to the 2021-rules tax advance. */
  healthCap: number | null
  /** Fields the user typed by hand this month. */
  overridden: (keyof PayslipOverride)[]
  /** The module's result (null for B2B) — the DRA summary is built from it. */
  calc: EmploymentResult | null
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

/** Month extras that are inputs of the calculation; every other override replaces a calculated figure. */
const INPUT_KEYS: (keyof PayslipOverride)[] = ['bonus', 'deductions', 'sickDays', 'sickBase', 'sickRate']

/** The module's input for one person and month. */
export function employmentInput(member: StaffMember, month: string, ytd: EmploymentYtd): EmploymentInput {
  const o: PayslipOverride = member.overrides?.[month] ?? {}
  const contract = member.contract as EmploymentInput['contract']
  const basePay = grossOf(member)
  const share = member.copyright ? (member.copyrightShare ?? 100) / 100 : 0
  return {
    contract,
    gross: basePay,
    bonus: o.bonus ?? 0,
    pit2: member.pit2 ? (member.pit2Part ?? 1) : 0,
    kup: member.commuting ? 'elevated' : 'standard',
    authorShare: share,
    under26: member.youthRelief && under26(member, month),
    student: member.student,
    chorobowe: member.sickness,
    otherTitleZus: member.otherTitle,
    ownEmployee: !!member.ownEmployee,
    fpExempt: !!member.fpExempt,
    fgspExempt: !!member.fgspExempt,
    fep: !!member.fep,
    etat: member.fte || 1,
    hours: contract === 'zlecenie' && member.payType === 'hourly' ? member.hours : 0,
    ppk: member.ppk && contract !== 'dzielo' ? {} : null,
    sickness:
      contract === 'uop' && o.sickDays
        ? { days: o.sickDays, avgGross: o.sickBase ?? basePay, rate: (o.sickRate ?? 80) / 100 }
        : null,
    ytd
  }
}

/**
 * Steps 4–8 of calcEmployment (health, youth relief, costs, PIT, the health cap) again, from
 * contributions, sick pay, costs or tax typed by hand. Same formulas and rounding as the module,
 * so a figure changed by hand carries into everything that follows from it.
 */
function withOverrides(r: EmploymentResult, o: PayslipOverride, input: EmploymentInput, p: PayrollParams): EmploymentResult {
  const R = p.rates
  const ytd: EmploymentYtd = { zusBase: 0, taxBase: 0, youngRevenue: 0, authorKup: 0, ...input.ytd }
  const isUop = r.contract === 'uop'
  const ee = {
    emerytalne: o.pension ?? r.employee.emerytalne,
    rentowe: o.disability ?? r.employee.rentowe,
    chorobowe: o.sickness ?? r.employee.chorobowe,
    total: 0
  }
  ee.total = r2(ee.emerytalne + ee.rentowe + ee.chorobowe)
  const er = {
    ...r.employer,
    emerytalne: o.erPension ?? r.employer.emerytalne,
    rentowe: o.erDisability ?? r.employer.rentowe,
    wypadkowe: o.erAccident ?? r.employer.wypadkowe,
    fp: o.erLabourFund ?? r.employer.fp,
    fgsp: o.erFgsp ?? r.employer.fgsp
  }
  er.total = r2(er.emerytalne + er.rentowe + er.wypadkowe + er.fp + er.fgsp + er.fep)

  const zusGross = r.salary.zusBase
  const sickPay = o.sickPay ?? r.salary.sickPay
  const revenue = r2(zusGross + sickPay + r.ppk.employer)
  const healthBase = r.insured.health ? r2(zusGross + sickPay - ee.total) : 0
  let health = r2(healthBase * R.health)

  const exempt = input.under26 && r.contract !== 'dzielo' ? r2(Math.min(revenue, Math.max(0, p.pit.youngLimit - ytd.youngRevenue))) : 0
  const taxable = r2(revenue - exempt)
  const zusDeductible = r2(ee.total * (revenue > 0 ? taxable / revenue : 0))
  const small = r.taxMethod === 'ryczalt'

  let kupStandard = 0
  let authorKup = 0
  if (o.kup !== undefined) kupStandard = o.kup
  else if (taxable > 0 && !small) {
    const incomeAfterZus = Math.max(0, taxable - zusDeductible)
    const f = revenue > 0 ? Math.min(1, ((input.authorShare ?? 0) * zusGross) / revenue) : 0
    if (f > 0) authorKup = r2(Math.min(incomeAfterZus * f * p.pit.authorKupRate, Math.max(0, p.pit.authorKupLimit - ytd.authorKup)))
    const rest = incomeAfterZus * (1 - f)
    if (isUop) {
      if (f < 1) kupStandard = r2(Math.min(input.kup === 'elevated' ? p.pit.kupElevated : p.pit.kupStandard, rest))
    } else kupStandard = r2(rest * p.pit.contractKupRate)
  }
  const kup = r2(kupStandard + authorKup)

  let taxBase: number
  let pitAdvance: number
  if (small) {
    taxBase = roundPLN(Math.max(0, taxable - zusDeductible))
    pitAdvance = roundPLN(taxBase * p.pit.smallContractRate)
  } else {
    taxBase = roundPLN(Math.max(0, taxable - zusDeductible - kup))
    const tax = isUop ? scaleTax(taxBase, ytd.taxBase, p) : taxBase * p.pit.rate1
    pitAdvance = taxBase > 0 ? roundPLN(Math.max(0, tax - r.reduction)) : 0
  }
  if (o.pit !== undefined) pitAdvance = o.pit

  let healthCapped = false
  if (o.health !== undefined) health = o.health
  else if (input.healthCapOldRules !== false && health > 0 && exempt === 0 && !small) {
    const oldAdvance = r2(Math.max(0, taxBase * p.pit.oldRulesRate - (isUop && input.pit2 ? p.pit.oldRulesReduction : 0)))
    if (health > oldAdvance) {
      health = oldAdvance
      healthCapped = true
    }
  }

  return {
    ...r,
    gross: r2(zusGross + sickPay),
    salary: { ...r.salary, sickPay },
    revenue,
    employee: ee,
    health,
    healthBase,
    healthCapped,
    young: { exempt, taxable },
    kup,
    kupDetail: { standard: kupStandard, author: authorKup },
    taxBase,
    pitAdvance,
    net: r2(zusGross + sickPay - ee.total - health - pitAdvance - r.ppk.employee),
    employer: er,
    employerCost: r2(zusGross + sickPay + er.total + r.ppk.employer),
    ytd: {
      zusBase: r.ytd.zusBase,
      taxBase: isUop ? ytd.taxBase + taxBase : ytd.taxBase,
      youngRevenue: r2(ytd.youngRevenue + exempt),
      authorKup: r2(ytd.authorKup + authorKup)
    }
  }
}

const emptyYtd = (): EmploymentYtd => ({ zusBase: 0, taxBase: 0, youngRevenue: 0, authorKup: 0 })

/** One month of one person, given the year so far; `state` is moved on to the end of the month. */
function payslip(member: StaffMember, month: string, tax: FirmTax, state: { ytd: EmploymentYtd }): PayslipMonth {
  const o: PayslipOverride = member.overrides?.[month] ?? {}
  const overridden = (Object.keys(o) as (keyof PayslipOverride)[]).filter((k) => typeof o[k] === 'number')
  const basePay = grossOf(member)
  const bonus = o.bonus ?? 0
  const deductions = o.deductions ?? 0

  if (member.contract === 'b2b') {
    const gross = r2(basePay + bonus)
    const vat = member.vatRate === null ? 0 : r2((gross * member.vatRate) / 100)
    return {
      month, member, gross,
      employee: { pension: 0, disability: 0, sickness: 0, health: 0, ppk: 0 },
      employer: { pension: 0, disability: 0, accident: 0, labourFund: 0, fgsp: 0, fep: 0, ppk: 0 },
      deductibleCosts: 0, taxBase: 0, pit: 0, net: r2(gross + vat), cost: r2(gross + vat), zus: 0, vat,
      flags: ['b2b'], basePay, bonus, absence: 0, sickPay: 0, deductions, healthCap: null, overridden, calc: null
    }
  }

  const p = calcParams(tax, Number(month.slice(0, 4)))
  const input = employmentInput(member, month, state.ytd)
  let r = calcEmployment(input, p)
  if (overridden.some((k) => !INPUT_KEYS.includes(k))) r = withOverrides(r, o, input, p)
  const before = state.ytd
  state.ytd = r.ytd

  const flags: string[] = []
  if (r.insured.social && r.zusBases.emRent < r.salary.zusBase) flags.push('zusCap')
  if (r.young.exempt > 0) flags.push(r.young.exempt < r.revenue ? 'youthLimit' : 'youth')
  if (r.taxMethod === 'ryczalt') flags.push('flat')
  if (r.contract === 'uop' && before.taxBase + r.taxBase > p.pit.threshold) flags.push('pit32')
  if (r.kupDetail.author > 0 && r.ytd.authorKup >= p.pit.authorKupLimit) flags.push('authorLimit')
  if (r.healthCapped) flags.push('healthCap')
  if (r.etat && input.gross + bonus < r.etat.minWage) flags.push('belowMinWage')
  if (input.hours && input.gross / input.hours < p.minHourly) flags.push('belowMinHourly')

  const e = r.employee
  const er = r.employer
  return {
    month,
    member,
    gross: r.gross,
    employee: { pension: e.emerytalne, disability: e.rentowe, sickness: e.chorobowe, health: r.health, ppk: r.ppk.employee },
    employer: {
      pension: er.emerytalne,
      disability: er.rentowe,
      accident: er.wypadkowe,
      labourFund: er.fp,
      fgsp: er.fgsp,
      fep: er.fep,
      ppk: r.ppk.employer
    },
    deductibleCosts: r.kup,
    taxBase: r.taxBase,
    pit: r.pitAdvance,
    net: r2(r.net - deductions),
    cost: r.employerCost,
    zus: r2(e.total + r.health + er.total),
    vat: 0,
    flags,
    basePay,
    bonus,
    absence: r.salary.absenceDeduction,
    sickPay: r.salary.sickPay,
    deductions,
    healthCap: r.healthCapped ? r.health : null,
    overridden,
    calc: r
  }
}

/** Payslips of every active person for every month of the year up to `upTo` (1–12). */
export function payrollYearRun(staff: StaffMember[], tax: FirmTax, year: number, upTo: number): PayslipMonth[][] {
  const states = new Map(staff.map((s) => [s.id, { ytd: emptyYtd() }]))
  const out: PayslipMonth[][] = []
  for (let m = 1; m <= upTo; m++) {
    const month = `${year}-${String(m).padStart(2, '0')}`
    out.push(staff.filter((s) => isActive(s, month)).map((s) => payslip(s, month, tax, states.get(s.id) as { ytd: EmploymentYtd })))
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
