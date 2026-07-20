import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { ExchangeRates } from '../shared/types'

// Free, no-API-key endpoint; updates once every 24h. Chosen over ECB-only
// feeds (e.g. Frankfurter) because it also covers RUB/UAH, which ECB doesn't
// publish and this app's user base plausibly needs.
const API_URL = 'https://open.er-api.com/v6/latest/USD'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

function cachePath(): string {
  return join(app.getPath('userData'), 'exchangeRates.json')
}

function readCache(): ExchangeRates | null {
  try {
    if (!existsSync(cachePath())) return null
    return JSON.parse(readFileSync(cachePath(), 'utf-8'))
  } catch {
    return null
  }
}

function writeCache(rates: ExchangeRates): void {
  writeFileSync(cachePath(), JSON.stringify(rates, null, 2), 'utf-8')
}

interface OpenErApiResponse {
  result: string
  rates: Record<string, number>
}

async function fetchFreshRates(): Promise<ExchangeRates> {
  const res = await fetch(API_URL)
  if (!res.ok) throw new Error(`exchange rate fetch failed: ${res.status}`)
  const data = (await res.json()) as OpenErApiResponse
  if (data.result !== 'success') throw new Error('exchange rate API returned an error result')
  const rates: ExchangeRates = { base: 'USD', rates: data.rates, fetchedAt: Date.now() }
  writeCache(rates)
  return rates
}

/** Returns cached rates if fresh (<24h old) unless forceRefresh; falls back to stale cache on network failure. */
export async function getRates(forceRefresh: boolean): Promise<ExchangeRates> {
  const cached = readCache()
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < ONE_DAY_MS) {
    return cached
  }
  try {
    return await fetchFreshRates()
  } catch (err) {
    if (cached) return cached
    throw err
  }
}
