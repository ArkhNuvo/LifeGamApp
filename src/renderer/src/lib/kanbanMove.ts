import { createDefaultColumns } from './kanbanDefaults'
import { revertCardEffects, syncCardDoneState } from './kanbanXp'
import type { UserData } from './types'

export type CardLocation =
  | { type: 'unassigned' }
  | { type: 'column'; monthKey: string; columnId: string }

function listFor(draft: UserData, location: CardLocation) {
  if (location.type === 'unassigned') return draft.kanban.unassigned
  return draft.kanban.months[location.monthKey]?.columns.find((c) => c.id === location.columnId)
    ?.cards
}

/** Moves a card between its current location and a new one, keeping done/xp state consistent. */
export function moveCardTo(
  draft: UserData,
  cardId: string,
  from: CardLocation,
  to: CardLocation
): void {
  const fromList = listFor(draft, from)
  if (!fromList) return
  const idx = fromList.findIndex((c) => c.id === cardId)
  if (idx === -1) return
  const [card] = fromList.splice(idx, 1)

  if (to.type === 'unassigned') {
    if (card.effectsApplied) revertCardEffects(draft, card)
    card.done = false
    card.effectsApplied = false
    draft.kanban.unassigned.push(card)
    return
  }

  if (!draft.kanban.months[to.monthKey]) {
    draft.kanban.months[to.monthKey] = { columns: createDefaultColumns() }
  }
  const destCol = draft.kanban.months[to.monthKey].columns.find((c) => c.id === to.columnId)
  if (!destCol) {
    fromList.splice(idx, 0, card)
    return
  }
  destCol.cards.push(card)
  syncCardDoneState(draft, card, destCol.status)
}
