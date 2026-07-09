import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { todayISO } from '../../lib/date'
import { useT } from '../../lib/i18n/useT'
import type { TranslationKey } from '../../lib/i18n'
import './DailyCheckinModal.css'

interface Props {
  onClose: () => void
}

const EMOJI_OPTIONS: { emoji: string; value: number; labelKey: TranslationKey }[] = [
  { emoji: '😩', value: 0, labelKey: 'checkin.emoji.terrible' },
  { emoji: '😕', value: 25, labelKey: 'checkin.emoji.bad' },
  { emoji: '😐', value: 50, labelKey: 'checkin.emoji.ok' },
  { emoji: '🙂', value: 75, labelKey: 'checkin.emoji.good' },
  { emoji: '😄', value: 100, labelKey: 'checkin.emoji.great' }
]

type Step = 'mental' | 'physical'

export default function DailyCheckinModal({ onClose }: Props): JSX.Element {
  const t = useT()
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
        <div className="checkin-step-indicator">{t('checkin.step', { step: step === 'mental' ? 1 : 2 })}</div>
        <h2>{step === 'mental' ? t('checkin.questionMental') : t('checkin.questionPhysical')}</h2>
        <div className="checkin-emojis">
          {EMOJI_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className="checkin-emoji-btn"
              onClick={() => pick(o.value)}
              title={t(o.labelKey)}
            >
              <span className="checkin-emoji">{o.emoji}</span>
              <span className="checkin-emoji-label">{t(o.labelKey)}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={skip}>
            {t('checkin.skip')}
          </button>
        </div>
      </div>
    </div>
  )
}
