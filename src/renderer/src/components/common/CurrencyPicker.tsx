import { useState } from 'react'
import type { CurrencyCode } from '../../lib/types'
import { CURRENCIES, CURRENCY_SYMBOLS } from '../../lib/currency'
import { useClickOutside } from '../../lib/useClickOutside'
import { useT } from '../../lib/i18n/useT'
import './CurrencyPicker.css'

interface Props {
  value: CurrencyCode
  onChange: (code: CurrencyCode) => void
}

export default function CurrencyPicker({ value, onChange }: Props): JSX.Element {
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false))

  return (
    <div className="currency-picker" ref={ref}>
      <button
        type="button"
        className="currency-picker-btn"
        onClick={() => setOpen((v) => !v)}
        title={t('finance.currencyPickerTooltip')}
      >
        {CURRENCY_SYMBOLS[value]}
      </button>
      {open && (
        <div className="currency-picker-menu">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              className={c === value ? 'currency-option active' : 'currency-option'}
              onClick={() => {
                onChange(c)
                setOpen(false)
              }}
            >
              <span className="currency-option-symbol">{CURRENCY_SYMBOLS[c]}</span>
              <span>{c}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
