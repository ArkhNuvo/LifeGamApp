import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { readFileSync, statSync } from 'fs'
import { basename, extname } from 'path'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import {
  listUsernames,
  registerUser,
  loginUser,
  autoLoginUser,
  getRememberedUsername,
  setRememberedUsername,
  loadUserData,
  saveUserData,
  saveAvatarDataUrl,
  readFileAsDataUrl,
  saveAttachment,
  readAttachmentAsDataUrl,
  removeAttachment
} from './storage'
import { extractDocument, getAiStatus, setAiConfig } from './ai'
import * as telegram from './telegram'
import * as exchangeRates from './exchangeRates'
import * as crypto from './crypto'
import * as reports from './reports'
import { initUpdater, checkForUpdates, quitAndInstall } from './updater'
import type { AiExtractRequest, PickedFile, TelegramCatalogPayload, UserData } from '../shared/types'

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf'
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  initUpdater(mainWindow)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('auth:listUsernames', () => listUsernames())
  ipcMain.handle('auth:register', (_e, username: string, password: string) =>
    registerUser(username, password)
  )
  ipcMain.handle('auth:login', (_e, username: string, password: string) =>
    loginUser(username, password)
  )
  ipcMain.handle('auth:autoLogin', (_e, username: string) => autoLoginUser(username))
  ipcMain.handle('auth:getRememberedUsername', () => getRememberedUsername())
  ipcMain.handle('auth:setRememberedUsername', (_e, username: string | null) => {
    setRememberedUsername(username)
    return true
  })
  ipcMain.handle('data:load', (_e, username: string) => loadUserData(username))
  ipcMain.handle('data:save', (_e, username: string, data: UserData) => {
    saveUserData(username, data)
    return true
  })
  ipcMain.on('data:saveSync', (e, username: string, data: UserData) => {
    try {
      saveUserData(username, data)
      e.returnValue = true
    } catch {
      e.returnValue = false
    }
  })
  ipcMain.handle('files:pickImage', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
  ipcMain.handle('files:saveAvatar', (_e, username: string, dataUrl: string) =>
    saveAvatarDataUrl(username, dataUrl)
  )
  ipcMain.handle('files:readAsDataUrl', (_e, path: string) => readFileAsDataUrl(path))

  ipcMain.handle('attachments:pick', async (): Promise<PickedFile | { error: 'too_big' } | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Documents', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const path = result.filePaths[0]
    if (statSync(path).size > MAX_DOCUMENT_BYTES) return { error: 'too_big' }
    const mime = MIME_BY_EXTENSION[extname(path).toLowerCase()]
    if (!mime) return null
    const buffer = readFileSync(path)
    return { name: basename(path), mime, size: buffer.length, dataBase64: buffer.toString('base64') }
  })
  ipcMain.handle('attachments:save', (_e, username: string, mime: string, dataBase64: string) =>
    saveAttachment(username, mime, dataBase64)
  )
  ipcMain.handle('attachments:read', (_e, path: string) => readAttachmentAsDataUrl(path))
  ipcMain.handle('attachments:remove', (_e, path: string) => {
    removeAttachment(path)
    return true
  })

  ipcMain.handle('ai:status', () => getAiStatus())
  ipcMain.handle('ai:setConfig', (_e, update: { apiKey?: string | null; model?: string }) => setAiConfig(update))
  ipcMain.handle('ai:extract', (_e, req: AiExtractRequest) => extractDocument(req))

  ipcMain.handle('telegram:startPairing', (_e, username: string) => telegram.startPairing(username))
  ipcMain.handle('telegram:checkPairingStatus', (_e, code: string) => telegram.checkPairingStatus(code))
  ipcMain.handle('telegram:pushCatalog', (_e, apiToken: string, payload: TelegramCatalogPayload) =>
    telegram.pushCatalog(apiToken, payload)
  )
  ipcMain.handle('telegram:fetchPendingActions', (_e, apiToken: string) =>
    telegram.fetchPendingActions(apiToken)
  )
  ipcMain.handle('telegram:fetchFile', (_e, apiToken: string, fileId: string, name: string | null) =>
    telegram.fetchFile(apiToken, fileId, name)
  )
  ipcMain.handle('telegram:ackActions', (_e, apiToken: string, ids: number[]) =>
    telegram.ackActions(apiToken, ids)
  )

  ipcMain.handle('updates:check', () => checkForUpdates())
  ipcMain.handle('updates:quitAndInstall', () => quitAndInstall())

  ipcMain.handle('reports:savePdf', (_e, html: string, name: string, landscape: boolean) =>
    reports.savePdf(html, name, landscape)
  )
  ipcMain.handle('reports:saveText', (_e, content: string, name: string) => reports.saveText(content, name))
  ipcMain.handle('crypto:prices', (_e, tickers: string[], force?: boolean) => crypto.getPrices(tickers, !!force))
  ipcMain.handle('rates:get', () => exchangeRates.getRates(false))
  ipcMain.handle('rates:refresh', () => exchangeRates.getRates(true))
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
