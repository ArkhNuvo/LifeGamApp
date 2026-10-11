import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useT } from '../../lib/i18n/useT'
import { todayISO } from '../../lib/date'
import { newId } from '../../lib/ids'
import {
  createSubscription,
  deleteSubscription,
  materializeSubscriptions,
  nextPaymentDate,
  rescheduleSubscription,
  updateSubscription
} from '../../lib/ledger'
import type { Recurrence } from '../../lib/types'
import ConfirmModal from '../common/ConfirmModal'
import { useAccounts } from './useFinance'

interface Props {
  /** Subscription to edit, or 'new' to create one. */
  subscriptionId: string | 'new'
  onClose: () => void
}

/**
 * Create or edit a recurring payment: who it goes to, what for, how much,
 * and when it is paid. Every payment shows up in the calendar as a planned
 * event until it is confirmed.
 */
export default function SubscriptionModal({ subscriptionId, onClose }: Props): JSX.Element | null {
  const t = useT()
  const creating = subscriptionId === 'new'
  const updateData = useAppStore((s) => s.updateData)
  const sub = useAppStore((s) => s.data?.ledger.subscriptions.find((x) => x.id === subscriptionId))
  const data = useAppStore((s) => s.data)
  const counterparties = useAppStore((s) => s.data?.ledger.counterparties ?? [])
  const accounts = useAccounts()
  const payAccounts = accounts.filter((a) => a.group === 'checking' || a.id === sub?.accountId)
  const initialNext = sub && data ? nextPaymentDate(data, sub) : todayISO()

  const [counterpartyId, setCounterpartyId] = useState(sub?.counterpartyId ?? '')
  const [newCpName, setNewCpName] = useState<string | null>(null)
  const [title, setTitle] = useState(sub?.title ?? '')
  const [amount, setAmount] = useState(sub ? String(sub.amount) : '')
  const [accountId, setAccountId] = useState(sub?.accountId ?? payAccounts[0]?.id ?? '')
  const [category, setCategory] = useState(sub?.category ?? t('fin.subscriptionCategory'))
  const [every, setEvery] = useState<Recurrence>(sub?.every ?? 'month')
  const [nextDate, setNextDate] = useState(initialNext)
  const [active, setActive] = useState(sub?.active ?? true)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (!creating && !sub) return null

  const amountValue = parseFloat(amount.replace(',', '.'))
  const serviceName = counterparties.find((c) => c.id === counterpartyId)?.name ?? (newCpName ?? '').trim()
  const label = title.trim() || serviceName
  const valid = !Number.isNaN(amountValue) && amountValue > 0 && label.length > 0 && !!accountId && !!nextDate

  function save(): void {
    if (!valid) return
    const today = todayISO()
    updateData((draft) => {
      let cpId = counterpartyId || null
      if (!cpId && (newCpName ?? '').trim()) {
        cpId = newId()
        draft.ledger.counterparties.push({
          id: cpId,
          name: (newCpName ?? '').trim(),
          kind: 'service',
          defaultCategory: category.trim()
        })
      }
      if (creating) {
        createSubscription(draft, {
          title: label,
          amount: amountValue,
          accountId,
          category: category.trim(),
          counterpartyId: cpId,
          every,
          startDate: nextDate
        })
      } else {
        const current = draft.ledger.subscriptions.find((s) => s.id === subscriptionId)
        if (!current) return
        updateSubscription(
          draft,
          subscriptionId,
          { title: label, amount: amountValue, accountId, category: category.trim(), counterpartyId: cpId, active },
          today
        )
        if (every !== current.every || nextDate !== initialNext) {
          rescheduleSubscription(draft, subscriptionId, every, nextDate)
        }
      }
      materializeSubscriptions(draft, today)
    })
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card fin-modal">
        <h2>{creating ? t('fin.newSubscription') : t('fin.editSubscription')}</h2>

        <div className="form-field">
          <label>{t('fin.fieldService')}</label>
          <div className="reward-row">
            <select value={counterpartyId} onChange={(e) => setCounterpartyId(e.target.value)}>
              <option value="">{t('fin.noCounterparty')}</option>
              {counterparties.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={() => setNewCpName(newCpName === null ? '' : null)}>
              {t('fin.newCounterparty')}
            </button>
          </div>
          {newCpName !== null && (
            <input
              value={newCpName}
              placeholder={t('fin.cpName')}
              onChange={(e) => setNewCpName(e.target.value)}
              autoFocus
            />
          )}
        </div>

        <div className="form-field">
          <label>{t('fin.fieldTitle')}</label>
          <input value={title} placeholder={serviceName} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="fin-row">
          <div className="form-field fin-grow">
            <label>{t('fin.fieldAmount')}</label>
            <div className="signed-field-row">
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <span className="money-currency">{accounts.find((a) => a.id === accountId)?.currency ?? ''}</span>
            </div>
          </div>
          <div className="form-field fin-grow">
            <label>{t('fin.fieldAccount')}</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {payAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="fin-row">
          <div className="form-field fin-grow">
            <label>{t('fin.fieldPeriod')}</label>
            <select value={every} onChange={(e) => setEvery(e.target.value as Recurrence)}>
              <option value="week">{t('fin.repeatWeek')}</option>
              <option value="month">{t('fin.repeatMonth')}</option>
              <option value="year">{t('fin.repeatYear')}</option>
            </select>
          </div>
          <div className="form-field fin-grow">
            <label>{t('fin.fieldNextPayment')}</label>
            <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </div>
        </div>

        <div className="form-field">
          <label>{t('fin.fieldCategory')}</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>

        {!creating && (
          <label className="fin-confirm-field">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>{t('fin.fieldActive')}</span>
          </label>
        )}
        <div className="field-hint">{t('fin.subCreateHint')}</div>

        <div className="modal-actions">
          {!creating && (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmingDelete(true)}>
              {t('common.delete')}
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!valid}>
            {t('common.save')}
          </button>
        </div>
        {confirmingDelete && sub && (
          <ConfirmModal
            message={t('fin.deleteSubConfirm', { name: sub.title })}
            onConfirm={() => {
              updateData((draft) => deleteSubscription(draft, subscriptionId))
              onClose()
            }}
            onCancel={() => setConfirmingDelete(false)}
          />
        )}
      </div>
    </div>
  )
}
