/**
 * First-pass energy scoring. Kept in one place so the quiz weighting can be
 * revised later without touching UI. Each question contributes a 0-100
 * candidate score; the final value is their average, rounded to the nearest
 * 25 to match the quarter-step battery/bicep display.
 */
import type { TranslationKey } from './i18n'

export type QuizAnswer = number | boolean

export interface QuizQuestion {
  id: string
  textKey: TranslationKey
  kind: 'scale' | 'yesno'
  /** For 'yesno': score if answer is "yes" (true) / "no" (false). */
  yesScore?: number
  noScore?: number
}

export const MENTAL_QUIZ: QuizQuestion[] = [
  { id: 'feeling', textKey: 'energyQuiz.q.feeling', kind: 'scale' },
  {
    id: 'struggled',
    textKey: 'energyQuiz.q.struggled',
    kind: 'yesno',
    yesScore: 50,
    noScore: 100
  },
  {
    id: 'distracted',
    textKey: 'energyQuiz.q.distracted',
    kind: 'yesno',
    yesScore: 75,
    noScore: 100
  },
  {
    id: 'sleep',
    textKey: 'energyQuiz.q.sleep',
    kind: 'yesno',
    yesScore: 100,
    noScore: 50
  }
]

export const PHYSICAL_QUIZ: QuizQuestion[] = [
  { id: 'strength', textKey: 'energyQuiz.q.strength', kind: 'scale' },
  {
    id: 'soreness',
    textKey: 'energyQuiz.q.soreness',
    kind: 'yesno',
    yesScore: 50,
    noScore: 100
  }
]

function roundToQuarter(value: number): number {
  return Math.round(value / 25) * 25
}

export function scoreQuiz(questions: QuizQuestion[], answers: Record<string, QuizAnswer>): number {
  const scores = questions.map((q) => {
    const answer = answers[q.id]
    if (q.kind === 'scale') {
      const v = typeof answer === 'number' ? answer : 0
      return Math.max(0, Math.min(5, v)) * 20
    }
    return answer ? (q.yesScore ?? 100) : (q.noScore ?? 100)
  })
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return Math.max(0, Math.min(100, roundToQuarter(avg)))
}
