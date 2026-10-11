import { useEffect } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useRatesStore } from '../../state/useRatesStore'
import { useT } from '../../lib/i18n/useT'
import CurrencyCombobox from '../finance/CurrencyCombobox'

/** App settings. Currently: the main currency that totals and converted values are shown in. */
export default function SettingsModal({ onClose }: { onClose: () => void }): JSX.Element {
  const t = useT()
  const updateData = useAppStore((s) => s.updateData)
  const main = useAppStore((s) => s.data?.settings.mainCurrency ?? 'USD')
  const rates = useRatesStore((s) => s.rates)
  const loading = useRatesStore((s) => s.loading)
  const fetchIfNeeded = useRatesStore((s) => s.fetchIfNeeded)
  const refresh = useRatesStore((s) => s.refresh)

  useEffect(() => {
    fetchIfNeeded()
  }, [fetchIfNeeded])

  return (
    <div className="modal-overlay">
      <div className="modal-card fin-modal">
        <h2>{t('settings.title')}</h2>

        <div className="form-field">
          <label>{t('settings.mainCurrency')}</label>
          <CurrencyCombobox
            value={main}
            onChange={(code) =>
              updateData((draft) => {
                draft.settings.mainCurrency = code
              })
            }
          />
          <div className="field-hint">{t('settings.mainCurrencyHint')}</div>
        </div>

        <div className="form-field">
          <label>{t('settings.rates')}</label>
          <div className="reward-row">
            <span className="field-hint fin-grow">
              {rates
                ? t('settings.ratesUpdated', { date: new Date(rates.fetchedAt).toLocaleString() })
                : t('settings.ratesNone')}
            </span>
            <button type="button" className="btn" onClick={refresh} disabled={loading}>
              {loading ? '…' : t('settings.ratesRefresh')}
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
