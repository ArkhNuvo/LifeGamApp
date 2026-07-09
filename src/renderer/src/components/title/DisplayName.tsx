import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useT } from '../../lib/i18n/useT'
import './DisplayName.css'

export default function DisplayName(): JSX.Element {
  const t = useT()
  const username = useAppStore((s) => s.data?.profile.username ?? '')
  const displayName = useAppStore((s) => s.data?.profile.displayName ?? null)
  const updateData = useAppStore((s) => s.updateData)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  const shown = displayName ?? username

  function startEdit(): void {
    setValue(shown)
    setEditing(true)
  }

  function save(): void {
    const trimmed = value.trim()
    updateData((draft) => {
      draft.profile.displayName = trimmed && trimmed !== draft.profile.username ? trimmed : null
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        className="display-name-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') setEditing(false)
        }}
        autoFocus
      />
    )
  }

  return (
    <span className="display-name" onDoubleClick={startEdit} title={t('profile.editNameTooltip')}>
      {shown}
    </span>
  )
}
