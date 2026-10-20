import { useEffect, useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useRatesStore } from '../../state/useRatesStore'
import { useT } from '../../lib/i18n/useT'
import CurrencyCombobox from '../finance/CurrencyCombobox'
import { useAccounts } from '../finance/useFinance'
import type { TranslationKey } from '../../lib/i18n'

/** App settings. Currently: the main currency that totals and converted values are shown in. */
export default function SettingsModal({ onClose }: { onClose: () => void }): JSX.Element {
  const t = useT()
  const updateData = useAppStore((s) => s.updateData)
  const main = useAppStore((s) => s.data?.settings.mainCurrency ?? 'USD')
  const rates = useRatesStore((s) => s.rates)
  const loading = useRatesStore((s) => s.loading)
  const fetchIfNeeded = useRatesStore((s) => s.fetchIfNeeded)
  const refresh = useRatesStore((s) => s.refresh)
  const settings = useAppStore((s) => s.data?.settings)
  const accounts = useAccounts().filter((a) => !a.crypto)
  const username = useAppStore((s) => s.username)
  const [pwOld, setPwOld] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwRepeat, setPwRepeat] = useState('')
  const [pwNote, setPwNote] = useState<{ ok: boolean; text: string } | null>(null)

  async function changePassword(): Promise<void> {
    if (!username) return
    if (pwNew !== pwRepeat) {
      setPwNote({ ok: false, text: t('auth.passwordsDiffer') })
      return
    }
    const res = await window.api.auth.changePassword(username, pwOld, pwNew)
    if (res.ok) {
      setPwOld('')
      setPwNew('')
      setPwRepeat('')
      setPwNote({ ok: true, text: t('settings.passwordChanged') })
    } else {
      setPwNote({ ok: false, text: t(`auth.error.${res.error ?? 'login_failed'}` as TranslationKey) })
    }
  }
  const [digits, setDigits] = useState('')
  const [bindTo, setBindTo] = useState('')
  const bindings = Object.entries(settings?.cardAccounts ?? {})
  const accountLabel = (id: string): string => accounts.find((a) => a.id === id)?.name ?? '?'

  function accountSelect(value: string | null | undefined, onChange: (id: string | null) => void): JSX.Element {
    return (
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">—</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.currency})
          </option>
        ))}
      </select>
    )
  }

  function addBinding(): void {
    const last4 = digits.replace(/\D/g, '')
    const target = bindTo || accounts[0]?.id
    if (last4.length !== 4 || !target) return
    updateData((draft) => {
      draft.settings.cardAccounts = { ...(draft.settings.cardAccounts ?? {}), [last4]: target }
    })
    setDigits('')
  }

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
          <label>{t('settings.defaultCard')}</label>
          {accountSelect(settings?.defaultCardAccountId, (id) =>
            updateData((draft) => {
              draft.settings.defaultCardAccountId = id
            })
          )}
        </div>
        <div className="form-field">
          <label>{t('settings.defaultCash')}</label>
          {accountSelect(settings?.defaultCashAccountId, (id) =>
            updateData((draft) => {
              draft.settings.defaultCashAccountId = id
            })
          )}
          <div className="field-hint">{t('settings.paymentHint')}</div>
        </div>
        <div className="form-field">
          <label>{t('settings.cardBindings')}</label>
          {bindings.map(([last4, accountId]) => (
            <div key={last4} className="fin-cp-row">
              <span className="fin-cp-name">•••• {last4}</span>
              <span className="fin-cp-meta">→ {accountLabel(accountId)}</span>
              <button
                type="button"
                className="icon-btn"
                title={t('common.delete')}
                onClick={() =>
                  updateData((draft) => {
                    const next = { ...(draft.settings.cardAccounts ?? {}) }
                    delete next[last4]
                    draft.settings.cardAccounts = next
                  })
                }
              >
                🗑
              </button>
            </div>
          ))}
          <div className="reward-row">
            <input
              value={digits}
              maxLength={4}
              inputMode="numeric"
              placeholder={t('settings.cardDigits')}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, ''))}
              style={{ width: 90 }}
            />
            <div className="fin-grow">{accountSelect(bindTo || accounts[0]?.id, (id) => setBindTo(id ?? ''))}</div>
            <button type="button" className="btn" onClick={addBinding} disabled={digits.length !== 4}>
              {t('common.add')}
            </button>
          </div>
        </div>

        <details className="settings-password">
          <summary>{t('settings.password')}</summary>
          <div className="settings-password-grid">
            <input type="password" placeholder={t('settings.passwordCurrent')} value={pwOld} onChange={(e) => setPwOld(e.target.value)} />
            <input type="password" placeholder={t('settings.passwordNew')} value={pwNew} onChange={(e) => setPwNew(e.target.value)} />
            <input type="password" placeholder={t('settings.passwordRepeat')} value={pwRepeat} onChange={(e) => setPwRepeat(e.target.value)} />
            <button type="button" className="btn" onClick={() => void changePassword()} disabled={!pwOld || !pwNew}>
              {t('settings.passwordChange')}
            </button>
          </div>
          {pwNote && <div className={pwNote.ok ? 'field-hint' : 'field-hint fin-negative'}>{pwNote.text}</div>}
          <div className="field-hint">{t('settings.passwordTelegramHint')}</div>
        </details>

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
