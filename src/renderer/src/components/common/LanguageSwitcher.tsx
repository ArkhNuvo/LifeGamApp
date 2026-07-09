import { useState } from 'react'
import { useLanguageStore } from '../../state/useLanguageStore'
import { LANGUAGE_CODES, LANGUAGE_LABELS } from '../../lib/i18n'
import { useT } from '../../lib/i18n/useT'
import { useClickOutside } from '../../lib/useClickOutside'
import './LanguageSwitcher.css'

export default function LanguageSwitcher(): JSX.Element {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false))

  return (
    <div className="language-switcher" ref={ref}>
      <button
        type="button"
        className="icon-btn language-switcher-btn"
        onClick={() => setOpen((v) => !v)}
        title={t('language.switchTooltip')}
      >
        {language.toUpperCase()}
      </button>
      {open && (
        <div className="language-switcher-menu">
          {LANGUAGE_CODES.map((code) => (
            <button
              key={code}
              type="button"
              className={code === language ? 'language-option active' : 'language-option'}
              onClick={() => {
                setLanguage(code)
                setOpen(false)
              }}
            >
              {LANGUAGE_LABELS[code]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
