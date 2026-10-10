import { todayISO } from './date'
import type { ColumnStatus, KanbanCard, KanbanColumn, UserData } from './types'

/**
 * XP is whatever the user assigned to each skill/subskill when creating the
 * card (card.rewards) — it is independent of the energy cost fields.
 */
export function xpForCard(card: Pick<KanbanCard, 'rewards'>): number {
  return card.rewards.reduce((sum, r) => sum + (r.xp || 0), 0)
}

/** Applies a signed money delta to the card's target checking category, or the general balance if unset/unknown. */
function applyMoneyDelta(draft: UserData, card: KanbanCard, sign: 1 | -1): void {
  const amount = sign * (card.money || 0)
  if (!amount) return
  const category = card.checkingCategoryId
    ? draft.finance.checking.categories.find((c) => c.id === card.checkingCategoryId)
    : undefined
  if (category) {
    category.balance += amount
  } else {
    draft.finance.checking.balance += amount
  }
}

/**
 * Applies a completed card's effects: XP and money always apply (they're
 * cumulative totals), but the energy delta only applies if the card's
 * completedDate is today — backdated/future-dated activities shouldn't move
 * today's energy gauge.
 */
export function applyCardEffects(draft: UserData, card: KanbanCard): void {
  for (const reward of card.rewards) {
    if (!reward.xp) continue
    draft.totalXp += reward.xp
    const skill = draft.skills.find((s) => s.id === reward.skillId)
    if (!skill) continue
    if (reward.subskillId) {
      const sub = skill.subskills.find((su) => su.id === reward.subskillId)
      if (sub) sub.xp += reward.xp
      else skill.xp += reward.xp
    } else {
      skill.xp += reward.xp
    }
  }
  applyMoneyDelta(draft, card, 1)
  if (card.completedDate === todayISO()) {
    draft.energy.mental = Math.max(0, Math.min(100, draft.energy.mental + (card.energyMental || 0)))
    draft.energy.physical = Math.max(
      0,
      Math.min(100, draft.energy.physical + (card.energyPhysical || 0))
    )
  }
}

export function revertCardEffects(draft: UserData, card: KanbanCard): void {
  for (const reward of card.rewards) {
    if (!reward.xp) continue
    draft.totalXp = Math.max(0, draft.totalXp - reward.xp)
    const skill = draft.skills.find((s) => s.id === reward.skillId)
    if (!skill) continue
    if (reward.subskillId) {
      const sub = skill.subskills.find((su) => su.id === reward.subskillId)
      if (sub) sub.xp = Math.max(0, sub.xp - reward.xp)
      else skill.xp = Math.max(0, skill.xp - reward.xp)
    } else {
      skill.xp = Math.max(0, skill.xp - reward.xp)
    }
  }
  applyMoneyDelta(draft, card, -1)
  if (card.completedDate === todayISO()) {
    draft.energy.mental = Math.max(0, Math.min(100, draft.energy.mental - (card.energyMental || 0)))
    draft.energy.physical = Math.max(
      0,
      Math.min(100, draft.energy.physical - (card.energyPhysical || 0))
    )
  }
}

/**
 * Keeps card.done / card.effectsApplied consistent with where the card lives.
 * `desiredDone` overrides the "done follows DONE-column" default, used for
 * the manual checkbox toggle.
 */
export function syncCardDoneState(
  draft: UserData,
  card: KanbanCard,
  columnStatus: ColumnStatus,
  desiredDone?: boolean
): void {
  const shouldBeDone = desiredDone !== undefined ? desiredDone : columnStatus === 'DONE'
  card.done = shouldBeDone
  if (card.done && !card.effectsApplied) {
    if (!card.completedDate) {
      card.completedDate = todayISO()
    }
    applyCardEffects(draft, card)
    card.effectsApplied = true
  } else if (!card.done && card.effectsApplied) {
    revertCardEffects(draft, card)
    card.effectsApplied = false
  }
}

/**
 * Applies an edit to a card while keeping already-granted effects in sync.
 * If the card's XP/money/energy were already applied, they are reverted with
 * the *old* values before the edit and re-applied with the *new* ones after —
 * otherwise a later revert (delete, undo, drag out of DONE) would subtract the
 * edited amounts instead of what was actually granted.
 */
export function editCardWithEffects(
  draft: UserData,
  card: KanbanCard,
  mutate: (card: KanbanCard) => void
): void {
  const wasApplied = card.effectsApplied
  if (wasApplied) revertCardEffects(draft, card)
  mutate(card)
  if (wasApplied) {
    if (!card.completedDate) card.completedDate = todayISO()
    applyCardEffects(draft, card)
  }
}

/**
 * Relocates a card into its month's DONE-status column, inserted at the
 * top, then syncs its done state — for sources that flag a card done
 * without themselves performing the physical move (e.g. the Telegram bot).
 * In-app, this normally happens via drag-and-drop; this mirrors that.
 * The reverse also holds: un-marking a card that sits in DONE moves it back
 * to the column it came from (or the first non-DONE column), otherwise it
 * would be "not done, yet in DONE" and drop out of every bot list.
 * Falls back to an in-place sync if the card is unassigned or the month has
 * no suitable column.
 */
export function moveToDoneColumnAndSync(
  draft: UserData,
  monthKey: string | null,
  column: KanbanColumn | null,
  card: KanbanCard,
  desiredDone?: boolean
): void {
  const columns = monthKey ? draft.kanban.months[monthKey]?.columns : undefined
  if (column && columns) {
    let target: KanbanColumn | undefined
    if (desiredDone === true && column.status !== 'DONE') {
      target = columns.find((c) => c.status === 'DONE')
      if (target) card.returnColumnId = column.id
    } else if (desiredDone === false && column.status === 'DONE') {
      target =
        columns.find((c) => c.id === card.returnColumnId && c.status !== 'DONE') ??
        [...columns].sort((a, b) => a.order - b.order).find((c) => c.status !== 'DONE')
      if (target) delete card.returnColumnId
    }
    if (target) {
      column.cards = column.cards.filter((c) => c.id !== card.id)
      target.cards.unshift(card)
      syncCardDoneState(draft, card, target.status, desiredDone)
      return
    }
  }
  syncCardDoneState(draft, card, column?.status ?? 'TODO', desiredDone)
}
