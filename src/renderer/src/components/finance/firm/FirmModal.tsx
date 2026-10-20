import { useState } from 'react'
import { useAppStore } from '../../../state/useAppStore'
import { useModuleStore } from '../../../state/useModuleStore'
import { newId } from '../../../lib/ids'
import { useFirmLabel } from '../../../lib/firmLabels'
import { useT } from '../../../lib/i18n/useT'
import { DEFAULT_TAX, formatNip, isValidNip } from '../../../lib/polishTax'
import { todayISO } from '../../../lib/date'
import type { CurrencyCode, Firm } from '../../../lib/types'
import CurrencyCombobox from '../CurrencyCombobox'
import FirmLogo from './FirmLogo'

interface Props {
  /** Firm to edit; omitted to create one. */
  firm?: Firm
  onClose: () => void
}

/** Create or edit a firm: name, NIP and an optional PNG logo. */
export default function FirmModal({ firm, onClose }: Props): JSX.Element {
  const F = useFirmLabel()
  const t = useT()
  const updateData = useAppStore((s) => s.updateData)
  const username = useAppStore((s) => s.username)
  const setScope = useModuleStore((s) => s.setScope)
  const [name, setName] = useState(firm?.name ?? '')
  const [nip, setNip] = useState(firm ? formatNip(firm.nip) : '')
  const [logo, setLogo] = useState<string | null>(firm?.logo ?? null)
  const [currency, setCurrency] = useState<CurrencyCode>(firm?.finance.checking.currency ?? 'PLN')
  const [logoError, setLogoError] = useState(false)
  const [vatPayer, setVatPayer] = useState(firm?.tax.vatPayer ?? false)
  const [vatPeriod, setVatPeriod] = useState<'month' | 'quarter'>(firm?.tax.vatPeriod ?? 'month')

  const digits = nip.replace(/\D/g, '')
  const nipOk = isValidNip(digits)
  const valid = name.trim().length > 0 && nipOk

  async function pickLogo(): Promise<void> {
    const file = await window.api.attachments.pick()
    if (!file || 'error' in file) return
    if (file.mime !== 'image/png' || !username) {
      setLogoError(true)
      return
    }
    setLogoError(false)
    setLogo(await window.api.attachments.save(username, file.mime, file.dataBase64))
  }

  function save(): void {
    if (!valid) return
    const createdId = firm ? null : newId()
    updateData((draft) => {
      if (!draft.firms) draft.firms = []
      if (firm) {
        const target = draft.firms.find((f) => f.id === firm.id)
        if (target) {
          if (target.logo && target.logo !== logo) void window.api.attachments.remove(target.logo)
          Object.assign(target, { name: name.trim(), nip: digits, logo })
          target.tax.vatPayer = vatPayer
          target.tax.vatPeriod = vatPeriod
        }
        return
      }
      const created: Firm = {
        id: createdId as string,
        name: name.trim(),
        nip: digits,
        logo,
        tax: { ...DEFAULT_TAX, vatPayer, vatPeriod, params: {} },
        createdAt: todayISO(),
        finance: { checking: { balance: 0, currency, categories: [] }, savings: [] },
        ledger: { counterparties: [], events: [], subscriptions: [] }
      }
      draft.firms.push(created)
    })
    if (createdId) setScope(createdId)
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card fin-modal">
        <h2>{firm ? F('firm.editTitle') : F('firm.newTitle')}</h2>
        <div className="form-field">
          <label>{F('firm.name')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="form-field">
          <label>{F('firm.nip')}</label>
          <input
            value={nip}
            inputMode="numeric"
            placeholder="123-456-32-18"
            onChange={(e) => setNip(e.target.value)}
            onBlur={() => setNip(formatNip(nip))}
          />
          {digits.length > 0 && !nipOk && <div className="field-hint fin-negative">{F('firm.nipInvalid')}</div>}
        </div>
        {!firm && (
          <div className="form-field">
            <label>{F('firm.currency')}</label>
            <CurrencyCombobox value={currency} onChange={setCurrency} />
          </div>
        )}
        <label className="fin-keep-balances">
          <input type="checkbox" checked={vatPayer} onChange={(e) => setVatPayer(e.target.checked)} />
          {F('ts.vatPayer')}
        </label>
        <div className="field-hint">{F(vatPayer ? 'vat.modeVatHint' : 'vat.modeNoVatHint')}</div>
        {vatPayer && (
          <div className="form-field">
            <label>{F('ts.vatPeriod')}</label>
            <select value={vatPeriod} onChange={(e) => setVatPeriod(e.target.value as 'month' | 'quarter')}>
              <option value="month">{F('ts.vatMonth')}</option>
              <option value="quarter">{F('ts.vatQuarter')}</option>
            </select>
          </div>
        )}
        <div className="form-field">
          <label>{F('firm.logo')}</label>
          <div className="reward-row">
            <FirmLogo name={name || '?'} logo={logo} size={44} />
            <button type="button" className="btn" onClick={() => void pickLogo()}>
              {F('firm.logoUpload')}
            </button>
            {logo && (
              <button type="button" className="btn" onClick={() => setLogo(null)}>
                {F('firm.logoRemove')}
              </button>
            )}
          </div>
          <div className={logoError ? 'field-hint fin-negative' : 'field-hint'}>
            {logoError ? F('firm.logoPngOnly') : F('firm.logoHint')}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!valid}>
            {firm ? t('common.save') : t('common.add')}
          </button>
        </div>
      </div>
    </div>
  )
}
