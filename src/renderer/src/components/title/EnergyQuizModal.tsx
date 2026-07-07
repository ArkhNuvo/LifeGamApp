import { useState } from 'react'
import { MENTAL_QUIZ, PHYSICAL_QUIZ, scoreQuiz, QuizAnswer, QuizQuestion } from '../../lib/energy'
import { useAppStore } from '../../state/useAppStore'
import './EnergyQuizModal.css'

interface Props {
  kind: 'mental' | 'physical'
  onClose: () => void
}

const TITLES: Record<Props['kind'], string> = {
  mental: 'Оцени ментальную энергию',
  physical: 'Оцени физическую энергию'
}

function QuestionRow({
  question,
  value,
  onChange
}: {
  question: QuizQuestion
  value: QuizAnswer | undefined
  onChange: (v: QuizAnswer) => void
}): JSX.Element {
  return (
    <div className="quiz-question">
      <div className="quiz-question-text">{question.text}</div>
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
            Да
          </button>
          <button
            type="button"
            className={value === false ? 'quiz-yesno-btn active' : 'quiz-yesno-btn'}
            onClick={() => onChange(false)}
          >
            Нет
          </button>
        </div>
      )}
    </div>
  )
}

export default function EnergyQuizModal({ kind, onClose }: Props): JSX.Element {
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
        <h2>{TITLES[kind]}</h2>

        {questions.map((q) => (
          <QuestionRow
            key={q.id}
            question={q}
            value={answers[q.id]}
            onChange={(v) => setAnswers((s) => ({ ...s, [q.id]: v }))}
          />
        ))}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!allAnswered}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
