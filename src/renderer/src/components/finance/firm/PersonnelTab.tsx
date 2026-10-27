import { useMemo, useState } from 'react'
import { useAppStore } from '../../../state/useAppStore'
import { useFirmLabel } from '../../../lib/firmLabels'
import { useT } from '../../../lib/i18n/useT'
import { dueDate } from '../../../lib/polishTax'
import { isActive, payrollYearRun, type PayslipMonth } from '../../../lib/payroll'
import type { Firm, StaffMember } from '../../../lib/types'
import ConfirmModal from '../../common/ConfirmModal'
import DraSummary from './DraSummary'
import StaffModal from './StaffModal'
import { payrollEventId, postPayroll, useFirmPayroll } from './usePayroll'

type Group = 'uop' | 'civil' | 'b2b'
const groupOf = (m: StaffMember): Group => (m.contract === 'uop' ? 'uop' : m.contract === 'b2b' ? 'b2b' : 'civil')
const money = (n: number): string => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ddmm = (iso: string): string => iso.slice(5).split('-').reverse().join('.')
const fraction = (fte: number): string => {
  const known: [number, string][] = [[1, '1/1'], [0.875, '7/8'], [0.75, '3/4'], [0.5, '1/2'], [1 / 3, '1/3'], [0.25, '1/4'], [0.125, '1/8']]
  return known.find(([v]) => Math.abs(v - fte) < 0.001)?.[1] ?? String(Math.round(fte * 100) / 100)
}

/** The firm's staff: employees on UoP, people on civil contracts and B2B contractors, with what is owed for the month. */
export default function PersonnelTab({ firm, month }: { firm: Firm; month: string }): JSX.Element {
  const F = useFirmLabel()
  const t = useT()
  const updateData = useAppStore((s) => s.updateData)
  const [groups, setGroups] = useState<Set<Group>>(new Set(['uop', 'civil', 'b2b']))
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<StaffMember | 'new' | null>(null)
  const [deleting, setDeleting] = useState<StaffMember | null>(null)
  const { slips, totals } = useFirmPayroll(firm, month)
  const staff = firm.staff ?? []
  const slipOf = useMemo(() => new Map<string, PayslipMonth>(slips.map((s) => [s.member.id, s])), [slips])
  const posted = firm.ledger.events.find((e) => e.id === payrollEventId(month))

  const shown = staff
    .filter((m) => groups.has(groupOf(m)))
    .filter((m) => showInactive || isActive(m, month) || (m.endDate === null && m.startDate > `${month}-31`))
    .sort((a, b) => groupOf(a).localeCompare(groupOf(b)) || a.lastName.localeCompare(b.lastName))

  function toggle(g: Group): void {
    setGroups((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  function post(): void {
    // The yearly run is recomputed inside the mutation so the booked figures match the data being changed.
    updateData((draft) => {
      const target = draft.firms?.find((f) => f.id === firm.id)
      if (!target) return
      const year = Number(month.slice(0, 4))
      const idx = Number(month.slice(5, 7))
      const monthSlips = payrollYearRun(target.staff ?? [], target.tax, year, idx)[idx - 1] ?? []
      postPayroll(target, month, monthSlips)
    })
  }

  const contractLabel = (m: StaffMember): string =>
    m.contract === 'uop' ? `UoP ${fraction(m.fte)}` : m.contract === 'zlecenie' ? 'Zlecenie' : m.contract === 'dzielo' ? 'Dzieło' : 'B2B'
  const tile = (label: string, value: number): JSX.Element => (
    <div className="fin-tile">
      <span className="fin-tile-label">{label}</span>
      <span className="fin-tile-value">{money(value)} zł</span>
    </div>
  )

  return (
    <div className="fin-tab staff-tab">
      <div className="staff-summary">
        {tile(F('staff.sum.gross'), totals.gross)}
        {tile(F('staff.sum.net'), totals.net)}
        {tile(F('staff.sum.zus', { date: ddmm(dueDate(month, 20)) }), totals.zus)}
        {tile(F('staff.sum.pit', { date: ddmm(dueDate(month, 20)) }), totals.pit)}
        {tile(F('staff.sum.cost'), totals.cost)}
        {tile(F('staff.sum.b2b'), totals.b2b)}
      </div>

      <div className="kpir-bar">
        <div className="staff-filters">
          {(['uop', 'civil', 'b2b'] as const).map((g) => (
            <button key={g} type="button" className={`fin-chip${groups.has(g) ? ' active' : ''}`} onClick={() => toggle(g)}>
              {F(`staff.filter.${g}`)}
            </button>
          ))}
          <label className="fin-keep-balances">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            {F('staff.showInactive')}
          </label>
        </div>
        <div className="reward-row">
          <button type="button" className="btn" onClick={post} disabled={totals.cost === 0} title={F('staff.postHint')}>
            {posted ? F('staff.repost') : F('staff.post', { month })}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            {F('staff.add')}
          </button>
        </div>
      </div>
      {posted && <div className="fin-hint">✓ {F('staff.posted', { amount: `${money(posted.amount)} zł` })}</div>}

      <div className="kpir-table">
        <table>
          <thead>
            <tr>
              <th>{F('staff.col.name')}</th>
              <th>{F('staff.col.contract')}</th>
              <th>{F('staff.from')}</th>
              <th className="num">{F('staff.col.gross')}</th>
              <th className="num">{F('staff.col.net')}</th>
              <th className="num">{F('staff.col.zus')}</th>
              <th className="num">{F('staff.col.pit')}</th>
              <th className="num">{F('staff.col.cost')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={9} className="fin-empty">
                  {F('staff.empty')}
                </td>
              </tr>
            )}
            {shown.map((m) => {
              const slip = slipOf.get(m.id)
              const warn = slip?.flags.filter((f) => f.startsWith('below')) ?? []
              return (
                <tr key={m.id} className={`kpir-row${slip ? '' : ' staff-inactive'}`} onClick={() => setEditing(m)}>
                  <td>
                    {warn.length > 0 && (
                      <span className="fin-review-badge" title={warn.map((f) => F(`staff.f.${f}`)).join('\n')}>
                        ⚠
                      </span>
                    )}
                    {`${m.firstName} ${m.lastName}`.trim() || m.company}
                    {slip && slip.overridden.length > 0 && <span className="staff-manual" title={F('staff.manual')}> ✎</span>}
                    <small className="kpir-sub">{m.contract === 'b2b' ? [m.company, m.nip && `NIP ${m.nip}`].filter(Boolean).join(' · ') : m.position}</small>
                  </td>
                  <td>{contractLabel(m)}</td>
                  <td>
                    {ddmm(m.startDate)}
                    {m.endDate && <small className="kpir-sub">– {ddmm(m.endDate)}</small>}
                  </td>
                  <td className="num">{slip ? money(slip.gross) : '—'}</td>
                  <td className="num">{slip ? money(slip.net) : '—'}</td>
                  <td className="num">{slip ? money(slip.zus) : '—'}</td>
                  <td className="num">{slip ? money(slip.pit) : '—'}</td>
                  <td className="num">{slip ? money(slip.cost) : '—'}</td>
                  <td className="num">
                    <button
                      type="button"
                      className="icon-btn"
                      title={t('common.delete')}
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleting(m)
                      }}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="fin-hint">{F('staff.simplified')}</div>
      <DraSummary firm={firm} month={month} slips={slips} />

      {editing && (
        <StaffModal firm={firm} month={month} member={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
      {deleting && (
        <ConfirmModal
          message={F('staff.deleteConfirm', { name: `${deleting.firstName} ${deleting.lastName}`.trim() || deleting.company || '' })}
          onConfirm={() => {
            updateData((draft) => {
              const target = draft.firms?.find((f) => f.id === firm.id)
              if (target) target.staff = (target.staff ?? []).filter((s) => s.id !== deleting.id)
            })
            setDeleting(null)
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
