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

/** Asks the bot to confirm a sign-in or password reset in the user's Telegram. Returns the request id. */
export async function requestAuth(apiToken: string, purpose: 'login' | 'reset'): Promise<{ id: string } | { error: 'not_linked' | 'network' }> {
  try {
    const res = await fetch(`${API_BASE}/auth/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
      body: JSON.stringify({ purpose }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (res.status === 401 || res.status === 409) return { error: 'not_linked' }
    if (!res.ok) return { error: 'network' }
    return (await res.json()) as { id: string }
  } catch {
    return { error: 'network' }
  }
}

export async function authStatus(apiToken: string, id: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/auth/status?id=${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (!res.ok) return 'network'
    return ((await res.json()) as { status: string }).status
  } catch {
    return 'network'
  }
}

export const BOT_USERNAME = 'LifeGamBot'

/** Starts recovering a forgotten login: the server hands out a code for the user to send to the bot. */
export async function recoverStart(): Promise<{ id: string; code: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/recover/start`, { method: 'POST', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    if (!res.ok) return null
    return (await res.json()) as { id: string; code: string }
  } catch {
    return null
  }
}

export async function recoverStatus(id: string): Promise<{ status: string; username?: string }> {
  try {
    const res = await fetch(`${API_BASE}/recover/status?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    if (!res.ok) return { status: 'network' }
    return (await res.json()) as { status: string; username?: string }
  } catch {
    return { status: 'network' }
  }
}

/** The account a bot token belongs to, or null. */
export async function whoami(apiToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/whoami`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (!res.ok) return null
    return ((await res.json()) as { username: string }).username
  } catch {
    return null
  }
}
