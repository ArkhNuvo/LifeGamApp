import { useMemo, useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { currentMonthKey, buildMonthOptions, computeMonthsWithActivity } from '../../lib/month'
import MonthPicker from '../kanban/MonthPicker'
import type { ColumnStatus } from '../../lib/types'

const STATUS_LABEL: Record<ColumnStatus, string> = {
  TODO: 'TO DO',
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN PROCESS',
  DONE: 'DONE'
}

export default function PlannedActivitiesWidget(): JSX.Element {
  const months = useAppStore((s) => s.data?.kanban.months ?? {})
  const [monthKey, setMonthKey] = useState(currentMonthKey())
  const monthOptions = buildMonthOptions(Object.keys(months))
  const monthsWithActivity = useMemo(() => computeMonthsWithActivity(months), [months])

  const month = months[monthKey]
  const items = (month?.columns ?? [])
    .flatMap((col) => col.cards.filter((c) => !c.done).map((card) => ({ card, status: col.status })))
    .sort((a, b) => {
      if (!a.card.completedDate && !b.card.completedDate) return 0
      if (!a.card.completedDate) return 1
      if (!b.card.completedDate) return -1
      return a.card.completedDate.localeCompare(b.card.completedDate)
    })

  return (
    <div className="widget-with-month">
      <MonthPicker
        value={monthKey}
        options={monthOptions}
        monthsWithActivity={monthsWithActivity}
        onChange={setMonthKey}
      />
      {items.length === 0 ? (
        <div className="widget-empty">Нет запланированных активностей</div>
      ) : (
        <div className="planned-list">
          {items.map(({ card, status }) => (
            <div className="planned-row" key={card.id}>
              <span className="planned-title">{card.title}</span>
              <span className="planned-status">{STATUS_LABEL[status]}</span>
              <span className="planned-date">{card.completedDate ?? 'без даты'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
