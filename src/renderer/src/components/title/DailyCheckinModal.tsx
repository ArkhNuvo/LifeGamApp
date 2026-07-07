import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { todayISO } from '../../lib/date'
import './DailyCheckinModal.css'

interface Props {
  onClose: () => void
}

const EMOJI_OPTIONS: { emoji: string; value: number; label: string }[] = [
  { emoji: '😩', value: 0, label: 'Совсем никак' },
  { emoji: '😕', value: 25, label: 'Так себе' },
  { emoji: '😐', value: 50, label: 'Средне' },
  { emoji: '🙂', value: 75, label: 'Хорошо' },
  { emoji: '😄', value: 100, label: 'Отлично' }
]

type Step = 'mental' | 'physical'

export default function DailyCheckinModal({ onClose }: Props): JSX.Element {
  const updateData = useAppStore((s) => s.updateData)
  const [step, setStep] = useState<Step>('mental')

  function markDoneForToday(): void {
    updateData((draft) => {
      draft.energy.lastCheckinDate = todayISO()
    })
  }

  function skip(): void {
    markDoneForToday()
    onClose()
  }

  function pick(value: number): void {
    updateData((draft) => {
      draft.energy[step] = value
    })
    if (step === 'mental') {
      setStep('physical')
    } else {
      markDoneForToday()
      onClose()
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card checkin-card">
        <div className="checkin-step-indicator">Шаг {step === 'mental' ? 1 : 2} из 2</div>
        <h2>{step === 'mental' ? 'Как твоя ментальная энергия сегодня?' : 'Как твоя физическая энергия сегодня?'}</h2>
        <div className="checkin-emojis">
          {EMOJI_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className="checkin-emoji-btn"
              onClick={() => pick(o.value)}
              title={o.label}
            >
              <span className="checkin-emoji">{o.emoji}</span>
              <span className="checkin-emoji-label">{o.label}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={skip}>
            Пропустить
          </button>
        </div>
      </div>
    </div>
  )
}
