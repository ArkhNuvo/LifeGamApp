import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { newId } from '../../lib/ids'
import type { StatsWidgetType } from '../../lib/types'
import SkillsPieWidget from './SkillsPieWidget'
import StatusBreakdownWidget from './StatusBreakdownWidget'
import PlannedActivitiesWidget from './PlannedActivitiesWidget'
import SkillsRadarWidget from './SkillsRadarWidget'
import MissedActivitiesWidget from './MissedActivitiesWidget'
import SkillTrendWidget from './SkillTrendWidget'
import './StatsGrid.css'

const WIDGET_LABEL: Record<StatsWidgetType, string> = {
  skillsPie: 'Опыт по навыкам',
  statusBreakdown: 'Соотношение по статусам',
  plannedActivities: 'Запланированные активности',
  skillsRadar: 'Роза ветров по навыкам',
  missedActivities: 'Пропущенные активности',
  skillsTrend: 'Динамика опыта по навыкам'
}

export default function StatsGrid(): JSX.Element {
  const widgets = useAppStore((s) => s.data?.stats.widgets ?? [])
  const updateData = useAppStore((s) => s.updateData)
  const [addingType, setAddingType] = useState<StatsWidgetType | ''>('')

  function addWidget(): void {
    if (!addingType) return
    updateData((draft) => {
      draft.stats.widgets.push({ id: newId(), type: addingType, size: 'normal' })
    })
    setAddingType('')
  }

  function removeWidget(id: string): void {
    updateData((draft) => {
      draft.stats.widgets = draft.stats.widgets.filter((w) => w.id !== id)
    })
  }

  function toggleSize(id: string): void {
    updateData((draft) => {
      const widget = draft.stats.widgets.find((w) => w.id === id)
      if (widget) widget.size = widget.size === 'wide' ? 'normal' : 'wide'
    })
  }

  return (
    <div className="stats-grid">
      {widgets.map((widget) => (
        <div
          className={`stats-cell stats-cell--widget${widget.size === 'wide' ? ' stats-cell--wide' : ''}`}
          key={widget.id}
        >
          <div className="stats-cell-header">
            <span>{WIDGET_LABEL[widget.type]}</span>
            <div className="stats-cell-header-actions">
              <button
                type="button"
                className="icon-btn"
                onClick={() => toggleSize(widget.id)}
                title={widget.size === 'wide' ? 'Свернуть до одной ячейки' : 'Растянуть на две ячейки'}
              >
                {widget.size === 'wide' ? '⇤⇥' : '⇥⇤'}
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => removeWidget(widget.id)}
                title="Удалить виджет"
              >
                ×
              </button>
            </div>
          </div>
          <div className="stats-cell-body">
            {widget.type === 'skillsPie' && <SkillsPieWidget />}
            {widget.type === 'statusBreakdown' && <StatusBreakdownWidget />}
            {widget.type === 'plannedActivities' && <PlannedActivitiesWidget />}
            {widget.type === 'skillsRadar' && <SkillsRadarWidget />}
            {widget.type === 'missedActivities' && <MissedActivitiesWidget />}
            {widget.type === 'skillsTrend' && <SkillTrendWidget />}
          </div>
        </div>
      ))}

      <div className="stats-cell stats-cell--add">
        <select value={addingType} onChange={(e) => setAddingType(e.target.value as StatsWidgetType | '')}>
          <option value="">— выбрать виджет —</option>
          {(Object.keys(WIDGET_LABEL) as StatsWidgetType[]).map((type) => (
            <option key={type} value={type}>
              {WIDGET_LABEL[type]}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-primary" onClick={addWidget} disabled={!addingType}>
          + Добавить
        </button>
      </div>
    </div>
  )
}
