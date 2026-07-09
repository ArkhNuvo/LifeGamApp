import { useState } from 'react'
import { MENTAL_QUIZ, PHYSICAL_QUIZ, scoreQuiz, QuizAnswer, QuizQuestion } from '../../lib/energy'
import { useAppStore } from '../../state/useAppStore'
import { useT, type TFunction } from '../../lib/i18n/useT'
import type { TranslationKey } from '../../lib/i18n'
import './EnergyQuizModal.css'

interface Props {
  kind: 'mental' | 'physical'
  onClose: () => void
}

const TITLE_KEYS: Record<Props['kind'], TranslationKey> = {
  mental: 'energyQuiz.titleMental',
  physical: 'energyQuiz.titlePhysical'
}

function QuestionRow({
  question,
  value,
  onChange,
  t
}: {
  question: QuizQuestion
  value: QuizAnswer | undefined
  onChange: (v: QuizAnswer) => void
  t: TFunction
}): JSX.Element {
  return (
    <div className="quiz-question">
      <div className="quiz-question-text">{t(question.textKey)}</div>
      {question.kind === 'scale' ? (
        <div className="quiz-scale">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={value === n ? 'quiz-scale-btn active' : 'quiz-scale-btn'}
              onClick={() => onChange(n)}
            >
              {n}
            </button>
          ))}
        </div>
      ) : (
        <div className="quiz-yesno">
          <button
            type="button"
            className={value === true ? 'quiz-yesno-btn active' : 'quiz-yesno-btn'}
            onClick={() => onChange(true)}
          >
            {t('common.yes')}
          </button>
          <button
            type="button"
            className={value === false ? 'quiz-yesno-btn active' : 'quiz-yesno-btn'}
            onClick={() => onChange(false)}
          >
            {t('common.no')}
          </button>
        </div>
      )}
    </div>
  )
}

export default function EnergyQuizModal({ kind, onClose }: Props): JSX.Element {
  const t = useT()
  const updateData = useAppStore((s) => s.updateData)
  const questions = kind === 'mental' ? MENTAL_QUIZ : PHYSICAL_QUIZ
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>({})

  const allAnswered = questions.every((q) => answers[q.id] !== undefined)

  function handleSubmit(): void {
    const score = scoreQuiz(questions, answers)
    updateData((draft) => {
      draft.energy[kind] = score
    })
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card energy-quiz-card">
        <h2>{t(TITLE_KEYS[kind])}</h2>

        {questions.map((q) => (
          <QuestionRow
            key={q.id}
            question={q}
            value={answers[q.id]}
            onChange={(v) => setAnswers((s) => ({ ...s, [q.id]: v }))}
            t={t}
          />
        ))}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!allAnswered}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
