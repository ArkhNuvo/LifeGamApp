import { contextBridge, ipcRenderer } from 'electron'
import type { AuthResult, TelegramAction, TelegramCatalogPayload, UserData } from '../shared/types'

const api = {
  auth: {
    listUsernames: (): Promise<string[]> => ipcRenderer.invoke('auth:listUsernames'),
    register: (username: string, password: string): Promise<AuthResult> =>
      ipcRenderer.invoke('auth:register', username, password),
    login: (username: string, password: string): Promise<AuthResult> =>
      ipcRenderer.invoke('auth:login', username, password)
  },
  data: {
    load: (username: string): Promise<UserData> => ipcRenderer.invoke('data:load', username),
    save: (username: string, data: UserData): Promise<boolean> =>
      ipcRenderer.invoke('data:save', username, data)
  },
  files: {
    pickImage: (): Promise<string | null> => ipcRenderer.invoke('files:pickImage'),
    saveAvatar: (username: string, dataUrl: string): Promise<string> =>
      ipcRenderer.invoke('files:saveAvatar', username, dataUrl),
    readAsDataUrl: (path: string): Promise<string> => ipcRenderer.invoke('files:readAsDataUrl', path)
  },
  telegram: {
    startPairing: (username: string): Promise<string> =>
      ipcRenderer.invoke('telegram:startPairing', username),
    checkPairingStatus: (code: string): Promise<string | null> =>
      ipcRenderer.invoke('telegram:checkPairingStatus', code),
    pushCatalog: (apiToken: string, payload: TelegramCatalogPayload): Promise<void> =>
      ipcRenderer.invoke('telegram:pushCatalog', apiToken, payload),
    fetchPendingActions: (apiToken: string): Promise<TelegramAction[]> =>
      ipcRenderer.invoke('telegram:fetchPendingActions', apiToken),
    ackActions: (apiToken: string, ids: number[]): Promise<void> =>
      ipcRenderer.invoke('telegram:ackActions', apiToken, ids)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
