/**
 * First-pass energy scoring. Kept in one place so the quiz weighting can be
 * revised later without touching UI. Each question contributes a 0-100
 * candidate score; the final value is their average, rounded to the nearest
 * 25 to match the quarter-step battery/bicep display.
 */

export type QuizAnswer = number | boolean

export interface QuizQuestion {
  id: string
  text: string
  kind: 'scale' | 'yesno'
  /** For 'yesno': score if answer is "yes" (true) / "no" (false). */
  yesScore?: number
  noScore?: number
}

export const MENTAL_QUIZ: QuizQuestion[] = [
  { id: 'feeling', text: 'Как ты себя чувствуешь по шкале от 0 до 5?', kind: 'scale' },
  {
    id: 'struggled',
    text: 'Ты тупил при выполнении предыдущего задания?',
    kind: 'yesno',
    yesScore: 50,
    noScore: 100
  },
  {
    id: 'distracted',
    text: 'Ты отвлекался во время предыдущей активности?',
    kind: 'yesno',
    yesScore: 75,
    noScore: 100
  },
  {
    id: 'sleep',
    text: 'Ты хорошо выспался в последнее время?',
    kind: 'yesno',
    yesScore: 100,
    noScore: 50
  }
]

export const PHYSICAL_QUIZ: QuizQuestion[] = [
  { id: 'strength', text: 'Сколько физических сил у тебя осталось, по шкале от 0 до 5?', kind: 'scale' },
  {
    id: 'soreness',
    text: 'Чувствуешь физический дискомфорт или усталость в теле?',
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
