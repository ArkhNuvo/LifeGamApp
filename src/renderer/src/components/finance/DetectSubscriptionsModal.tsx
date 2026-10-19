import { useMemo, useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useT } from '../../lib/i18n/useT'
import { todayISO } from '../../lib/date'
import { adoptCandidate, detectSubscriptions, dismissCandidate } from '../../lib/subscriptionDetect'
import { formatMoney, useAccounts } from './useFinance'

const EVERY_KEYS = { week: 'fin.repeatWeek', month: 'fin.repeatMonth', year: 'fin.repeatYear' } as const

/** Recurring payments found in the history: pick the ones that really are subscriptions. */
export default function DetectSubscriptionsModal({ onClose }: { onClose: () => void }): JSX.Element {
  const t = useT()
  const updateData = useAppStore((s) => s.updateData)
  const ledger = useAppStore((s) => s.data?.ledger)
  const accounts = useAccounts()
  const today = todayISO()
  const candidates = useMemo(() => (ledger ? detectSubscriptions({ ledger }, today) : []), [ledger, today])
  const [unticked, setUnticked] = useState<Set<string>>(new Set())
  const chosen = candidates.filter((c) => !unticked.has(c.key))

  function create(): void {
    updateData((draft) => {
      for (const c of chosen) adoptCandidate(draft, c, today)
    })
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card fin-modal fin-modal--wide">
        <h2>{t('fin.subsDetectTitle')}</h2>
        <p className="fin-hint">{t('fin.subsDetectHint')}</p>

        <div className="fin-cp-list">
          {candidates.length === 0 && <div className="fin-empty">{t('fin.subsDetectNone')}</div>}
          {candidates.map((c) => {
            const currency = accounts.find((a) => a.id === c.accountId)?.currency
            const money = (n: number): string => (currency ? formatMoney(n, currency) : String(n))
            return (
              <div key={c.key} className="fin-cp-row">
                <input
                  type="checkbox"
                  checked={!unticked.has(c.key)}
                  onChange={() =>
                    setUnticked((prev) => {
                      const next = new Set(prev)
                      if (next.has(c.key)) next.delete(c.key)
                      else next.add(c.key)
                      return next
                    })
                  }
                />
                <span className="fin-cp-name">
                  {c.title} {!c.active && <em>{t('fin.subsEnded')}</em>}
                </span>
                <span className="fin-cp-meta">
                  {t(EVERY_KEYS[c.every])},{' '}
                  {c.minAmount === c.maxAmount ? money(c.amount) : `${money(c.minAmount)} – ${money(c.maxAmount)}`}
                </span>
                <span className="fin-cp-meta">{t('fin.subsDetectRow', { n: c.count, date: c.lastDate })}</span>
                <button
                  type="button"
                  className="icon-btn"
                  title={t('fin.subsNotOne')}
                  onClick={() => updateData((draft) => dismissCandidate(draft, c.key))}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.close')}
          </button>
          {candidates.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={create} disabled={chosen.length === 0}>
              {t('fin.subsDetectCreate', { n: chosen.length })}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
