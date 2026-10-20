import type { CryptoHolding, CryptoPrices, FinanceBook } from './types'

export function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function allTickers(data: Pick<FinanceBook, 'finance'>): string[] {
  const set = new Set<string>()
  for (const entry of data.finance.savings) for (const h of entry.holdings ?? []) set.add(h.ticker)
  return [...set]
}

/** USD value of one holding (0 when the coin has no price yet). */
export function holdingValue(holding: CryptoHolding, prices: CryptoPrices['prices']): number {
  return holding.amount * (prices[holding.ticker] ?? 0)
}

export function portfolioValue(holdings: CryptoHolding[], prices: CryptoPrices['prices']): number {
  return holdings.reduce((sum, h) => sum + holdingValue(h, prices), 0)
}

/**
 * Writes the current USD value of every crypto account into its balance.
 * An account whose coins have no price at all (offline, unknown tickers) keeps
 * its last value instead of dropping to zero.
 */
export function syncCryptoBalances(draft: FinanceBook, prices: CryptoPrices['prices']): void {
  for (const entry of draft.finance.savings) {
    if (!entry.holdings || entry.holdings.length === 0) continue
    if (!entry.holdings.some((h) => prices[h.ticker] != null)) continue
    const value = Math.round(portfolioValue(entry.holdings, prices) * 100) / 100
    if (entry.amount !== value) entry.amount = value
  }
}

/** Prices are shown with enough digits to be meaningful for both BTC and sub-cent coins. */
export function formatPrice(usd: number): string {
  if (usd >= 1000) return usd.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (usd >= 1) return usd.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (usd >= 0.01) return usd.toLocaleString('en-US', { maximumFractionDigits: 4 })
  return usd.toLocaleString('en-US', { maximumSignificantDigits: 4 })
}

export function formatCoinAmount(amount: number): string {
  return amount.toLocaleString('en-US', { maximumFractionDigits: 8 })
}
