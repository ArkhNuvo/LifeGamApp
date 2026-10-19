import type { PickedFile, TelegramAction, TelegramCatalogPayload } from '../shared/types'

const API_BASE = process.env.LIFEGAM_BOT_API_URL ?? 'http://199.247.0.246:8080'
/** Without a timeout a hung server would stall background sync for minutes. */
const REQUEST_TIMEOUT_MS = 15_000

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
    body: JSON.stringify({ username }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!res.ok) throw new Error(`pair/start failed: ${res.status}`)
  const data = (await res.json()) as PairStartResult
  return data.code
}

export async function checkPairingStatus(code: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/pair/status?code=${encodeURIComponent(code)}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!res.ok) throw new Error(`pair/status failed: ${res.status}`)
  const data = (await res.json()) as PairStatusResult
  return data.paired && data.api_token ? data.api_token : null
}

export async function pushCatalog(apiToken: string, payload: TelegramCatalogPayload): Promise<void> {
  const res = await fetch(`${API_BASE}/sync/catalog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!res.ok) throw new Error(`sync/catalog failed: ${res.status}`)
}

export async function fetchPendingActions(apiToken: string): Promise<TelegramAction[]> {
  const res = await fetch(`${API_BASE}/actions/pending`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!res.ok) throw new Error(`actions/pending failed: ${res.status}`)
  return (await res.json()) as TelegramAction[]
}

export async function ackActions(apiToken: string, ids: number[]): Promise<void> {
  const res = await fetch(`${API_BASE}/actions/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
    body: JSON.stringify({ ids }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  if (!res.ok) throw new Error(`actions/ack failed: ${res.status}`)
}

/** Downloads a photo/scan the user sent to the bot. Returns null when the server no longer has it. */
export async function fetchFile(apiToken: string, fileId: string, name: string | null): Promise<PickedFile | null> {
  const res = await fetch(`${API_BASE}/files/${encodeURIComponent(fileId)}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    signal: AbortSignal.timeout(60_000)
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`files/${fileId} failed: ${res.status}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  const mime = (res.headers.get('content-type') ?? 'application/octet-stream').split(';')[0]
  return { name: name ?? fileId, mime, size: bytes.length, dataBase64: bytes.toString('base64') }
}
