import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AiExtractRequest, AiExtractResult, AiExtraction, AiStatus } from '../shared/types'

// The override exists so the request/response handling can be tested against a local stand-in server.
const API_URL = process.env.LIFEGAM_AI_URL ?? 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-sonnet-5-5'
const REQUEST_TIMEOUT_MS = 90_000

interface StoredConfig {
  model: string
  /** API key encrypted with the OS keychain (DPAPI on Windows) and base64-encoded. */
  keyEnc: string | null
}

function configPath(): string {
  return join(app.getPath('userData'), 'ai.json')
}

function readConfig(): StoredConfig {
  try {
    if (existsSync(configPath())) {
      const parsed = JSON.parse(readFileSync(configPath(), 'utf-8'))
      return {
        model: typeof parsed.model === 'string' && parsed.model ? parsed.model : DEFAULT_MODEL,
        keyEnc: typeof parsed.keyEnc === 'string' ? parsed.keyEnc : null
      }
    }
  } catch {
    // fall through to defaults
  }
  return { model: DEFAULT_MODEL, keyEnc: null }
}

function writeConfig(config: StoredConfig): void {
  writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf-8')
}

function readKey(config: StoredConfig): string | null {
  if (!config.keyEnc || !safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(Buffer.from(config.keyEnc, 'base64'))
  } catch {
    return null
  }
}

export function getAiStatus(): AiStatus {
  const config = readConfig()
  return {
    hasKey: readKey(config) !== null,
    model: config.model,
    encryptionAvailable: safeStorage.isEncryptionAvailable()
  }
}

/** `apiKey`: a new key to store, `null` to delete the stored one, undefined to leave it alone. */
export function setAiConfig(update: { apiKey?: string | null; model?: string }): { ok: boolean; error?: string } {
  const config = readConfig()
  if (typeof update.model === 'string') config.model = update.model.trim() || DEFAULT_MODEL
  if (update.apiKey === null) {
    config.keyEnc = null
  } else if (typeof update.apiKey === 'string' && update.apiKey.trim()) {
    const key = update.apiKey.trim().replace(/^["']|["']$/g, '')
    if (!isValidKey(key)) return { ok: false, error: 'invalid_key' }
    if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: 'encryption_unavailable' }
    config.keyEnc = safeStorage.encryptString(key).toString('base64')
  }
  writeConfig(config)
  return { ok: true }
}

const EXTRACTION_TOOL = {
  name: 'record_financial_document',
  description: 'Record the financial facts read from the document.',
  input_schema: {
    type: 'object',
    properties: {
      event_type: {
        type: 'string',
        enum: ['expense', 'income', 'transfer'],
        description: 'expense = a purchase or payment made; income = money received; transfer = between own accounts.'
      },
      amount: { type: ['number', 'null'], description: 'Total paid or received, positive, "." as decimal separator.' },
      currency: { type: ['string', 'null'], description: 'ISO 4217 code such as PLN, EUR, USD.' },
      date: { type: ['string', 'null'], description: 'Payment or issue date as YYYY-MM-DD.' },
      merchant: { type: ['string', 'null'], description: 'Seller, service or payee/payer name as printed.' },
      description: { type: ['string', 'null'], description: 'What it was for, at most 60 characters.' },
      category: { type: ['string', 'null'], description: 'Short spending/income category.' },
      recurrence: {
        type: 'string',
        enum: ['none', 'week', 'month', 'year'],
        description: 'Only if the document clearly states recurring billing; otherwise none.'
      },
      payment_method: {
        type: ['string', 'null'],
        enum: ['card', 'cash', 'transfer', 'crypto', null],
        description: 'How it was paid, if the document says: card (debit/credit card, contactless, BLIK), cash, transfer (bank transfer), crypto. Otherwise null.'
      },
      card_last4: { type: ['string', 'null'], description: 'Last four digits of the payment card if printed (e.g. "1234" from "**** 1234"); otherwise null.' },
      crypto_ticker: { type: ['string', 'null'], description: 'For a crypto payment, the coin ticker such as BTC or ETH; otherwise null.' },
      crypto_amount: { type: ['number', 'null'], description: 'For a crypto payment, the amount in that coin (positive); otherwise null.' },
      document_type: { type: 'string', description: 'receipt, invoice, bank_confirmation, payslip, or other.' },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      notes: { type: ['string', 'null'], description: 'Anything uncertain or worth double-checking.' }
    },
    required: ['event_type', 'amount', 'currency', 'date', 'merchant', 'description', 'category', 'recurrence', 'payment_method', 'card_last4', 'crypto_ticker', 'crypto_amount', 'document_type', 'confidence', 'notes']
  }
} as const

/** API keys are plain ASCII (sk-ant-...); anything else — Cyrillic letters typed in the wrong layout, say — can't go into an HTTP header. */
function isValidKey(key: string): boolean {
  return /^[!-~]+$/.test(key)
}

const SUPPORTED_IMAGES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

function buildSystemPrompt(req: AiExtractRequest): string {
  const lines = [
    'You read one financial document (receipt, invoice, bank payment confirmation, payslip, subscription invoice) and report its facts by calling the tool.',
    `Always answer by calling the ${EXTRACTION_TOOL.name} tool; do not reply with prose.`,
    'Never invent values: if something is not on the document, use null. Do not guess a date.',
    'Amounts are the final total actually paid or received, not a subtotal or tax line.',
    'For a crypto payment, report the coin amount in crypto_amount and the coin in crypto_ticker; amount is then the fiat value if the document shows one, else null.',
    `Today is ${req.today}; answer free-text fields (description, category, notes) in the language "${req.language}".`
  ]
  if (req.categories.length > 0) {
    lines.push(`The user already uses these categories; reuse one if it fits: ${req.categories.join(', ')}.`)
  }
  if (req.counterparties.length > 0) {
    lines.push(`Known counterparties; if the merchant is one of them, copy that exact spelling: ${req.counterparties.join(', ')}.`)
  }
  return lines.join('\n')
}

function toExtraction(input: Record<string, unknown>): AiExtraction {
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const amount = typeof input.amount === 'number' && Number.isFinite(input.amount) ? Math.abs(input.amount) : null
  const date = str(input.date)
  const eventType = input.event_type === 'income' || input.event_type === 'transfer' ? input.event_type : 'expense'
  const recurrence =
    input.recurrence === 'week' || input.recurrence === 'month' || input.recurrence === 'year' ? input.recurrence : 'none'
  const confidence = input.confidence === 'high' || input.confidence === 'low' ? input.confidence : 'medium'
  const method = ['card', 'cash', 'transfer', 'crypto'].includes(input.payment_method as string)
    ? (input.payment_method as AiExtraction['paymentMethod'])
    : null
  const last4 = str(input.card_last4)?.replace(/\D/g, '').slice(-4) ?? null
  const cryptoAmount =
    typeof input.crypto_amount === 'number' && Number.isFinite(input.crypto_amount) && input.crypto_amount > 0
      ? input.crypto_amount
      : null
  return {
    eventType,
    paymentMethod: method,
    cardLast4: last4 && last4.length === 4 ? last4 : null,
    cryptoTicker: str(input.crypto_ticker)?.toUpperCase().replace(/[^A-Z0-9]/g, '') ?? null,
    cryptoAmount,
    amount,
    currency: str(input.currency)?.toUpperCase() ?? null,
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    merchant: str(input.merchant),
    description: str(input.description),
    category: str(input.category),
    recurrence,
    documentType: str(input.document_type) ?? 'other',
    confidence,
    notes: str(input.notes)
  }
}

/** Sends one image or PDF to Claude and returns the structured facts it read. The key never leaves this process. */
export async function extractDocument(req: AiExtractRequest): Promise<AiExtractResult> {
  const config = readConfig()
  const apiKey = readKey(config)
  if (!apiKey) return { ok: false, code: 'no_key', error: 'No API key configured' }
  // A key saved by an earlier version (or edited by hand) may still hold characters that can't be sent.
  if (!isValidKey(apiKey)) return { ok: false, code: 'auth', error: 'The stored API key contains invalid characters' }

  const isPdf = req.mime === 'application/pdf'
  if (!isPdf && !SUPPORTED_IMAGES.has(req.mime)) {
    return { ok: false, code: 'bad_input', error: `Unsupported file type: ${req.mime}` }
  }

  const documentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: req.dataBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: req.mime, data: req.dataBase64 } }

  let res: Response
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1024,
        system: buildSystemPrompt(req),
        tools: [EXTRACTION_TOOL],
        messages: [
          {
            role: 'user',
            content: [documentBlock, { type: 'text', text: 'Read this document and record its facts.' }]
          }
        ]
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch (err) {
    return { ok: false, code: 'other', error: err instanceof Error ? err.message : String(err) }
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { error?: { message?: string } }
      if (body.error?.message) message = body.error.message
    } catch {
      // keep the status line
    }
    const code = res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'rate' : 'other'
    return { ok: false, code, error: message }
  }

  const body = (await res.json()) as {
    content?: { type: string; input?: Record<string, unknown>; text?: string }[]
  }
  // Not every model accepts a forced tool choice, so the tool is offered rather than required;
  // if a model answers in prose instead, a JSON object in its text is accepted too.
  const toolUse = body.content?.find((block) => block.type === 'tool_use')
  if (toolUse?.input) return { ok: true, data: toExtraction(toolUse.input) }
  const text = body.content?.find((block) => block.type === 'text')?.text ?? ''
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try {
      return { ok: true, data: toExtraction(JSON.parse(text.slice(start, end + 1))) }
    } catch {
      // fall through
    }
  }
  return { ok: false, code: 'other', error: 'The model returned no structured result' }
}
