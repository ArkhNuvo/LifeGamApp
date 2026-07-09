import { useState } from 'react'
import type { ColumnStatus } from '../../lib/types'
import { useT } from '../../lib/i18n/useT'
import { STATUS_LABEL_KEYS } from './statusLabels'

interface Props {
  initialName?: string
  initialStatus?: ColumnStatus
  onCancel: () => void
  onSave: (name: string, status: ColumnStatus) => void
}

const STATUS_OPTIONS: ColumnStatus[] = ['TODO', 'PLANNED', 'IN_PROGRESS', 'DONE']

export default function ColumnModal({ initialName, initialStatus, onCancel, onSave }: Props): JSX.Element {
  const t = useT()
  const [name, setName] = useState(initialName ?? '')
  const [status, setStatus] = useState<ColumnStatus>(initialStatus ?? 'TODO')

  function submit(): void {
    if (!name.trim()) return
    onSave(name.trim(), status)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>{initialName ? t('kanban.editColumnTitle') : t('kanban.newColumnTitle')}</h2>
        <div className="form-field">
          <label>{t('common.nameLabel')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="form-field">
          <label>{t('kanban.statusLabel')}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ColumnStatus)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(STATUS_LABEL_KEYS[s])}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
