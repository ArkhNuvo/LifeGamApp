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
import type { ContractType, Firm, PayslipOverride, StaffMember } from '../../../lib/types'

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

type OverrideKey = keyof PayslipOverride

/** One line of the payslip: shows the calculated value; ✎ lets the user type their own for this month. */
function EditableRow({
  label,
  value,
  field,
  manual,
  strong,
  onOverride
}: {
  label: string
  value: number
  field?: OverrideKey
  manual: boolean
  strong?: boolean
  onOverride: (key: OverrideKey, value: number | undefined) => void
}): JSX.Element {
  const F = useFirmLabel()
  const [editing, setEditing] = useState(false)
  const commit = (raw: string): void => {
    setEditing(false)
    if (!field) return
    const n = parseFloat(raw.replace(',', '.'))
    if (Number.isFinite(n)) onOverride(field, Math.round(n * 100) / 100)
  }
  return (
    <div className={`tax-row${strong ? ' tax-row--strong' : ''}${manual ? ' tax-row--manual' : ''}`}>
      <span>
        {label}
        {manual && <small className="staff-manual"> · {F('staff.manual')}</small>}
      </span>
      <span className="staff-value">
        {editing && field ? (
          <input
            className="staff-value-input"
            type="number"
            step="0.01"
            defaultValue={value}
            autoFocus
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
              if (e.key === 'Escape') setEditing(false)
            }}
          />
        ) : (
          <span className="tax-value">{money(value)} zł</span>
        )}
        {field && !editing && (
          <button type="button" className="icon-btn staff-edit" title={F('staff.edit')} onClick={() => setEditing(true)}>
            ✎
          </button>
        )}
        {field && manual && !editing && (
          <button type="button" className="icon-btn staff-edit" title={F('staff.reset')} onClick={() => onOverride(field, undefined)}>
            ↺
          </button>
        )}
      </span>
    </div>
  )
}

function Breakdown({
  slip,
  onOverride
}: {
  slip: PayslipMonth
  onOverride: (key: OverrideKey, value: number | undefined) => void
}): JSX.Element {
  const F = useFirmLabel()
  const manual = (k: OverrideKey): boolean => slip.overridden.includes(k)
  const row = (label: string, value: number, field?: OverrideKey, strong = false): JSX.Element => (
    <EditableRow label={label} value={value} field={field} manual={!!field && manual(field)} strong={strong} onOverride={onOverride} />
  )
  if (slip.member.contract === 'b2b') {
    return (
      <div className="tax-card">
        <div className="tax-row">{F('staff.r.invoice', { net: money(slip.gross), vat: money(slip.vat) })}</div>
        {row(F('staff.r.cost'), slip.cost, undefined, true)}
      </div>
    )
  }
  const e = slip.employee
  const er = slip.employer
  const o = slip.member.overrides?.[slip.month] ?? {}
  // Extras that change the gross this month, entered directly.
  const extra = (label: string, field: OverrideKey, value: number | undefined, placeholder = '0'): JSX.Element => (
    <label className="staff-extra">
      <span>{label}</span>
      <input
        type="number"
        step="0.01"
        value={value || ''}
        placeholder={placeholder}
        onChange={(ev) => {
          const n = parseFloat(ev.target.value.replace(',', '.'))
          onOverride(field, Number.isFinite(n) && n !== 0 ? n : undefined)
        }}
      />
    </label>
  )
  const isUop = slip.member.contract === 'uop'
  return (
    <>
      <div className="staff-extras">
        {extra(F('staff.bonus'), 'bonus', slip.bonus)}
        {isUop && extra(F('staff.sickDays'), 'sickDays', o.sickDays)}
        {isUop && !!o.sickDays && extra(F('staff.sickBase'), 'sickBase', o.sickBase, money(slip.basePay))}
        {isUop && !!o.sickDays && (
          <label className="staff-extra">
            <span>{F('staff.sickRate')}</span>
            <select value={String(o.sickRate ?? 80)} onChange={(ev) => onOverride('sickRate', ev.target.value === '80' ? undefined : Number(ev.target.value))}>
              <option value="80">80%</option>
              <option value="100">100%</option>
            </select>
          </label>
        )}
        {extra(F('staff.deductions'), 'deductions', slip.deductions)}
      </div>
      <div className="tax-card">
        {(slip.bonus > 0 || slip.sickPay > 0 || slip.absence > 0) && row(F('staff.r.basePay'), slip.basePay)}
        {slip.absence > 0 && row(F('staff.r.absence'), -slip.absence)}
        {(slip.sickPay > 0 || manual('sickPay')) && row(F('staff.sickPay'), slip.sickPay, 'sickPay')}
        {row(F('staff.r.gross'), slip.gross, undefined, true)}
        {row(F('staff.r.pension'), e.pension, 'pension')}
        {row(F('staff.r.disability'), e.disability, 'disability')}
        {row(F('staff.r.sickness'), e.sickness, 'sickness')}
        {row(F('staff.r.health'), e.health, 'health')}
        {row(F('staff.r.kup'), slip.deductibleCosts, 'kup')}
        {slip.taxBase > 0 && row(F('staff.r.base'), slip.taxBase)}
        {row(F('staff.r.pit'), slip.pit, 'pit')}
        {e.ppk > 0 && row(F('staff.r.ppk'), e.ppk)}
        {slip.deductions > 0 && row(F('staff.deductions'), slip.deductions)}
        {row(F('staff.r.net'), slip.net, undefined, true)}
      </div>
      <div className="tax-card">
        {row(F('staff.r.erPension'), er.pension, 'erPension')}
        {row(F('staff.r.erDisability'), er.disability, 'erDisability')}
        {row(F('staff.r.erAccident'), er.accident, 'erAccident')}
        {row(F('staff.r.erLabourFund'), er.labourFund, 'erLabourFund')}
        {row(F('staff.r.erFgsp'), er.fgsp, 'erFgsp')}
        {er.fep > 0 && row('FEP', er.fep)}
        {er.ppk > 0 && row(F('staff.r.ppkEr'), er.ppk)}
        {row(F('staff.r.cost'), slip.cost, undefined, true)}
      </div>
      {slip.flags
        .filter((f) => f !== 'b2b')
        .map((f) => (
          <div key={f} className={`fin-widget-note${f.startsWith('below') ? ' fin-negative' : ''}`}>
            {f.startsWith('below') ? '⚠ ' : 'ℹ '}
            {F(`staff.f.${f}`, { cap: money(slip.healthCap ?? 0), exempt: money(slip.calc?.young.exempt ?? 0) })}
          </div>
        ))}
      <div className="fin-widget-note">{F('staff.manualHint')}</div>
    </>
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

  /** A hand-entered figure for the shown month; undefined goes back to the calculation. */
  function setOverride(key: keyof PayslipOverride, value: number | undefined): void {
    setM((prev) => {
      const current = { ...(prev.overrides?.[month] ?? {}) }
      if (value === undefined) delete current[key]
      else current[key] = value
      const overrides = { ...(prev.overrides ?? {}) }
      if (Object.keys(current).length === 0) delete overrides[month]
      else overrides[month] = current
      return { ...prev, overrides }
    })
  }

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

  const pit2Part = m.pit2 && (
    <label className="staff-extra staff-sub">
      <span>{F('staff.pit2Part')}</span>
      <select value={String(m.pit2Part ?? 1)} onChange={(e) => set('pit2Part', Number(e.target.value) as 1 | 2 | 3)}>
        <option value="1">300 zł</option>
        <option value="2">150 zł (½)</option>
        <option value="3">100 zł (⅓)</option>
      </select>
    </label>
  )
  const copyrightShare = m.copyright && (
    <label className="staff-extra staff-sub">
      <span>{F('staff.copyrightShare')}</span>
      <input
        type="number"
        min={1}
        max={100}
        value={m.copyrightShare ?? 100}
        onChange={(e) => set('copyrightShare', Math.min(100, Math.max(0, num(e.target.value))))}
      />
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
                  {pit2Part}
                  {check('commuting', F('staff.commuting'))}
                  {check('youthRelief', F('staff.youth'))}
                  {check('copyright', F('staff.copyright'))}
                  {copyrightShare}
                  {check('ppk', F('staff.ppk'))}
                </>
              )}
              {m.contract === 'zlecenie' && (
                <>
                  {check('student', F('staff.student'))}
                  {!m.student && check('otherTitle', F('staff.otherTitle'))}
                  {!m.student && !m.otherTitle && check('sickness', F('staff.sickness'))}
                  {check('pit2', F('staff.pit2'))}
                  {pit2Part}
                  {check('youthRelief', F('staff.youth'))}
                  {check('copyright', F('staff.copyright'))}
                  {copyrightShare}
                  {check('ownEmployee', F('staff.ownEmployee'))}
                  {check('ppk', F('staff.ppk'))}
                </>
              )}
              {m.contract === 'dzielo' && (
                <>
                  {check('copyright', F('staff.copyright'))}
                  {copyrightShare}
                  {check('ownEmployee', F('staff.ownEmployee'))}
                </>
              )}
            </div>
            {(m.contract === 'uop' || (m.contract === 'zlecenie' && !m.student && !m.otherTitle)) && (
              <details className="staff-more" open={!!(m.fpExempt || m.fgspExempt || m.fep)}>
                <summary>{F('staff.exemptions')}</summary>
                <div className="staff-checks">
                  {check('fpExempt', F('staff.fpExempt'))}
                  {check('fgspExempt', F('staff.fgspExempt'))}
                  {check('fep', F('staff.fep'))}
                </div>
              </details>
            )}

            <label className="form-field">
              <span>{F('staff.note')}</span>
              <input value={m.note} onChange={(e) => set('note', e.target.value)} />
            </label>
          </div>

          <div className="staff-calc">
            <div className="fin-section-title">{F('staff.calc', { month })}</div>
            {slip ? <Breakdown slip={slip} onOverride={setOverride} /> : <div className="fin-empty">{F('staff.inactive', { month })}</div>}
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
