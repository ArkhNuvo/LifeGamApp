import { Draggable, Droppable } from '@hello-pangea/dnd'
import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { newId } from '../../lib/ids'
import { revertCardEffects, syncCardDoneState } from '../../lib/kanbanXp'
import type { ColumnStatus, KanbanColumn } from '../../lib/types'
import Card from './Card'
import ColumnModal from './ColumnModal'
import CardModal, { CardFormValues } from './CardModal'
import ConfirmModal from '../common/ConfirmModal'

interface Props {
  column: KanbanColumn
  index: number
  monthKey: string
}

const STATUS_LABEL: Record<ColumnStatus, string> = {
  TODO: 'TO DO',
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN PROCESS',
  DONE: 'DONE'
}

export default function Column({ column, index, monthKey }: Props): JSX.Element {
  const updateData = useAppStore((s) => s.updateData)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [creatingCard, setCreatingCard] = useState(false)

  function saveColumn(name: string, status: ColumnStatus): void {
    updateData((draft) => {
      const col = draft.kanban.months[monthKey]?.columns.find((c) => c.id === column.id)
      if (col) {
        col.name = name
        col.status = status
      }
    })
    setEditing(false)
  }

  function deleteColumn(): void {
    updateData((draft) => {
      const m = draft.kanban.months[monthKey]
      if (!m) return
      const target = m.columns.find((c) => c.id === column.id)
      target?.cards.forEach((c) => {
        if (c.effectsApplied) revertCardEffects(draft, c)
      })
      m.columns = m.columns.filter((c) => c.id !== column.id)
    })
    setConfirmingDelete(false)
  }

  function createCard(values: CardFormValues): void {
    updateData((draft) => {
      const col = draft.kanban.months[monthKey]?.columns.find((c) => c.id === column.id)
      if (!col) return
      const card = {
        id: newId(),
        title: values.title,
        description: values.description,
        rewards: values.rewards,
        energyMental: values.energyMental,
        energyPhysical: values.energyPhysical,
        money: values.money,
        createdDate: values.createdDate,
        completedDate: values.completedDate,
        done: false,
        effectsApplied: false
      }
      col.cards.push(card)
      if (col.status === 'DONE') {
        syncCardDoneState(draft, card, col.status)
      }
    })
    setCreatingCard(false)
  }

  return (
    <Draggable draggableId={column.id} index={index}>
      {(provided) => (
        <div className="kanban-column" ref={provided.innerRef} {...provided.draggableProps}>
          <div className="kanban-column-header" {...provided.dragHandleProps}>
            <span className="kanban-column-name">{column.name}</span>
            <span className="kanban-column-status">{STATUS_LABEL[column.status]}</span>
            <div className="kanban-column-actions">
              <button type="button" className="icon-btn" onClick={() => setEditing(true)} title="Редактировать">
                ✎
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setConfirmingDelete(true)}
                title="Удалить колонку"
              >
                🗑
              </button>
            </div>
          </div>

          <Droppable droppableId={column.id} type="CARD">
            {(dropProvided) => (
              <div className="kanban-column-cards" ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                {column.cards.map((card, i) => (
                  <Card
                    key={card.id}
                    card={card}
                    index={i}
                    columnId={column.id}
                    columnStatus={column.status}
                    monthKey={monthKey}
                  />
                ))}
                {dropProvided.placeholder}
              </div>
            )}
          </Droppable>

          <button type="button" className="kanban-create-card-btn" onClick={() => setCreatingCard(true)}>
            + Создать активность
          </button>

          {editing && (
            <ColumnModal
              initialName={column.name}
              initialStatus={column.status}
              onCancel={() => setEditing(false)}
              onSave={saveColumn}
            />
          )}
          {confirmingDelete && (
            <ConfirmModal
              message={`Удалить колонку "${column.name}" вместе со всеми карточками?`}
              onConfirm={deleteColumn}
              onCancel={() => setConfirmingDelete(false)}
            />
          )}
          {creatingCard && <CardModal onCancel={() => setCreatingCard(false)} onSave={createCard} />}
        </div>
      )}
    </Draggable>
  )
}
