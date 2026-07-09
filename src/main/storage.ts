import { app } from 'electron'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join, extname } from 'path'
import type { AuthResult, UserData } from '../shared/types'

interface UserIndexEntry {
  username: string
  salt: string
  passwordHash: string
}

function usersRoot(): string {
  const root = join(app.getPath('userData'), 'users')
  if (!existsSync(root)) mkdirSync(root, { recursive: true })
  return root
}

function indexFilePath(): string {
  return join(usersRoot(), 'index.json')
}

function readIndex(): UserIndexEntry[] {
  const path = indexFilePath()
  if (!existsSync(path)) return []
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return []
  }
}

function writeIndex(entries: UserIndexEntry[]): void {
  writeFileSync(indexFilePath(), JSON.stringify(entries, null, 2), 'utf-8')
}

function userDir(username: string): string {
  const dir = join(usersRoot(), username)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function userDataPath(username: string): string {
  return join(userDir(username), 'data.json')
}

function sessionFilePath(): string {
  return join(app.getPath('userData'), 'session.json')
}

/** "Remember me" — stores/reads which username should be auto-logged-in on next launch. */
export function getRememberedUsername(): string | null {
  const path = sessionFilePath()
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'))
    return typeof parsed.username === 'string' ? parsed.username : null
  } catch {
    return null
  }
}

export function setRememberedUsername(username: string | null): void {
  const path = sessionFilePath()
  if (username) {
    writeFileSync(path, JSON.stringify({ username }, null, 2), 'utf-8')
  } else if (existsSync(path)) {
    unlinkSync(path)
  }
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex')
}

function defaultUserData(username: string): UserData {
  return {
    profile: {
      username,
      displayName: null,
      avatar: { file: null, cropX: 0, cropY: 0, zoom: 1 }
    },
    totalXp: 0,
    energy: { mental: 100, physical: 100, lastCheckinDate: null },
    finance: {
      checking: { balance: 0, categories: [] },
      savings: []
    },
    skills: [],
    kanban: {
      months: {},
      unassigned: [],
      zoom: 1
    },
    stats: {
      widgets: []
    },
    theme: 'violetAmber',
    colorMode: 'dark',
    telegram: {
      apiToken: null
    }
  }
}

export function listUsernames(): string[] {
  return readIndex().map((u) => u.username)
}

export function registerUser(username: string, password: string): AuthResult {
  const uname = username.trim()
  if (!uname || uname.length < 2) {
    return { ok: false, error: 'username_too_short' }
  }
  if (!password || password.length < 4) {
    return { ok: false, error: 'password_too_short' }
  }
  const entries = readIndex()
  if (entries.some((u) => u.username.toLowerCase() === uname.toLowerCase())) {
    return { ok: false, error: 'user_exists' }
  }
  const salt = randomBytes(16).toString('hex')
  const passwordHash = hashPassword(password, salt)
  entries.push({ username: uname, salt, passwordHash })
  writeIndex(entries)
  writeFileSync(userDataPath(uname), JSON.stringify(defaultUserData(uname), null, 2), 'utf-8')
  return { ok: true, username: uname }
}

export function loginUser(username: string, password: string): AuthResult {
  const uname = username.trim()
  const entries = readIndex()
  const entry = entries.find((u) => u.username.toLowerCase() === uname.toLowerCase())
  if (!entry) return { ok: false, error: 'user_not_found' }
  const hash = hashPassword(password, entry.salt)
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(entry.passwordHash, 'hex')
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: 'wrong_password' }
  }
  return { ok: true, username: entry.username }
}

/** Used only for a previously-remembered session — intentionally skips the password check. */
export function autoLoginUser(username: string): AuthResult {
  const entries = readIndex()
  const entry = entries.find((u) => u.username === username)
  if (!entry) return { ok: false, error: 'user_not_found' }
  return { ok: true, username: entry.username }
}

/** Normalizes cards saved under older schema versions so old data files don't crash the app. */
function normalizeCard(card: Record<string, unknown>): void {
  if (!Array.isArray(card.rewards)) {
    card.rewards = []
  }
  if (typeof card.money !== 'number') {
    card.money = 0
  }
  if (typeof card.checkingCategoryId === 'undefined') {
    card.checkingCategoryId = null
  }
  if (typeof card.completedDate === 'undefined') {
    // Missing entirely = pre-completedDate schema; a present `null` is an intentional "not done yet".
    card.completedDate = typeof card.dueDate === 'string' ? card.dueDate : card.createdDate
  }
  if (typeof card.effectsApplied !== 'boolean') {
    card.effectsApplied = typeof card.xpApplied === 'boolean' ? card.xpApplied : false
  }
  if (typeof card.description !== 'string') {
    card.description = ''
  }
  delete card.skillId
  delete card.subskillId
  delete card.dueDate
  delete card.xpApplied
}

function normalizeUserData(data: UserData): UserData {
  for (const month of Object.values(data.kanban.months)) {
    for (const column of month.columns) {
      column.cards.forEach((c) => normalizeCard(c as unknown as Record<string, unknown>))
    }
  }
  data.kanban.unassigned.forEach((c) => normalizeCard(c as unknown as Record<string, unknown>))
  if (typeof data.energy.lastCheckinDate === 'undefined') {
    data.energy.lastCheckinDate = null
  }
  if (!data.stats) {
    data.stats = { widgets: [] }
  }
  data.stats.widgets.forEach((w) => {
    if (w.size !== 'normal' && w.size !== 'wide') w.size = 'normal'
  })
  if (typeof data.kanban.zoom !== 'number') {
    data.kanban.zoom = 1
  }
  if (!data.theme) {
    data.theme = 'violetAmber'
  }
  if (data.colorMode !== 'light' && data.colorMode !== 'dark') {
    data.colorMode = 'dark'
  }
  if (!data.telegram) {
    data.telegram = { apiToken: null }
  }
  if (!Array.isArray(data.finance.checking.categories)) {
    data.finance.checking.categories = []
  }
  if (typeof data.profile.displayName === 'undefined') {
    data.profile.displayName = null
  }
  return data
}

export function loadUserData(username: string): UserData {
  const path = userDataPath(username)
  if (!existsSync(path)) {
    const data = defaultUserData(username)
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
    return data
  }
  return normalizeUserData(JSON.parse(readFileSync(path, 'utf-8')))
}

export function saveUserData(username: string, data: UserData): void {
  writeFileSync(userDataPath(username), JSON.stringify(data, null, 2), 'utf-8')
}

export function saveAvatarDataUrl(username: string, dataUrl: string): string {
  const match = /^data:image\/(\w+);base64,(.+)$/.exec(dataUrl)
  if (!match) throw new Error('Invalid image data URL')
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
  const dest = join(userDir(username), `avatar.${ext}`)
  writeFileSync(dest, Buffer.from(match[2], 'base64'))
  return dest
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
}

export function readFileAsDataUrl(path: string): string {
  const ext = extname(path).toLowerCase()
  const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream'
  const data = readFileSync(path).toString('base64')
  return `data:${mime};base64,${data}`
}
