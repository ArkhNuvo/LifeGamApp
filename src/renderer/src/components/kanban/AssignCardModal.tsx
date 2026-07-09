import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { buildMonthOptions, formatMonthLabel } from '../../lib/month'
import { createDefaultColumns } from '../../lib/kanbanDefaults'
import { syncCardDoneState } from '../../lib/kanbanXp'
import { useT } from '../../lib/i18n/useT'

interface Props {
  cardId: string
  onCancel: () => void
  onDone: () => void
}

export default function AssignCardModal({ cardId, onCancel, onDone }: Props): JSX.Element {
  const t = useT()
  const data = useAppStore((s) => s.data)
  const updateData = useAppStore((s) => s.updateData)
  const monthOptions = buildMonthOptions(Object.keys(data?.kanban.months ?? {}))
  const [monthKey, setMonthKey] = useState(monthOptions[0])
  const month = data?.kanban.months[monthKey]
  const fallbackColumns = useMemo(() => createDefaultColumns(), [monthKey])
  const columns = month ? [...month.columns].sort((a, b) => a.order - b.order) : fallbackColumns
  const [columnId, setColumnId] = useState(columns[0]?.id ?? '')

  useEffect(() => {
    setColumnId(columns[0]?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey])

  function confirm(): void {
    updateData((draft) => {
      const card = draft.kanban.unassigned.find((c) => c.id === cardId)
      if (!card) return
      draft.kanban.unassigned = draft.kanban.unassigned.filter((c) => c.id !== cardId)
      if (!draft.kanban.months[monthKey]) {
        draft.kanban.months[monthKey] = { columns: fallbackColumns }
      }
      const targetColumns = draft.kanban.months[monthKey].columns
      const targetColumn = targetColumns.find((c) => c.id === columnId) ?? targetColumns[0]
      if (!targetColumn) return
      targetColumn.cards.push(card)
      if (targetColumn.status === 'DONE') {
        syncCardDoneState(draft, card, targetColumn.status)
      }
    })
    onDone()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>{t('kanban.moveToKanbanTitle')}</h2>
        <div className="form-field">
          <label>{t('kanban.monthLabel')}</label>
          <select value={monthKey} onChange={(e) => setMonthKey(e.target.value)}>
            {monthOptions.map((k) => (
              <option key={k} value={k}>
                {formatMonthLabel(k, t)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>{t('kanban.assignColumnLabel')}</label>
          <select value={columnId} onChange={(e) => setColumnId(e.target.value)}>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={!columnId}>
            {t('kanban.assignButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
