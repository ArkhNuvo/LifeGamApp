import { useFirmLabel } from '../../../lib/firmLabels'
import { newId } from '../../../lib/ids'
import { KPIR_COLUMNS, VAT_RATES, defaultColumn } from '../../../lib/kpir'
import type { KpirColumn, LedgerDocument, LedgerEventType, LedgerItem } from '../../../lib/types'

const r2 = (n: number): number => Math.round(n * 100) / 100
const num = (v: string): number => {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Recomputes the dependent amounts after one of net / gross / rate changed. */
export function recalcItem(item: LedgerItem, changed: 'net' | 'gross' | 'rate'): LedgerItem {
  const rate = item.vatRate ?? 0
  if (changed === 'gross') {
    const net = r2(item.gross / (1 + rate / 100))
    return { ...item, net, vat: r2(item.gross - net) }
  }
  const vat = r2((item.net * rate) / 100)
  return { ...item, vat, gross: r2(item.net + vat) }
}

export function itemsTotal(items: LedgerItem[]): { net: number; vat: number; gross: number } {
  return items.reduce((s, i) => ({ net: r2(s.net + i.net), vat: r2(s.vat + i.vat), gross: r2(s.gross + i.gross) }), { net: 0, vat: 0, gross: 0 })
}

interface Props {
  type: LedgerEventType
  doc: LedgerDocument
  onDoc: (doc: LedgerDocument) => void
  items: LedgerItem[]
  onItems: (items: LedgerItem[]) => void
  /** The event's own amount, to warn when it differs from the lines. */
  amount: number
  currency: string
  onUseTotal: (gross: number) => void
}

/** Firm events: the document's details and its lines, each booked in a KPiR column. */
export default function DocumentItems({ type, doc, onDoc, items, onItems, amount, currency, onUseTotal }: Props): JSX.Element {
  const F = useFirmLabel()
  const total = itemsTotal(items)
  const fallback = defaultColumn(type)
  const mismatch = items.length > 0 && Math.abs(total.gross - amount) > 0.009

  function patch(id: string, change: Partial<LedgerItem>, recalc?: 'net' | 'gross' | 'rate'): void {
    onItems(items.map((it) => (it.id === id ? (recalc ? recalcItem({ ...it, ...change }, recalc) : { ...it, ...change }) : it)))
  }

  function add(): void {
    // A first line takes over the amount already typed for the event.
    const gross = items.length === 0 && amount > 0 ? amount : 0
    const line: LedgerItem = recalcItem(
      { id: newId(), description: '', net: 0, vatRate: 23, vat: 0, gross, kpir: fallback },
      'gross'
    )
    onItems([...items, line])
  }

  return (
    <div className="firm-doc">
      <details open={!!doc.number || !!doc.counterpartyName}>
        <summary>{F('ev.doc')}</summary>
        <div className="firm-doc-grid">
          <label className="form-field">
            <span>{F('ev.docNumber')}</span>
            <input value={doc.number} onChange={(e) => onDoc({ ...doc, number: e.target.value })} />
          </label>
          <label className="form-field">
            <span>{F('ev.ksef')}</span>
            <input value={doc.ksef ?? ''} onChange={(e) => onDoc({ ...doc, ksef: e.target.value })} />
          </label>
          <label className="form-field">
            <span>{F('ev.cpName')}</span>
            <input value={doc.counterpartyName ?? ''} onChange={(e) => onDoc({ ...doc, counterpartyName: e.target.value })} />
          </label>
          <label className="form-field">
            <span>{F('ev.cpNip')}</span>
            <input value={doc.counterpartyNip ?? ''} onChange={(e) => onDoc({ ...doc, counterpartyNip: e.target.value })} />
          </label>
          <label className="form-field firm-doc-wide">
            <span>{F('ev.cpAddress')}</span>
            <input value={doc.counterpartyAddress ?? ''} onChange={(e) => onDoc({ ...doc, counterpartyAddress: e.target.value })} />
          </label>
        </div>
      </details>

      <div className="firm-items-head">
        <span className="fin-section-title">{F('ev.items')}</span>
        <button type="button" className="btn" onClick={add}>
          {F('ev.addItem')}
        </button>
      </div>
      {items.length === 0 && <div className="field-hint">{F('ev.itemsHint', { col: fallback })}</div>}
      {items.length > 0 && (
        <div className="firm-items">
          <div className="firm-item firm-item--head">
            <span>{F('ev.itemDesc')}</span>
            <span>{F('ev.net')}</span>
            <span>{F('ev.vatRate')}</span>
            <span>{F('ev.gross')}</span>
            <span>{F('ev.column')}</span>
            <span />
          </div>
          {items.map((it) => (
            <div key={it.id} className="firm-item">
              <input value={it.description} onChange={(e) => patch(it.id, { description: e.target.value })} />
              <input type="number" step="0.01" value={it.net} onChange={(e) => patch(it.id, { net: num(e.target.value) }, 'net')} />
              <select
                value={it.vatRate === null ? 'zw' : String(it.vatRate)}
                onChange={(e) => patch(it.id, { vatRate: e.target.value === 'zw' ? null : Number(e.target.value) }, 'rate')}
                title={`${F('ev.vat')}: ${it.vat.toFixed(2)}`}
              >
                {VAT_RATES.map((r) => (
                  <option key={String(r)} value={r === null ? 'zw' : String(r)}>
                    {r === null ? F('ev.exempt') : `${r}%`}
                  </option>
                ))}
              </select>
              <input type="number" step="0.01" value={it.gross} onChange={(e) => patch(it.id, { gross: num(e.target.value) }, 'gross')} />
              <select value={it.kpir ?? fallback} onChange={(e) => patch(it.id, { kpir: e.target.value as KpirColumn })}>
                {KPIR_COLUMNS.map((c) => (
                  <option key={c.id} value={c.id} title={c.label}>
                    {c.id} · {c.label}
                  </option>
                ))}
                <option value="-">— {F('ev.notInBook')}</option>
              </select>
              <button type="button" className="icon-btn" onClick={() => onItems(items.filter((x) => x.id !== it.id))}>
                ✕
              </button>
            </div>
          ))}
          <div className="firm-items-total">
            {F('ev.itemsTotal', { net: total.net.toFixed(2), vat: total.vat.toFixed(2), gross: total.gross.toFixed(2) })} {currency}
          </div>
          {mismatch && (
            <div className="field-hint fin-negative">
              {F('ev.mismatch')}{' '}
              <button type="button" className="btn" onClick={() => onUseTotal(total.gross)}>
                {F('ev.useTotal')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
