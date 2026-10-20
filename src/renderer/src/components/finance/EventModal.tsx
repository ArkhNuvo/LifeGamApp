import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useBookSelect, useUpdateBook } from '../../lib/book'
import { useRatesStore } from '../../state/useRatesStore'
import { useCryptoStore } from '../../state/useCryptoStore'
import { useLanguageStore } from '../../state/useLanguageStore'
import { useT } from '../../lib/i18n/useT'
import { todayISO } from '../../lib/date'
import { convert } from '../../lib/currency'
import { newId } from '../../lib/ids'
import {
  accountBalance,
  adjustAccountBalance,
  addEvent,
  createSubscription,
  editEvent,
  materializeSubscriptions,
  GENERAL_ACCOUNT_ID
} from '../../lib/ledger'
import { fromDataUrl, prepareForAi, toDataUrl } from '../../lib/documents'
import { normalizeTicker } from '../../lib/crypto'
import { useFirm } from '../../lib/book'
import type { KpirColumn, LedgerDocument, LedgerItem } from '../../lib/types'
import { pickPaymentAccount, type PaymentReason } from '../../lib/paymentAccount'
import type {
  AiExtraction,
  Attachment,
  CounterpartyKind,
  LedgerEvent,
  LedgerEventType,
  PickedFile,
  Recurrence
} from '../../lib/types'
import AiSettingsModal from './AiSettingsModal'
import DocumentItems, { recalcItem } from './firm/DocumentItems'
import FilePreviewModal from './FilePreviewModal'
import FileViewer from './FileViewer'
import { useAccounts } from './useFinance'

const LANGUAGE_NAMES: Record<string, string> = {
  ru: 'Russian',
  en: 'English',
  pl: 'Polish',
  hu: 'Hungarian',
  isv: 'Russian'
}

const norm = (text: string): string => text.trim().toLowerCase()

const DEFAULT_CATEGORY_KEYS = {
  expense: 'fin.catDefaultsExpense',
  income: 'fin.catDefaultsIncome',
  transfer: 'fin.catDefaultsTransfer'
} as const

interface Props {
  /** Existing event to edit; omit to create a new one. */
  initial?: LedgerEvent
  defaultDate?: string
  onClose: () => void
}

const TYPES: { value: LedgerEventType; labelKey: 'fin.typeExpense' | 'fin.typeIncome' | 'fin.typeTransfer' }[] = [
  { value: 'expense', labelKey: 'fin.typeExpense' },
  { value: 'income', labelKey: 'fin.typeIncome' },
  { value: 'transfer', labelKey: 'fin.typeTransfer' }
]

const KIND_KEYS: Record<CounterpartyKind, 'fin.kindService' | 'fin.kindShop' | 'fin.kindPerson' | 'fin.kindOrg'> = {
  service: 'fin.kindService',
  shop: 'fin.kindShop',
  person: 'fin.kindPerson',
  organization: 'fin.kindOrg'
}

export default function EventModal({ initial, defaultDate, onClose }: Props): JSX.Element {
  const t = useT()
  const updateData = useUpdateBook()
  const counterparties = useBookSelect((b) => b?.ledger.counterparties ?? [])
  const events = useBookSelect((b) => b?.ledger.events ?? [])
  const rates = useRatesStore((s) => s.rates?.rates ?? null)
  const accounts = useAccounts()
  const today = todayISO()

  const [type, setType] = useState<LedgerEventType>(initial?.type ?? 'expense')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? GENERAL_ACCOUNT_ID)
  const [toAccountId, setToAccountId] = useState(
    initial?.toAccountId ?? accounts.find((a) => a.id !== (initial?.accountId ?? accounts[0]?.id))?.id ?? ''
  )
  const [toAmount, setToAmount] = useState(initial?.toAmount != null ? String(initial.toAmount) : '')
  const [toAmountTouched, setToAmountTouched] = useState(initial?.toAmount != null)
  /** "Operation on a savings account": swaps the account list from checking to savings. */
  const [savingsMode, setSavingsMode] = useState(
    () => accounts.find((a) => a.id === (initial?.accountId ?? ''))?.group === 'savings'
  )
  const [swappedIncome, setSwappedIncome] = useState(false)
  // Payments in a coin: the coin and its amount; `amount` is then the USD equivalent.
  const [cryptoTicker, setCryptoTicker] = useState(initial?.crypto?.ticker ?? '')
  const [cryptoQty, setCryptoQty] = useState(initial?.crypto ? String(initial.crypto.amount) : '')
  const [amountTouched, setAmountTouched] = useState(!!initial)
  /** A card number seen on the document that isn't tied to an account yet. */
  const [newCard, setNewCard] = useState<string | null>(null)
  const [rememberCard, setRememberCard] = useState(true)
  const settings = useAppStore((s) => s.data?.settings)
  const savings = useBookSelect((b) => b?.finance.savings)
  const prices = useCryptoStore((s) => s.prices)
  const fetchPrices = useCryptoStore((s) => s.fetch)
  /** Events flagged by the CSV import are already reflected in the real balances, so editing them leaves balances alone by default. */
  const [keepBalances, setKeepBalances] = useState(initial?.review === 'transfer')
  /** What the user is typing into the rate field right now; null = show the rate derived from the two amounts. */
  const [rateDraft, setRateDraft] = useState<string | null>(null)
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? today)
  const [category, setCategory] = useState(initial?.category ?? '')
  const [counterpartyId, setCounterpartyId] = useState<string>(initial?.counterpartyId ?? '')
  // A placeholder from the bot (amount not known yet) becomes a paid event once the user fills it in.
  const placeholder = initial?.review === 'document'
  const [confirmed, setConfirmed] = useState(
    placeholder ? initial.date <= today : (initial?.confirmed ?? (defaultDate ?? today) <= today)
  )
  const [confirmedTouched, setConfirmedTouched] = useState(!!initial && !placeholder)
  const [recurrence, setRecurrence] = useState<Recurrence | ''>('')
  // Firm books: the document's details and its lines booked in KPiR columns.
  const firm = useFirm()
  const [doc, setDoc] = useState<LedgerDocument>(initial?.doc ?? { number: '' })
  const [items, setItems] = useState<LedgerItem[]>(initial?.items ?? [])
  const [newCpName, setNewCpName] = useState<string | null>(null)
  const [newCpKind, setNewCpKind] = useState<CounterpartyKind>('service')

  const username = useAppStore((s) => s.username)
  const language = useLanguageStore((s) => s.language)
  const [draftFile, setDraftFile] = useState<PickedFile | null>(null)
  const [existingAtt, setExistingAtt] = useState<Attachment[]>(initial?.attachments ?? [])
  const [aiHasKey, setAiHasKey] = useState<boolean | null>(null)
  const [aiNote, setAiNote] = useState<{ kind: 'running' | 'ok' | 'error'; text: string } | null>(null)
  const [previewDraft, setPreviewDraft] = useState(false)
  const [previewAtt, setPreviewAtt] = useState<Attachment | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    window.api.ai.status().then((status) => setAiHasKey(status.hasKey))
  }, [])

  const draftUrl = useMemo(() => (draftFile ? toDataUrl(draftFile.mime, draftFile.dataBase64) : null), [draftFile])

  // Payments are made from checking accounts unless the "savings operation" box is ticked, which
  // lists the savings accounts (and crypto portfolios) instead; transfers may use any account but a portfolio.
  const sourceAccounts =
    type === 'transfer'
      ? accounts.filter((a) => !a.crypto || a.id === initial?.accountId)
      : accounts.filter((a) => (savingsMode ? a.group === 'savings' : a.group === 'checking'))
  const account = accounts.find((a) => a.id === accountId)
  const hasSavings = accounts.some((a) => a.group === 'savings')

  // An account chosen elsewhere (the document reader, a type switch) that is a savings one turns the box on.
  useEffect(() => {
    if (type !== 'transfer' && account?.group === 'savings' && !savingsMode) setSavingsMode(true)
  }, [type, account?.group, savingsMode])

  function toggleSavingsMode(on: boolean): void {
    setSavingsMode(on)
    const list = accounts.filter((a) => (on ? a.group === 'savings' : a.group === 'checking'))
    if (!list.some((a) => a.id === accountId)) setAccountId(list[0]?.id ?? GENERAL_ACCOUNT_ID)
  }
  const tickerSym = normalizeTicker(cryptoTicker)
  const cryptoQtyValue = parseFloat(cryptoQty.replace(',', '.'))
  const isCrypto = !!account?.crypto && type !== 'transfer'
  const heldTickers = (savings?.find((e) => e.id === accountId)?.holdings ?? []).map((h) => h.ticker)

  // The USD equivalent follows the coin amount at the live price until the user types their own figure.
  useEffect(() => {
    if (isCrypto && tickerSym) void fetchPrices([tickerSym])
  }, [isCrypto, tickerSym, fetchPrices])
  useEffect(() => {
    if (!isCrypto || amountTouched) return
    const price = prices[tickerSym]
    if (price && cryptoQtyValue > 0) setAmount(String(Math.round(cryptoQtyValue * price * 100) / 100))
  }, [isCrypto, amountTouched, prices, tickerSym, cryptoQtyValue])
  const toAccount = accounts.find((a) => a.id === toAccountId)
  /** Category hints are per event type: what you already used for it (most used first), then a starter list. */
  function suggestionsFor(kind: LedgerEventType): string[] {
    const used = new Map<string, number>()
    for (const e of events) {
      if (e.type === kind && e.category) used.set(e.category, (used.get(e.category) ?? 0) + 1)
    }
    const history = [...used.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)
    const defaults = t(DEFAULT_CATEGORY_KEYS[kind]).split(',')
    const seen = new Set<string>()
    return [...history, ...defaults].filter((name) => {
      const key = name.trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  const categorySuggestions = suggestionsFor(type)

  function suggestedToAmount(amountText: string, from: string, to: string): string {
    const value = parseFloat(amountText.replace(',', '.'))
    const fromAcc = accounts.find((a) => a.id === from)
    const toAcc = accounts.find((a) => a.id === to)
    if (!fromAcc || !toAcc || Number.isNaN(value)) return ''
    return String(Math.round(convert(value, fromAcc.currency, toAcc.currency, rates) * 100) / 100)
  }

  function changeAmount(value: string): void {
    setAmount(value)
    setAmountTouched(true)
    if (type === 'transfer' && !toAmountTouched) setToAmount(suggestedToAmount(value, accountId, toAccountId))
  }

  function changeAccounts(from: string, to: string): void {
    setAccountId(from)
    setToAccountId(to)
    if (type === 'transfer' && !toAmountTouched) setToAmount(suggestedToAmount(amount, from, to))
  }

  function changeDate(value: string): void {
    setDate(value)
    // Future dates default to "planned", past/today ones to "paid" — until the user decides otherwise.
    if (!confirmedTouched) setConfirmed(value <= today)
  }

  function pickCounterparty(id: string): void {
    setCounterpartyId(id)
    const cp = counterparties.find((c) => c.id === id)
    if (cp && !category) setCategory(cp.defaultCategory)
  }

  function addCounterpartyInline(): void {
    const name = (newCpName ?? '').trim()
    if (!name) return
    const id = newId()
    updateData((draft) => {
      draft.ledger.counterparties.push({ id, name, kind: newCpKind, defaultCategory: category.trim() })
    })
    setCounterpartyId(id)
    setNewCpName(null)
  }

  /** Takes a file dropped onto the document area (same limits as the file dialog). */
  function acceptDroppedFile(file: File): void {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) {
      setAiNote({ kind: 'error', text: t('fin.docBadType') })
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setAiNote({ kind: 'error', text: t('fin.docTooBig') })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const { dataBase64 } = fromDataUrl(String(reader.result))
      setDraftFile({ name: file.name, mime: file.type, size: file.size, dataBase64 })
      setAiNote(null)
    }
    reader.readAsDataURL(file)
  }

  async function pickFile(): Promise<void> {
    const picked = await window.api.attachments.pick()
    if (!picked) return
    if ('error' in picked) {
      setAiNote({ kind: 'error', text: t('fin.docTooBig') })
      return
    }
    setDraftFile(picked)
    setAiNote(null)
  }

  /** Puts what the AI read into the form; nothing is saved until the user checks it and presses Save. */
  function applyExtraction(d: AiExtraction): void {
    const notes: string[] = []
    setType(d.eventType)
    if (d.amount !== null) setAmount(String(d.amount))
    if (firm) {
      setDoc((prev) => ({
        ...prev,
        number: d.documentNumber ?? prev.number,
        counterpartyName: d.counterpartyName ?? prev.counterpartyName,
        counterpartyNip: d.counterpartyNip ?? prev.counterpartyNip
      }))
      const columns = ['7', '8', '10', '11', '12', '13', '16', '-']
      const lines = d.items
        .filter((it) => it.net !== null || it.gross !== null)
        .map((it) => {
          const base: LedgerItem = {
            id: newId(),
            description: it.description,
            net: it.net ?? 0,
            vatRate: it.vatRate,
            vat: 0,
            gross: it.gross ?? 0,
            kpir: columns.includes(it.kpirColumn ?? '') ? (it.kpirColumn as KpirColumn) : null
          }
          // Keep what the document says; derive only what's missing.
          if (it.net !== null && it.gross !== null) return { ...base, vat: Math.round((it.gross - it.net) * 100) / 100 }
          return recalcItem(base, it.net !== null ? 'net' : 'gross')
        })
      if (lines.length > 0) setItems(lines)
    }
    if (d.cryptoTicker && d.cryptoAmount) {
      setCryptoTicker(d.cryptoTicker)
      setCryptoQty(String(d.cryptoAmount))
      if (d.amount === null) setAmountTouched(false)
    }
    // Where it was paid from follows how it was paid: a known card, the default card / cash account, a coin portfolio.
    if (settings) {
      const { account: picked, reason } = pickPaymentAccount(
        settings,
        accounts,
        d,
        (id) => savings?.find((e) => e.id === id)?.holdings?.map((h) => h.ticker) ?? []
      )
      if (picked) {
        setAccountId(picked.id)
        const why: Record<PaymentReason, string | null> = {
          crypto: 'fin.payBy_crypto',
          'card-binding': 'fin.payBy_cardBinding',
          'default-card': 'fin.payBy_defaultCard',
          'default-cash': 'fin.payBy_defaultCash',
          currency: null,
          general: null
        }
        if (why[reason]) notes.push(t(why[reason] as 'fin.payBy_crypto', { account: picked.name, card: d.cardLast4 ?? '' }))
        if (d.currency && picked.currency !== d.currency && !picked.crypto) {
          notes.push(t('fin.docCurrencyMismatch', { currency: d.currency }))
        }
      }
      if (d.cardLast4 && !settings.cardAccounts?.[d.cardLast4]) setNewCard(d.cardLast4)
    }
    if (d.date) changeDate(d.date)
    const label = d.description ?? d.merchant
    if (label) setTitle(label)

    const merchant = d.merchant
    const known = merchant
      ? counterparties.find((c) => norm(c.name) === norm(merchant)) ??
        counterparties.find((c) => norm(merchant).includes(norm(c.name)) || norm(c.name).includes(norm(merchant)))
      : undefined
    if (known) {
      setCounterpartyId(known.id)
      setNewCpName(null)
    } else if (merchant) {
      setCounterpartyId('')
      setNewCpName(merchant)
      notes.push(t('fin.docNewCounterparty', { name: merchant }))
    }
    const nextCategory = known?.defaultCategory || d.category
    if (nextCategory) setCategory(nextCategory)
    if (!initial && d.eventType !== 'transfer' && d.recurrence !== 'none') setRecurrence(d.recurrence)

    const confidence = t(
      d.confidence === 'high'
        ? 'fin.docConfidenceHigh'
        : d.confidence === 'low'
          ? 'fin.docConfidenceLow'
          : 'fin.docConfidenceMedium'
    )
    setAiNote({
      kind: 'ok',
      text: [t('fin.docDone', { confidence }), ...notes, d.notes ?? ''].filter(Boolean).join(' ')
    })
  }

  async function recognize(): Promise<void> {
    if (!draftFile) return
    setAiNote({ kind: 'running', text: t('fin.docRecognizing') })
    const prepared = await prepareForAi(draftFile.mime, draftFile.dataBase64)
    const result = await window.api.ai.extract({
      dataBase64: prepared.dataBase64,
      mime: prepared.mime,
      language: LANGUAGE_NAMES[language] ?? 'English',
      today,
      categories: Array.from(new Set([...suggestionsFor('expense'), ...suggestionsFor('income')])),
      counterparties: counterparties.map((c) => c.name),
      business: !!firm
    })
    if (result.ok) {
      applyExtraction(result.data)
      return
    }
    if (result.code === 'no_key') setAiHasKey(false)
    const text =
      result.code === 'auth'
        ? t('fin.aiErrAuth')
        : result.code === 'rate'
          ? t('fin.aiErrRate')
          : result.code === 'bad_input'
            ? t('fin.docBadType')
            : t('fin.aiErrOther', { message: result.error })
    setAiNote({ kind: 'error', text })
  }

  const amountValue = parseFloat(amount.replace(',', '.'))
  const toAmountValue = parseFloat(toAmount.replace(',', '.'))
  const valid =
    !Number.isNaN(amountValue) &&
    amountValue > 0 &&
    !!account &&
    (!isCrypto || (tickerSym.length > 0 && cryptoQtyValue > 0)) &&
    (type !== 'transfer' || (!!toAccount && toAccountId !== accountId && !Number.isNaN(toAmountValue) && toAmountValue > 0))

  const crossCurrency = type === 'transfer' && !!account && !!toAccount && account.currency !== toAccount.currency
  // The rate follows from the two amounts whenever both are known.
  const derivedRate =
    amountValue > 0 && toAmountValue > 0 ? String(Math.round((toAmountValue / amountValue) * 1e6) / 1e6) : ''

  function changeRate(text: string): void {
    setRateDraft(text)
    const rate = parseFloat(text.replace(',', '.'))
    if (rate > 0 && amountValue > 0) {
      setToAmount(String(Math.round(amountValue * rate * 100) / 100))
      setToAmountTouched(true)
    }
  }

  async function save(): Promise<void> {
    if (!valid || saving) return
    setSaving(true)
    let added: Attachment[] = []
    if (draftFile && username) {
      const path = await window.api.attachments.save(username, draftFile.mime, draftFile.dataBase64)
      added = [{ id: newId(), name: draftFile.name, mime: draftFile.mime, path }]
    }
    const attachments = [...existingAtt, ...added]
    const removed = (initial?.attachments ?? []).filter((a) => !existingAtt.some((x) => x.id === a.id))

    // A merchant the AI found that isn't in the registry yet is added together with the event.
    const pendingCpName = counterpartyId ? '' : (newCpName ?? '').trim()
    const newCpId = pendingCpName ? newId() : ''
    const cpName = counterparties.find((c) => c.id === counterpartyId)?.name ?? pendingCpName
    const fields = {
      type,
      title: title.trim() || cpName || (type === 'transfer' && toAccount ? `→ ${toAccount.name}` : ''),
      amount: amountValue,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      toAmount: type === 'transfer' ? toAmountValue : null,
      date,
      category: category.trim(),
      counterpartyId: counterpartyId || newCpId || null,
      confirmed,
      attachments,
      review: null,
      crypto: isCrypto ? { ticker: tickerSym, amount: cryptoQtyValue } : null,
      ...(firm && type !== 'transfer'
        ? { items: items.filter((it) => it.net !== 0 || it.gross !== 0 || it.description.trim()), doc: doc.number || doc.counterpartyName || doc.counterpartyNip || doc.ksef || doc.counterpartyAddress ? doc : null }
        : {})
    }
    updateData((draft, root) => {
      if (newCard && rememberCard) {
        root.settings.cardAccounts = { ...(root.settings.cardAccounts ?? {}), [newCard]: accountId }
      }
      if (newCpId) {
        draft.ledger.counterparties.push({
          id: newCpId,
          name: pendingCpName,
          kind: newCpKind,
          defaultCategory: fields.category
        })
      }
      let ev: LedgerEvent | undefined
      if (initial) {
        // Back-filled history is already in the real balances: edit the event, then put the balances back.
        const touched = keepBalances
          ? [...new Set([initial.accountId, initial.toAccountId, fields.accountId, fields.toAccountId])].filter(
              (id): id is string => !!id
            )
          : []
        const before = touched.map((id) => accountBalance(draft, id))
        editEvent(draft, initial.id, fields)
        touched.forEach((id, i) => adjustAccountBalance(draft, id, before[i] - accountBalance(draft, id)))
        ev = draft.ledger.events.find((e) => e.id === initial.id)
      } else {
        ev = addEvent(draft, { ...fields, subscriptionId: null })
      }
      if (ev && recurrence && type !== 'transfer' && !ev.subscriptionId) {
        // This event is the first occurrence; later ones become planned events in the calendar.
        const sub = createSubscription(draft, {
          title: fields.title,
          amount: fields.amount,
          accountId: fields.accountId,
          category: fields.category,
          counterpartyId: fields.counterpartyId,
          every: recurrence,
          startDate: date
        })
        sub.generated = 1
        ev.subscriptionId = sub.id
        materializeSubscriptions(draft, todayISO())
      }
    })
    removed.forEach((a) => window.api.attachments.remove(a.path))
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className={`modal-card fin-modal${firm ? ' fin-modal--wide' : ''}`}>
        <h2>{initial ? t('fin.editEvent') : t('fin.newEvent')}</h2>

        <div className="fin-type-switch">
          {TYPES.map((tp) => (
            <button
              key={tp.value}
              type="button"
              className={`fin-type-btn fin-type-btn--${tp.value}${type === tp.value ? ' active' : ''}`}
              onClick={() => {
                setType(tp.value)
                // A category typed for one kind of event doesn't make sense for another ("Salary" as an expense).
                if (category && !suggestionsFor(tp.value).some((c) => c.toLowerCase() === category.trim().toLowerCase())) {
                  setCategory('')
                }
                if (tp.value === 'transfer' && type === 'income') {
                  // An incoming payment becomes a transfer *into* its account: the source is another one,
                  // and the amount we know is the credited one.
                  const source = accounts.find((a) => a.id !== accountId && a.group === 'checking') ?? accounts.find((a) => a.id !== accountId)
                  if (source) {
                    setToAccountId(accountId)
                    setAccountId(source.id)
                    setToAmount(amount)
                    setToAmountTouched(true)
                    if (source.currency !== account?.currency) setAmount('')
                    setSwappedIncome(true)
                  }
                } else if (tp.value === 'transfer' && !toAmountTouched) {
                  setToAmount(suggestedToAmount(amount, accountId, toAccountId))
                }
                if (tp.value === 'income' && type === 'transfer' && swappedIncome) {
                  setAccountId(toAccountId)
                  setAmount(toAmount)
                  setSwappedIncome(false)
                }
              }}
            >
              {t(tp.labelKey)}
            </button>
          ))}
        </div>

        <div
          className={dragOver ? 'fin-doc fin-doc--over' : 'fin-doc'}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files[0]
            if (file) acceptDroppedFile(file)
          }}
        >
          <div className="fin-doc-head">{t('fin.docTitle')}</div>
          {!draftFile && (
            <button type="button" className="btn fin-upload" onClick={pickFile}>
              📎 {t('fin.docUpload')}
            </button>
          )}
          {draftFile && draftUrl && (
            <div className="fin-doc-body">
              <div className="fin-doc-thumb">
                <FileViewer dataUrl={draftUrl} mime={draftFile.mime} name={draftFile.name} />
              </div>
              <div className="fin-doc-side">
                <div className="fin-doc-name" title={draftFile.name}>
                  {draftFile.name}
                </div>
                {aiHasKey === false ? (
                  <button type="button" className="btn btn-primary" onClick={() => setSettingsOpen(true)}>
                    {t('fin.docSetKey')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={recognize}
                    disabled={aiNote?.kind === 'running'}
                  >
                    ✨ {aiNote?.kind === 'running' ? t('fin.docRecognizing') : t('fin.docRecognize')}
                  </button>
                )}
                <div className="reward-row">
                  <button type="button" className="btn" onClick={() => setPreviewDraft(true)}>
                    {t('fin.docEnlarge')}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setDraftFile(null)
                      setAiNote(null)
                    }}
                  >
                    {t('fin.docRemove')}
                  </button>
                </div>
              </div>
            </div>
          )}
          {existingAtt.map((a) => (
            <div key={a.id} className="fin-doc-existing">
              <span title={a.name}>📎 {a.name}</span>
              <button type="button" className="btn" onClick={() => setPreviewAtt(a)}>
                {t('fin.docEnlarge')}
              </button>
              <button
                type="button"
                className="icon-btn"
                title={t('fin.docRemove')}
                onClick={() => setExistingAtt((list) => list.filter((x) => x.id !== a.id))}
              >
                ×
              </button>
            </div>
          ))}
          {aiNote && <div className={`fin-doc-note fin-doc-note--${aiNote.kind}`}>{aiNote.text}</div>}
          {draftFile && aiHasKey === false && <div className="field-hint">{t('fin.docNoKey')}</div>}
        </div>

        <div className="form-field">
          <label>{t('fin.fieldCounterparty')}</label>
          <div className="reward-row">
            <select value={counterpartyId} onChange={(e) => pickCounterparty(e.target.value)}>
              <option value="">{t('fin.noCounterparty')}</option>
              {counterparties.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={() => setNewCpName(newCpName === null ? '' : null)}>
              {t('fin.newCounterparty')}
            </button>
          </div>
          {newCpName !== null && (
            <div className="reward-row">
              <input
                value={newCpName}
                placeholder={t('fin.cpName')}
                onChange={(e) => setNewCpName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCounterpartyInline()}
                autoFocus
              />
              <select value={newCpKind} onChange={(e) => setNewCpKind(e.target.value as CounterpartyKind)}>
                {(Object.keys(KIND_KEYS) as CounterpartyKind[]).map((k) => (
                  <option key={k} value={k}>
                    {t(KIND_KEYS[k])}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-primary" onClick={addCounterpartyInline}>
                {t('common.add')}
              </button>
            </div>
          )}
        </div>

        <div className="form-field">
          <label>{t('fin.fieldTitle')}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="fin-row">
          <div className="form-field fin-grow">
            <label>{t('fin.fieldAmount')}</label>
            <div className="signed-field-row">
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => changeAmount(e.target.value)}
                autoFocus={!initial}
              />
              <span className="money-currency">{account?.currency ?? ''}</span>
            </div>
          </div>
          <div className="form-field fin-grow">
            <label>{t('fin.fieldAccount')}</label>
            <select value={accountId} onChange={(e) => changeAccounts(e.target.value, toAccountId)}>
              {sourceAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </div>
        </div>

        {type !== 'transfer' && (hasSavings || savingsMode) && (
          <label className="fin-keep-balances">
            <input type="checkbox" checked={savingsMode} onChange={(e) => toggleSavingsMode(e.target.checked)} />
            {t('fin.savingsOperation')}
          </label>
        )}

        {isCrypto && (
          <>
            <div className="fin-row">
              <div className="form-field fin-grow">
                <label>{t('fin.cryptoTicker')}</label>
                <input
                  list="fin-held-tickers"
                  value={cryptoTicker}
                  placeholder="BTC"
                  onChange={(e) => setCryptoTicker(e.target.value)}
                />
                <datalist id="fin-held-tickers">
                  {heldTickers.map((tk) => (
                    <option key={tk} value={tk} />
                  ))}
                </datalist>
              </div>
              <div className="form-field fin-grow">
                <label>{t('fin.cryptoAmount')}</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={cryptoQty}
                  onChange={(e) => setCryptoQty(e.target.value)}
                />
              </div>
            </div>
            <div className="fin-hint">{t('fin.cryptoUsdHint')}</div>
          </>
        )}

        {newCard && (
          <label className="fin-keep-balances">
            <input type="checkbox" checked={rememberCard} onChange={(e) => setRememberCard(e.target.checked)} />
            {t('fin.rememberCard', { card: newCard })}
          </label>
        )}

        {type === 'transfer' && (
          <div className="fin-row">
            <div className="form-field fin-grow">
              <label>{t('fin.fieldToAccount')}</label>
              <select value={toAccountId} onChange={(e) => changeAccounts(accountId, e.target.value)}>
                <option value="">—</option>
                {accounts
                  .filter((a) => a.id !== accountId && !a.crypto)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
              </select>
            </div>
            <div className="form-field fin-grow">
              <label>{t('fin.fieldToAmount')}</label>
              <div className="signed-field-row">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={toAmount}
                  onChange={(e) => {
                    setToAmount(e.target.value)
                    setToAmountTouched(true)
                  }}
                />
                <span className="money-currency">{toAccount?.currency ?? ''}</span>
              </div>
            </div>
            {crossCurrency && (
              <div className="form-field fin-grow">
                <label>{t('fin.fieldRate', { from: account.currency, to: toAccount.currency })}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rateDraft ?? derivedRate}
                  onChange={(e) => changeRate(e.target.value)}
                  onBlur={() => setRateDraft(null)}
                />
              </div>
            )}
          </div>
        )}

        {initial?.review === 'transfer' && (
          <label className="fin-keep-balances">
            <input type="checkbox" checked={keepBalances} onChange={(e) => setKeepBalances(e.target.checked)} />
            {t('fin.keepBalances')}
          </label>
        )}

        <div className="fin-row">
          <div className="form-field fin-grow">
            <label>{t('fin.fieldDate')}</label>
            <input type="date" value={date} onChange={(e) => changeDate(e.target.value)} />
          </div>
          <div className="form-field fin-grow">
            <label>{t('fin.fieldCategory')}</label>
            <input list={`fin-category-${type}`} value={category} onChange={(e) => setCategory(e.target.value)} />
            <datalist id={`fin-category-${type}`}>
              {categorySuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>

        {firm && type !== 'transfer' && (
          <DocumentItems
            type={type}
            doc={doc}
            onDoc={setDoc}
            items={items}
            onItems={(next) => {
              setItems(next)
              // While the amount is still empty, the lines fill it in.
              if ((!amount || amountValue === 0) && next.length > 0) {
                const gross = next.reduce((sum, it) => sum + it.gross, 0)
                if (gross > 0) setAmount(String(Math.round(gross * 100) / 100))
              }
            }}
            amount={Number.isNaN(amountValue) ? 0 : amountValue}
            currency={account?.currency ?? ''}
            onUseTotal={(gross) => changeAmount(String(gross))}
          />
        )}

        {!initial?.subscriptionId && type !== 'transfer' && (
          <div className="form-field">
            <label>{t('fin.fieldRepeat')}</label>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence | '')}>
              <option value="">{t('fin.repeatNone')}</option>
              <option value="week">{t('fin.repeatWeek')}</option>
              <option value="month">{t('fin.repeatMonth')}</option>
              <option value="year">{t('fin.repeatYear')}</option>
            </select>
            {recurrence === '' && <div className="field-hint">{t('fin.repeatHint')}</div>}
          </div>
        )}

        <label className="fin-confirm-field">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => {
              setConfirmed(e.target.checked)
              setConfirmedTouched(true)
            }}
          />
          <span>{t('fin.confirmedLabel')}</span>
        </label>
        <div className="field-hint">{t('fin.confirmedHint')}</div>

        {previewDraft && draftFile && draftUrl && (
          <FilePreviewModal
            draft={{ name: draftFile.name, mime: draftFile.mime, dataUrl: draftUrl }}
            onClose={() => setPreviewDraft(false)}
          />
        )}
        {previewAtt && <FilePreviewModal attachments={[previewAtt]} onClose={() => setPreviewAtt(null)} />}
        {settingsOpen && (
          <AiSettingsModal
            onClose={() => {
              setSettingsOpen(false)
              window.api.ai.status().then((status) => setAiHasKey(status.hasKey))
            }}
          />
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!valid || saving}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
