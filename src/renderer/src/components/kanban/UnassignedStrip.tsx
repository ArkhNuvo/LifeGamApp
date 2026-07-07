import { useState } from 'react'
import { Draggable, Droppable } from '@hello-pangea/dnd'
import { useAppStore } from '../../state/useAppStore'
import { newId } from '../../lib/ids'
import { revertCardEffects } from '../../lib/kanbanXp'
import { moveCardTo, type CardLocation } from '../../lib/kanbanMove'
import CardModal, { CardFormValues } from './CardModal'
import AssignCardModal from './AssignCardModal'
import './Kanban.css'

export default function UnassignedStrip(): JSX.Element {
  const cards = useAppStore((s) => s.data?.kanban.unassigned ?? [])
  const skills = useAppStore((s) => s.data?.skills ?? [])
  const updateData = useAppStore((s) => s.updateData)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [assigningId, setAssigningId] = useState<string | null>(null)

  function createCard(values: CardFormValues): void {
    updateData((draft) => {
      draft.kanban.unassigned.push({
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
      })
    })
    setCreating(false)
  }

  function saveEdit(id: string, values: CardFormValues, target?: CardLocation): void {
    updateData((draft) => {
      const card = draft.kanban.unassigned.find((c) => c.id === id) ?? null
      const isStillUnassigned = !!card
      if (card) {
        card.title = values.title
        card.description = values.description
        card.rewards = values.rewards
        card.energyMental = values.energyMental
        card.energyPhysical = values.energyPhysical
        card.money = values.money
        card.createdDate = values.createdDate
        card.completedDate = values.completedDate
      }
      if (target && target.type !== 'unassigned' && isStillUnassigned) {
        moveCardTo(draft, id, { type: 'unassigned' }, target)
      }
    })
    setEditingId(null)
  }

  function deleteCard(id: string): void {
    updateData((draft) => {
      const card = draft.kanban.unassigned.find((c) => c.id === id)
      if (card?.effectsApplied) revertCardEffects(draft, card)
      draft.kanban.unassigned = draft.kanban.unassigned.filter((c) => c.id !== id)
    })
  }

  return (
    <div className="unassigned-strip">
      <div className="unassigned-strip-header">Активности вне канбана</div>
      <Droppable droppableId="unassigned" type="CARD" direction="horizontal">
        {(provided) => (
          <div className="unassigned-strip-list" ref={provided.innerRef} {...provided.droppableProps}>
            {cards.map((card, index) => {
              const rewardSkills = card.rewards
                .map((r) => skills.find((s) => s.id === r.skillId))
                .filter((s): s is NonNullable<typeof s> => !!s)
              return (
                <Draggable draggableId={card.id} index={index} key={card.id}>
                  {(dragProvided) => (
                    <div
                      className="unassigned-card"
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                    >
                      <span className="unassigned-card-title">{card.title}</span>
                      {rewardSkills.map((skill, i) => (
                        <span key={i} className="unassigned-card-skill" style={{ color: skill.color }}>
                          {skill.name}
                        </span>
                      ))}
                      <button
                        type="button"
                        className="icon-btn"
                        title="Перенести в канбан"
                        onClick={() => setAssigningId(card.id)}
                      >
                        📌
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Редактировать"
                        onClick={() => setEditingId(card.id)}
                      >
                        ✎
                      </button>
                      <button type="button" className="icon-btn" title="Удалить" onClick={() => deleteCard(card.id)}>
                        🗑
                      </button>
                      {editingId === card.id && (
                        <CardModal
                          initial={card}
                          currentLocation={{ type: 'unassigned' }}
                          onCancel={() => setEditingId(null)}
                          onSave={(values, target) => saveEdit(card.id, values, target)}
                        />
                      )}
                      {assigningId === card.id && (
                        <AssignCardModal
                          cardId={card.id}
                          onCancel={() => setAssigningId(null)}
                          onDone={() => setAssigningId(null)}
                        />
                      )}
                    </div>
                  )}
                </Draggable>
              )
            })}
            {provided.placeholder}
            <button type="button" className="unassigned-add-btn" onClick={() => setCreating(true)}>
              + Добавить активность
            </button>
          </div>
        )}
      </Droppable>
      {creating && <CardModal onCancel={() => setCreating(false)} onSave={createCard} />}
    </div>
  )
}
