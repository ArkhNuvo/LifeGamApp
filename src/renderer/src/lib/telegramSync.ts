import type {
  TelegramAction,
  TelegramCatalogPayload,
  TelegramCreateActionPayload,
  TelegramDeleteActionPayload,
  TelegramEditActionPayload,
  TelegramToggleDoneActionPayload,
  KanbanCard,
  UserData
} from './types'
import { newId } from './ids'
import { buildCatalogPayload, findCardEverywhere } from './kanbanCatalog'
import { revertCardEffects, syncCardDoneState } from './kanbanXp'
import { useAppStore } from '../state/useAppStore'

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
  const card: KanbanCard = {
    id: payload.id ?? newId(),
    title: payload.title,
    description: payload.description,
    rewards: payload.rewards,
    energyMental: payload.energyMental,
    energyPhysical: payload.energyPhysical,
    money: payload.money,
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
  const column = draft.kanban.months[monthKey]?.columns.find((c) => c.id === columnId)
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
  syncCardDoneState(draft, found.card, found.column?.status ?? 'TODO', payload.done)
}

function applyEditAction(draft: UserData, payload: TelegramEditActionPayload): void {
  const found = findCardEverywhere(draft, payload.cardId)
  if (!found) return
  Object.assign(found.card, payload.patch)
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

let syncInFlight = false

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
    try {
      const actions = await fetchPendingActions(apiToken)
      if (actions.length > 0) {
        useAppStore.getState().updateData((draft) => {
          for (const action of actions) {
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
            }
          }
        })
        await ackActions(
          apiToken,
          actions.map((a) => a.id)
        )
      }
    } catch {
      // best-effort — a failed pull shouldn't block the catalog push below
    }

    try {
      const current = useAppStore.getState().data
      if (current) {
        await pushCatalog(apiToken, buildCatalogPayload(current))
      }
    } catch {
      // best-effort background sync — silent on network errors
    }
  } finally {
    syncInFlight = false
  }
}
