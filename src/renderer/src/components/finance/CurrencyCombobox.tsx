import { useMemo, useState } from 'react'
import { useLanguageStore } from '../../state/useLanguageStore'
import { useT } from '../../lib/i18n/useT'
import { useClickOutside } from '../../lib/useClickOutside'
import { CURRENCIES, currencyName } from '../../lib/currency'
import type { CurrencyCode } from '../../lib/types'

interface Props {
  value: CurrencyCode
  onChange: (code: CurrencyCode) => void
}

/** Currency field you can type into: matches the ticker (EUR) or the name (euro, злотый, ...). */
export default function CurrencyCombobox({ value, onChange }: Props): JSX.Element {
  const t = useT()
  const language = useLanguageStore((s) => s.language)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false))

  const options = useMemo(
    () => CURRENCIES.map((code) => ({ code, name: currencyName(code, language) })),
    [language]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    const matches = options.filter((o) => `${o.code} ${o.name}`.toLowerCase().includes(q))
    // Ticker matches first, so typing "eu" puts EUR above anything that merely contains it.
    return matches.sort(
      (a, b) => Number(b.code.toLowerCase().startsWith(q)) - Number(a.code.toLowerCase().startsWith(q))
    )
  }, [options, query])

  const current = options.find((o) => o.code === value)

  function pick(code: CurrencyCode): void {
    onChange(code)
    setOpen(false)
    setQuery('')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const choice = filtered[highlight] ?? filtered[0]
      if (choice) pick(choice.code)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div className="fin-combo" ref={ref}>
      <input
        value={open ? query : current ? `${current.code} — ${current.name}` : value}
        placeholder={t('fin.currencySearch')}
        onFocus={(e) => {
          setOpen(true)
          setQuery('')
          setHighlight(0)
          e.currentTarget.select()
        }}
        onChange={(e) => {
          setOpen(true)
          setQuery(e.target.value)
          setHighlight(0)
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div className="fin-combo-list">
          {filtered.length === 0 && <div className="fin-combo-empty">{t('fin.currencyNoMatch')}</div>}
          {filtered.map((o, i) => (
            <button
              key={o.code}
              type="button"
              className={i === highlight ? 'fin-combo-option active' : 'fin-combo-option'}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(o.code)
              }}
            >
              <strong>{o.code}</strong>
              <span>{o.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
