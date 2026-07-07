import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { THEMES } from '../../lib/themes'
import type { ThemeName } from '../../lib/types'
import './ThemeSwitcher.css'

export default function ThemeSwitcher(): JSX.Element {
  const theme = useAppStore((s) => s.data?.theme ?? 'violetAmber')
  const updateData = useAppStore((s) => s.updateData)
  const [open, setOpen] = useState(false)

  function pick(name: ThemeName): void {
    updateData((draft) => {
      draft.theme = name
    })
    setOpen(false)
  }

  return (
    <div className="theme-switcher">
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((v) => !v)}
        title="Сменить цветовую схему"
      >
        🎨
      </button>
      {open && (
        <div className="theme-switcher-menu">
          {(Object.keys(THEMES) as ThemeName[]).map((key) => (
            <button
              key={key}
              type="button"
              className={key === theme ? 'theme-option active' : 'theme-option'}
              onClick={() => pick(key)}
            >
              <span
                className="theme-swatch"
                style={{
                  background: `linear-gradient(135deg, ${THEMES[key].accent} 50%, ${THEMES[key].accent2} 50%)`
                }}
              />
              <span className="theme-option-label">{THEMES[key].label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
