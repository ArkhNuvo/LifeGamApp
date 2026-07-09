import { useAppStore } from '../../state/useAppStore'
import { todayISO } from '../../lib/date'
import { formatMonthLabel } from '../../lib/month'
import { useT } from '../../lib/i18n/useT'

interface MissedItem {
  title: string
  completedDate: string
  location: string
}

export default function MissedActivitiesWidget(): JSX.Element {
  const t = useT()
  const months = useAppStore((s) => s.data?.kanban.months ?? {})
  const unassigned = useAppStore((s) => s.data?.kanban.unassigned ?? [])
  const today = todayISO()

  const missed: MissedItem[] = []
  for (const [key, month] of Object.entries(months)) {
    for (const col of month.columns) {
      for (const card of col.cards) {
        if (!card.done && card.completedDate && card.completedDate < today) {
          missed.push({ title: card.title, completedDate: card.completedDate, location: formatMonthLabel(key, t) })
        }
      }
    }
  }
  for (const card of unassigned) {
    if (!card.done && card.completedDate && card.completedDate < today) {
      missed.push({ title: card.title, completedDate: card.completedDate, location: t('stats.missedLocationUnassigned') })
    }
  }
  missed.sort((a, b) => a.completedDate.localeCompare(b.completedDate))

  return (
    <div className="missed-widget">
      <div className={missed.length > 0 ? 'missed-count missed-count--alert' : 'missed-count'}>
        {missed.length}
      </div>
      {missed.length === 0 ? (
        <div className="widget-empty">{t('stats.emptyMissed')}</div>
      ) : (
        <div className="planned-list">
          {missed.map((m, i) => (
            <div className="planned-row" key={i}>
              <span className="planned-title">{m.title}</span>
              <span className="planned-status">{m.location}</span>
              <span className="planned-date">{m.completedDate}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
