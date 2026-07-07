import { formatMonthLabel } from '../../lib/month'

interface Props {
  value: string
  monthOptions: string[]
  onChange: (value: string) => void
}

export const ALL_TIME_SCOPE = 'all'

export default function ScopeSelector({ value, monthOptions, onChange }: Props): JSX.Element {
  return (
    <select className="scope-selector" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value={ALL_TIME_SCOPE}>Весь период</option>
      {monthOptions.map((key) => (
        <option key={key} value={key}>
          {formatMonthLabel(key)}
        </option>
      ))}
    </select>
  )
}
