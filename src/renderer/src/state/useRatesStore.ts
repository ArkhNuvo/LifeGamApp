import { create } from 'zustand'
import type { ExchangeRates } from '../lib/types'

interface RatesState {
  rates: ExchangeRates | null
  loading: boolean
  /** Fetches rates once (main process handles its own 24h staleness check/cache) unless already loaded. */
  fetchIfNeeded: () => Promise<void>
  refresh: () => Promise<void>
}

export const useRatesStore = create<RatesState>((set, get) => ({
  rates: null,
  loading: false,
  fetchIfNeeded: async () => {
    if (get().rates || get().loading) return
    set({ loading: true })
    try {
      const rates = await window.api.rates.get()
      set({ rates, loading: false })
    } catch {
      set({ loading: false })
    }
  },
  refresh: async () => {
    set({ loading: true })
    try {
      const rates = await window.api.rates.refresh()
      set({ rates, loading: false })
    } catch {
      set({ loading: false })
    }
  }
}))
