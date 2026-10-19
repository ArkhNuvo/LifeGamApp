import { useEffect, useMemo } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useCryptoStore } from '../../state/useCryptoStore'
import { allTickers, portfolioValue, syncCryptoBalances } from '../../lib/crypto'

const REFRESH_MS = 5 * 60 * 1000

/**
 * Keeps crypto accounts' USD balances in line with live prices: fetches prices
 * for every held ticker on open, whenever the set of tickers changes and every
 * few minutes, and writes the portfolio values back into the accounts.
 */
export function useCryptoSync(): void {
  const savings = useAppStore((s) => s.data?.finance.savings)
  const updateData = useAppStore((s) => s.updateData)
  const prices = useCryptoStore((s) => s.prices)
  const fetchPrices = useCryptoStore((s) => s.fetch)
  const tickers = useMemo(() => (savings ? allTickers({ finance: { savings } } as never) : []), [savings])
  const tickerKey = tickers.join(',')

  useEffect(() => {
    if (tickers.length === 0) return
    void fetchPrices(tickers)
    const timer = setInterval(() => void fetchPrices(tickers, true), REFRESH_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey, fetchPrices])

  useEffect(() => {
    if (!savings) return
    const outdated = savings.some((entry) => {
      if (!entry.holdings || entry.holdings.length === 0) return false
      if (!entry.holdings.some((h) => prices[h.ticker] != null)) return false
      return Math.round(portfolioValue(entry.holdings, prices) * 100) / 100 !== entry.amount
    })
    if (outdated) updateData((draft) => syncCryptoBalances(draft, prices))
  }, [savings, prices, updateData])
}
