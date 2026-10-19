import { newId } from './ids'
import { canConvert, convert } from './currency'
import { convertEventsForAccount, GENERAL_ACCOUNT_ID, retargetEventsToGeneral } from './ledger'
import type { CurrencyCode, UserData } from './types'

export type AccountKind = 'checking' | 'savings' | 'crypto'

type Rates = Record<string, number> | null

export interface NewAccount {
  name: string
  kind: AccountKind
  currency: CurrencyCode
  balance: number
}

/** A checking account is a category under the general balance; a savings account is a savings entry. */
export function addAccount(draft: UserData, fields: NewAccount): string {
  const id = newId()
  if (fields.kind === 'checking') {
    draft.finance.checking.categories.push({
      id,
      name: fields.name,
      balance: fields.balance,
      currency: fields.currency
    })
  } else if (fields.kind === 'crypto') {
    // A coin portfolio is valued in USD from live prices; the balance starts at zero.
    draft.finance.savings.push({ id, name: fields.name, amount: 0, currency: 'USD', holdings: [] })
  } else {
    draft.finance.savings.push({ id, name: fields.name, amount: fields.balance, currency: fields.currency })
  }
  return id
}

/**
 * Cards store their money amount in the currency of the account they're tied
 * to (a checking category id, or null for the general balance). When that
 * account's currency changes, those amounts must be converted too — otherwise
 * a later revert would subtract the old number in the new currency.
 */
function convertTiedCards(
  draft: UserData,
  accountId: string | null,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Rates,
  retargetTo?: string | null
): void {
  const cards = [
    ...Object.values(draft.kanban.months).flatMap((m) => m.columns.flatMap((c) => c.cards)),
    ...draft.kanban.unassigned
  ]
  for (const card of cards) {
    if ((card.checkingCategoryId ?? null) !== accountId) continue
    if (card.money) card.money = Math.round(convert(card.money, from, to, rates) * 100) / 100
    if (retargetTo !== undefined) card.checkingCategoryId = retargetTo
  }
}

/** Whether switching an account between these currencies can be done right now (rates are loaded for both). */
export function canSwitchCurrency(from: CurrencyCode, to: CurrencyCode, rates: Rates): boolean {
  return from === to || canConvert(from, to, rates)
}

/**
 * Switches an account's currency. Everything tied to it (card and event
 * amounts) is converted at the current rate; the balance itself is converted
 * too unless `convertBalance` is false (the user typed a new balance).
 */
export function changeAccountCurrency(
  draft: UserData,
  accountId: string,
  to: CurrencyCode,
  rates: Rates,
  convertBalance: boolean
): void {
  const { checking, savings } = draft.finance
  const round = (n: number, from: CurrencyCode): number => Math.round(convert(n, from, to, rates) * 100) / 100
  if (accountId === GENERAL_ACCOUNT_ID) {
    const from = checking.currency
    if (from === to) return
    convertTiedCards(draft, null, from, to, rates)
    convertEventsForAccount(draft, accountId, from, to, rates)
    if (convertBalance) checking.balance = round(checking.balance, from)
    checking.currency = to
    return
  }
  const category = checking.categories.find((c) => c.id === accountId)
  if (category) {
    const from = category.currency
    if (from === to) return
    convertTiedCards(draft, category.id, from, to, rates)
    convertEventsForAccount(draft, accountId, from, to, rates)
    if (convertBalance) category.balance = round(category.balance, from)
    category.currency = to
    return
  }
  const entry = savings.find((e) => e.id === accountId)
  if (entry) {
    const from = entry.currency
    if (from === to) return
    convertEventsForAccount(draft, accountId, from, to, rates)
    if (convertBalance) entry.amount = round(entry.amount, from)
    entry.currency = to
  }
}

/** Deleting a checking account folds its balance (and cards/events) into the general balance. */
export function removeCheckingAccount(draft: UserData, accountId: string, rates: Rates): void {
  const category = draft.finance.checking.categories.find((c) => c.id === accountId)
  if (!category) return
  const general = draft.finance.checking
  general.balance =
    Math.round((general.balance + convert(category.balance, category.currency, general.currency, rates)) * 100) / 100
  convertTiedCards(draft, category.id, category.currency, general.currency, rates, null)
  retargetEventsToGeneral(draft, category.id, category.currency, general.currency, rates)
  general.categories = general.categories.filter((c) => c.id !== accountId)
}

export function removeSavingsAccount(draft: UserData, accountId: string): void {
  draft.finance.savings = draft.finance.savings.filter((e) => e.id !== accountId)
}

/** Whether any event or subscription refers to this account. */
export function accountHasHistory(draft: Pick<UserData, 'ledger'>, accountId: string): boolean {
  return (
    draft.ledger.events.some((e) => e.accountId === accountId || e.toAccountId === accountId) ||
    draft.ledger.subscriptions.some((s) => s.accountId === accountId)
  )
}
