import type { TelegramAction, TelegramCatalogPayload } from '../shared/types'

const API_BASE = 'http://199.247.0.246:8080'

interface PairStartResult {
  code: string
}

interface PairStatusResult {
  paired: boolean
  api_token?: string
}

export async function startPairing(username: string): Promise<string> {
  const res = await fetch(`${API_BASE}/pair/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  })
  if (!res.ok) throw new Error(`pair/start failed: ${res.status}`)
  const data = (await res.json()) as PairStartResult
  return data.code
}

export async function checkPairingStatus(code: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/pair/status?code=${encodeURIComponent(code)}`)
  if (!res.ok) throw new Error(`pair/status failed: ${res.status}`)
  const data = (await res.json()) as PairStatusResult
  return data.paired && data.api_token ? data.api_token : null
}

export async function pushCatalog(apiToken: string, payload: TelegramCatalogPayload): Promise<void> {
  const res = await fetch(`${API_BASE}/sync/catalog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(`sync/catalog failed: ${res.status}`)
}

export async function fetchPendingActions(apiToken: string): Promise<TelegramAction[]> {
  const res = await fetch(`${API_BASE}/actions/pending`, {
    headers: { Authorization: `Bearer ${apiToken}` }
  })
  if (!res.ok) throw new Error(`actions/pending failed: ${res.status}`)
  return (await res.json()) as TelegramAction[]
}

export async function ackActions(apiToken: string, ids: number[]): Promise<void> {
  const res = await fetch(`${API_BASE}/actions/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
    body: JSON.stringify({ ids })
  })
  if (!res.ok) throw new Error(`actions/ack failed: ${res.status}`)
}
