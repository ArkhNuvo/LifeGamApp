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

/** USD price per ticker (null when none was found). */
export interface CryptoPrices {
  prices: Record<string, number | null>
  fetchedAt: number
}

export interface CryptoHolding {
  ticker: string
  amount: number
}

export interface SavingsEntry {
  id: string
  name: string
  /** For a crypto account this is the cached USD value of `holdings`, refreshed from live prices. */
  amount: number
  currency: CurrencyCode
  /** Present (even if empty) on a crypto account: coins held, by ticker. */
  holdings?: CryptoHolding[]
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
export type PaymentMethod = 'card' | 'cash' | 'transfer' | 'crypto'

export interface AiExtraction {
  eventType: 'expense' | 'income' | 'transfer'
  /** How the document says it was paid; null when it doesn't say. */
  paymentMethod: PaymentMethod | null
  /** Last four digits of the card used, when printed on the document. */
  cardLast4: string | null
  /** For crypto payments: the coin ticker and the amount in that coin. */
  cryptoTicker: string | null
  cryptoAmount: number | null
  /** Business documents: invoice lines with a suggested KPiR column, the document number and the other party. */
  items: { description: string; net: number | null; vatRate: number | null; gross: number | null; kpirColumn: string | null }[]
  documentNumber: string | null
  counterpartyName: string | null
  counterpartyNip: string | null
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
  /** A firm's document: also read the lines and suggest KPiR columns. */
  business?: boolean
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
  review?: 'transfer' | 'document' | null
  /** Document lines for the KPiR (firm books). */
  items?: LedgerItem[]
  doc?: LedgerDocument | null
  /** A payment made in a coin: `amount` stays the USD equivalent, this holds the coin amount that moved the portfolio. */
  crypto?: { ticker: string; amount: number } | null
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

/** One tile of the finance statistics board; x/y/w/h are grid units on a 12-column board. */
export interface FinWidgetConfig {
  id: string
  metric: string
  chart: string
  period: string
  /** Narrows the metric to one account; null = all. */
  accountId: string | null
  title: string
  x: number
  y: number
  w: number
  h: number
}

export interface FinanceStatsState {
  widgets: FinWidgetConfig[]
  /** Net worth / crypto value (main currency) by date, recorded as the app is used. */
  snapshots: Record<string, { total: number; crypto: number }>
}

export interface FinanceAccounts {
  checking: {
    balance: number
    currency: CurrencyCode
    categories: CheckingCategory[]
    /** A custom name for the general checking balance; the localized default is used when empty. */
    generalName?: string
  }
  savings: SavingsEntry[]
}

/** Everything the finance module works on: personal finances (UserData itself) or one firm. */
export interface FinanceBook {
  finance: FinanceAccounts
  ledger: Ledger
  financeStats?: FinanceStatsState
}

export type TaxForm = 'skala' | 'liniowy' | 'ryczalt'
/** full = "duży ZUS", preferential = 24 months of the lower base, start = "ulga na start" (health only),
 *  small_plus = "mały ZUS plus" (own base), none = no ZUS paid by the firm (e.g. insured through employment). */
export type ZusScheme = 'full' | 'preferential' | 'start' | 'small_plus' | 'none'

/** Yearly amounts the calculations depend on; defaults ship with the app and every one can be overridden. */
export interface TaxParams {
  minimumWage: number
  /** Base of the full social contributions (60% of the forecast average wage). */
  zusFullBase: number
  /** Base of the preferential contributions (30% of the minimum wage). */
  zusPreferentialBase: number
  /** Minimum monthly health contribution for skala / liniowy. */
  healthMin: number
  /** Ryczałt flat health contribution for annual revenue up to 60k / 60–300k / above. */
  healthRyczalt: [number, number, number]
  /** Yearly cap on health contributions deductible under the flat 19% rate. */
  liniowyHealthDeductionLimit: number
}

export interface FirmTax {
  form: TaxForm
  /** Ryczałt rate in percent (17, 15, 14, 12, 10, 8.5, 5.5, 3, 2). */
  ryczaltRate: number
  zus: ZusScheme
  /** Own base for "mały ZUS plus". */
  smallPlusBase: number | null
  /** Voluntary sickness insurance. */
  sickness: boolean
  vatPayer: boolean
  vatPeriod: 'month' | 'quarter'
  /** Per-year overrides of the default parameters, keyed by year ("2026"). */
  params: Record<string, Partial<TaxParams>>
  /** Accident insurance rate in percent (1.67 for payers with up to 9 insured). */
  accidentRate?: number
}

/** UoP = employment contract, zlecenie / dzieło = civil-law contracts, b2b = a contractor invoicing the firm. */
export type ContractType = 'uop' | 'zlecenie' | 'dzielo' | 'b2b'

export interface StaffMember {
  id: string
  firstName: string
  lastName: string
  pesel: string
  /** Contractors (B2B): their business name and NIP. */
  company?: string
  nip?: string
  position: string
  contract: ContractType
  startDate: string
  endDate: string | null
  /** 'monthly' gross pay (net invoice for B2B), 'hourly' rate × hours a month, 'once' a one-off amount paid on payDate (dzieło). */
  payType: 'monthly' | 'hourly' | 'once'
  rate: number
  hours: number
  payDate: string | null
  /** Part of a full-time job for UoP: 1, 0.5, 0.25… */
  fte: number
  /** PIT exemption for people under 26 (UoP, zlecenie), applied automatically while the PESEL says they are under 26. */
  youthRelief: boolean
  /** Zlecenie: a pupil / student under 26 — no ZUS at all. */
  student: boolean
  /** PIT-2 filed: the monthly tax-reducing amount is applied. */
  pit2: boolean
  /** UoP: commutes from another town — higher deductible costs. */
  commuting: boolean
  /** Zlecenie: voluntary sickness insurance. */
  sickness: boolean
  /** Zlecenie: already insured elsewhere (e.g. a job paying at least the minimum wage) — only the health contribution is due. */
  otherTitle: boolean
  /** Zlecenie / dzieło with a transfer of copyright: 50% deductible costs. */
  copyright: boolean
  /** Enrolled in PPK (employee 2%, employer 1.5%). */
  ppk: boolean
  /** B2B: VAT rate on the contractor's invoices (null = not a VAT payer). */
  vatRate: number | null
  note: string
}

export interface Firm extends FinanceBook {
  id: string
  name: string
  nip: string
  /** Stored PNG (attachment path); null = the initial letter is shown instead. */
  logo: string | null
  tax: FirmTax
  createdAt: string
  /** Employees and contractors of the firm. */
  staff?: StaffMember[]
}

/** KPiR columns a document line can be booked in; '-' = not a KPiR entry (the owner's own ZUS, PIT, VAT payments). */
export type KpirColumn = '7' | '8' | '10' | '11' | '12' | '13' | '16' | '-'

/** One line of an invoice/receipt, booked in a KPiR column. */
export interface LedgerItem {
  id: string
  description: string
  net: number
  /** VAT rate in percent; null = exempt / not subject. */
  vatRate: number | null
  vat: number
  gross: number
  kpir: KpirColumn | null
  /** Optional override of the profit-and-loss line (RZiS) the line is reported in. */
  rzis?: string | null
}

/** Accounting details of the document behind an event (firm books). */
export interface LedgerDocument {
  number: string
  ksef?: string
  counterpartyName?: string
  counterpartyNip?: string
  counterpartyAddress?: string
}

export interface Ledger {
  counterparties: Counterparty[]
  events: LedgerEvent[]
  subscriptions: Subscription[]
  /** Merchant keys the user said are not subscriptions, so detection stops suggesting them. */
  dismissedSubscriptions?: string[]
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
  finance: FinanceAccounts
  /** Display preferences. `mainCurrency` is what totals and converted values are shown in. */
  settings: {
    mainCurrency: CurrencyCode
    /** Where card payments go when nothing more specific is known (account id). */
    defaultCardAccountId?: string | null
    /** Where cash payments go (account id). */
    defaultCashAccountId?: string | null
    /** Last four digits of a card → the account it pays from. */
    cardAccounts?: Record<string, string>
  }
  ledger: Ledger
  financeStats?: FinanceStatsState
  /** Businesses kept as separate finance books (own accounts, events, KPiR and taxes). */
  firms?: Firm[]
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
  /** Accounts a payment sent from the bot can go to (crypto portfolios excluded). */
  financeAccounts: TelegramFinanceAccount[]
  /** Personal finances and each firm, with their accounts, so the bot can file a payment to the right book. */
  financeBooks: TelegramFinanceBook[]
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

export type TelegramActionType = 'create' | 'toggle_done' | 'edit' | 'delete' | 'set_energy' | 'finance_add'

/** A payment (optionally with a photo/scan of its receipt) entered in the bot, to become a ledger event. */
export interface TelegramFinanceAddPayload {
  /** Generated by the bot; becomes the event id, which makes a re-delivered action harmless. */
  id: string
  type: 'expense' | 'income'
  /** Null when the user sent only a document: the app reads the amount from it (AI) or flags the event. */
  amount: number | null
  currency: string | null
  title: string
  category: string
  accountId: string | null
  date: string
  fileId: string | null
  fileName: string | null
  mime: string | null
  /** Said in the bot message ("cash", "card", "*1234"); the app picks the account from it when no account was chosen. */
  paymentMethod?: 'card' | 'cash' | null
  cardLast4?: string | null
  /** 'personal' (default) or the id of the firm the payment belongs to. */
  bookId?: string
}

export interface TelegramFinanceBook {
  /** 'personal' or the firm id. */
  id: string
  kind: 'personal' | 'firm'
  name: string
  accounts: TelegramFinanceAccount[]
}

/** Accounts the bot may offer for a payment. */
export interface TelegramFinanceAccount {
  id: string
  name: string
  currency: string
}

export interface TelegramAction {
  id: number
  action_type: TelegramActionType
  payload:
    | TelegramCreateActionPayload
    | TelegramToggleDoneActionPayload
    | TelegramEditActionPayload
    | TelegramDeleteActionPayload
    | TelegramSetEnergyActionPayload
    | TelegramFinanceAddPayload
}

export interface AuthResult {
  ok: boolean
  error?: string
  username?: string
}

/** Signing in / resetting the password with a confirmation in Telegram. */
export type TelegramAuthStart = { ok: true; id: string } | { ok: false; error: 'user_not_found' | 'not_linked' | 'network' }
export type TelegramAuthPoll =
  | { status: 'pending' | 'denied' | 'expired' | 'network' }
  | { status: 'approved'; purpose: 'login' | 'reset'; username: string }

/** Recovering an account whose login and password are both forgotten: a code sent to the bot from Telegram. */
export type TelegramRecoverStart = { ok: true; id: string; code: string; bot: string } | { ok: false; error: 'network' }
export type TelegramRecoverPoll =
  | { status: 'pending' | 'expired' | 'network' | 'mismatch' }
  | { status: 'approved'; username: string }
  /** Telegram knows the account, but it isn't on this computer. */
  | { status: 'no_local'; username: string }

export type UpdateStatus =
  | { state: 'checking' }
  | { state: 'not-available' }
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }
  | { state: 'dev-unavailable' }
