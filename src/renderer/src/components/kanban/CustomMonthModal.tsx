import { useState } from 'react'
import { monthKey, MONTH_NAME_KEYS } from '../../lib/month'
import { useT } from '../../lib/i18n/useT'

interface Props {
  onCancel: () => void
  onSave: (key: string) => void
}

export default function CustomMonthModal({ onCancel, onSave }: Props): JSX.Element {
  const t = useT()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>{t('kanban.customMonthTitle')}</h2>
        <div className="form-field">
          <label>{t('kanban.monthLabel')}</label>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_NAME_KEYS.map((key, i) => (
              <option key={key} value={i}>
                {t(key)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>{t('kanban.yearLabel')}</label>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(monthKey(year, month))}>
            {t('kanban.open')}
          </button>
        </div>
      </div>
    </div>
  )
}
