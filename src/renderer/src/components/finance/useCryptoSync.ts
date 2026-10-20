import { useEffect, useMemo } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useCryptoStore } from '../../state/useCryptoStore'
import { allBooks } from '../../lib/book'
import { allTickers, portfolioValue, syncCryptoBalances } from '../../lib/crypto'
import type { SavingsEntry } from '../../lib/types'

const REFRESH_MS = 5 * 60 * 1000

/**
 * Keeps crypto accounts' USD balances in line with live prices — in personal
 * finances and in every firm: fetches prices for every held ticker on open,
 * whenever the set of tickers changes and every few minutes, and writes the
 * portfolio values back into the accounts.
 */
export function useCryptoSync(): void {
  const data = useAppStore((s) => s.data)
  const updateData = useAppStore((s) => s.updateData)
  const prices = useCryptoStore((s) => s.prices)
  const fetchPrices = useCryptoStore((s) => s.fetch)
  const books = useMemo(() => (data ? allBooks(data) : []), [data])
  const tickers = useMemo(() => [...new Set(books.flatMap((b) => allTickers(b)))].sort(), [books])
  const tickerKey = tickers.join(',')

  useEffect(() => {
    if (tickers.length === 0) return
    void fetchPrices(tickers)
    const timer = setInterval(() => void fetchPrices(tickers, true), REFRESH_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey, fetchPrices])

  useEffect(() => {
    const stale = (entry: SavingsEntry): boolean => {
      if (!entry.holdings || entry.holdings.length === 0) return false
      if (!entry.holdings.some((h) => prices[h.ticker] != null)) return false
      return Math.round(portfolioValue(entry.holdings, prices) * 100) / 100 !== entry.amount
    }
    if (books.some((b) => b.finance.savings.some(stale))) {
      updateData((draft) => {
        for (const book of allBooks(draft)) syncCryptoBalances(book, prices)
      })
    }
  }, [books, prices, updateData])
}
