import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { THEMES, THEME_LABEL_KEYS } from '../../lib/themes'
import type { ColorMode, ThemeName } from '../../lib/types'
import { useT } from '../../lib/i18n/useT'
import { useClickOutside } from '../../lib/useClickOutside'
import './ThemeSwitcher.css'

export default function ThemeSwitcher(): JSX.Element {
  const t = useT()
  const theme = useAppStore((s) => s.data?.theme ?? 'violetAmber')
  const colorMode = useAppStore((s) => s.data?.colorMode ?? 'dark')
  const updateData = useAppStore((s) => s.updateData)
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false))

  function pickTheme(name: ThemeName): void {
    updateData((draft) => {
      draft.theme = name
    })
  }

  function pickMode(mode: ColorMode): void {
    updateData((draft) => {
      draft.colorMode = mode
    })
  }

  return (
    <div className="theme-switcher" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((v) => !v)}
        title={t('theme.switchTooltip')}
      >
        🎨
      </button>
      {open && (
        <div className="theme-switcher-menu">
          <div className="theme-mode-row">
            <button
              type="button"
              className={colorMode === 'light' ? 'theme-mode-btn active' : 'theme-mode-btn'}
              onClick={() => pickMode('light')}
            >
              ☀️ {t('theme.light')}
            </button>
            <button
              type="button"
              className={colorMode === 'dark' ? 'theme-mode-btn active' : 'theme-mode-btn'}
              onClick={() => pickMode('dark')}
            >
              🌙 {t('theme.dark')}
            </button>
          </div>
          <div className="theme-swatch-grid">
            {(Object.keys(THEMES) as ThemeName[]).map((key) => (
              <button
                key={key}
                type="button"
                className={key === theme ? 'theme-option active' : 'theme-option'}
                title={t(THEME_LABEL_KEYS[key])}
                onClick={() => pickTheme(key)}
              >
                <span
                  className="theme-swatch"
                  style={{
                    background: `linear-gradient(135deg, ${THEMES[key].accent} 50%, ${THEMES[key].accent2} 50%)`
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
