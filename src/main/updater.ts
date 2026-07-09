import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '../shared/types'

let win: BrowserWindow | null = null
let wired = false

function send(status: UpdateStatus): void {
  win?.webContents.send('updates:status', status)
}

export function initUpdater(window: BrowserWindow): void {
  win = window
  if (wired) return
  wired = true

  autoUpdater.autoDownload = false

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-not-available', () => send({ state: 'not-available' }))
  autoUpdater.on('update-available', (info) => {
    send({ state: 'available', version: info.version })
    autoUpdater.downloadUpdate().catch((err) => {
      send({ state: 'error', message: String(err?.message ?? err) })
    })
  })
  autoUpdater.on('download-progress', (progress) => {
    send({ state: 'downloading', percent: Math.round(progress.percent) })
  })
  autoUpdater.on('update-downloaded', (info) => {
    send({ state: 'downloaded', version: info.version })
  })
  autoUpdater.on('error', (err) => {
    send({ state: 'error', message: String(err?.message ?? err) })
  })
}

export function checkForUpdates(): void {
  if (!app.isPackaged) {
    send({ state: 'dev-unavailable' })
    return
  }
  autoUpdater.checkForUpdates().catch((err) => {
    send({ state: 'error', message: String(err?.message ?? err) })
  })
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
