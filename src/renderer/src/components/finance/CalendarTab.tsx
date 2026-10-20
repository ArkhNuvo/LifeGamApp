import { useMemo } from 'react'
import { useBookSelect } from '../../lib/book'
import { useLanguageStore } from '../../state/useLanguageStore'
import { useT } from '../../lib/i18n/useT'
import { todayISO } from '../../lib/date'
import { addDays, monthOf } from '../../lib/ledger'
import type { LedgerEvent } from '../../lib/types'
import { formatMoney, useAccounts } from './useFinance'

const TYPE_KEYS = {
  expense: 'fin.typeExpense',
  income: 'fin.typeIncome',
  transfer: 'fin.typeTransfer'
} as const

interface Props {
  month: string
  onEdit: (event: LedgerEvent) => void
  onNewOnDate: (date: string) => void
}

/** Month grid, Monday first, with the confirmed and the still-planned events of each day. */
export default function CalendarTab({ month, onEdit, onNewOnDate }: Props): JSX.Element {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const events = useBookSelect((b) => b?.ledger.events ?? [])
  const accounts = useAccounts()
  const today = todayISO()

  const weekdays = useMemo(() => {
    const locale = language === 'isv' ? 'sl' : language
    // 2024-01-01 is a Monday.
    return Array.from({ length: 7 }, (_, i) =>
      new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'short' })
    )
  }, [language])

  const days = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const first = `${month}-01`
    const weekdayOfFirst = (new Date(y, m - 1, 1).getDay() + 6) % 7 // Monday = 0
    const daysInMonth = new Date(y, m, 0).getDate()
    const cells = Math.ceil((weekdayOfFirst + daysInMonth) / 7) * 7
    return Array.from({ length: cells }, (_, i) => addDays(first, i - weekdayOfFirst))
  }, [month])

  const byDate = useMemo(() => {
    const map = new Map<string, LedgerEvent[]>()
    for (const ev of events) {
      const list = map.get(ev.date)
      if (list) list.push(ev)
      else map.set(ev.date, [ev])
    }
    return map
  }, [events])

  function chipText(ev: LedgerEvent): string {
    const currency = accounts.find((a) => a.id === ev.accountId)?.currency ?? 'USD'
    const sign = ev.type === 'income' ? '+' : ev.type === 'expense' ? '-' : ''
    return `${ev.title || t(TYPE_KEYS[ev.type])} ${sign}${formatMoney(ev.amount, currency)}`
  }

  return (
    <div className="fin-tab">
      <div className="fin-cal-legend">{t('fin.calendarLegend')}</div>
      <div className="fin-cal">
        {weekdays.map((w) => (
          <div key={w} className="fin-cal-weekday">
            {w}
          </div>
        ))}
        {days.map((iso) => {
          const inMonth = monthOf(iso) === month
          const list = byDate.get(iso) ?? []
          return (
            <div
              key={iso}
              className={`fin-cal-cell${inMonth ? '' : ' fin-cal-cell--out'}${iso === today ? ' fin-cal-cell--today' : ''}`}
            >
              <div className="fin-cal-day">
                <span>{Number(iso.slice(8))}</span>
                <button
                  type="button"
                  className="fin-cal-add"
                  title={t('fin.calendarAddHint')}
                  onClick={() => onNewOnDate(iso)}
                >
                  +
                </button>
              </div>
              {list.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  className={`fin-cal-chip fin-cal-chip--${ev.type}${ev.confirmed ? '' : ' fin-cal-chip--planned'}`}
                  title={chipText(ev)}
                  onClick={() => onEdit(ev)}
                >
                  {chipText(ev)}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
