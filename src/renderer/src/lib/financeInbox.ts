import { useAppStore } from '../state/useAppStore'
import { useLanguageStore } from '../state/useLanguageStore'
import { useRatesStore } from '../state/useRatesStore'
import { todayISO } from './date'
import { canConvert, convert } from './currency'
import { prepareForAi } from './documents'
import { newId } from './ids'
import { addEvent, listAccounts } from './ledger'
import { pickPaymentAccount } from './paymentAccount'
import { bookOf } from './book'
import type { AiExtraction, Attachment, CurrencyCode, FinanceBook, KpirColumn, LedgerDocument, LedgerItem, TelegramFinanceAddPayload, UserData } from './types'

/** The book a bot payment belongs to: a firm when it still exists, personal finances otherwise. */
function targetBook(data: UserData, bookId: string | undefined): { book: FinanceBook; firm: boolean } {
  const firm = bookId && bookId !== 'personal' ? bookOf(data, bookId) : undefined
  return firm ? { book: firm, firm: true } : { book: data, firm: false }
}

const KPIR = ['7', '8', '10', '11', '12', '13', '16', '-']

/** Invoice lines and document details read by the AI, for a firm's KPiR. */
function documentParts(d: AiExtraction): { items: LedgerItem[]; doc: LedgerDocument | null } {
  const r2 = (n: number): number => Math.round(n * 100) / 100
  const items = d.items
    .filter((it) => it.net !== null || it.gross !== null)
    .map((it): LedgerItem => {
      const rate = it.vatRate ?? 0
      const net = it.net ?? r2((it.gross ?? 0) / (1 + rate / 100))
      const gross = it.gross ?? r2(net * (1 + rate / 100))
      return {
        id: newId(),
        description: it.description,
        net,
        vatRate: it.vatRate,
        vat: r2(gross - net),
        gross,
        kpir: KPIR.includes(it.kpirColumn ?? '') ? (it.kpirColumn as KpirColumn) : null
      }
    })
  const doc =
    d.documentNumber || d.counterpartyName || d.counterpartyNip
      ? { number: d.documentNumber ?? '', counterpartyName: d.counterpartyName ?? undefined, counterpartyNip: d.counterpartyNip ?? undefined }
      : null
  return { items, doc }
}

const LANGUAGE_NAMES: Record<string, string> = {
  ru: 'Russian',
  en: 'English',
  pl: 'Polish',
  hu: 'Hungarian',
  isv: 'Russian'
}

/**
 * Turns a payment sent from the Telegram bot into a ledger event: fetches the
 * attached photo/scan, reads the amount from it with AI when the user didn't
 * type one (and an API key is set), and flags the event for review when the
 * amount is still unknown. Throws on network errors so the action stays queued.
 */
export async function applyFinanceAdd(apiToken: string, payload: TelegramFinanceAddPayload): Promise<void> {
  const store = useAppStore.getState()
  const data = store.data
  if (!data) throw new Error('no data loaded')
  const { book, firm } = targetBook(data, payload.bookId)
  // A re-delivered action (the ack failed last time) must not create a second event.
  if (book.ledger.events.some((e) => e.id === payload.id)) return

  let attachment: Attachment | null = null
  let extraction: AiExtraction | null = null
  if (payload.fileId) {
    const file = await window.api.telegram.fetchFile(apiToken, payload.fileId, payload.fileName)
    if (file && store.username) {
      const path = await window.api.attachments.save(store.username, file.mime, file.dataBase64)
      attachment = { id: newId(), name: payload.fileName ?? file.name, mime: file.mime, path }
      // A firm's document is always read: its lines go to the KPiR.
      const needsReading = payload.amount === null || !payload.title || firm
      if (needsReading && (await window.api.ai.status()).hasKey) {
        try {
          const prepared = await prepareForAi(file.mime, file.dataBase64)
          const result = await window.api.ai.extract({
            dataBase64: prepared.dataBase64,
            mime: prepared.mime,
            language: LANGUAGE_NAMES[useLanguageStore.getState().language] ?? 'English',
            today: todayISO(),
            categories: [...new Set(book.ledger.events.map((e) => e.category).filter(Boolean))],
            counterparties: book.ledger.counterparties.map((c) => c.name),
            business: firm
          })
          if (result.ok) extraction = result.data
        } catch {
          // reading the document is a bonus; the event is still created and flagged below
        }
      }
    }
  }

  const rates = useRatesStore.getState().rates?.rates ?? null
  // A payment in a coin: the coin amount rides along, and its USD value comes from the live price.
  const coin =
    extraction?.cryptoTicker && extraction.cryptoAmount
      ? { ticker: extraction.cryptoTicker, amount: extraction.cryptoAmount }
      : null
  let coinUsd: number | null = null
  if (coin) {
    try {
      coinUsd = (await window.api.crypto.prices([coin.ticker])).prices[coin.ticker] ?? null
    } catch {
      coinUsd = null
    }
  }
  const type = payload.amount === null && extraction && extraction.eventType !== 'transfer' ? extraction.eventType : payload.type
  let amount = payload.amount ?? extraction?.amount ?? null
  const currency = (payload.currency ?? extraction?.currency ?? null) as CurrencyCode | null
  const date = payload.amount === null && extraction?.date ? extraction.date : payload.date
  const title = payload.title || extraction?.description || extraction?.merchant || ''
  const category = payload.category || extraction?.category || ''

  const parts = firm && extraction ? documentParts(extraction) : null

  useAppStore.getState().updateData((root) => {
    const draft = targetBook(root, payload.bookId).book
    if (draft.ledger.events.some((e) => e.id === payload.id)) return
    const all = listAccounts(draft, '')
    // An account picked in the bot wins; otherwise the way it was paid decides (card binding, default card / cash, coin).
    const chosen = all.find((a) => a.id === payload.accountId && !a.crypto)
    const account =
      chosen ??
      pickPaymentAccount(
        root.settings,
        all,
        {
          paymentMethod: coin ? 'crypto' : (payload.paymentMethod ?? extraction?.paymentMethod),
          cardLast4: payload.cardLast4 ?? extraction?.cardLast4,
          currency,
          cryptoTicker: coin?.ticker
        },
        (id) => draft.finance.savings.find((e) => e.id === id)?.holdings?.map((h) => h.ticker) ?? []
      ).account
    if (!account) return
    if (coin && account.crypto && coinUsd !== null && amount === null) amount = Math.round(coin.amount * coinUsd * 100) / 100
    if (amount !== null && currency && currency !== account.currency && canConvert(currency, account.currency, rates)) {
      amount = Math.round(convert(amount, currency, account.currency, rates) * 100) / 100
    }
    const known = amount !== null && amount > 0
    const ev = addEvent(draft, {
      type,
      title,
      amount: known ? (amount as number) : 0,
      accountId: account.id,
      toAccountId: null,
      toAmount: null,
      date,
      category,
      counterpartyId: null,
      subscriptionId: null,
      // Not yet known = a placeholder that must not touch balances until the user fills it in.
      confirmed: known && date <= todayISO(),
      attachments: attachment ? [attachment] : [],
      review: known ? null : 'document',
      crypto: coin && account.crypto ? coin : null,
      ...(parts ? { items: parts.items, doc: parts.doc } : {})
    })
    ev.id = payload.id
  })
}
