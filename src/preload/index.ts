import { contextBridge, ipcRenderer } from 'electron'
import type {
  AiExtractRequest,
  AiExtractResult,
  AiStatus,
  AuthResult,
  PickedFile,
  CryptoPrices,
  ExchangeRates,
  TelegramAction,
  TelegramCatalogPayload,
  UpdateStatus,
  UserData
} from '../shared/types'

const api = {
  auth: {
    listUsernames: (): Promise<string[]> => ipcRenderer.invoke('auth:listUsernames'),
    register: (username: string, password: string): Promise<AuthResult> =>
      ipcRenderer.invoke('auth:register', username, password),
    login: (username: string, password: string): Promise<AuthResult> =>
      ipcRenderer.invoke('auth:login', username, password),
    autoLogin: (username: string): Promise<AuthResult> =>
      ipcRenderer.invoke('auth:autoLogin', username),
    getRememberedUsername: (): Promise<string | null> =>
      ipcRenderer.invoke('auth:getRememberedUsername'),
    setRememberedUsername: (username: string | null): Promise<boolean> =>
      ipcRenderer.invoke('auth:setRememberedUsername', username)
  },
  data: {
    load: (username: string): Promise<UserData> => ipcRenderer.invoke('data:load', username),
    save: (username: string, data: UserData): Promise<boolean> =>
      ipcRenderer.invoke('data:save', username, data),
    /** Blocking save for logout/window-close, where an async invoke might not finish. */
    saveSync: (username: string, data: UserData): boolean =>
      ipcRenderer.sendSync('data:saveSync', username, data)
  },
  files: {
    pickImage: (): Promise<string | null> => ipcRenderer.invoke('files:pickImage'),
    saveAvatar: (username: string, dataUrl: string): Promise<string> =>
      ipcRenderer.invoke('files:saveAvatar', username, dataUrl),
    readAsDataUrl: (path: string): Promise<string> => ipcRenderer.invoke('files:readAsDataUrl', path)
  },
  attachments: {
    /** Opens a file dialog (photo or PDF) and returns the file's contents. */
    pick: (): Promise<PickedFile | { error: 'too_big' } | null> => ipcRenderer.invoke('attachments:pick'),
    save: (username: string, mime: string, dataBase64: string): Promise<string> =>
      ipcRenderer.invoke('attachments:save', username, mime, dataBase64),
    read: (path: string): Promise<string> => ipcRenderer.invoke('attachments:read', path),
    remove: (path: string): Promise<boolean> => ipcRenderer.invoke('attachments:remove', path)
  },
  ai: {
    status: (): Promise<AiStatus> => ipcRenderer.invoke('ai:status'),
    setConfig: (update: { apiKey?: string | null; model?: string }): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('ai:setConfig', update),
    extract: (req: AiExtractRequest): Promise<AiExtractResult> => ipcRenderer.invoke('ai:extract', req)
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
    fetchFile: (apiToken: string, fileId: string, name: string | null): Promise<PickedFile | null> =>
      ipcRenderer.invoke('telegram:fetchFile', apiToken, fileId, name),
    ackActions: (apiToken: string, ids: number[]): Promise<void> =>
      ipcRenderer.invoke('telegram:ackActions', apiToken, ids)
  },
  updates: {
    check: (): Promise<void> => ipcRenderer.invoke('updates:check'),
    quitAndInstall: (): Promise<void> => ipcRenderer.invoke('updates:quitAndInstall'),
    onStatus: (callback: (status: UpdateStatus) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, status: UpdateStatus): void => callback(status)
      ipcRenderer.on('updates:status', listener)
      return () => ipcRenderer.removeListener('updates:status', listener)
    }
  },
  crypto: {
    prices: (tickers: string[], force?: boolean): Promise<CryptoPrices> =>
      ipcRenderer.invoke('crypto:prices', tickers, force)
  },
  rates: {
    get: (): Promise<ExchangeRates> => ipcRenderer.invoke('rates:get'),
    refresh: (): Promise<ExchangeRates> => ipcRenderer.invoke('rates:refresh')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
