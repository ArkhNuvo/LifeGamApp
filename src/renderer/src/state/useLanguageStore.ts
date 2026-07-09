import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LanguageCode } from '../lib/i18n'

interface LanguageState {
  language: LanguageCode
  setLanguage: (language: LanguageCode) => void
}

/**
 * Global, account-independent setting (unlike theme, which lives in per-user
 * UserData) — it must be available before login, so it's persisted to
 * localStorage directly rather than through the user's data.json.
 */
export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'ru',
      setLanguage: (language) => set({ language })
    }),
    { name: 'lifegam-language' }
  )
)
