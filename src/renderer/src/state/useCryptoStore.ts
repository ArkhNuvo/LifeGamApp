import { create } from 'zustand'
import type { CryptoPrices } from '../lib/types'

interface CryptoState {
  prices: CryptoPrices['prices']
  fetchedAt: number | null
  loading: boolean
  /** Fetches USD prices for the tickers and merges them into the store; returns the merged prices. */
  fetch: (tickers: string[], force?: boolean) => Promise<CryptoPrices['prices']>
}

export const useCryptoStore = create<CryptoState>((set, get) => ({
  prices: {},
  fetchedAt: null,
  loading: false,
  fetch: async (tickers, force = false) => {
    if (tickers.length === 0) return get().prices
    set({ loading: true })
    try {
      const result = await window.api.crypto.prices(tickers, force)
      const prices = { ...get().prices, ...result.prices }
      set({ prices, fetchedAt: result.fetchedAt, loading: false })
      return prices
    } catch {
      set({ loading: false })
      return get().prices
    }
  }
}))
