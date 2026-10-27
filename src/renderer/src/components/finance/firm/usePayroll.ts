import { useMemo } from 'react'
import { payrollTotals, payrollYearRun, type PayrollTotals, type PayslipMonth } from '../../../lib/payroll'
import { addEvent, editEvent, GENERAL_ACCOUNT_ID } from '../../../lib/ledger'
import { newId } from '../../../lib/ids'
import type { Firm, LedgerItem } from '../../../lib/types'

export interface FirmPayroll {
  /** Payslips of the month. */
  slips: PayslipMonth[]
  totals: PayrollTotals
}

/** The month's payroll, computed over the year so far (the ZUS cap, the 32% bracket and youth limit are yearly). */
export function useFirmPayroll(firm: Firm, month: string): FirmPayroll {
  return useMemo(() => {
    const staff = firm.staff ?? []
    const year = Number(month.slice(0, 4))
    const index = Number(month.slice(5, 7))
    const run = payrollYearRun(staff, firm.tax, year, index)
    const slips = run[index - 1] ?? []
    return { slips, totals: payrollTotals(slips) }
  }, [firm.staff, firm.tax, month])
}

export const payrollEventId = (month: string): string => `payroll-${month}`

const r2 = (n: number): number => Math.round(n * 100) / 100

/**
 * Books the month's payroll in the firm's KPiR as one "Lista płac" event: gross
 * pay in column 12, the employer's contributions in column 13. Booking again
 * replaces the earlier figures.
 */
export function postPayroll(firm: Firm, month: string, slips: PayslipMonth[]): void {
  const people = slips.filter((s) => s.member.contract !== 'b2b')
  const gross = r2(people.reduce((s, p) => s + p.gross, 0))
  const contributions = r2(
    people.reduce((s, p) => s + p.employer.pension + p.employer.disability + p.employer.accident + p.employer.labourFund + p.employer.fgsp + p.employer.fep, 0)
  )
  const ppk = r2(people.reduce((s, p) => s + p.employer.ppk, 0))
  const line = (description: string, amount: number, kpir: LedgerItem['kpir']): LedgerItem => ({
    id: newId(),
    description,
    net: amount,
    vatRate: null,
    vat: 0,
    gross: amount,
    kpir
  })
  const items = [
    line('Wynagrodzenia brutto', gross, '12'),
    line('Składki ZUS, FP, FGŚP, FEP pracodawcy', contributions, '13'),
    ...(ppk > 0 ? [line('Wpłaty PPK pracodawcy', ppk, '13')] : [])
  ].filter((it) => it.gross > 0)
  const amount = r2(gross + contributions + ppk)
  const [y, m] = month.split('-').map(Number)
  const date = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`
  const id = payrollEventId(month)
  const title = `Lista płac ${String(m).padStart(2, '0')}.${y}`
  const existing = firm.ledger.events.find((e) => e.id === id)
  if (existing) {
    editEvent(firm, id, { amount, items, title })
    return
  }
  const ev = addEvent(firm, {
    type: 'expense',
    title,
    amount,
    accountId: GENERAL_ACCOUNT_ID,
    toAccountId: null,
    toAmount: null,
    date,
    category: 'Wynagrodzenia',
    counterpartyId: null,
    subscriptionId: null,
    confirmed: true,
    attachments: [],
    items,
    doc: { number: `LP/${String(m).padStart(2, '0')}/${y}` }
  })
  ev.id = id
}
