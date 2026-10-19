import type { CryptoPrices } from '../shared/types'

// Public, key-less endpoints. Binance lists the pair for almost every coin a
// retail holder has; CoinGecko covers the long tail it doesn't.
const BINANCE_URL = 'https://api.binance.com/api/v3/ticker/price'
const GECKO_SEARCH = 'https://api.coingecko.com/api/v3/search'
const GECKO_PRICE = 'https://api.coingecko.com/api/v3/simple/price'
const CACHE_MS = 2 * 60 * 1000

const STABLES = new Set(['USD', 'USDT', 'USDC', 'DAI', 'BUSD', 'FDUSD', 'TUSD', 'USDP'])

interface Cached {
  usd: number | null
  at: number
}

const cache = new Map<string, Cached>()

async function binancePrices(): Promise<Map<string, number>> {
  const res = await fetch(BINANCE_URL, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`binance ${res.status}`)
  const list = (await res.json()) as { symbol: string; price: string }[]
  return new Map(list.map((p) => [p.symbol, parseFloat(p.price)]))
}

function priceFromBinance(ticker: string, pairs: Map<string, number>): number | null {
  for (const quote of ['USDT', 'USDC', 'FDUSD', 'BUSD']) {
    const p = pairs.get(ticker + quote)
    if (p && p > 0) return p
  }
  const viaBtc = pairs.get(`${ticker}BTC`)
  const btc = pairs.get('BTCUSDT')
  if (viaBtc && btc) return viaBtc * btc
  return null
}

async function priceFromGecko(ticker: string): Promise<number | null> {
  try {
    const search = await fetch(`${GECKO_SEARCH}?query=${encodeURIComponent(ticker)}`, {
      signal: AbortSignal.timeout(15_000)
    })
    if (!search.ok) return null
    const { coins } = (await search.json()) as {
      coins: { id: string; symbol: string; market_cap_rank: number | null }[]
    }
    // Several coins can share a symbol; the one with the best market-cap rank is the real one.
    const match = coins
      .filter((c) => c.symbol.toUpperCase() === ticker)
      .sort((a, b) => (a.market_cap_rank ?? 1e9) - (b.market_cap_rank ?? 1e9))[0]
    if (!match) return null
    const res = await fetch(`${GECKO_PRICE}?ids=${encodeURIComponent(match.id)}&vs_currencies=usd`, {
      signal: AbortSignal.timeout(15_000)
    })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, { usd?: number }>
    return data[match.id]?.usd ?? null
  } catch {
    return null
  }
}

/** USD price per ticker; `null` where no price could be found. Results are cached for a couple of minutes. */
export async function getPrices(tickers: string[], force = false): Promise<CryptoPrices> {
  const wanted = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))]
  const now = Date.now()
  const stale = wanted.filter((t) => {
    if (STABLES.has(t)) return false
    const hit = cache.get(t)
    return force || !hit || now - hit.at > CACHE_MS
  })
  if (stale.length > 0) {
    let pairs: Map<string, number> | null = null
    try {
      pairs = await binancePrices()
    } catch {
      pairs = null
    }
    for (const ticker of stale) {
      let usd = pairs ? priceFromBinance(ticker, pairs) : null
      if (usd === null) usd = await priceFromGecko(ticker)
      // Keep the last known price when the network fails, rather than blanking the portfolio.
      const previous = cache.get(ticker)?.usd ?? null
      cache.set(ticker, { usd: usd ?? previous, at: usd === null && previous === null ? now - CACHE_MS + 15_000 : now })
    }
  }
  const prices: Record<string, number | null> = {}
  for (const t of wanted) prices[t] = STABLES.has(t) ? 1 : (cache.get(t)?.usd ?? null)
  return { prices, fetchedAt: now }
}
