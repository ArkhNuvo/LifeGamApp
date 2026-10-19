import type {
  TelegramAction,
  TelegramCatalogPayload,
  TelegramCreateActionPayload,
  TelegramDeleteActionPayload,
  TelegramEditActionPayload,
  TelegramFinanceAddPayload,
  TelegramSetEnergyActionPayload,
  TelegramToggleDoneActionPayload,
  KanbanCard,
  UserData
} from './types'
import { newId } from './ids'
import { buildCatalogPayload, findCardEverywhere } from './kanbanCatalog'
import {
  revertCardEffects,
  syncCardDoneState,
  moveToDoneColumnAndSync,
  editCardWithEffects
} from './kanbanXp'
import { useAppStore } from '../state/useAppStore'
import { applyFinanceAdd } from './financeInbox'

export function startPairing(username: string): Promise<string> {
  return window.api.telegram.startPairing(username)
}

export function checkPairingStatus(code: string): Promise<string | null> {
  return window.api.telegram.checkPairingStatus(code)
}

export function pushCatalog(apiToken: string, payload: TelegramCatalogPayload): Promise<void> {
  return window.api.telegram.pushCatalog(apiToken, payload)
}

export function fetchPendingActions(apiToken: string): Promise<TelegramAction[]> {
  return window.api.telegram.fetchPendingActions(apiToken)
}

export function ackActions(apiToken: string, ids: number[]): Promise<void> {
  return window.api.telegram.ackActions(apiToken, ids)
}

function applyCreateAction(draft: UserData, payload: TelegramCreateActionPayload): void {
  // If a previous ack failed, the server re-delivers the same create action —
  // skip it instead of adding a duplicate card with the same id.
  if (payload.id && findCardEverywhere(draft, payload.id)) return
  const card: KanbanCard = {
    id: payload.id ?? newId(),
    title: payload.title,
    description: payload.description,
    rewards: payload.rewards,
    energyMental: payload.energyMental,
    energyPhysical: payload.energyPhysical,
    money: payload.money,
    checkingCategoryId: payload.checkingCategoryId,
    createdDate: payload.createdDate,
    completedDate: payload.completedDate,
    done: false,
    effectsApplied: false
  }
  if (payload.target.type === 'unassigned') {
    draft.kanban.unassigned.push(card)
    return
  }
  const { monthKey, columnId } = payload.target
  // The bot computes monthKey from the server's clock, which can disagree
  // with the user's local month around midnight on the 1st — column ids are
  // unique, so fall back to finding the column in any month.
  const column =
    draft.kanban.months[monthKey]?.columns.find((c) => c.id === columnId) ??
    Object.values(draft.kanban.months)
      .flatMap((m) => m.columns)
      .find((c) => c.id === columnId)
  if (!column) {
    draft.kanban.unassigned.push(card)
    return
  }
  column.cards.push(card)
  if (column.status === 'DONE') {
    syncCardDoneState(draft, card, column.status)
  }
}

function applyToggleDoneAction(draft: UserData, payload: TelegramToggleDoneActionPayload): void {
  const found = findCardEverywhere(draft, payload.cardId)
  if (!found) return
  moveToDoneColumnAndSync(draft, found.monthKey, found.column, found.card, payload.done)
}

function applyEditAction(draft: UserData, payload: TelegramEditActionPayload): void {
  const found = findCardEverywhere(draft, payload.cardId)
  if (!found) return
  editCardWithEffects(draft, found.card, (card) => Object.assign(card, payload.patch))
}

function applyDeleteAction(draft: UserData, payload: TelegramDeleteActionPayload): void {
  const found = findCardEverywhere(draft, payload.cardId)
  if (!found) return
  if (found.card.effectsApplied) revertCardEffects(draft, found.card)
  if (found.column) {
    found.column.cards = found.column.cards.filter((c) => c.id !== payload.cardId)
  } else {
    draft.kanban.unassigned = draft.kanban.unassigned.filter((c) => c.id !== payload.cardId)
  }
}

function applySetEnergyAction(draft: UserData, payload: TelegramSetEnergyActionPayload): void {
  const clamped = Math.max(0, Math.min(100, payload.value))
  draft.energy[payload.kind] = clamped
}

let syncInFlight = false

// The catalog is only re-sent when its content changed (or the bot just
// acted, or it's been a while) — instead of re-uploading identical data
// every 10 seconds. The periodic re-push is a safety net: the server's
// optimistic mirror can drift from the app's state in rare cases where a bot
// action doesn't change anything locally.
const FORCE_PUSH_INTERVAL_MS = 5 * 60 * 1000
let lastPushedJson: string | null = null
let lastPushedToken: string | null = null
let lastPushAt = 0

/**
 * Pulls and applies any actions queued from the bot, then pushes a fresh
 * catalog reflecting the (possibly just-updated) local state — in that
 * order, so a card created via the bot shows up in the *same* sync tick's
 * catalog instead of needing one extra cycle. Guarded against overlapping
 * calls (mount + window-focus can fire within milliseconds of each other,
 * which previously caused the same bot action to be applied twice).
 * Silent on network errors — this is a best-effort background sync.
 */
export async function syncWithTelegram(apiToken: string): Promise<void> {
  if (syncInFlight) return
  syncInFlight = true
  try {
    let botActed = false
    try {
      const actions = await fetchPendingActions(apiToken)
      const financeActions = actions.filter((a) => a.action_type === 'finance_add')
      const taskActions = actions.filter((a) => a.action_type !== 'finance_add')
      // Payments need the network (the attached document), so they go one by one and are only
      // acknowledged once saved — a failure leaves the action queued for the next tick.
      for (const action of financeActions) {
        try {
          await applyFinanceAdd(apiToken, action.payload as TelegramFinanceAddPayload)
          await ackActions(apiToken, [action.id])
          botActed = true
        } catch {
          // retried on the next sync
        }
      }
      if (taskActions.length > 0) {
        botActed = true
        useAppStore.getState().updateData((draft) => {
          for (const action of taskActions) {
            switch (action.action_type) {
              case 'create':
                applyCreateAction(draft, action.payload as TelegramCreateActionPayload)
                break
              case 'toggle_done':
                applyToggleDoneAction(draft, action.payload as TelegramToggleDoneActionPayload)
                break
              case 'edit':
                applyEditAction(draft, action.payload as TelegramEditActionPayload)
                break
              case 'delete':
                applyDeleteAction(draft, action.payload as TelegramDeleteActionPayload)
                break
              case 'set_energy':
                applySetEnergyAction(draft, action.payload as TelegramSetEnergyActionPayload)
                break
            }
          }
        })
        await ackActions(
          apiToken,
          taskActions.map((a) => a.id)
        )
      }
    } catch {
      // best-effort — a failed pull shouldn't block the catalog push below
    }

    try {
      const current = useAppStore.getState().data
      if (current) {
        const json = JSON.stringify(buildCatalogPayload(current))
        const unchanged = json === lastPushedJson && apiToken === lastPushedToken
        if (!unchanged || botActed || Date.now() - lastPushAt > FORCE_PUSH_INTERVAL_MS) {
          await pushCatalog(apiToken, JSON.parse(json))
          lastPushedJson = json
          lastPushedToken = apiToken
          lastPushAt = Date.now()
        }
      }
    } catch {
      // best-effort background sync — silent on network errors
    }
  } finally {
    syncInFlight = false
  }
}
