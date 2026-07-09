import { useState } from 'react'
import { formatMonthLabel } from '../../lib/month'
import { useT } from '../../lib/i18n/useT'
import CustomMonthModal from './CustomMonthModal'

interface Props {
  value: string
  options: string[]
  monthsWithActivity: Set<string>
  onChange: (key: string) => void
}

const CUSTOM = '__custom__'

export default function MonthPicker({ value, options, monthsWithActivity, onChange }: Props): JSX.Element {
  const t = useT()
  const [pickingCustom, setPickingCustom] = useState(false)

  return (
    <div className="month-picker">
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value === CUSTOM) {
            setPickingCustom(true)
          } else {
            onChange(e.target.value)
          }
        }}
      >
        {options.map((key) => (
          <option key={key} value={key}>
            {formatMonthLabel(key, t)}
            {monthsWithActivity.has(key) ? ' •' : ''}
          </option>
        ))}
        <option value={CUSTOM}>{t('kanban.otherMonth')}</option>
      </select>
      {pickingCustom && (
        <CustomMonthModal
          onCancel={() => setPickingCustom(false)}
          onSave={(key) => {
            onChange(key)
            setPickingCustom(false)
          }}
        />
      )}
    </div>
  )
}
