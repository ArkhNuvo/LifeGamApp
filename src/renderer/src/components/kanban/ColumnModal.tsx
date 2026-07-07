import { useState } from 'react'
import type { ColumnStatus } from '../../lib/types'

interface Props {
  initialName?: string
  initialStatus?: ColumnStatus
  onCancel: () => void
  onSave: (name: string, status: ColumnStatus) => void
}

const STATUS_OPTIONS: { value: ColumnStatus; label: string }[] = [
  { value: 'TODO', label: 'TO DO' },
  { value: 'PLANNED', label: 'PLANNED' },
  { value: 'IN_PROGRESS', label: 'IN PROCESS' },
  { value: 'DONE', label: 'DONE' }
]

export default function ColumnModal({ initialName, initialStatus, onCancel, onSave }: Props): JSX.Element {
  const [name, setName] = useState(initialName ?? '')
  const [status, setStatus] = useState<ColumnStatus>(initialStatus ?? 'TODO')

  function submit(): void {
    if (!name.trim()) return
    onSave(name.trim(), status)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>{initialName ? 'Редактировать колонку' : 'Новая колонка'}</h2>
        <div className="form-field">
          <label>Название</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="form-field">
          <label>Статус</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ColumnStatus)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
