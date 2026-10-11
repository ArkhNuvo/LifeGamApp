/** Parsing of bank-statement style CSV files into candidate events. Everything here is pure and runs locally. */

export type DateFormat = 'auto' | 'iso' | 'dmy' | 'mdy'
export type AmountMode = 'signed' | 'split'

/** Column index for each field, or -1 when the file has no such column. */
export interface ColumnMapping {
  date: number
  amount: number
  debit: number
  credit: number
  description: number
  category: number
  counterparty: number
  currency: number
}

export interface ImportOptions {
  amountMode: AmountMode
  /** Plus means expense, minus means income (for statements that list spending as positive). */
  invert: boolean
  dateFormat: DateFormat
}

export type RowError = 'date' | 'amount' | null

export interface ImportRow {
  /** 1-based line in the file, for the user to find the row. */
  line: number
  date: string | null
  amount: number | null
  type: 'expense' | 'income' | null
  title: string
  category: string
  counterparty: string
  currency: string
  /** The row looks like a transfer between the user's own accounts and needs a manual look. */
  suspectTransfer: boolean
  error: RowError
}

const OWN_TRANSFER = /wewn[eę]trzn|przelew w[lł]asny|own transfer|internal transfer|между своими|собственн/i

export const EMPTY_MAPPING: ColumnMapping = {
  date: -1,
  amount: -1,
  debit: -1,
  credit: -1,
  description: -1,
  category: -1,
  counterparty: -1,
  currency: -1
}

/** Splits CSV text into rows of cells, honouring quotes ("a;b", "" for a literal quote) and CRLF. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/** Picks the delimiter that splits the first lines into the most consistent number of columns. */
export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 8)
  let best = ','
  let bestScore = -1
  for (const candidate of [';', ',', '\t', '|']) {
    const counts = sample.map((line) => {
      let n = 0
      let quoted = false
      for (const ch of line) {
        if (ch === '"') quoted = !quoted
        else if (ch === candidate && !quoted) n++
      }
      return n
    })
    const first = counts[0] ?? 0
    const consistent = counts.filter((c) => c === first).length
    const score = first > 0 ? first * 10 + consistent : 0
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best
}

/** Reads "1 234,56", "1,234.56", "-12.50", "(12.50)", "12.50-", "12,50 PLN" as a number. */
export function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/[  \s]/g, '')
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) {
    negative = true
    s = s.slice(1, -1)
  }
  if (s.endsWith('-')) {
    negative = true
    s = s.slice(0, -1)
  }
  if (s.startsWith('-') || s.startsWith('−')) {
    negative = !negative
    s = s.slice(1)
  }
  s = s.replace(/^\+/, '').replace(/[^\d.,]/g, '')
  if (!/\d/.test(s)) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let normalized: string
  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: whichever comes last is the decimal separator.
    const decimal = lastComma > lastDot ? ',' : '.'
    const thousands = decimal === ',' ? '.' : ','
    normalized = s.split(thousands).join('').replace(decimal, '.')
  } else if (lastComma !== -1 || lastDot !== -1) {
    const sep = lastComma !== -1 ? ',' : '.'
    const parts = s.split(sep)
    const tail = parts[parts.length - 1]
    // A lone separator followed by exactly 3 digits (and several groups) is a thousands mark: "1,234" / "1.234.567".
    const isThousands = parts.length > 2 || (tail.length === 3 && parts[0].length <= 3 && parts[0] !== '0')
    normalized = isThousands ? parts.join('') : parts.slice(0, -1).join('') + '.' + tail
  } else {
    normalized = s
  }
  const value = parseFloat(normalized)
  if (Number.isNaN(value)) return null
  return negative ? -value : value
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function isoOrNull(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

/** Works out whether slash/dot dates are day-first or month-first from the values themselves. */
export function detectDateFormat(samples: string[]): 'iso' | 'dmy' | 'mdy' {
  let firstOver12 = false
  let secondOver12 = false
  for (const raw of samples) {
    const s = raw.trim()
    if (/^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(s)) return 'iso'
    const m = /^(\d{1,2})[./-](\d{1,2})[./-]\d{2,4}/.exec(s)
    if (!m) continue
    if (Number(m[1]) > 12) firstOver12 = true
    if (Number(m[2]) > 12) secondOver12 = true
  }
  if (secondOver12 && !firstOver12) return 'mdy'
  return 'dmy'
}

export function parseDate(raw: string, format: Exclude<DateFormat, 'auto'>): string | null {
  const s = raw.trim()
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(s)
  if (m) return isoOrNull(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/.exec(s)
  if (!m) return null
  let year = Number(m[3])
  if (year < 100) year += 2000
  const a = Number(m[1])
  const b = Number(m[2])
  return format === 'mdy' ? isoOrNull(year, a, b) : isoOrNull(year, b, a)
}

const HEADER_HINTS: Record<keyof ColumnMapping, RegExp> = {
  date: /^(data|date|дата|dátum|datum|booking|księgow|transaction date|data op)/i,
  amount: /^(kwota|amount|сумма|összeg|value|wartość|betrag|importo)/i,
  debit: /(obci[aą]ż|debit|списани|расход|wydatek|kiadás|ausgabe|withdraw)/i,
  credit: /(uznani|credit|зачислен|приход|доход|wpływ|bevétel|einnahme|deposit)/i,
  description: /(opis|tytu|title|description|назначени|описани|details|szczeg|memo|narrative|leírás|megjegyz|verwendung|reference)/i,
  category: /(kategor|category|категори|kategória)/i,
  counterparty: /(kontrahent|odbiorc|nadawc|payee|merchant|получател|контрагент|nazwa|partner|empfänger|name)/i,
  currency: /(waluta|currency|валют|pénznem|währung)/i
}

/** Guesses which column is which, from the header names (or, without headers, from the content). */
export function autoDetectMapping(header: string[] | null, sample: string[][]): ColumnMapping {
  const mapping: ColumnMapping = { ...EMPTY_MAPPING }
  const taken = new Set<number>()
  if (header) {
    // Order matters: the more specific fields claim their column first.
    for (const field of ['debit', 'credit', 'date', 'amount', 'category', 'currency', 'description', 'counterparty'] as const) {
      const idx = header.findIndex((h, i) => !taken.has(i) && HEADER_HINTS[field].test(h.trim()))
      if (idx !== -1) {
        mapping[field] = idx
        taken.add(idx)
      }
    }
  }
  const columns = sample[0]?.length ?? header?.length ?? 0
  const column = (i: number): string[] => sample.map((r) => r[i] ?? '')
  if (mapping.date === -1) {
    for (let i = 0; i < columns; i++) {
      if (!taken.has(i) && column(i).filter((c) => c.trim()).length > 0 && column(i).every((c) => !c.trim() || parseDate(c, 'dmy'))) {
        mapping.date = i
        taken.add(i)
        break
      }
    }
  }
  if (mapping.amount === -1 && mapping.debit === -1 && mapping.credit === -1) {
    for (let i = 0; i < columns; i++) {
      if (!taken.has(i) && column(i).filter((c) => c.trim()).length > 0 && column(i).every((c) => !c.trim() || parseAmount(c) !== null)) {
        mapping.amount = i
        taken.add(i)
        break
      }
    }
  }
  if (mapping.description === -1) {
    let best = -1
    let bestLen = 0
    for (let i = 0; i < columns; i++) {
      if (taken.has(i)) continue
      const len = column(i).reduce((sum, c) => sum + c.length, 0)
      if (len > bestLen) {
        bestLen = len
        best = i
      }
    }
    mapping.description = best
  }
  return mapping
}

function cell(row: string[], index: number): string {
  return index >= 0 ? (row[index] ?? '').trim() : ''
}

/** Card statements append the purchase date and pad with spaces ("SHELL  Wejherowo POL 2026-09-24"); drop that noise. */
function tidyTitle(raw: string): string {
  return raw.replace(/\s+\d{4}-\d{2}-\d{2}$/, '').replace(/\s{2,}/g, ' ').trim()
}

/** Turns table rows into candidate events. `firstLine` is the 1-based line number of rows[0]. */
export function buildRows(
  rows: string[][],
  firstLine: number,
  mapping: ColumnMapping,
  options: ImportOptions
): ImportRow[] {
  const dateFormat: Exclude<DateFormat, 'auto'> =
    options.dateFormat === 'auto'
      ? detectDateFormat(rows.slice(0, 50).map((r) => cell(r, mapping.date)))
      : options.dateFormat
  return rows.map((row, i): ImportRow => {
    const date = parseDate(cell(row, mapping.date), dateFormat)
    let amount: number | null = null
    let type: 'expense' | 'income' | null = null
    if (options.amountMode === 'signed') {
      const value = parseAmount(cell(row, mapping.amount))
      if (value !== null && value !== 0) {
        amount = Math.abs(value)
        type = value < 0 ? 'expense' : 'income'
      }
    } else {
      const debit = parseAmount(cell(row, mapping.debit)) ?? 0
      const credit = parseAmount(cell(row, mapping.credit)) ?? 0
      const net = credit - Math.abs(debit)
      if (net !== 0) {
        amount = Math.abs(net)
        type = net < 0 ? 'expense' : 'income'
      }
    }
    if (type && options.invert) type = type === 'expense' ? 'income' : 'expense'
    const counterparty = cell(row, mapping.counterparty)
    return {
      line: firstLine + i,
      date,
      amount,
      type,
      title: tidyTitle(cell(row, mapping.description) || counterparty),
      category: cell(row, mapping.category),
      counterparty,
      currency: cell(row, mapping.currency).toUpperCase(),
      suspectTransfer: OWN_TRANSFER.test(row.join(' ')),
      error: !date ? 'date' : amount === null ? 'amount' : null
    }
  })
}

/** Decodes file bytes; tries UTF-8 first and falls back to the legacy codepage when the bytes aren't valid UTF-8. */
export function decodeBytes(bytes: Uint8Array, encoding: 'auto' | 'utf-8' | 'windows-1250' | 'windows-1251'): string {
  const strip = (s: string): string => s.replace(/^﻿/, '')
  if (encoding !== 'auto') return strip(new TextDecoder(encoding).decode(bytes))
  try {
    return strip(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    return strip(new TextDecoder('windows-1250').decode(bytes))
  }
}
