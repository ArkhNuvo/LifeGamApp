import { useMemo } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useBookSelect } from '../../lib/book'
import { useT } from '../../lib/i18n/useT'
import { listAccounts, type LedgerAccount } from '../../lib/ledger'
import { CURRENCY_SYMBOLS } from '../../lib/currency'
import type { CurrencyCode } from '../../lib/types'

/** All accounts events can touch (general checking balance, its categories, savings). */
export function useAccounts(): LedgerAccount[] {
  const t = useT()
  const finance = useBookSelect((b) => b?.finance)
  const generalName = finance?.checking.generalName?.trim() || t('finance.categoryGeneralOption')
  return useMemo(
    () => (finance ? listAccounts({ finance }, generalName) : []),
    [finance, generalName]
  )
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  return `${amount.toFixed(2)} ${CURRENCY_SYMBOLS[currency]}`
}

/** The user's main currency (Settings); totals and converted values are shown in it. */
export function useMainCurrency(): CurrencyCode {
  return useAppStore((s) => s.data?.settings.mainCurrency ?? 'USD')
}

/** Whole-unit amount in the main currency, e.g. "1 550 $". */
export function formatMain(amount: number, main: CurrencyCode): string {
  return `${Math.round(amount).toLocaleString('ru-RU')} ${CURRENCY_SYMBOLS[main]}`
}
