import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useRatesStore } from '../../state/useRatesStore'
import { useClickOutside } from '../../lib/useClickOutside'
import { ratePairLabel } from '../../lib/currency'
import type { CurrencyCode } from '../../lib/types'
import { useT } from '../../lib/i18n/useT'
import './ExchangeRatesButton.css'

export default function ExchangeRatesButton(): JSX.Element {
  const t = useT()
  const data = useAppStore((s) => s.data)
  const rates = useRatesStore((s) => s.rates)
  const loading = useRatesStore((s) => s.loading)
  const fetchIfNeeded = useRatesStore((s) => s.fetchIfNeeded)
  const refresh = useRatesStore((s) => s.refresh)
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false))

  useEffect(() => {
    fetchIfNeeded()
  }, [fetchIfNeeded])

  const usedCurrencies = useMemo(() => {
    if (!data) return []
    const set = new Set<CurrencyCode>()
    set.add(data.finance.checking.currency)
    data.finance.checking.categories.forEach((c) => set.add(c.currency))
    data.finance.savings.forEach((e) => set.add(e.currency))
    set.delete('USD')
    return Array.from(set).sort()
  }, [data])

  return (
    <div className="exchange-rates-button" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((v) => !v)}
        title={t('finance.exchangeRatesTooltip')}
      >
        💱
      </button>
      {open && (
        <div className="exchange-rates-menu">
          {usedCurrencies.length === 0 ? (
            <span className="field-hint">{t('finance.noForeignCurrencies')}</span>
          ) : (
            usedCurrencies.map((code) => {
              const { label, value } = ratePairLabel(code, rates?.rates ?? null)
              return (
                <div className="exchange-rate-row" key={code}>
                  <span>{label}</span>
                  <span>{value !== null ? value.toFixed(4) : '—'}</span>
                </div>
              )
            })
          )}
          <div className="exchange-rates-footer">
            <span className="field-hint">
              {rates
                ? t('finance.ratesUpdated', { date: new Date(rates.fetchedAt).toLocaleString() })
                : t('finance.ratesLoading')}
            </span>
            <button
              type="button"
              className="icon-btn"
              onClick={refresh}
              disabled={loading}
              title={t('finance.refreshRatesTooltip')}
            >
              {loading ? '⏳' : '🔄'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
