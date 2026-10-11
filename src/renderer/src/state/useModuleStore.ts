import { create } from 'zustand'

export type AppModule = 'life' | 'finance'

interface ModuleState {
  module: AppModule
  setModule: (module: AppModule) => void
}

/** Which top-level screen is shown: the life dashboard or the finance module. */
export const useModuleStore = create<ModuleState>((set) => ({
  module: 'life',
  setModule: (module) => set({ module })
}))
