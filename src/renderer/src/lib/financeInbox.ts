import { useAppStore } from '../state/useAppStore'
import { useLanguageStore } from '../state/useLanguageStore'
import { useRatesStore } from '../state/useRatesStore'
import { todayISO } from './date'
import { canConvert, convert } from './currency'
import { prepareForAi } from './documents'
import { newId } from './ids'
import { addEvent, listAccounts } from './ledger'
import { pickPaymentAccount } from './paymentAccount'
import type { AiExtraction, Attachment, CurrencyCode, TelegramFinanceAddPayload } from './types'

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
  // A re-delivered action (the ack failed last time) must not create a second event.
  if (data.ledger.events.some((e) => e.id === payload.id)) return

  let attachment: Attachment | null = null
  let extraction: AiExtraction | null = null
  if (payload.fileId) {
    const file = await window.api.telegram.fetchFile(apiToken, payload.fileId, payload.fileName)
    if (file && store.username) {
      const path = await window.api.attachments.save(store.username, file.mime, file.dataBase64)
      attachment = { id: newId(), name: payload.fileName ?? file.name, mime: file.mime, path }
      const needsReading = payload.amount === null || !payload.title
      if (needsReading && (await window.api.ai.status()).hasKey) {
        try {
          const prepared = await prepareForAi(file.mime, file.dataBase64)
          const result = await window.api.ai.extract({
            dataBase64: prepared.dataBase64,
            mime: prepared.mime,
            language: LANGUAGE_NAMES[useLanguageStore.getState().language] ?? 'English',
            today: todayISO(),
            categories: [...new Set(data.ledger.events.map((e) => e.category).filter(Boolean))],
            counterparties: data.ledger.counterparties.map((c) => c.name)
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

  useAppStore.getState().updateData((draft) => {
    if (draft.ledger.events.some((e) => e.id === payload.id)) return
    const all = listAccounts(draft, '')
    // An account picked in the bot wins; otherwise the way it was paid decides (card binding, default card / cash, coin).
    const chosen = all.find((a) => a.id === payload.accountId && !a.crypto)
    const account =
      chosen ??
      pickPaymentAccount(
        draft.settings,
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
      crypto: coin && account.crypto ? coin : null
    })
    ev.id = payload.id
  })
}
