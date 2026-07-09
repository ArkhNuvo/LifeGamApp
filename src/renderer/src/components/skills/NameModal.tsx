import { useState } from 'react'
import { useT } from '../../lib/i18n/useT'

interface Props {
  title: string
  label: string
  initialValue?: string
  onCancel: () => void
  onSave: (name: string) => void
}

export default function NameModal({ title, label, initialValue, onCancel, onSave }: Props): JSX.Element {
  const t = useT()
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
