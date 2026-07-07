import { useState } from 'react'
import { monthKey } from '../../lib/month'

interface Props {
  onCancel: () => void
  onSave: (key: string) => void
}

const MONTH_NAMES_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь'
]

export default function CustomMonthModal({ onCancel, onSave }: Props): JSX.Element {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>Выбрать месяц и год</h2>
        <div className="form-field">
          <label>Месяц</label>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTH_NAMES_RU.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Год</label>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(monthKey(year, month))}>
            Открыть
          </button>
        </div>
      </div>
    </div>
  )
}
