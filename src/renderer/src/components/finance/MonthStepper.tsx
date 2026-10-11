import { shiftMonth } from '../../lib/ledger'
import { formatMonthLabel } from '../../lib/month'
import { useT } from '../../lib/i18n/useT'

interface Props {
  month: string
  onChange: (month: string) => void
}

export default function MonthStepper({ month, onChange }: Props): JSX.Element {
  const t = useT()
  return (
    <div className="fin-month-stepper">
      <button type="button" className="icon-btn" onClick={() => onChange(shiftMonth(month, -1))}>
        ‹
      </button>
      <span className="fin-month-label">{formatMonthLabel(month, t)}</span>
      <button type="button" className="icon-btn" onClick={() => onChange(shiftMonth(month, 1))}>
        ›
      </button>
    </div>
  )
}
