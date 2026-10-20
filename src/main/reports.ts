import { BrowserWindow, dialog } from 'electron'
import { writeFileSync } from 'fs'

/**
 * Renders a self-contained HTML document off-screen and saves it as a PDF the
 * user places with a save dialog. Returns the saved path, or null if cancelled.
 */
export async function savePdf(html: string, defaultName: string, landscape: boolean): Promise<string | null> {
  const target = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (target.canceled || !target.filePath) return null
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } })
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const pdf = await win.webContents.printToPDF({
      landscape,
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
    })
    writeFileSync(target.filePath, pdf)
    return target.filePath
  } finally {
    win.destroy()
  }
}

/** Saves text (CSV) through a save dialog; a BOM keeps Excel reading UTF-8 correctly. */
export async function saveText(content: string, defaultName: string): Promise<string | null> {
  const target = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  })
  if (target.canceled || !target.filePath) return null
  writeFileSync(target.filePath, '﻿' + content, 'utf-8')
  return target.filePath
}
