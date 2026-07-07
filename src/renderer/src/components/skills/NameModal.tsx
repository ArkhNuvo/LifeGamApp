import { useState } from 'react'

interface Props {
  title: string
  label: string
  initialValue?: string
  onCancel: () => void
  onSave: (name: string) => void
}

export default function NameModal({ title, label, initialValue, onCancel, onSave }: Props): JSX.Element {
  const [name, setName] = useState(initialValue ?? '')

  function submit(): void {
    if (!name.trim()) return
    onSave(name.trim())
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>{title}</h2>
        <div className="form-field">
          <label>{label}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
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
