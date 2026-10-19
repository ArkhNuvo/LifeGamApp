import { useAppStore } from '../../state/useAppStore'
import { useRatesStore } from '../../state/useRatesStore'
import { useT } from '../../lib/i18n/useT'
import { canConvert, convert } from '../../lib/currency'
import { monthlyCost, nextSubscriptionDate } from '../../lib/ledger'
import { detectSubscriptions } from '../../lib/subscriptionDetect'
import { todayISO } from '../../lib/date'
import ExchangeRatesButton from '../common/ExchangeRatesButton'
import { formatMain, formatMoney, useAccounts, useMainCurrency } from './useFinance'

interface Props {
  onAddAccount: () => void
  onEditAccount: (id: string) => void
  onNewSubscription: () => void
  onEditSubscription: (id: string) => void
  onDetectSubscriptions: () => void
  onOpenCrypto: (id: string) => void
}

/** Left column of the finance module: mode, totals, accounts, and recurring payments. */
export default function FinanceProfile({
  onAddAccount,
  onEditAccount,
  onNewSubscription,
  onEditSubscription,
  onDetectSubscriptions,
  onOpenCrypto
}: Props): JSX.Element {
  const t = useT()
  const subscriptions = useAppStore((s) => s.data?.ledger.subscriptions ?? [])
  const events = useAppStore((s) => s.data?.ledger.events ?? [])
  const rates = useRatesStore((s) => s.rates?.rates ?? null)
  const accounts = useAccounts()
  const main = useMainCurrency()

  const usd = (group: 'checking' | 'savings'): number =>
    accounts.filter((a) => a.group === group).reduce((sum, a) => sum + convert(a.balance, a.currency, main, rates), 0)
  const checkingTotal = usd('checking')
  const savingsTotal = usd('savings')
  // The next payment still waiting to be confirmed (falls back to the next not-yet-generated date).
  const nextPaymentDate = (id: string, fallback: string): string => {
    const upcoming = events
      .filter((e) => e.subscriptionId === id && !e.confirmed)
      .map((e) => e.date)
      .sort()[0]
    return (upcoming ?? fallback).slice(5).split('-').reverse().join('.')
  }
  const ledger = useAppStore((s) => s.data?.ledger)
  const found = ledger ? detectSubscriptions({ ledger }, todayISO()).length : 0
  const monthlySubs = subscriptions
    .filter((s) => s.active)
    .reduce((sum, s) => sum + monthlyCost(s, accounts, rates, main), 0)

  return (
    <div className="fin-profile">
      <div className="fin-mode">
        <button type="button" className="fin-mode-btn active">
          {t('fin.modePersonal')}
        </button>
        <button type="button" className="fin-mode-btn" disabled title={t('fin.modeBusinessSoon')}>
          {t('fin.modeBusiness')}
        </button>
      </div>

      <div className="fin-total">
        <span className="fin-tile-label">{t('fin.total')}</span>
        <span className="fin-total-value">{formatMain(checkingTotal + savingsTotal, main)}</span>
      </div>
      <div className="fin-subtotals">
        <div className="fin-tile">
          <span className="fin-tile-label">{t('fin.checkingTotal')}</span>
          <span className="fin-tile-value">{formatMain(checkingTotal, main)}</span>
        </div>
        <div className="fin-tile">
          <span className="fin-tile-label">{t('fin.savingsTotal')}</span>
          <span className="fin-tile-value">{formatMain(savingsTotal, main)}</span>
        </div>
      </div>

      <div className="fin-section-head">
        <div className="fin-section-title">{t('fin.accountsTitle')}</div>
        <ExchangeRatesButton />
      </div>
      {(['checking', 'savings'] as const).map((group) => (
        <div key={group} className="fin-list">
          <div className="fin-group-title">{t(group === 'checking' ? 'fin.groupChecking' : 'fin.savingsTotal')}</div>
          {accounts
            .filter((a) => a.group === group)
            .map((a) => (
              <button key={a.id} type="button" className="fin-list-item" onClick={() => (a.crypto ? onOpenCrypto(a.id) : onEditAccount(a.id))}>
                <span>{a.crypto ? '🪙 ' : ''}{a.name}</span>
                <span className={`fin-amount${a.balance < 0 ? ' fin-negative' : ''}`}>
                  {formatMoney(a.balance, a.currency)}
                  {a.currency !== main && canConvert(a.currency, main, rates) && (
                    <small>≈ {formatMain(convert(a.balance, a.currency, main, rates), main)}</small>
                  )}
                </span>
              </button>
            ))}
        </div>
      ))}
      <button type="button" className="fin-add-btn" onClick={onAddAccount}>
        {t('fin.addAccount')}
      </button>

      <div className="fin-section-title">{t('fin.subsTitle')}</div>
      <div className="fin-list">
        {subscriptions.length === 0 && <div className="fin-empty">{t('fin.subsEmpty')}</div>}
        {subscriptions.map((s) => {
          const account = accounts.find((a) => a.id === s.accountId)
          return (
            <button key={s.id} type="button" className="fin-list-item" onClick={() => onEditSubscription(s.id)}>
              <span>
                {s.title} {!s.active && <em>{t('fin.paused')}</em>}
                {s.active && <small>{nextPaymentDate(s.id, nextSubscriptionDate(s))}</small>}
              </span>
              <span>{account ? formatMoney(s.amount, account.currency) : s.amount}</span>
            </button>
          )
        })}
        <button type="button" className="fin-add-btn" onClick={onNewSubscription}>
          {t('fin.addSubscription')}
        </button>
        <button type="button" className="fin-add-btn" onClick={onDetectSubscriptions}>
          {found > 0 ? t('fin.subsDetectFound', { n: found }) : t('fin.subsDetect')}
        </button>
        <div className="fin-hint">{t('fin.subsPerMonth', { amount: formatMain(monthlySubs, main) })}</div>
      </div>
    </div>
  )
}
