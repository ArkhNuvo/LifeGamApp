import type { CurrencyCode } from './types'

export const CURRENCIES: CurrencyCode[] = [
  'USD',
  'EUR',
  'PLN',
  'RUB',
  'UAH',
  'GBP',
  'CHF',
  'CZK',
  'HUF',
  'JPY',
  'CNY'
]

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: '$',
  EUR: '€',
  PLN: 'zł',
  RUB: '₽',
  UAH: '₴',
  GBP: '£',
  CHF: 'CHF',
  CZK: 'Kč',
  HUF: 'Ft',
  JPY: '¥',
  CNY: '¥'
}

/** Converts an amount in `currency` to USD using a 1-USD-per-`rates[code]` rate table. Falls back to the raw amount if rates aren't loaded yet. */
export function convertToUsd(
  amount: number,
  currency: CurrencyCode,
  rates: Record<string, number> | null
): number {
  if (currency === 'USD') return amount
  const rate = rates?.[currency]
  if (!rate) return amount
  return amount / rate
}

/**
 * Picks whichever quoting direction reads naturally for this currency:
 * "CODE/USD" when one unit of it is worth more than a dollar (EUR, GBP, ...),
 * "USD/CODE" when it takes several units to match a dollar (PLN, RUB, JPY, ...) —
 * matching real-world FX quoting convention instead of always dividing by USD.
 */
export function ratePairLabel(
  currency: CurrencyCode,
  rates: Record<string, number> | null
): { label: string; value: number | null } {
  if (currency === 'USD') return { label: 'USD/USD', value: 1 }
  const rate = rates?.[currency]
  if (!rate) return { label: `${currency}/USD`, value: null }
  if (rate >= 1) {
    return { label: `USD/${currency}`, value: rate }
  }
  return { label: `${currency}/USD`, value: 1 / rate }
}

/** Converts an amount between any two currencies via USD as a pivot. Falls back to the USD-equivalent (or the raw amount) if rates for `to` aren't available. */
export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<string, number> | null
): number {
  if (from === to) return amount
  const usd = convertToUsd(amount, from, rates)
  if (to === 'USD') return usd
  const rate = rates?.[to]
  if (!rate) return usd
  return usd * rate
}

/** Whether rates are loaded for both currencies, i.e. `convert` would give a real result rather than a fallback. */
export function canConvert(
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<string, number> | null
): boolean {
  const has = (c: CurrencyCode): boolean => c === 'USD' || !!rates?.[c]
  return has(from) && has(to)
}
