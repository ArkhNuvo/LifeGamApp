import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useRatesStore } from '../../state/useRatesStore'
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
  const updateData = useAppStore((s) => s.updateData)
  const counterparties = useAppStore((s) => s.data?.ledger.counterparties ?? [])
  const events = useAppStore((s) => s.data?.ledger.events ?? [])
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
  const [swappedIncome, setSwappedIncome] = useState(false)
  /** Events flagged by the CSV import are already reflected in the real balances, so editing them leaves balances alone by default. */
  const [keepBalances, setKeepBalances] = useState(initial?.review === 'transfer')
  /** What the user is typing into the rate field right now; null = show the rate derived from the two amounts. */
  const [rateDraft, setRateDraft] = useState<string | null>(null)
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? today)
  const [category, setCategory] = useState(initial?.category ?? '')
  const [counterpartyId, setCounterpartyId] = useState<string>(initial?.counterpartyId ?? '')
  const [confirmed, setConfirmed] = useState(initial?.confirmed ?? (defaultDate ?? today) <= today)
  const [confirmedTouched, setConfirmedTouched] = useState(!!initial)
  const [recurrence, setRecurrence] = useState<Recurrence | ''>('')
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

  // Payments (expenses, income, subscriptions) can't go through a savings account;
  // only transfers may move money in and out of savings.
  const sourceAccounts =
    type === 'transfer' ? accounts : accounts.filter((a) => a.group === 'checking' || a.id === initial?.accountId)
  const account = accounts.find((a) => a.id === accountId)
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
    if (d.currency) {
      const match = accounts.find((a) => a.group === 'checking' && a.currency === d.currency)
      if (match) setAccountId(match.id)
      else notes.push(t('fin.docCurrencyMismatch', { currency: d.currency }))
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
      counterparties: counterparties.map((c) => c.name)
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
      review: null
    }
    updateData((draft) => {
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
      <div className="modal-card fin-modal">
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
                if (tp.value !== 'transfer' && account?.group === 'savings' && accountId !== initial?.accountId) {
                  setAccountId(accounts.find((a) => a.group === 'checking')?.id ?? GENERAL_ACCOUNT_ID)
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

        {type === 'transfer' && (
          <div className="fin-row">
            <div className="form-field fin-grow">
              <label>{t('fin.fieldToAccount')}</label>
              <select value={toAccountId} onChange={(e) => changeAccounts(accountId, e.target.value)}>
                <option value="">—</option>
                {accounts
                  .filter((a) => a.id !== accountId)
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
