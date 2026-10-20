import { useFirmLabel } from '../../../lib/firmLabels'
import { dueDate } from '../../../lib/polishTax'
import type { VatByRate, VatEntry, VatRegister } from '../../../lib/vat'
import type { LedgerEvent } from '../../../lib/types'

const money = (n: number): string => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ddmm = (iso: string): string => iso.split('-').reverse().join('.')

interface Props {
  register: VatRegister
  /** The settlement period: 'YYYY-MM' or 'Qn YYYY'. */
  label: string
  /** Last month of the period, for the payment deadline. */
  lastMonth: string
  events: Map<string, LedgerEvent>
  onEdit: (ev: LedgerEvent) => void
}

function RateTable({ title, rows, total }: { title: string; rows: VatByRate[]; total: number }): JSX.Element {
  const F = useFirmLabel()
  return (
    <div className="vat-box">
      <div className="fin-section-title">{title}</div>
      <table className="rzis-table">
        <thead>
          <tr>
            <td>{F('vat.rate')}</td>
            <td className="num">{F('ev.net')}</td>
            <td className="num">VAT</td>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="fin-empty">
                —
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={String(r.rate)}>
              <td>{r.rate === null ? 'zw / np' : `${r.rate}%`}</td>
              <td className="num">{money(r.net)}</td>
              <td className="num">{money(r.vat)}</td>
            </tr>
          ))}
          <tr className="rzis-total">
            <td>{F('vat.total')}</td>
            <td className="num">{money(rows.reduce((s, r) => s + r.net, 0))}</td>
            <td className="num">{money(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function EntryTable({ title, rows, events, onEdit }: { title: string; rows: VatEntry[]; events: Map<string, LedgerEvent>; onEdit: (ev: LedgerEvent) => void }): JSX.Element {
  const F = useFirmLabel()
  return (
    <div className="vat-entries">
      <div className="fin-section-title">{title}</div>
      <div className="kpir-table">
        <table>
          <thead>
            <tr>
              <th>{F('vat.date')}</th>
              <th>{F('ev.docNumber')}</th>
              <th>{F('ev.cpName')}</th>
              <th>NIP</th>
              <th className="num">{F('ev.net')}</th>
              <th className="num">VAT</th>
              <th className="num">{F('ev.gross')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="fin-empty">
                  —
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.eventId} className="kpir-row" onClick={() => events.get(r.eventId) && onEdit(events.get(r.eventId) as LedgerEvent)}>
                <td>{ddmm(r.date)}</td>
                <td>{r.docNumber}</td>
                <td>{r.counterparty}</td>
                <td>{r.nip}</td>
                <td className="num">{money(r.net)}</td>
                <td className="num">{money(r.vat)}</td>
                <td className="num">{money(r.gross)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Sales and purchase VAT registers of the settlement period, and the VAT to pay. */
export default function VatRegisterView({ register, label, lastMonth, events, onEdit }: Props): JSX.Element {
  const F = useFirmLabel()
  return (
    <div className="vat-view">
      <div className="vat-summary">
        <div className="fin-tile">
          <span className="fin-tile-label">{F('vat.output')}</span>
          <span className="fin-tile-value">{money(register.outputVat)} zł</span>
        </div>
        <div className="fin-tile">
          <span className="fin-tile-label">{F('vat.input')}</span>
          <span className="fin-tile-value">{money(register.inputVat)} zł</span>
        </div>
        <div className="fin-tile">
          <span className="fin-tile-label">
            {register.due >= 0 ? F('tax.vat', { date: ddmm(dueDate(lastMonth, 25)).slice(0, 5) }) : F('tax.vatRefund')}
          </span>
          <span className={`fin-tile-value${register.due < 0 ? ' fin-income' : ''}`}>{money(Math.abs(register.due))} zł</span>
        </div>
      </div>
      <div className="fin-hint">
        {F('vat.period')}: {label}
        {register.missing > 0 && <> · ⚠ {F('vat.missing', { n: register.missing })}</>}
      </div>
      <div className="vat-rates">
        <RateTable title={F('vat.salesRates')} rows={register.salesByRate} total={register.outputVat} />
        <RateTable title={F('vat.purchaseRates')} rows={register.purchasesByRate} total={register.inputVat} />
      </div>
      <EntryTable title={F('vat.salesRegister')} rows={register.sales} events={events} onEdit={onEdit} />
      <EntryTable title={F('vat.purchaseRegister')} rows={register.purchases} events={events} onEdit={onEdit} />
    </div>
  )
}
