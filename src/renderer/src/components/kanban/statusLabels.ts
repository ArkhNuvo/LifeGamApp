import type { ColumnStatus } from '../../lib/types'
import type { TranslationKey } from '../../lib/i18n'

export const STATUS_LABEL_KEYS: Record<ColumnStatus, TranslationKey> = {
  TODO: 'kanban.status.todo',
  PLANNED: 'kanban.status.planned',
  IN_PROGRESS: 'kanban.status.inProgress',
  DONE: 'kanban.status.done'
}
