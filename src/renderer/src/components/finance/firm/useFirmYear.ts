import { useMemo } from 'react'
import { useRatesStore } from '../../../state/useRatesStore'
import { monthFigures, type KpirContext } from '../../../lib/kpir'
import { yearTax, type MonthFigures, type MonthTax } from '../../../lib/polishTax'
import type { Firm } from '../../../lib/types'
import { useAccounts } from '../useFinance'

export interface FirmYear {
  ctx: KpirContext
  year: number
  monthIndex: number
  months: MonthFigures[]
  taxes: MonthTax[]
  /** Tax figures of the selected month. */
  current: MonthTax | undefined
}

/** KPiR figures and tax estimates of the firm's year, up to the month shown in the module. */
export function useFirmYear(firm: Firm, month: string): FirmYear {
  const accounts = useAccounts()
  const rates = useRatesStore((s) => s.rates?.rates ?? null)
  return useMemo(() => {
    const ctx: KpirContext = { accounts, rates, vatPayer: firm.tax.vatPayer }
    const year = Number(month.slice(0, 4))
    const monthIndex = Number(month.slice(5, 7))
    const months = monthFigures(ctx, firm.ledger.events, String(year))
    const taxes = yearTax(firm.tax, year, months, 12)
    return { ctx, year, monthIndex, months, taxes, current: taxes[monthIndex - 1] }
  }, [accounts, rates, firm.tax, firm.ledger.events, month])
}
