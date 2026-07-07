import type { Skill } from './types'

export function totalSkillXp(skill: Pick<Skill, 'xp' | 'subskills'>): number {
  return skill.xp + skill.subskills.reduce((sum, s) => sum + s.xp, 0)
}
