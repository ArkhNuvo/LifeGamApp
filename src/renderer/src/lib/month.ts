import type { KanbanMonth } from './types'
import type { TranslationKey } from './i18n'
import type { TFunction } from './i18n/useT'

export function monthKey(year: number, monthIndex0: number): string {
  return `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`
}

export function parseMonthKey(key: string): { year: number; monthIndex0: number } {
  const [y, m] = key.split('-').map(Number)
  return { year: y, monthIndex0: m - 1 }
}

export const MONTH_NAME_KEYS: TranslationKey[] = [
  'kanban.months.january',
  'kanban.months.february',
  'kanban.months.march',
  'kanban.months.april',
  'kanban.months.may',
  'kanban.months.june',
  'kanban.months.july',
  'kanban.months.august',
  'kanban.months.september',
  'kanban.months.october',
  'kanban.months.november',
  'kanban.months.december'
]

export function formatMonthLabel(key: string, t: TFunction): string {
  const { year, monthIndex0 } = parseMonthKey(key)
  return `${t(MONTH_NAME_KEYS[monthIndex0])} ${year}`
}

export function currentMonthKey(): string {
  const now = new Date()
  return monthKey(now.getFullYear(), now.getMonth())
}

/** Builds the dropdown option list: months with existing data, remaining months of the current year, plus the current month. */
export function buildMonthOptions(existingKeys: string[]): string[] {
  const now = new Date()
  const year = now.getFullYear()
  const set = new Set<string>(existingKeys)
  for (let m = 0; m < 12; m++) {
    set.add(monthKey(year, m))
  }
  return Array.from(set).sort()
}

export function computeMonthsWithActivity(months: Record<string, KanbanMonth>): Set<string> {
  const set = new Set<string>()
  for (const [key, m] of Object.entries(months)) {
    if (m.columns.some((c) => c.cards.length > 0)) set.add(key)
  }
  return set
}
