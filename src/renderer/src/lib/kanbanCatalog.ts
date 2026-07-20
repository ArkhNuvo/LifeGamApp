import { currentMonthKey } from './month'
import { todayISO } from './date'
import { useLanguageStore } from '../state/useLanguageStore'
import { useRatesStore } from '../state/useRatesStore'
import { getLevelProgress } from './xpCurve'
import { convertToUsd } from './currency'
import type {
  KanbanCard,
  KanbanColumn,
  TelegramCatalogCard,
  TelegramCatalogPayload,
  UserData
} from './types'

function shapeCard(
  card: KanbanCard,
  skills: UserData['skills'],
  checkingCategories: UserData['finance']['checking']['categories']
): TelegramCatalogCard {
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    energyMental: card.energyMental,
    energyPhysical: card.energyPhysical,
    money: card.money,
    checkingCategoryName: checkingCategories.find((c) => c.id === card.checkingCategoryId)?.name ?? null,
    done: card.done,
    rewards: card.rewards.map((r) => {
      const skill = skills.find((s) => s.id === r.skillId)
      const subskill = skill?.subskills.find((sub) => sub.id === r.subskillId)
      return { skillName: skill?.name ?? '?', subskillName: subskill?.name ?? null, xp: r.xp }
    })
  }
}

export function buildCatalogPayload(data: UserData): TelegramCatalogPayload {
  const skills = data.skills.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    subskills: s.subskills.map((sub) => ({ id: sub.id, name: sub.name }))
  }))

  const currentColumns = data.kanban.months[currentMonthKey()]?.columns ?? []
  const sortedColumns = [...currentColumns].sort((a, b) => a.order - b.order)
  const columns = sortedColumns.map((c) => ({ id: c.id, name: c.name, status: c.status }))

  const checkingCategories = data.finance.checking.categories

  const today = todayISO()
  const plannedCards: TelegramCatalogCard[] = []
  const doneTodayCards: TelegramCatalogCard[] = []
  const weekCards: TelegramCatalogCard[] = []
  const inProcessCards: TelegramCatalogCard[] = []
  for (const col of sortedColumns) {
    for (const card of col.cards) {
      const isTodoOrPlanned = col.status === 'TODO' || col.status === 'PLANNED'
      // A card "is for today" if its target/completion date is set to today,
      // or — when no completedDate has been set yet — if it was created today
      // (covers bot-created cards, which default completedDate to null).
      const isForToday = card.completedDate ? card.completedDate === today : card.createdDate === today
      if (!card.done && isTodoOrPlanned && isForToday) {
        plannedCards.push(shapeCard(card, data.skills, checkingCategories))
      }
      if (!card.done && isTodoOrPlanned) {
        weekCards.push(shapeCard(card, data.skills, checkingCategories))
      }
      if (!card.done && col.status === 'IN_PROGRESS') {
        inProcessCards.push(shapeCard(card, data.skills, checkingCategories))
      }
      if (card.done && card.completedDate === today) {
        doneTodayCards.push(shapeCard(card, data.skills, checkingCategories))
      }
    }
  }

  const language = useLanguageStore.getState().language
  const rates = useRatesStore.getState().rates?.rates ?? null

  const progress = getLevelProgress(data.totalXp)
  const checkingBreakdown = [
    { name: null, amount: data.finance.checking.balance, currency: data.finance.checking.currency },
    ...checkingCategories.map((c) => ({ name: c.name, amount: c.balance, currency: c.currency }))
  ]
  const savingsBreakdown = data.finance.savings.map((e) => ({
    name: e.name,
    amount: e.amount,
    currency: e.currency
  }))
  const resources = {
    displayName: data.profile.displayName ?? data.profile.username,
    level: progress.level,
    xpIntoLevel: progress.xpIntoLevel,
    xpForNextLevel: progress.xpForNextLevel,
    energyMental: data.energy.mental,
    energyPhysical: data.energy.physical,
    checkingBalance:
      convertToUsd(data.finance.checking.balance, data.finance.checking.currency, rates) +
      checkingCategories.reduce((sum, c) => sum + convertToUsd(c.balance, c.currency, rates), 0),
    savingsBalance: data.finance.savings.reduce(
      (sum, e) => sum + convertToUsd(e.amount, e.currency, rates),
      0
    ),
    checkingBreakdown,
    savingsBreakdown
  }

  return {
    skills,
    columns,
    checkingCategories: checkingCategories.map((c) => ({ id: c.id, name: c.name })),
    plannedCards,
    doneTodayCards,
    weekCards,
    inProcessCards,
    resources,
    language
  }
}

export interface CardLookupResult {
  card: KanbanCard
  column: KanbanColumn | null
  monthKey: string | null
}

/** Scans every month's columns, then unassigned, for a card with this id. */
export function findCardEverywhere(draft: UserData, cardId: string): CardLookupResult | null {
  for (const [monthKey, month] of Object.entries(draft.kanban.months)) {
    for (const column of month.columns) {
      const card = column.cards.find((c) => c.id === cardId)
      if (card) return { card, column, monthKey }
    }
  }
  const unassignedCard = draft.kanban.unassigned.find((c) => c.id === cardId)
  if (unassignedCard) return { card: unassignedCard, column: null, monthKey: null }
  return null
}
