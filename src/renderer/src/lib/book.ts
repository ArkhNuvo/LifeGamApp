import { useCallback } from 'react'
import { useAppStore } from '../state/useAppStore'
import { useModuleStore, type FinanceScope } from '../state/useModuleStore'
import type { FinanceBook, Firm, UserData } from './types'

/** The finance book a scope points at: the user's own data, or one of their firms. */
export function bookOf(data: UserData, scope: FinanceScope): FinanceBook | undefined {
  if (scope === 'personal') return data
  return data.firms?.find((f) => f.id === scope)
}

export function firmOf(data: UserData | null | undefined, scope: FinanceScope): Firm | undefined {
  if (!data || scope === 'personal') return undefined
  return data.firms?.find((f) => f.id === scope)
}

/** The book the finance module currently shows. */
export function useBook(): FinanceBook | undefined {
  const scope = useModuleStore((s) => s.scope)
  return useAppStore((s) => (s.data ? bookOf(s.data, scope) : undefined))
}

/** The firm currently shown, or undefined in personal mode. */
export function useFirm(): Firm | undefined {
  const scope = useModuleStore((s) => s.scope)
  return useAppStore((s) => firmOf(s.data, scope))
}

/**
 * Mutates the current book. The mutator also gets the whole draft for the rare
 * edits that live outside a book (global settings).
 */
export function useUpdateBook(): (fn: (book: FinanceBook, draft: UserData) => void) => void {
  const scope = useModuleStore((s) => s.scope)
  const updateData = useAppStore((s) => s.updateData)
  return useCallback(
    (fn) =>
      updateData((draft) => {
        const book = bookOf(draft, scope)
        if (book) fn(book, draft)
      }),
    [scope, updateData]
  )
}

/** Every book of the user: personal first, then the firms. */
export function allBooks(data: UserData): FinanceBook[] {
  return [data, ...(data.firms ?? [])]
}

/** Selects from the current book, like `useAppStore(selector)` for the book's own data. */
export function useBookSelect<T>(selector: (book: FinanceBook | undefined) => T): T {
  const scope = useModuleStore((s) => s.scope)
  return useAppStore((s) => selector(s.data ? bookOf(s.data, scope) : undefined))
}
