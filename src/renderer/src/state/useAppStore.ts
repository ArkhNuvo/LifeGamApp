import { create } from 'zustand'
import type { UserData } from '../lib/types'

interface AppState {
  username: string | null
  data: UserData | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  login: (username: string, password: string) => Promise<boolean>
  register: (username: string, password: string) => Promise<boolean>
  logout: () => void
  updateData: (mutator: (draft: UserData) => void) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(username: string, data: UserData): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    window.api.data.save(username, data)
  }, 400)
}

export const useAppStore = create<AppState>((set, get) => ({
  username: null,
  data: null,
  status: 'idle',
  error: null,

  login: async (username, password) => {
    set({ status: 'loading', error: null })
    const result = await window.api.auth.login(username, password)
    if (!result.ok || !result.username) {
      set({ status: 'error', error: result.error ?? 'Ошибка входа' })
      return false
    }
    const data = await window.api.data.load(result.username)
    set({ username: result.username, data, status: 'ready', error: null })
    return true
  },

  register: async (username, password) => {
    set({ status: 'loading', error: null })
    const result = await window.api.auth.register(username, password)
    if (!result.ok || !result.username) {
      set({ status: 'error', error: result.error ?? 'Ошибка регистрации' })
      return false
    }
    const data = await window.api.data.load(result.username)
    set({ username: result.username, data, status: 'ready', error: null })
    return true
  },

  logout: () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    set({ username: null, data: null, status: 'idle', error: null })
  },

  updateData: (mutator) => {
    const { username, data } = get()
    if (!username || !data) return
    const next = structuredClone(data)
    mutator(next)
    set({ data: next })
    scheduleSave(username, next)
  }
}))
