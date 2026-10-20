import { create } from 'zustand'

export type AppModule = 'life' | 'finance'
/** Which finance book is open: personal finances or a firm (its id). */
export type FinanceScope = 'personal' | string

interface ModuleState {
  module: AppModule
  scope: FinanceScope
  setModule: (module: AppModule) => void
  setScope: (scope: FinanceScope) => void
}

/** Which top-level screen is shown (life dashboard or finance) and which finance book. */
export const useModuleStore = create<ModuleState>((set) => ({
  module: 'life',
  scope: 'personal',
  setModule: (module) => set({ module }),
  setScope: (scope) => set({ scope })
}))
