import type { KanbanMonth } from './types'

/** XP actually credited to each skill from cards completed within a single month. */
export function skillXpForMonth(
  months: Record<string, KanbanMonth>,
  monthKey: string
): Record<string, number> {
  const result: Record<string, number> = {}
  const month = months[monthKey]
  if (!month) return result
  for (const col of month.columns) {
    for (const card of col.cards) {
      if (!card.effectsApplied) continue
      for (const r of card.rewards) {
        if (!r.xp) continue
        result[r.skillId] = (result[r.skillId] ?? 0) + r.xp
      }
    }
  }
  return result
}
