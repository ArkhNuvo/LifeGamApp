/**
 * Leveling curve: quadratic growth. Steeper than linear so higher levels take
 * meaningfully longer, but far gentler than exponential so late levels stay
 * reachable. Tune via XP_A / XP_B only.
 */
const XP_A = 60
const XP_B = 40

export function xpToReachLevel(level: number): number {
  return Math.round(XP_A * level * level + XP_B * level)
}

export interface LevelProgress {
  level: number
  xpIntoLevel: number
  xpForNextLevel: number
  totalXp: number
}

export function getLevelProgress(totalXp: number): LevelProgress {
  const xp = Math.max(0, totalXp)
  let level = 1
  while (xp >= xpToReachLevel(level)) {
    level++
  }
  const prevThreshold = level === 1 ? 0 : xpToReachLevel(level - 1)
  const nextThreshold = xpToReachLevel(level)
  return {
    level,
    xpIntoLevel: xp - prevThreshold,
    xpForNextLevel: nextThreshold - prevThreshold,
    totalXp: xp
  }
}
