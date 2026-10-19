import { GENERAL_ACCOUNT_ID, type LedgerAccount } from './ledger'
import type { PaymentMethod, UserData } from './types'

export interface PaymentHint {
  paymentMethod?: PaymentMethod | null
  cardLast4?: string | null
  currency?: string | null
  cryptoTicker?: string | null
}

export type PaymentReason = 'crypto' | 'card-binding' | 'default-card' | 'default-cash' | 'currency' | 'general'

/**
 * Chooses the account a payment most likely came from:
 * a coin → the portfolio holding it; a known card (last four digits) → its
 * account; "card" → the default card account; "cash" → the default cash
 * account; otherwise an account in the document's currency, else the general one.
 */
export function pickPaymentAccount(
  settings: UserData['settings'],
  accounts: LedgerAccount[],
  hint: PaymentHint,
  holdingsOf?: (accountId: string) => string[]
): { account: LedgerAccount | undefined; reason: PaymentReason } {
  const usable = (id: string | null | undefined): LedgerAccount | undefined =>
    id ? accounts.find((a) => a.id === id && !a.crypto) : undefined

  if (hint.paymentMethod === 'crypto' || hint.cryptoTicker) {
    const portfolios = accounts.filter((a) => a.crypto)
    const holding = hint.cryptoTicker
      ? portfolios.find((a) => holdingsOf?.(a.id).includes(hint.cryptoTicker as string))
      : undefined
    const account = holding ?? portfolios[0]
    if (account) return { account, reason: 'crypto' }
  }
  const bound = hint.cardLast4 ? usable(settings.cardAccounts?.[hint.cardLast4]) : undefined
  if (bound) return { account: bound, reason: 'card-binding' }
  if (hint.paymentMethod === 'card') {
    const account = usable(settings.defaultCardAccountId)
    if (account) return { account, reason: 'default-card' }
  }
  if (hint.paymentMethod === 'cash') {
    const account = usable(settings.defaultCashAccountId)
    if (account) return { account, reason: 'default-cash' }
  }
  const byCurrency = hint.currency
    ? accounts.find((a) => !a.crypto && a.group === 'checking' && a.currency === hint.currency)
    : undefined
  if (byCurrency) return { account: byCurrency, reason: 'currency' }
  return {
    account: accounts.find((a) => a.id === GENERAL_ACCOUNT_ID) ?? accounts.find((a) => !a.crypto),
    reason: 'general'
  }
}
