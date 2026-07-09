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
import { useT } from '../../lib/i18n/useT'
import { STATUS_LABEL_KEYS } from './statusLabels'

interface Props {
  column: KanbanColumn
  index: number
  monthKey: string
}

export default function Column({ column, index, monthKey }: Props): JSX.Element {
  const t = useT()
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
        checkingCategoryId: values.checkingCategoryId,
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
            <span className="kanban-column-status">{t(STATUS_LABEL_KEYS[column.status])}</span>
            <div className="kanban-column-actions">
              <button type="button" className="icon-btn" onClick={() => setEditing(true)} title={t('common.edit')}>
                ✎
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setConfirmingDelete(true)}
                title={t('kanban.deleteColumnTooltip')}
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
            {t('kanban.createCardButton')}
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
              message={t('kanban.deleteColumnConfirm', { name: column.name })}
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
