import { create } from 'zustand'
import type { UserData } from '../lib/types'

interface AppState {
  username: string | null
  data: UserData | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  init: () => Promise<void>
  login: (username: string, password: string, remember: boolean) => Promise<boolean>
  register: (username: string, password: string, remember: boolean) => Promise<boolean>
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

  init: async () => {
    if (get().status !== 'idle') return
    const remembered = await window.api.auth.getRememberedUsername()
    if (!remembered) return
    set({ status: 'loading', error: null })
    const result = await window.api.auth.autoLogin(remembered)
    if (!result.ok || !result.username) {
      await window.api.auth.setRememberedUsername(null)
      set({ status: 'idle', error: null })
      return
    }
    const data = await window.api.data.load(result.username)
    set({ username: result.username, data, status: 'ready', error: null })
  },

  login: async (username, password, remember) => {
    set({ status: 'loading', error: null })
    const result = await window.api.auth.login(username, password)
    if (!result.ok || !result.username) {
      set({ status: 'error', error: result.error ?? 'login_failed' })
      return false
    }
    await window.api.auth.setRememberedUsername(remember ? result.username : null)
    const data = await window.api.data.load(result.username)
    set({ username: result.username, data, status: 'ready', error: null })
    return true
  },

  register: async (username, password, remember) => {
    set({ status: 'loading', error: null })
    const result = await window.api.auth.register(username, password)
    if (!result.ok || !result.username) {
      set({ status: 'error', error: result.error ?? 'register_failed' })
      return false
    }
    await window.api.auth.setRememberedUsername(remember ? result.username : null)
    const data = await window.api.data.load(result.username)
    set({ username: result.username, data, status: 'ready', error: null })
    return true
  },

  logout: () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    window.api.auth.setRememberedUsername(null)
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
