export type ColumnStatus = 'TODO' | 'PLANNED' | 'IN_PROGRESS' | 'DONE'

export interface CardReward {
  skillId: string
  subskillId: string | null
  xp: number
}

export interface KanbanCard {
  id: string
  title: string
  description: string
  rewards: CardReward[]
  /** Signed: negative = costs energy, positive = restores energy. */
  energyMental: number
  /** Signed: negative = costs energy, positive = restores energy. */
  energyPhysical: number
  /** Signed: negative = expense, positive = income. */
  money: number
  /** Which checking category the money delta applies to; null = the general/uncategorized balance. */
  checkingCategoryId: string | null
  createdDate: string
  /** The date this activity was/is done — null until completed, editable/backdatable. */
  completedDate: string | null
  done: boolean
  effectsApplied: boolean
  /** Column a card was auto-moved out of when marked done from the bot — where an undo puts it back. */
  returnColumnId?: string
}

export interface KanbanColumn {
  id: string
  name: string
  status: ColumnStatus
  order: number
  cards: KanbanCard[]
}

export interface KanbanMonth {
  columns: KanbanColumn[]
}

export interface Subskill {
  id: string
  name: string
  xp: number
}

export interface Skill {
  id: string
  name: string
  color: string
  xp: number
  subskills: Subskill[]
}

export type CurrencyCode =
  | 'USD'
  | 'EUR'
  | 'PLN'
  | 'RUB'
  | 'UAH'
  | 'GBP'
  | 'CHF'
  | 'CZK'
  | 'HUF'
  | 'JPY'
  | 'CNY'
  | 'SEK'
  | 'NOK'
  | 'DKK'
  | 'CAD'
  | 'AUD'
  | 'NZD'
  | 'TRY'
  | 'BYN'
  | 'KZT'
  | 'GEL'
  | 'AMD'
  | 'AED'
  | 'ILS'
  | 'INR'
  | 'KRW'
  | 'BRL'
  | 'MXN'
  | 'ZAR'
  | 'SGD'
  | 'HKD'
  | 'RON'
  | 'BGN'

/** Cached daily snapshot of exchange rates against USD (1 USD = rates[code] units of that currency). */
export interface ExchangeRates {
  base: 'USD'
  rates: Record<string, number>
  fetchedAt: number
}

export interface SavingsEntry {
  id: string
  name: string
  amount: number
  currency: CurrencyCode
}

export interface CheckingCategory {
  id: string
  name: string
  balance: number
  currency: CurrencyCode
}

export type LedgerEventType = 'expense' | 'income' | 'transfer'
export type Recurrence = 'week' | 'month' | 'year'
export type CounterpartyKind = 'service' | 'shop' | 'person' | 'organization'

/** A document (receipt, invoice, payment confirmation) stored alongside an event. */
export interface Attachment {
  id: string
  name: string
  mime: string
  /** Absolute path of the stored copy inside the app's user data folder. */
  path: string
}

/** A file chosen from disk, held in memory until it is attached to an event. */
export interface PickedFile {
  name: string
  mime: string
  size: number
  dataBase64: string
}

/** What the AI read from a document; every field may be null when it isn't on the document. */
export interface AiExtraction {
  eventType: 'expense' | 'income' | 'transfer'
  amount: number | null
  currency: string | null
  date: string | null
  merchant: string | null
  description: string | null
  category: string | null
  recurrence: 'none' | 'week' | 'month' | 'year'
  documentType: string
  confidence: 'low' | 'medium' | 'high'
  notes: string | null
}

export interface AiExtractRequest {
  dataBase64: string
  mime: string
  language: string
  today: string
  categories: string[]
  counterparties: string[]
}

export type AiExtractResult =
  | { ok: true; data: AiExtraction }
  | { ok: false; code: 'no_key' | 'auth' | 'rate' | 'bad_input' | 'other'; error: string }

export interface AiStatus {
  hasKey: boolean
  model: string
  encryptionAvailable: boolean
}

/** A service, shop, person or organization events can be tied to (the hidden "who" registry). */
export interface Counterparty {
  id: string
  name: string
  kind: CounterpartyKind
  defaultCategory: string
}

/**
 * One financial event ("card"). Amounts are always positive and expressed in
 * the currency of the account they touch; the type decides the direction.
 * Only `confirmed` events count towards balances and metrics — planned
 * (future or unpaid) ones are shown but ignored until the user confirms them.
 */
export interface LedgerEvent {
  id: string
  type: LedgerEventType
  title: string
  amount: number
  /** General checking balance ('__general__'), a checking category id or a savings entry id. */
  accountId: string
  /** Transfers only: destination account and the amount credited there (its own currency). */
  toAccountId: string | null
  toAmount: number | null
  date: string
  category: string
  counterpartyId: string | null
  /** Set when the event was generated from a subscription template. */
  subscriptionId: string | null
  confirmed: boolean
  /** Whether this event's amount is currently reflected in account balances. */
  effectsApplied: boolean
  /** Receipts, invoices and payment confirmations kept with the event. */
  attachments: Attachment[]
  /** Set by the CSV import on rows that look like a transfer between own accounts; cleared when the event is saved by hand. */
  review?: 'transfer' | null
}

/** A recurring payment template; its occurrences are materialised as planned events. */
export interface Subscription {
  id: string
  title: string
  amount: number
  accountId: string
  category: string
  counterpartyId: string | null
  every: Recurrence
  startDate: string
  /** How many occurrences (counted from startDate) have been generated as events so far. */
  generated: number
  active: boolean
}

export interface Ledger {
  counterparties: Counterparty[]
  events: LedgerEvent[]
  subscriptions: Subscription[]
}

export interface AvatarInfo {
  file: string | null
  cropX: number
  cropY: number
  zoom: number
}

export type StatsWidgetType =
  | 'skillsPie'
  | 'statusBreakdown'
  | 'plannedActivities'
  | 'skillsRadar'
  | 'missedActivities'
  | 'skillsTrend'

export interface StatsWidgetConfig {
  id: string
  type: StatsWidgetType
  size: 'normal' | 'wide'
}

export type ThemeName =
  | 'violetAmber'
  | 'blueOrange'
  | 'pinkLime'
  | 'tealCoral'
  | 'crimsonGold'
  | 'emeraldViolet'
  | 'indigoPeach'
  | 'slateAmber'
export type ColorMode = 'light' | 'dark'

export interface UserData {
  profile: {
    username: string
    /** Cosmetic display name shown in the UI; null means "use the login/username". */
    displayName: string | null
    avatar: AvatarInfo
  }
  totalXp: number
  energy: {
    mental: number
    physical: number
    lastCheckinDate: string | null
  }
  finance: {
    checking: { balance: number; currency: CurrencyCode; categories: CheckingCategory[] }
    savings: SavingsEntry[]
  }
  /** Display preferences. `mainCurrency` is what totals and converted values are shown in. */
  settings: { mainCurrency: CurrencyCode }
  ledger: Ledger
  skills: Skill[]
  kanban: {
    months: Record<string, KanbanMonth>
    unassigned: KanbanCard[]
    zoom: number
  }
  stats: {
    widgets: StatsWidgetConfig[]
  }
  theme: ThemeName
  colorMode: ColorMode
  telegram: {
    apiToken: string | null
  }
}

/** Catalog pushed app → server each sync tick so the bot can render menus and today's list. */
export interface TelegramCatalogSkill {
  id: string
  name: string
  color: string
  subskills: { id: string; name: string }[]
}

export interface TelegramCatalogColumn {
  id: string
  name: string
  status: ColumnStatus
}

export interface TelegramCatalogCardReward {
  skillName: string
  subskillName: string | null
  xp: number
}

export interface TelegramCatalogCard {
  id: string
  title: string
  description: string
  energyMental: number
  energyPhysical: number
  money: number
  /** Name of the checking category the money delta is tied to; null = general balance. */
  checkingCategoryName: string | null
  /** Currency of the account the money delta goes to (category's, else the general checking one). */
  currency: string
  done: boolean
  rewards: TelegramCatalogCardReward[]
}

export interface TelegramCatalogCheckingCategory {
  id: string
  name: string
  currency: string
}

/** One line of a checking/savings breakdown; name null = the general/uncategorized checking bucket. */
export interface TelegramCatalogFinanceEntry {
  name: string | null
  amount: number
  currency: string
}

export interface TelegramCatalogResources {
  displayName: string
  level: number
  xpIntoLevel: number
  xpForNextLevel: number
  energyMental: number
  energyPhysical: number
  /** USD-converted totals, for the top-level /resources summary. */
  checkingBalance: number
  savingsBalance: number
  /** Raw per-entry amounts/currencies, for the bot's "Финансы" drill-down. */
  checkingBreakdown: TelegramCatalogFinanceEntry[]
  savingsBreakdown: TelegramCatalogFinanceEntry[]
  /** IANA timezone of the app (e.g. "Europe/Warsaw"), so the bot's "today" matches the user's, not the UTC server's. */
  timezone: string
}

export interface TelegramCatalogPayload {
  skills: TelegramCatalogSkill[]
  columns: TelegramCatalogColumn[]
  /** Checking-account spending categories, so the bot can offer them when a card carries a money amount. */
  checkingCategories: TelegramCatalogCheckingCategory[]
  /** Not-done cards in a TODO/PLANNED column this month — "what's left to do". */
  plannedCards: TelegramCatalogCard[]
  /** Cards marked done today — "what got done today". */
  doneTodayCards: TelegramCatalogCard[]
  /** Every not-done TODO/PLANNED card this month, regardless of date — the bot's "/week" view. */
  weekCards: TelegramCatalogCard[]
  /** Not-done cards sitting in an IN_PROCESS-status column this month. */
  inProcessCards: TelegramCatalogCard[]
  /** Profile summary for the bot's "Resources" command. */
  resources: TelegramCatalogResources
  /** The app's current UI language, so the bot can reply in the same language. */
  language: string
}

export type TelegramActionTarget =
  | { type: 'unassigned' }
  | { type: 'column'; monthKey: string; columnId: string }

export interface TelegramCreateActionPayload {
  /** Generated by the bot so its own optimistic catalog update uses the same id as the eventual app-side card. */
  id: string
  target: TelegramActionTarget
  title: string
  description: string
  rewards: CardReward[]
  energyMental: number
  energyPhysical: number
  money: number
  checkingCategoryId: string | null
  createdDate: string
  completedDate: string | null
}

export interface TelegramToggleDoneActionPayload {
  cardId: string
  done: boolean
}

export interface TelegramEditActionPayload {
  cardId: string
  patch: Partial<{
    title: string
    description: string
    energyMental: number
    energyPhysical: number
    money: number
    checkingCategoryId: string | null
    completedDate: string | null
  }>
}

export interface TelegramDeleteActionPayload {
  cardId: string
}

export interface TelegramSetEnergyActionPayload {
  kind: 'mental' | 'physical'
  value: number
}

export type TelegramActionType = 'create' | 'toggle_done' | 'edit' | 'delete' | 'set_energy'

export interface TelegramAction {
  id: number
  action_type: TelegramActionType
  payload:
    | TelegramCreateActionPayload
    | TelegramToggleDoneActionPayload
    | TelegramEditActionPayload
    | TelegramDeleteActionPayload
    | TelegramSetEnergyActionPayload
}

export interface AuthResult {
  ok: boolean
  error?: string
  username?: string
}

export type UpdateStatus =
  | { state: 'checking' }
  | { state: 'not-available' }
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }
  | { state: 'dev-unavailable' }
