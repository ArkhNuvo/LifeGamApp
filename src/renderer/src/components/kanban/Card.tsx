import { Draggable } from '@hello-pangea/dnd'
import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { syncCardDoneState, revertCardEffects } from '../../lib/kanbanXp'
import { moveCardTo, type CardLocation } from '../../lib/kanbanMove'
import type { ColumnStatus, KanbanCard } from '../../lib/types'
import CardModal, { CardFormValues } from './CardModal'

interface Props {
  card: KanbanCard
  index: number
  columnId: string
  columnStatus: ColumnStatus
  monthKey: string
}

const STATUS_LABEL: Record<ColumnStatus, string> = {
  TODO: 'TO DO',
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN PROCESS',
  DONE: 'DONE'
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

export default function Card({ card, index, columnId, columnStatus, monthKey }: Props): JSX.Element {
  const updateData = useAppStore((s) => s.updateData)
  const skills = useAppStore((s) => s.data?.skills ?? [])
  const [editing, setEditing] = useState(false)

  function toggleDone(): void {
    if (columnStatus !== 'DONE') return
    updateData((draft) => {
      const col = draft.kanban.months[monthKey]?.columns.find((c) => c.id === columnId)
      const c = col?.cards.find((c) => c.id === card.id)
      if (!c) return
      syncCardDoneState(draft, c, columnStatus, !c.done)
    })
  }

  function saveEdit(values: CardFormValues, target?: CardLocation): void {
    updateData((draft) => {
      const col = draft.kanban.months[monthKey]?.columns.find((c) => c.id === columnId)
      const c = col?.cards.find((c) => c.id === card.id)
      if (!c) return
      c.title = values.title
      c.description = values.description
      c.rewards = values.rewards
      c.energyMental = values.energyMental
      c.energyPhysical = values.energyPhysical
      c.money = values.money
      c.createdDate = values.createdDate
      c.completedDate = values.completedDate

      const isSameLocation =
        !target || (target.type === 'column' && target.monthKey === monthKey && target.columnId === columnId)
      if (target && !isSameLocation) {
        moveCardTo(draft, card.id, { type: 'column', monthKey, columnId }, target)
      }
    })
    setEditing(false)
  }

  function deleteCard(): void {
    updateData((draft) => {
      const col = draft.kanban.months[monthKey]?.columns.find((c) => c.id === columnId)
      if (!col) return
      const c = col.cards.find((c) => c.id === card.id)
      if (c && c.effectsApplied) {
        revertCardEffects(draft, c)
      }
      col.cards = col.cards.filter((c) => c.id !== card.id)
    })
  }

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          className={`kanban-card${snapshot.isDragging ? ' dragging' : ''}`}
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <div className="kanban-card-top">
            <input
              type="checkbox"
              checked={card.done}
              disabled={columnStatus !== 'DONE'}
              onChange={toggleDone}
              title={columnStatus === 'DONE' ? 'Отметить выполненной' : 'Доступно только в колонке DONE'}
            />
            <span className="kanban-card-title">{card.title}</span>
            <button type="button" className="icon-btn" onClick={() => setEditing(true)} title="Редактировать">
              ✎
            </button>
            <button type="button" className="icon-btn" onClick={deleteCard} title="Удалить">
              🗑
            </button>
          </div>
          <div className="kanban-card-meta">
            <span className="kanban-card-status">{STATUS_LABEL[card.done ? 'DONE' : columnStatus]}</span>
            {card.completedDate && <span className="kanban-card-due">{card.completedDate}</span>}
          </div>
          {card.rewards.length > 0 && (
            <div className="kanban-card-rewards">
              {card.rewards.map((r, i) => {
                const skill = skills.find((s) => s.id === r.skillId)
                const sub = skill?.subskills.find((s) => s.id === r.subskillId)
                return (
                  <span key={i} className="kanban-card-reward" style={{ color: skill?.color }}>
                    +{r.xp} {skill?.name}
                    {sub ? ` / ${sub.name}` : ''}
                  </span>
                )
              })}
            </div>
          )}
          <div className="kanban-card-energy">
            🧠 {signed(card.energyMental)}% · 💪 {signed(card.energyPhysical)}%
            {card.money !== 0 && <> · 💵 {signed(card.money)}$</>}
          </div>
          {editing && (
            <CardModal
              initial={card}
              currentLocation={{ type: 'column', monthKey, columnId }}
              onCancel={() => setEditing(false)}
              onSave={saveEdit}
            />
          )}
        </div>
      )}
    </Draggable>
  )
}
