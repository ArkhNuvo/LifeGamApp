import { newId } from './ids'
import type { KanbanColumn } from './types'

export function createDefaultColumns(): KanbanColumn[] {
  return [
    { id: newId(), name: 'TO DO', status: 'TODO', order: 0, cards: [] },
    { id: newId(), name: 'PLANNED', status: 'PLANNED', order: 1, cards: [] },
    { id: newId(), name: 'IN PROCESS', status: 'IN_PROGRESS', order: 2, cards: [] },
    { id: newId(), name: 'DONE', status: 'DONE', order: 3, cards: [] }
  ]
}
