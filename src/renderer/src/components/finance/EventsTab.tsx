import { useMemo, useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useRatesStore } from '../../state/useRatesStore'
import { useT } from '../../lib/i18n/useT'
import { counterpartyName, deleteEvent, monthOf, setEventConfirmed, summarizeMonth } from '../../lib/ledger'
import type { Attachment, LedgerEvent } from '../../lib/types'
import FilePreviewModal from './FilePreviewModal'
import ConfirmModal from '../common/ConfirmModal'
import { formatMain, formatMoney, useAccounts, useMainCurrency } from './useFinance'

type Filter = 'all' | 'income' | 'expense' | 'transfer' | 'planned'

const FILTERS: { value: Filter; key: 'fin.filterAll' | 'fin.filterIncome' | 'fin.filterExpense' | 'fin.filterTransfer' | 'fin.filterPlanned' }[] = [
  { value: 'all', key: 'fin.filterAll' },
  { value: 'income', key: 'fin.filterIncome' },
  { value: 'expense', key: 'fin.filterExpense' },
  { value: 'transfer', key: 'fin.filterTransfer' },
  { value: 'planned', key: 'fin.filterPlanned' }
]

const TYPE_KEYS = {
  expense: 'fin.typeExpense',
  income: 'fin.typeIncome',
  transfer: 'fin.typeTransfer'
} as const

interface Props {
  month: string
  onEdit: (event: LedgerEvent) => void
}

export default function EventsTab({ month, onEdit }: Props): JSX.Element {
  const t = useT()
  const updateData = useAppStore((s) => s.updateData)
  const events = useAppStore((s) => s.data?.ledger.events ?? [])
  const counterparties = useAppStore((s) => s.data?.ledger.counterparties ?? [])
  const rates = useRatesStore((s) => s.rates?.rates ?? null)
  const accounts = useAccounts()
  const main = useMainCurrency()
  const [filter, setFilter] = useState<Filter>('all')
  const [deleting, setDeleting] = useState<LedgerEvent | null>(null)
  const [viewing, setViewing] = useState<Attachment[] | null>(null)

  const summary = useMemo(() => summarizeMonth(events, accounts, month, rates, main), [events, accounts, month, rates, main])

  const visible = useMemo(() => {
    return events
      .filter((e) => monthOf(e.date) === month)
      .filter((e) => (filter === 'all' ? true : filter === 'planned' ? !e.confirmed : e.type === filter))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [events, month, filter])

  const groups: { date: string; items: LedgerEvent[] }[] = []
  for (const ev of visible) {
    const last = groups[groups.length - 1]
    if (last && last.date === ev.date) last.items.push(ev)
    else groups.push({ date: ev.date, items: [ev] })
  }

  function amountText(ev: LedgerEvent): string {
    const from = accounts.find((a) => a.id === ev.accountId)
    const currency = from?.currency ?? 'USD'
    if (ev.type === 'income') return `+${formatMoney(ev.amount, currency)}`
    if (ev.type === 'expense') return `-${formatMoney(ev.amount, currency)}`
    const to = accounts.find((a) => a.id === ev.toAccountId)
    if (to && to.currency !== currency) {
      return `${formatMoney(ev.amount, currency)} → ${formatMoney(ev.toAmount ?? ev.amount, to.currency)}`
    }
    return formatMoney(ev.amount, currency)
  }

  return (
    <div className="fin-tab">
      <div className="fin-tiles">
        <div className="fin-tile fin-tile--income">
          <span className="fin-tile-label">{t('fin.tileIncome')}</span>
          <span className="fin-tile-value">+{formatMain(summary.income, main)}</span>
        </div>
        <div className="fin-tile fin-tile--expense">
          <span className="fin-tile-label">{t('fin.tileExpense')}</span>
          <span className="fin-tile-value">-{formatMain(summary.expense, main)}</span>
        </div>
        <div className="fin-tile">
          <span className="fin-tile-label">{t('fin.tileResult')}</span>
          <span className="fin-tile-value">
            {summary.result >= 0 ? '+' : '-'}
            {formatMain(Math.abs(summary.result), main)}
          </span>
        </div>
        <div className="fin-tile fin-tile--planned">
          <span className="fin-tile-label">{t('fin.tilePlanned')}</span>
          <span className="fin-tile-value">
            +{formatMain(summary.plannedIncome, main)} / -{formatMain(summary.plannedExpense, main)}
          </span>
        </div>
      </div>

      <div className="fin-chips">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={filter === f.value ? 'fin-chip active' : 'fin-chip'}
            onClick={() => setFilter(f.value)}
          >
            {t(f.key)}
          </button>
        ))}
      </div>

      {groups.length === 0 && <div className="fin-empty">{t('fin.eventsEmpty')}</div>}

      {groups.map((group) => (
        <div key={group.date} className="fin-day">
          <div className="fin-day-title">{group.date}</div>
          {group.items.map((ev) => {
            const cp = counterpartyName(counterparties, ev.counterpartyId)
            const account = accounts.find((a) => a.id === ev.accountId)
            const to = accounts.find((a) => a.id === ev.toAccountId)
            const meta = [
              ev.category || (ev.type === 'transfer' ? t('fin.typeTransfer') : ''),
              ev.type === 'transfer' && to ? `${account?.name ?? '?'} → ${to.name}` : account?.name ?? '?',
              cp
            ]
              .filter(Boolean)
              .join(', ')
            return (
              <div key={ev.id} className={ev.confirmed ? 'fin-event' : 'fin-event fin-event--planned'}>
                <input
                  type="checkbox"
                  checked={ev.confirmed}
                  title={t('fin.confirmPayment')}
                  onChange={(e) => updateData((draft) => setEventConfirmed(draft, ev.id, e.target.checked))}
                />
                <span className={`fin-type-chip fin-type-chip--${ev.type}`}>{t(TYPE_KEYS[ev.type])}</span>
                <div className="fin-event-main" onClick={() => onEdit(ev)}>
                  <div className="fin-event-title">
                    {ev.title || cp || t(TYPE_KEYS[ev.type])}
                    {ev.review === 'transfer' && (
                      <span className="fin-review-badge" title={t('fin.reviewTransfer')}>
                        ⚠
                      </span>
                    )}
                    {!ev.confirmed && <span className="fin-planned-badge">{t('fin.planned')}</span>}
                  </div>
                  <div className="fin-event-meta">{meta}</div>
                </div>
                <div className={`fin-event-amount fin-event-amount--${ev.type}`}>{amountText(ev)}</div>
                {ev.attachments.length > 0 && (
                  <button
                    type="button"
                    className="icon-btn fin-attach-btn"
                    onClick={() => setViewing(ev.attachments)}
                    title={t('fin.viewDocument')}
                  >
                    📎
                  </button>
                )}
                <button type="button" className="icon-btn" onClick={() => onEdit(ev)} title={t('common.edit')}>
                  ✎
                </button>
                <button type="button" className="icon-btn" onClick={() => setDeleting(ev)} title={t('common.delete')}>
                  🗑
                </button>
              </div>
            )
          })}
        </div>
      ))}

      {deleting && (
        <ConfirmModal
          message={t('fin.deleteEventConfirm')}
          onConfirm={() => {
            updateData((draft) => deleteEvent(draft, deleting.id))
            deleting.attachments.forEach((a) => window.api.attachments.remove(a.path))
            setDeleting(null)
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
      {viewing && <FilePreviewModal attachments={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
