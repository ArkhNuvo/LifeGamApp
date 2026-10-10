import { Draggable } from '@hello-pangea/dnd'
import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { syncCardDoneState, revertCardEffects, editCardWithEffects } from '../../lib/kanbanXp'
import { moveCardTo, type CardLocation } from '../../lib/kanbanMove'
import type { ColumnStatus, KanbanCard } from '../../lib/types'
import CardModal, { CardFormValues } from './CardModal'
import { useT } from '../../lib/i18n/useT'
import { STATUS_LABEL_KEYS } from './statusLabels'
import { CURRENCY_SYMBOLS } from '../../lib/currency'

interface Props {
  card: KanbanCard
  index: number
  columnId: string
  columnStatus: ColumnStatus
  monthKey: string
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

export default function Card({ card, index, columnId, columnStatus, monthKey }: Props): JSX.Element {
  const t = useT()
  const updateData = useAppStore((s) => s.updateData)
  const skills = useAppStore((s) => s.data?.skills ?? [])
  const moneyCurrency = useAppStore(
    (s) =>
      s.data?.finance.checking.categories.find((c) => c.id === card.checkingCategoryId)?.currency ??
      s.data?.finance.checking.currency ??
      'USD'
  )
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
      editCardWithEffects(draft, c, (target) => {
        target.title = values.title
        target.description = values.description
        target.rewards = values.rewards
        target.energyMental = values.energyMental
        target.energyPhysical = values.energyPhysical
        target.money = values.money
        target.checkingCategoryId = values.checkingCategoryId
        target.createdDate = values.createdDate
        target.completedDate = values.completedDate
      })

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
              title={columnStatus === 'DONE' ? t('kanban.markDoneTooltip') : t('kanban.onlyInDoneTooltip')}
            />
            <span className="kanban-card-title">{card.title}</span>
            <button type="button" className="icon-btn" onClick={() => setEditing(true)} title={t('common.edit')}>
              ✎
            </button>
            <button type="button" className="icon-btn" onClick={deleteCard} title={t('common.delete')}>
              🗑
            </button>
          </div>
          <div className="kanban-card-meta">
            <span className="kanban-card-status">{t(STATUS_LABEL_KEYS[card.done ? 'DONE' : columnStatus])}</span>
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
            {card.money !== 0 && (
              <>
                {' '}
                · 💵 {signed(card.money)}
                {CURRENCY_SYMBOLS[moneyCurrency]}
              </>
            )}
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
