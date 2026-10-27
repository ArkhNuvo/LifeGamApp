import { useState } from 'react'
import { useAppStore } from '../../../state/useAppStore'
import { useFirmLabel } from '../../../lib/firmLabels'
import { useT } from '../../../lib/i18n/useT'
import { DEFAULT_PARAMS, RYCZALT_RATES, paramsFor } from '../../../lib/polishTax'
import type { Firm, FirmTax, TaxForm, TaxParams, ZusScheme } from '../../../lib/types'

const FORMS: TaxForm[] = ['skala', 'liniowy', 'ryczalt']
const SCHEMES: ZusScheme[] = ['full', 'preferential', 'start', 'small_plus', 'none']
const PARAM_KEYS = ['minimumWage', 'zusFullBase', 'zusPreferentialBase', 'healthMin', 'liniowyHealthDeductionLimit'] as const

/** Form of taxation, ZUS scheme, VAT status and the yearly amounts the estimates use. */
export default function TaxSettingsModal({ firm, year, onClose }: { firm: Firm; year: number; onClose: () => void }): JSX.Element {
  const F = useFirmLabel()
  const t = useT()
  const updateData = useAppStore((s) => s.updateData)
  const [tax, setTax] = useState<FirmTax>(() => JSON.parse(JSON.stringify(firm.tax)))
  const params = paramsFor(tax, year)
  const set = <K extends keyof FirmTax>(key: K, value: FirmTax[K]): void => setTax((prev) => ({ ...prev, [key]: value }))

  function setParam(patch: Partial<TaxParams>): void {
    setTax((prev) => ({ ...prev, params: { ...prev.params, [year]: { ...(prev.params[year] ?? {}), ...patch } } }))
  }

  function save(): void {
    updateData((draft) => {
      const target = draft.firms?.find((f) => f.id === firm.id)
      if (target) target.tax = tax
    })
    onClose()
  }

  const num = (v: string): number => {
    const n = parseFloat(v.replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card fin-modal fin-modal--wide">
        <h2>
          {F('ts.title')} — {firm.name}
        </h2>
        <div className="fin-row">
          <div className="form-field fin-grow">
            <label>{F('ts.form')}</label>
            <select value={tax.form} onChange={(e) => set('form', e.target.value as TaxForm)}>
              {FORMS.map((f) => (
                <option key={f} value={f}>
                  {F(`ts.form.${f}`)}
                </option>
              ))}
            </select>
          </div>
          {tax.form === 'ryczalt' && (
            <div className="form-field">
              <label>{F('ts.ryczaltRate')}</label>
              <select value={tax.ryczaltRate} onChange={(e) => set('ryczaltRate', Number(e.target.value))}>
                {RYCZALT_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="fin-row">
          <div className="form-field fin-grow">
            <label>{F('ts.zus')}</label>
            <select value={tax.zus} onChange={(e) => set('zus', e.target.value as ZusScheme)}>
              {SCHEMES.map((z) => (
                <option key={z} value={z}>
                  {F(`ts.zus.${z}`)}
                </option>
              ))}
            </select>
          </div>
          {tax.zus === 'small_plus' && (
            <div className="form-field">
              <label>{F('ts.smallPlusBase')}</label>
              <input
                type="number"
                value={tax.smallPlusBase ?? ''}
                onChange={(e) => set('smallPlusBase', e.target.value === '' ? null : num(e.target.value))}
              />
            </div>
          )}
        </div>
        {tax.zus !== 'start' && tax.zus !== 'none' && (
          <label className="fin-keep-balances">
            <input type="checkbox" checked={tax.sickness} onChange={(e) => set('sickness', e.target.checked)} />
            {F('ts.sickness')}
          </label>
        )}
        {tax.zus !== 'start' && tax.zus !== 'none' && (
          <label className="form-field">
            <span>{F('ts.zusHoliday')}</span>
            <input
              type="month"
              value={tax.zusHoliday ?? ''}
              onChange={(e) => set('zusHoliday', e.target.value || null)}
              style={{ maxWidth: 180 }}
            />
            <span className="field-hint">{F('ts.zusHolidayHint')}</span>
          </label>
        )}
        <div className="fin-row">
          <label className="fin-keep-balances fin-grow">
            <input type="checkbox" checked={tax.vatPayer} onChange={(e) => set('vatPayer', e.target.checked)} />
            {F('ts.vatPayer')}
          </label>
          {tax.vatPayer && (
            <div className="form-field">
              <label>{F('ts.vatPeriod')}</label>
              <select value={tax.vatPeriod} onChange={(e) => set('vatPeriod', e.target.value as FirmTax['vatPeriod'])}>
                <option value="month">{F('ts.vatMonth')}</option>
                <option value="quarter">{F('ts.vatQuarter')}</option>
              </select>
            </div>
          )}
        </div>

        <div className="field-hint">{F(tax.vatPayer ? 'vat.modeVatHint' : 'vat.modeNoVatHint')}</div>

        <label className="form-field">
          <span>{F('staff.accident')}</span>
          <input
            type="number"
            step="0.01"
            value={tax.accidentRate ?? 1.67}
            onChange={(e) => set('accidentRate', num(e.target.value))}
            style={{ maxWidth: 120 }}
          />
        </label>

        <h3>{F('ts.params', { year })}</h3>
        <div className="field-hint">{F('ts.paramsHint')}</div>
        <div className="firm-params">
          {PARAM_KEYS.map((key) => (
            <label key={key} className="form-field">
              <span>{F(`ts.p.${key}`)}</span>
              <input type="number" step="0.01" value={params[key]} onChange={(e) => setParam({ [key]: num(e.target.value) })} />
            </label>
          ))}
          {[0, 1, 2].map((i) => (
            <label key={i} className="form-field">
              <span>{F(`ts.p.healthRyczalt${i}`)}</span>
              <input
                type="number"
                step="0.01"
                value={params.healthRyczalt[i]}
                onChange={(e) => {
                  const next = [...params.healthRyczalt] as TaxParams['healthRyczalt']
                  next[i] = num(e.target.value)
                  setParam({ healthRyczalt: next })
                }}
              />
            </label>
          ))}
        </div>
        {tax.params[year] && DEFAULT_PARAMS[String(year)] && (
          <button
            type="button"
            className="btn"
            onClick={() =>
              setTax((prev) => {
                const next = { ...prev.params }
                delete next[year]
                return { ...prev, params: next }
              })
            }
          >
            {F('ts.reset')}
          </button>
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
