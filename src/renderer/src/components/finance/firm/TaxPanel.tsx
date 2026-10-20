import { useState } from 'react'
import { useFirmLabel } from '../../../lib/firmLabels'
import { PIT, VAT_EXEMPTION_LIMIT, dueDate } from '../../../lib/polishTax'
import type { Firm } from '../../../lib/types'
import TaxSettingsModal from './TaxSettingsModal'
import { useFirmYear } from './useFirmYear'
import { useFirmPayroll } from './usePayroll'

const pln = (n: number): string => `${n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
const ddmm = (iso: string): string => iso.slice(5).split('-').reverse().join('.')

function Row({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: string }): JSX.Element {
  return (
    <div className={`tax-row${strong ? ' tax-row--strong' : ''}`} title={hint}>
      <span>{label}</span>
      <span className="tax-value">{value}</span>
    </div>
  )
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }): JSX.Element {
  const ratio = Math.max(0, Math.min(1, used / limit))
  return (
    <div className="tax-meter">
      <div className="tax-row">
        <span>{label}</span>
        <span className="tax-value">{Math.round(ratio * 100)}%</span>
      </div>
      <div className="fin-progress">
        <div className="fin-progress-bar" style={{ width: `${ratio * 100}%`, background: ratio >= 0.9 ? '#ff5c72' : ratio >= 0.7 ? '#ffb74d' : '#6c8cff' }} />
      </div>
      <div className="fin-widget-note">
        {pln(used)} / {pln(limit)}
      </div>
    </div>
  )
}

/** The firm's taxes and ZUS for the selected month, to keep an eye on "na bieżąco". */
export default function TaxPanel({ firm, month }: { firm: Firm; month: string }): JSX.Element {
  const F = useFirmLabel()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { year, current, taxes, monthIndex } = useFirmYear(firm, month)
  const { totals: staff } = useFirmPayroll(firm, month)
  if (!current) return <></>
  const zusTotal = current.social.total + current.health
  // Quarterly VAT accumulates over the quarter and is due on the 25th after it ends.
  const quarterEnd = Math.ceil(monthIndex / 3) * 3
  const vatDue =
    firm.tax.vatPeriod === 'quarter'
      ? taxes.slice(quarterEnd - 3, monthIndex).reduce((s, m) => s + m.vat, 0)
      : current.vat
  const vatMonth = firm.tax.vatPeriod === 'quarter' ? `${year}-${String(quarterEnd).padStart(2, '0')}` : current.month
  const vatLimit = VAT_EXEMPTION_LIMIT[String(year)] ?? VAT_EXEMPTION_LIMIT['2026']

  return (
    <div className="tax-panel">
      <div className="fin-section-head">
        <div className="fin-section-title">{F('tax.title')}</div>
        <button type="button" className="icon-btn" title={F('tax.settings')} onClick={() => setSettingsOpen(true)}>
          ⚙
        </button>
      </div>
      <div className="fin-hint">{F(`ts.form.${firm.tax.form}`)} · {F(`ts.zus.${firm.tax.zus}`)}</div>

      <div className="tax-card">
        {current.social.total > 0 && <Row label={F('tax.social')} value={pln(current.social.social)} hint={`${F('tax.labourFund')}: ${pln(current.social.labourFund)}`} />}
        {current.social.labourFund > 0 && <Row label={F('tax.labourFund')} value={pln(current.social.labourFund)} />}
        <Row label={F('tax.health')} value={pln(current.health)} />
        <Row label={F('tax.zusTotal', { date: ddmm(dueDate(current.month, 20)) })} value={pln(zusTotal)} strong />
      </div>
      <div className="tax-card">
        <Row label={F('tax.pit', { date: ddmm(dueDate(current.month, 20)) })} value={pln(current.pitAdvance)} strong />
        <Row label={F('tax.base')} value={pln(Math.max(0, current.ytdBase))} />
        <Row label={F('tax.pitYtd')} value={pln(current.ytdPit)} />
      </div>
      {firm.tax.vatPayer && (
        <div className="tax-card">
          <Row
            label={vatDue >= 0 ? F('tax.vat', { date: ddmm(dueDate(vatMonth, 25)) }) : F('tax.vatRefund')}
            value={pln(Math.abs(vatDue))}
            strong
          />
        </div>
      )}
      {!firm.tax.vatPayer && current.vatInfo > 0 && (
        <div className="tax-card">
          <Row label={F('vat.docVat')} value={pln(current.vatInfo)} hint={F('vat.modeNoVatHint')} />
        </div>
      )}
      <div className="tax-card">
        <Row label={F('tax.income')} value={pln(current.ytdIncome)} />
        {firm.tax.form === 'skala' && <Meter label={F('tax.threshold')} used={Math.max(0, current.ytdBase)} limit={PIT.skalaThreshold} />}
        {!firm.tax.vatPayer && <Meter label={F('tax.vatLimit')} used={current.ytdRevenue} limit={vatLimit} />}
      </div>
      {(staff.cost > 0 || staff.b2b > 0) && (
        <div className="tax-card">
          <div className="fin-tile-label">{F('tax.staffTitle', { month })}</div>
          {staff.zus > 0 && <Row label={F('tax.staffZus', { date: ddmm(dueDate(current.month, 20)) })} value={pln(staff.zus)} />}
          {staff.pit > 0 && <Row label={F('tax.staffPit', { date: ddmm(dueDate(current.month, 20)) })} value={pln(staff.pit)} />}
          {staff.net > 0 && <Row label={F('tax.staffNet')} value={pln(staff.net)} />}
          {staff.b2b > 0 && <Row label={F('tax.staffB2b')} value={pln(staff.b2b)} />}
        </div>
      )}
      <div className="tax-card">
        <Row
          label={F('tax.totalDue')}
          value={pln(zusTotal + current.pitAdvance + staff.zus + staff.pit + (firm.tax.vatPayer && vatDue > 0 && (firm.tax.vatPeriod === 'month' || monthIndex % 3 === 0) ? vatDue : 0))}
          strong
        />
      </div>
      <div className="fin-widget-note">{F('tax.estimate')}</div>

      {settingsOpen && <TaxSettingsModal firm={firm} year={year} onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
