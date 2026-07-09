import { useState } from 'react'
import { useT } from '../../lib/i18n/useT'

interface Props {
  initialName?: string
  initialColor?: string
  onCancel: () => void
  onSave: (name: string, color: string) => void
}

const DEFAULT_COLORS = ['#7c5cff', '#34d1a0', '#ffb454', '#ff5c72', '#4ea1ff', '#f068c6']

export default function AddSkillModal({ initialName, initialColor, onCancel, onSave }: Props): JSX.Element {
  const t = useT()
  const [name, setName] = useState(initialName ?? '')
  const [color, setColor] = useState(initialColor ?? DEFAULT_COLORS[0])

  function submit(): void {
    if (!name.trim()) return
    onSave(name.trim(), color)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>{initialName ? t('skills.editSkillTitle') : t('skills.newSkillTitle')}</h2>
        <div className="form-field">
          <label>{t('common.nameLabel')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="form-field">
          <label>{t('skills.colorLabel')}</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            <div style={{ display: 'flex', gap: 6 }}>
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: c,
                    border: c === color ? '2px solid white' : '1px solid var(--border)'
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            {initialName ? t('common.save') : t('common.add')}
          </button>
        </div>
      </div>
    </div>
  )
}
