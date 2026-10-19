import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useCryptoStore } from '../../state/useCryptoStore'
import { useRatesStore } from '../../state/useRatesStore'
import { useT } from '../../lib/i18n/useT'
import { canConvert, convert } from '../../lib/currency'
import {
  formatCoinAmount,
  formatPrice,
  holdingValue,
  normalizeTicker,
  portfolioValue
} from '../../lib/crypto'
import { formatMain, useMainCurrency } from './useFinance'

interface Props {
  accountId: string
  onClose: () => void
  onSettings: () => void
}

/** The coins held on a crypto account: ticker, amount, live price and value in USD and the main currency. */
export default function CryptoModal({ accountId, onClose, onSettings }: Props): JSX.Element {
  const t = useT()
  const updateData = useAppStore((s) => s.updateData)
  const entry = useAppStore((s) => s.data?.finance.savings.find((e) => e.id === accountId))
  const prices = useCryptoStore((s) => s.prices)
  const fetchedAt = useCryptoStore((s) => s.fetchedAt)
  const loading = useCryptoStore((s) => s.loading)
  const fetchPrices = useCryptoStore((s) => s.fetch)
  const rates = useRatesStore((s) => s.rates?.rates ?? null)
  const main = useMainCurrency()

  const [ticker, setTicker] = useState('')
  const [amount, setAmount] = useState('')

  const holdings = entry?.holdings ?? []
  const total = portfolioValue(holdings, prices)
  const inMain = (usd: number): string | null =>
    main !== 'USD' && canConvert('USD', main, rates) ? formatMain(convert(usd, 'USD', main, rates), main) : null
  const usdText = (usd: number): string => `$${usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  const amountValue = parseFloat(amount.replace(',', '.'))
  const symbol = normalizeTicker(ticker)
  const canAdd = symbol.length > 0 && amountValue > 0

  function setHoldings(mutate: (list: { ticker: string; amount: number }[]) => { ticker: string; amount: number }[]): void {
    updateData((draft) => {
      const target = draft.finance.savings.find((e) => e.id === accountId)
      if (target) target.holdings = mutate(target.holdings ?? [])
    })
  }

  function add(): void {
    if (!canAdd) return
    setHoldings((list) => {
      const existing = list.find((h) => h.ticker === symbol)
      if (existing) return list.map((h) => (h.ticker === symbol ? { ...h, amount: h.amount + amountValue } : h))
      return [...list, { ticker: symbol, amount: amountValue }]
    })
    void fetchPrices([symbol])
    setTicker('')
    setAmount('')
  }

  if (!entry) return <></>

  return (
    <div className="modal-overlay">
      <div className="modal-card fin-modal fin-modal--wide fin-crypto">
        <h2>{entry.name}</h2>

        <div className="fin-crypto-total">
          <span className="fin-total-value">{usdText(total)}</span>
          {inMain(total) && <span className="fin-crypto-main">≈ {inMain(total)}</span>}
          <button
            type="button"
            className="btn"
            disabled={loading || holdings.length === 0}
            onClick={() => void fetchPrices(holdings.map((h) => h.ticker), true)}
          >
            {loading ? '…' : '⟳'} {t('fin.cryptoRefresh')}
          </button>
        </div>
        {fetchedAt && (
          <div className="fin-hint">
            {t('fin.cryptoUpdated', { time: new Date(fetchedAt).toLocaleTimeString() })}
          </div>
        )}

        <div className="fin-crypto-table">
          <table>
            <thead>
              <tr>
                <th>{t('fin.cryptoTicker')}</th>
                <th className="num">{t('fin.cryptoAmount')}</th>
                <th className="num">{t('fin.cryptoPrice')}</th>
                <th className="num">{t('fin.cryptoValue')} $</th>
                {main !== 'USD' && <th className="num">{t('fin.cryptoValue')} {main}</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {holdings.length === 0 && (
                <tr>
                  <td colSpan={6} className="fin-empty">
                    {t('fin.cryptoEmpty')}
                  </td>
                </tr>
              )}
              {holdings.map((h) => {
                const price = prices[h.ticker]
                const value = holdingValue(h, prices)
                return (
                  <tr key={h.ticker}>
                    <td>
                      <strong>{h.ticker}</strong>
                    </td>
                    <td className="num">
                      <input
                        className="fin-crypto-amount"
                        defaultValue={formatCoinAmount(h.amount).replace(/,/g, '')}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value.replace(',', '.'))
                          if (!Number.isNaN(v) && v >= 0 && v !== h.amount) {
                            setHoldings((list) => list.map((x) => (x.ticker === h.ticker ? { ...x, amount: v } : x)))
                          }
                        }}
                      />
                    </td>
                    <td className="num">
                      {price == null ? (
                        <span className="fin-negative" title={t('fin.cryptoNoPrice')}>
                          {loading ? '…' : '?'}
                        </span>
                      ) : (
                        `$${formatPrice(price)}`
                      )}
                    </td>
                    <td className="num">{price == null ? '—' : usdText(value)}</td>
                    {main !== 'USD' && <td className="num">{price == null ? '—' : (inMain(value) ?? '—')}</td>}
                    <td className="num">
                      <button
                        type="button"
                        className="icon-btn"
                        title={t('common.delete')}
                        onClick={() => setHoldings((list) => list.filter((x) => x.ticker !== h.ticker))}
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

        <div className="fin-crypto-add">
          <input
            value={ticker}
            placeholder={t('fin.cryptoTickerPlaceholder')}
            onChange={(e) => setTicker(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <input
            type="number"
            min={0}
            step="any"
            value={amount}
            placeholder={t('fin.cryptoAmount')}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button type="button" className="btn btn-primary" onClick={add} disabled={!canAdd}>
            {t('common.add')}
          </button>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onSettings}>
            {t('fin.cryptoSettings')}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
