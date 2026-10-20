import { useMemo, useState } from 'react'
import { useAppStore } from '../../../state/useAppStore'
import { useFirmLabel } from '../../../lib/firmLabels'
import { useT } from '../../../lib/i18n/useT'
import { newId } from '../../../lib/ids'
import {
  birthDateFromPesel,
  blankMember,
  isValidPesel,
  payrollYearRun,
  type PayslipMonth
} from '../../../lib/payroll'
import type { ContractType, Firm, StaffMember } from '../../../lib/types'

const CONTRACTS: ContractType[] = ['uop', 'zlecenie', 'dzielo', 'b2b']
const FTE: [number, string][] = [
  [1, '1/1'],
  [0.875, '7/8'],
  [0.75, '3/4'],
  [0.5, '1/2'],
  [1 / 3, '1/3'],
  [0.25, '1/4'],
  [0.125, '1/8']
]
const money = (n: number): string => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Breakdown({ slip }: { slip: PayslipMonth }): JSX.Element {
  const F = useFirmLabel()
  const row = (label: string, value: number, strong = false): JSX.Element => (
    <div className={`tax-row${strong ? ' tax-row--strong' : ''}`}>
      <span>{label}</span>
      <span className="tax-value">{money(value)} zł</span>
    </div>
  )
  if (slip.member.contract === 'b2b') {
    return (
      <div className="tax-card">
        <div className="tax-row">{F('staff.r.invoice', { net: money(slip.gross), vat: money(slip.vat) })}</div>
        {row(F('staff.r.cost'), slip.cost, true)}
      </div>
    )
  }
  const e = slip.employee
  const er = slip.employer
  return (
    <div className="tax-card">
      {row(F('staff.r.gross'), slip.gross)}
      {row(F('staff.r.social'), e.pension + e.disability + e.sickness)}
      {row(F('staff.r.health'), e.health)}
      {slip.deductibleCosts > 0 && row(F('staff.r.kup'), slip.deductibleCosts)}
      {slip.taxBase > 0 && row(F('staff.r.base'), slip.taxBase)}
      {row(F('staff.r.pit'), slip.pit)}
      {e.ppk > 0 && row(F('staff.r.ppk'), e.ppk)}
      {row(F('staff.r.net'), slip.net, true)}
      {row(F('staff.r.employer'), er.pension + er.disability + er.accident + er.labourFund + er.fgsp)}
      {er.ppk > 0 && row(F('staff.r.ppkEr'), er.ppk)}
      {row(F('staff.r.cost'), slip.cost, true)}
      {slip.flags
        .filter((f) => f !== 'b2b')
        .map((f) => (
          <div key={f} className={`fin-widget-note${f.startsWith('below') ? ' fin-negative' : ''}`}>
            {f.startsWith('below') ? '⚠ ' : 'ℹ '}
            {F(`staff.f.${f}`)}
          </div>
        ))}
    </div>
  )
}

interface Props {
  firm: Firm
  month: string
  /** Person to edit; omitted to add one. */
  member?: StaffMember
  onClose: () => void
}

/** An employee or contractor: contract, pay and the options that change ZUS and PIT, with a live calculation. */
export default function StaffModal({ firm, month, member, onClose }: Props): JSX.Element {
  const F = useFirmLabel()
  const t = useT()
  const updateData = useAppStore((s) => s.updateData)
  const [m, setM] = useState<StaffMember>(member ?? { ...blankMember('uop'), id: '' })
  const [customFte, setCustomFte] = useState(!FTE.some(([v]) => Math.abs(v - (member?.fte ?? 1)) < 0.001))
  const set = <K extends keyof StaffMember>(key: K, value: StaffMember[K]): void => setM((prev) => ({ ...prev, [key]: value }))
  const num = (v: string): number => {
    const n = parseFloat(v.replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  function setContract(c: ContractType): void {
    // Keep who the person is, reset what depends on the contract.
    const fresh = blankMember(c)
    setM((prev) => ({
      ...fresh,
      id: prev.id,
      firstName: prev.firstName,
      lastName: prev.lastName,
      pesel: prev.pesel,
      company: prev.company,
      nip: prev.nip,
      position: prev.position,
      startDate: prev.startDate,
      endDate: prev.endDate,
      rate: prev.rate,
      note: prev.note
    }))
  }

  const peselDigits = m.pesel.replace(/\D/g, '')
  // B2B contractors are identified by their NIP; a PESEL left from another contract type doesn't matter.
  const peselOk = m.contract === 'b2b' || peselDigits.length === 0 || isValidPesel(peselDigits)
  const birth = birthDateFromPesel(peselDigits)
  const age = birth ? Math.floor((Date.now() - new Date(birth + 'T12:00:00').getTime()) / (365.25 * 86400000)) : null
  const named = m.contract === 'b2b' ? (m.company ?? '').trim() || m.lastName.trim() : m.firstName.trim() && m.lastName.trim()
  const valid = !!named && peselOk && m.rate > 0

  // The calculation for the shown month, with the rest of the staff (yearly limits are per person, so this one alone is enough).
  const slip = useMemo(() => {
    const year = Number(month.slice(0, 4))
    const idx = Number(month.slice(5, 7))
    const probe = { ...m, id: m.id || 'draft' }
    return payrollYearRun([probe], firm.tax, year, idx)[idx - 1]?.[0]
  }, [m, firm.tax, month])

  function save(): void {
    if (!valid) return
    updateData((draft) => {
      const target = draft.firms?.find((f) => f.id === firm.id)
      if (!target) return
      if (!target.staff) target.staff = []
      const record = { ...m, pesel: m.contract === 'b2b' ? '' : peselDigits, id: m.id || newId() }
      const i = target.staff.findIndex((s) => s.id === record.id)
      if (i >= 0) target.staff[i] = record
      else target.staff.push(record)
    })
    onClose()
  }

  const check = (key: keyof StaffMember, label: string): JSX.Element => (
    <label className="fin-keep-balances">
      <input type="checkbox" checked={!!m[key]} onChange={(e) => set(key, e.target.checked as never)} />
      {label}
    </label>
  )

  return (
    <div className="modal-overlay">
      <div className="modal-card fin-modal fin-modal--wide staff-modal">
        <h2>{member ? `${member.firstName} ${member.lastName}`.trim() || member.company : F('staff.add').replace('+ ', '')}</h2>

        <div className="fin-type-switch staff-contracts">
          {CONTRACTS.map((c) => (
            <button
              key={c}
              type="button"
              className={`fin-type-btn fin-type-btn--transfer${m.contract === c ? ' active' : ''}`}
              onClick={() => setContract(c)}
            >
              {F(`staff.c.${c}`)}
            </button>
          ))}
        </div>
        <div className="field-hint">{F(`staff.c.${m.contract}.hint`)}</div>

        <div className="staff-grid">
          <div className="staff-form">
            {m.contract === 'b2b' && (
              <div className="fin-row">
                <label className="form-field fin-grow">
                  <span>{F('staff.company')}</span>
                  <input value={m.company ?? ''} onChange={(e) => set('company', e.target.value)} />
                </label>
                <label className="form-field">
                  <span>NIP</span>
                  <input value={m.nip ?? ''} onChange={(e) => set('nip', e.target.value)} />
                </label>
              </div>
            )}
            <div className="fin-row">
              <label className="form-field fin-grow">
                <span>{F('staff.firstName')}</span>
                <input value={m.firstName} onChange={(e) => set('firstName', e.target.value)} autoFocus />
              </label>
              <label className="form-field fin-grow">
                <span>{F('staff.lastName')}</span>
                <input value={m.lastName} onChange={(e) => set('lastName', e.target.value)} />
              </label>
            </div>
            {m.contract !== 'b2b' && (
              <label className="form-field">
                <span>{F('staff.pesel')}</span>
                <input value={m.pesel} inputMode="numeric" maxLength={11} onChange={(e) => set('pesel', e.target.value)} />
                {!peselOk && <span className="field-hint fin-negative">{F('staff.peselInvalid')}</span>}
                {peselOk && birth && age !== null && <span className="field-hint">{F('staff.born', { date: birth, age })}</span>}
              </label>
            )}
            <label className="form-field">
              <span>{F('staff.position')}</span>
              <input value={m.position} onChange={(e) => set('position', e.target.value)} />
            </label>
            <div className="fin-row">
              <label className="form-field fin-grow">
                <span>{F('staff.from')}</span>
                <input type="date" value={m.startDate} onChange={(e) => set('startDate', e.target.value)} />
              </label>
              <label className="form-field fin-grow">
                <span>{F('staff.to')}</span>
                <input type="date" value={m.endDate ?? ''} onChange={(e) => set('endDate', e.target.value || null)} />
              </label>
            </div>

            {m.contract === 'uop' && (
              <div className="fin-row">
                <label className="form-field">
                  <span>{F('staff.fte')}</span>
                  <select
                    value={customFte ? 'other' : String(FTE.find(([v]) => Math.abs(v - m.fte) < 0.001)?.[0] ?? 1)}
                    onChange={(e) => {
                      if (e.target.value === 'other') {
                        setCustomFte(true)
                        return
                      }
                      setCustomFte(false)
                      set('fte', Number(e.target.value))
                    }}
                  >
                    {FTE.map(([v, label]) => (
                      <option key={label} value={String(v)}>
                        {label}
                      </option>
                    ))}
                    <option value="other">{F('staff.fteOther')}</option>
                  </select>
                </label>
                {customFte && (
                  <label className="form-field">
                    <span>{F('staff.fte')} (0–1)</span>
                    <input type="number" step="0.01" min={0.01} max={1} value={m.fte} onChange={(e) => set('fte', Math.min(1, Math.max(0.01, num(e.target.value))))} />
                  </label>
                )}
                <label className="form-field fin-grow">
                  <span>{F('staff.grossMonthly')}</span>
                  <input type="number" step="0.01" value={m.rate || ''} onChange={(e) => set('rate', num(e.target.value))} />
                </label>
              </div>
            )}

            {(m.contract === 'zlecenie' || m.contract === 'b2b') && (
              <div className="fin-row">
                <label className="form-field">
                  <span>{F('staff.payType')}</span>
                  <select value={m.payType} onChange={(e) => set('payType', e.target.value as StaffMember['payType'])}>
                    <option value="monthly">{F('staff.monthly')}</option>
                    <option value="hourly">{F('staff.hourly')}</option>
                  </select>
                </label>
                <label className="form-field fin-grow">
                  <span>
                    {m.payType === 'hourly' ? F('staff.rateHourly') : m.contract === 'b2b' ? F('staff.netMonthly') : F('staff.grossMonthly')}
                  </span>
                  <input type="number" step="0.01" value={m.rate || ''} onChange={(e) => set('rate', num(e.target.value))} />
                </label>
                {m.payType === 'hourly' && (
                  <label className="form-field">
                    <span>{F('staff.hours')}</span>
                    <input type="number" value={m.hours} onChange={(e) => set('hours', num(e.target.value))} />
                  </label>
                )}
              </div>
            )}

            {m.contract === 'dzielo' && (
              <div className="fin-row">
                <label className="form-field fin-grow">
                  <span>{F('staff.amountOnce')}</span>
                  <input type="number" step="0.01" value={m.rate || ''} onChange={(e) => set('rate', num(e.target.value))} />
                </label>
                <label className="form-field">
                  <span>{F('staff.payDate')}</span>
                  <input type="date" value={m.payDate ?? ''} onChange={(e) => set('payDate', e.target.value || null)} />
                </label>
              </div>
            )}

            {m.contract === 'b2b' && (
              <label className="form-field">
                <span>{F('staff.vatRate')}</span>
                <select value={m.vatRate === null ? 'none' : String(m.vatRate)} onChange={(e) => set('vatRate', e.target.value === 'none' ? null : Number(e.target.value))}>
                  {[23, 8, 5, 0].map((r) => (
                    <option key={r} value={String(r)}>
                      {r}%
                    </option>
                  ))}
                  <option value="none">{F('staff.noVat')}</option>
                </select>
              </label>
            )}

            <div className="staff-checks">
              {m.contract === 'uop' && (
                <>
                  {check('pit2', F('staff.pit2'))}
                  {check('commuting', F('staff.commuting'))}
                  {check('youthRelief', F('staff.youth'))}
                  {check('ppk', F('staff.ppk'))}
                </>
              )}
              {m.contract === 'zlecenie' && (
                <>
                  {check('student', F('staff.student'))}
                  {!m.student && check('otherTitle', F('staff.otherTitle'))}
                  {!m.student && !m.otherTitle && check('sickness', F('staff.sickness'))}
                  {check('pit2', F('staff.pit2'))}
                  {check('youthRelief', F('staff.youth'))}
                  {check('copyright', F('staff.copyright'))}
                  {check('ppk', F('staff.ppk'))}
                </>
              )}
              {m.contract === 'dzielo' && check('copyright', F('staff.copyright'))}
            </div>

            <label className="form-field">
              <span>{F('staff.note')}</span>
              <input value={m.note} onChange={(e) => set('note', e.target.value)} />
            </label>
          </div>

          <div className="staff-calc">
            <div className="fin-section-title">{F('staff.calc', { month })}</div>
            {slip ? <Breakdown slip={slip} /> : <div className="fin-empty">{F('staff.inactive', { month })}</div>}
            <div className="fin-widget-note">{F('staff.simplified')}</div>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!valid}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
