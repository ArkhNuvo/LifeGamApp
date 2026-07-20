import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
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
  readFileAsDataUrl
} from './storage'
import * as telegram from './telegram'
import * as exchangeRates from './exchangeRates'
import { initUpdater, checkForUpdates, quitAndInstall } from './updater'
import type { TelegramCatalogPayload, UserData } from '../shared/types'

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

  ipcMain.handle('telegram:startPairing', (_e, username: string) => telegram.startPairing(username))
  ipcMain.handle('telegram:checkPairingStatus', (_e, code: string) => telegram.checkPairingStatus(code))
  ipcMain.handle('telegram:pushCatalog', (_e, apiToken: string, payload: TelegramCatalogPayload) =>
    telegram.pushCatalog(apiToken, payload)
  )
  ipcMain.handle('telegram:fetchPendingActions', (_e, apiToken: string) =>
    telegram.fetchPendingActions(apiToken)
  )
  ipcMain.handle('telegram:ackActions', (_e, apiToken: string, ids: number[]) =>
    telegram.ackActions(apiToken, ids)
  )

  ipcMain.handle('updates:check', () => checkForUpdates())
  ipcMain.handle('updates:quitAndInstall', () => quitAndInstall())

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
