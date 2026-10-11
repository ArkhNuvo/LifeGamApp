import { create } from 'zustand'
import { produce, setAutoFreeze } from 'immer'
import type { UserData } from '../lib/types'
import { useModuleStore } from './useModuleStore'

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

// Data objects are still passed around as plain objects (IPC, catalog
// building); freezing them would turn any accidental out-of-draft mutation
// into a crash, so keep immer's structural sharing without the freeze.
setAutoFreeze(false)

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSave: { username: string; data: UserData } | null = null

function scheduleSave(username: string, data: UserData): void {
  if (saveTimer) clearTimeout(saveTimer)
  pendingSave = { username, data }
  saveTimer = setTimeout(() => {
    saveTimer = null
    pendingSave = null
    window.api.data.save(username, data)
  }, 400)
}

/**
 * Writes any still-debounced change immediately and synchronously — used on
 * logout and window close, where waiting out the debounce would lose the
 * user's last edit.
 */
export function flushPendingSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (pendingSave) {
    window.api.data.saveSync(pendingSave.username, pendingSave.data)
    pendingSave = null
  }
}

window.addEventListener('beforeunload', flushPendingSave)

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
    flushPendingSave()
    useModuleStore.getState().setModule('life')
    window.api.auth.setRememberedUsername(null)
    set({ username: null, data: null, status: 'idle', error: null })
  },

  updateData: (mutator) => {
    const { username, data } = get()
    if (!username || !data) return
    // immer copies only the branches the mutator actually touches; untouched
    // slices (skills, finance, other months...) keep their identity, so
    // components subscribed to them don't re-render on every change.
    const next = produce(data, mutator)
    if (next === data) return
    set({ data: next })
    scheduleSave(username, next)
  }
}))
