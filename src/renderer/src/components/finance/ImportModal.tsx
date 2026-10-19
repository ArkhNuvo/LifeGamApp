import { useMemo, useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useT } from '../../lib/i18n/useT'
import {
  autoDetectMapping,
  buildRows,
  decodeBytes,
  detectDelimiter,
  parseCsv,
  parseDate,
  type AmountMode,
  type ColumnMapping,
  type DateFormat
} from '../../lib/csvImport'
import { addEvent, adjustAccountBalance, GENERAL_ACCOUNT_ID } from '../../lib/ledger'
import { formatMoney, useAccounts } from './useFinance'

type Encoding = 'auto' | 'utf-8' | 'windows-1250' | 'windows-1251'
type Status = 'new' | 'duplicate' | 'currency' | 'bad'

const FIELDS = [
  'date',
  'amount',
  'debit',
  'credit',
  'description',
  'category',
  'counterparty',
  'currency',
  'type',
  'toAccount',
  'toAmount'
] as const

const FIELD_KEYS = {
  date: 'fin.importColDate',
  amount: 'fin.importColAmount',
  debit: 'fin.importColDebit',
  credit: 'fin.importColCredit',
  description: 'fin.importColDescription',
  category: 'fin.importColCategory',
  counterparty: 'fin.importColCounterparty',
  currency: 'fin.importColCurrency',
  type: 'fin.importColType',
  toAccount: 'fin.importColToAccount',
  toAmount: 'fin.importColToAmount'
} as const

const PREVIEW_LIMIT = 300

/** Bulk-imports transactions from a bank-statement CSV: map the columns, review the rows, confirm. */
export default function ImportModal({ onClose }: { onClose: () => void }): JSX.Element {
  const t = useT()
  const updateData = useAppStore((s) => s.updateData)
  const events = useAppStore((s) => s.data?.ledger.events ?? [])
  const accounts = useAccounts().filter((a) => !a.crypto)

  const [fileName, setFileName] = useState('')
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [encoding, setEncoding] = useState<Encoding>('auto')
  const [delimiter, setDelimiter] = useState(',')
  const [hasHeader, setHasHeader] = useState(true)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [amountMode, setAmountMode] = useState<AmountMode>('signed')
  const [invert, setInvert] = useState(false)
  const [dateFormat, setDateFormat] = useState<DateFormat>('auto')
  const [accountId, setAccountId] = useState(GENERAL_ACCOUNT_ID)
  const [adjustBalance, setAdjustBalance] = useState(false)
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [dragging, setDragging] = useState(false)

  const text = useMemo(() => (bytes ? decodeBytes(bytes, encoding) : ''), [bytes, encoding])
  const table = useMemo(() => (text ? parseCsv(text, delimiter) : []), [text, delimiter])
  const header = hasHeader ? (table[0] ?? null) : null
  const body = hasHeader ? table.slice(1) : table
  const firstLine = hasHeader ? 2 : 1
  const columnCount = Math.max(0, ...table.slice(0, 20).map((r) => r.length))
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0]

  function detect(nextTable: string[][], withHeader: boolean): void {
    const head = withHeader ? (nextTable[0] ?? null) : null
    const rows = (withHeader ? nextTable.slice(1) : nextTable).slice(0, 30)
    const found = autoDetectMapping(head, rows)
    setMapping(found)
    setAmountMode(found.amount === -1 && (found.debit !== -1 || found.credit !== -1) ? 'split' : 'signed')
  }

  async function loadFile(file: File): Promise<void> {
    const data = new Uint8Array(await file.arrayBuffer())
    const decoded = decodeBytes(data, 'auto')
    const delim = detectDelimiter(decoded)
    const parsed = parseCsv(decoded, delim)
    // A first row that holds a date somewhere is data, not a header.
    const looksLikeData = (parsed[0] ?? []).some((c) => parseDate(c, 'dmy') !== null)
    setFileName(file.name)
    setBytes(data)
    setEncoding('auto')
    setDelimiter(delim)
    setHasHeader(!looksLikeData)
    setSkipped(new Set())
    detect(parsed, !looksLikeData)
  }

  const rows = useMemo(
    () => (mapping ? buildRows(body, firstLine, mapping, { amountMode, invert, dateFormat }) : []),
    [body, firstLine, mapping, amountMode, invert, dateFormat]
  )

  // Existing events of the target account, as a multiset: each file row can match (and use up) one of them.
  const statuses = useMemo(() => {
    const existing = new Map<string, number>()
    for (const ev of events) {
      if (ev.accountId !== account?.id) continue
      const key = `${ev.date}|${ev.type}|${ev.amount.toFixed(2)}`
      existing.set(key, (existing.get(key) ?? 0) + 1)
    }
    return rows.map((row): Status => {
      if (row.error || !row.date || row.amount === null || !row.type) return 'bad'
      if (row.currency && account && row.currency !== account.currency) return 'currency'
      if (row.type === 'transfer') {
        const dest = accounts.find((a) => a.name.toLowerCase() === row.toAccount.toLowerCase())
        if (!dest || dest.id === account?.id) return 'bad'
      }
      const key = `${row.date}|${row.type}|${row.amount.toFixed(2)}`
      const left = existing.get(key) ?? 0
      if (left > 0) {
        existing.set(key, left - 1)
        return 'duplicate'
      }
      return 'new'
    })
  }, [rows, events, account, accounts])

  // Rows ticked for import: new ones by default, anything else only when the user opts in.
  const [included, setIncluded] = useState<Set<number>>(new Set())
  const selected = useMemo(() => {
    const out: number[] = []
    rows.forEach((row, i) => {
      const status = statuses[i]
      if (status === 'bad' || status === 'currency') return
      const on = status === 'new' ? !skipped.has(row.line) : included.has(row.line)
      if (on) out.push(i)
    })
    return out
  }, [rows, statuses, skipped, included])

  const counts = useMemo(() => {
    const c = { new: 0, duplicate: 0, currency: 0, bad: 0 }
    for (const s of statuses) c[s]++
    return c
  }, [statuses])

  function toggle(i: number): void {
    const line = rows[i].line
    if (statuses[i] === 'new') {
      setSkipped((prev) => {
        const next = new Set(prev)
        if (next.has(line)) next.delete(line)
        else next.add(line)
        return next
      })
    } else {
      setIncluded((prev) => {
        const next = new Set(prev)
        if (next.has(line)) next.delete(line)
        else next.add(line)
        return next
      })
    }
  }

  function runImport(): void {
    if (!account || selected.length === 0) return
    updateData((draft) => {
      // Net effect per account, so back-filled history can leave the real balances alone.
      const net = new Map<string, number>()
      const bump = (id: string, delta: number): void => void net.set(id, (net.get(id) ?? 0) + delta)
      for (const i of selected) {
        const row = rows[i]
        if (!row.date || row.amount === null || !row.type) continue
        const dest =
          row.type === 'transfer'
            ? accounts.find((a) => a.name.toLowerCase() === row.toAccount.toLowerCase())
            : undefined
        if (row.type === 'transfer' && !dest) continue
        const toAmount = dest ? (row.toAmount ?? row.amount) : null
        addEvent(draft, {
          type: row.type,
          title: row.title,
          amount: row.amount,
          accountId: account.id,
          toAccountId: dest?.id ?? null,
          toAmount,
          date: row.date,
          category: row.category,
          counterpartyId: null,
          subscriptionId: null,
          confirmed: true,
          attachments: [],
          review: row.suspectTransfer && row.type !== 'transfer' ? 'transfer' : null
        })
        if (row.type === 'income') bump(account.id, row.amount)
        else bump(account.id, -row.amount)
        if (dest && toAmount) bump(dest.id, toAmount)
      }
      // Back-filled history shouldn't move today's balance unless asked to.
      if (!adjustBalance) for (const [id, delta] of net) adjustAccountBalance(draft, id, -delta)
    })
    onClose()
  }

  const colOptions = (): JSX.Element[] => [
    <option key={-1} value={-1}>
      {t('fin.importNone')}
    </option>,
    ...Array.from({ length: columnCount }, (_, i) => (
      <option key={i} value={i}>
        {header?.[i]?.trim() ? `${i + 1}. ${header[i].trim()}` : t('fin.importColumn', { n: i + 1 })}
      </option>
    ))
  ]

  const visibleFields = FIELDS.filter((f) =>
    amountMode === 'signed' ? f !== 'debit' && f !== 'credit' : f !== 'amount'
  )

  return (
    <div className="modal-overlay">
      <div className="modal-card fin-modal fin-modal--wide fin-import">
        <h2>{t('fin.importTitle')}</h2>

        {!bytes && (
          <label
            className={dragging ? 'fin-dropzone dragging' : 'fin-dropzone'}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const file = e.dataTransfer.files[0]
              if (file) void loadFile(file)
            }}
          >
            <input
              type="file"
              accept=".csv,.txt,text/csv"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void loadFile(file)
              }}
            />
            {t('fin.importPick')}
          </label>
        )}

        {bytes && mapping && (
          <>
            <div className="fin-import-file">
              {fileName} · {t('fin.importRows', { n: body.length })}
            </div>

            <div className="fin-import-grid">
              <label>
                {t('fin.importAccount')}
                <select value={account?.id ?? ''} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('fin.importDelimiter')}
                <select
                  value={delimiter}
                  onChange={(e) => {
                    setDelimiter(e.target.value)
                    detect(parseCsv(text, e.target.value), hasHeader)
                  }}
                >
                  <option value=";">;</option>
                  <option value=",">,</option>
                  <option value={'\t'}>Tab</option>
                  <option value="|">|</option>
                </select>
              </label>
              <label>
                {t('fin.importEncoding')}
                <select value={encoding} onChange={(e) => setEncoding(e.target.value as Encoding)}>
                  <option value="auto">{t('fin.importAuto')}</option>
                  <option value="utf-8">UTF-8</option>
                  <option value="windows-1250">Windows-1250</option>
                  <option value="windows-1251">Windows-1251</option>
                </select>
              </label>
              <label>
                {t('fin.importDateFormat')}
                <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)}>
                  <option value="auto">{t('fin.importAuto')}</option>
                  <option value="dmy">DD.MM.YYYY</option>
                  <option value="mdy">MM/DD/YYYY</option>
                  <option value="iso">YYYY-MM-DD</option>
                </select>
              </label>
            </div>

            <div className="fin-import-checks">
              <label>
                <input
                  type="checkbox"
                  checked={hasHeader}
                  onChange={(e) => {
                    setHasHeader(e.target.checked)
                    detect(table, e.target.checked)
                  }}
                />
                {t('fin.importHasHeader')}
              </label>
              <label>
                <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
                {t('fin.importInvert')}
              </label>
            </div>

            <div className="fin-import-mode">
              <label>
                <input type="radio" checked={amountMode === 'signed'} onChange={() => setAmountMode('signed')} />
                {t('fin.importAmountSigned')}
              </label>
              <label>
                <input type="radio" checked={amountMode === 'split'} onChange={() => setAmountMode('split')} />
                {t('fin.importAmountSplit')}
              </label>
            </div>

            <div className="fin-import-grid">
              {visibleFields.map((field) => (
                <label key={field}>
                  {t(FIELD_KEYS[field])}
                  <select
                    value={mapping[field]}
                    onChange={(e) => setMapping({ ...mapping, [field]: Number(e.target.value) })}
                  >
                    {colOptions()}
                  </select>
                </label>
              ))}
            </div>

            <label className="fin-import-adjust">
              <input type="checkbox" checked={adjustBalance} onChange={(e) => setAdjustBalance(e.target.checked)} />
              <span>
                {t('fin.importAdjustBalance')}
                <small>{t('fin.importAdjustHint')}</small>
              </span>
            </label>

            <div className="fin-import-summary">
              {t('fin.importSummary', {
                n: counts.new,
                d: counts.duplicate,
                c: counts.currency,
                e: counts.bad
              })}
            </div>

            <div className="fin-import-table">
              <table>
                <thead>
                  <tr>
                    <th />
                    <th>{t('fin.importColDate')}</th>
                    <th>{t('fin.importColDescription')}</th>
                    <th>{t('fin.importColCategory')}</th>
                    <th className="num">{t('fin.importColAmount')}</th>
                    <th>{t('fin.importStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, PREVIEW_LIMIT).map((row, i) => {
                    const status = statuses[i]
                    const disabled = status === 'bad' || status === 'currency'
                    return (
                      <tr key={row.line} className={disabled ? 'off' : undefined}>
                        <td>
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={selected.includes(i)}
                            onChange={() => toggle(i)}
                          />
                        </td>
                        <td>{row.date ?? '—'}</td>
                        <td>
                          {row.suspectTransfer && row.type !== 'transfer' && (
                            <span className="fin-review-badge" title={t('fin.reviewTransfer')}>
                              ⚠
                            </span>
                          )}
                          {row.type === 'transfer' && `→ ${row.toAccount}: `}
                          {row.title}
                        </td>
                        <td>{row.category}</td>
                        <td className={row.type === 'income' ? 'num income' : 'num'}>
                          {row.amount !== null && account
                            ? `${row.type === 'income' ? '+' : row.type === 'transfer' ? '⇄' : '−'}${formatMoney(row.amount, account.currency)}`
                            : '—'}
                        </td>
                        <td>{t(`fin.importStatus_${status}` as 'fin.importStatus_new')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {rows.length > PREVIEW_LIMIT && (
                <div className="fin-empty">{t('fin.importMore', { n: rows.length - PREVIEW_LIMIT })}</div>
              )}
            </div>
          </>
        )}

        <div className="modal-actions">
          {bytes && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setBytes(null)
                setMapping(null)
              }}
            >
              {t('fin.importOtherFile')}
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          {bytes && (
            <button type="button" className="btn btn-primary" onClick={runImport} disabled={selected.length === 0}>
              {t('fin.importDo', { n: selected.length })}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
