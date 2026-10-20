import { useState } from 'react'
import { useBookSelect, useUpdateBook } from '../../lib/book'
import { useT } from '../../lib/i18n/useT'
import { newId } from '../../lib/ids'
import { deleteCounterparty } from '../../lib/ledger'
import type { Counterparty, CounterpartyKind } from '../../lib/types'
import ConfirmModal from '../common/ConfirmModal'

const KIND_KEYS = {
  service: 'fin.kindService',
  shop: 'fin.kindShop',
  person: 'fin.kindPerson',
  organization: 'fin.kindOrg'
} as const

/** The registry of services, shops and organizations events can be tied to. */
export default function CounterpartiesModal({ onClose }: { onClose: () => void }): JSX.Element {
  const t = useT()
  const updateData = useUpdateBook()
  const counterparties = useBookSelect((b) => b?.ledger.counterparties ?? [])
  const events = useBookSelect((b) => b?.ledger.events ?? [])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CounterpartyKind>('service')
  const [category, setCategory] = useState('')
  const [deleting, setDeleting] = useState<Counterparty | null>(null)

  function reset(): void {
    setEditingId(null)
    setName('')
    setKind('service')
    setCategory('')
  }

  function startEdit(cp: Counterparty): void {
    setEditingId(cp.id)
    setName(cp.name)
    setKind(cp.kind)
    setCategory(cp.defaultCategory)
  }

  function save(): void {
    const trimmed = name.trim()
    if (!trimmed) return
    updateData((draft) => {
      if (editingId) {
        const cp = draft.ledger.counterparties.find((c) => c.id === editingId)
        if (cp) {
          cp.name = trimmed
          cp.kind = kind
          cp.defaultCategory = category.trim()
        }
      } else {
        draft.ledger.counterparties.push({ id: newId(), name: trimmed, kind, defaultCategory: category.trim() })
      }
    })
    reset()
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card fin-modal fin-modal--wide">
        <h2>{t('fin.counterparties')}</h2>

        <div className="fin-cp-form">
          <input value={name} placeholder={t('fin.cpName')} onChange={(e) => setName(e.target.value)} />
          <select value={kind} onChange={(e) => setKind(e.target.value as CounterpartyKind)}>
            {(Object.keys(KIND_KEYS) as CounterpartyKind[]).map((k) => (
              <option key={k} value={k}>
                {t(KIND_KEYS[k])}
              </option>
            ))}
          </select>
          <input
            value={category}
            placeholder={t('fin.cpDefaultCategory')}
            onChange={(e) => setCategory(e.target.value)}
          />
          <button type="button" className="btn btn-primary" onClick={save} disabled={!name.trim()}>
            {editingId ? t('common.save') : t('common.add')}
          </button>
          {editingId && (
            <button type="button" className="btn" onClick={reset}>
              {t('common.cancel')}
            </button>
          )}
        </div>

        <div className="fin-cp-list">
          {counterparties.length === 0 && <div className="fin-empty">{t('fin.cpEmpty')}</div>}
          {counterparties.map((cp) => (
            <div key={cp.id} className="fin-cp-row">
              <span className="fin-cp-name">{cp.name}</span>
              <span className="fin-cp-meta">
                {t(KIND_KEYS[cp.kind])}
                {cp.defaultCategory ? `, ${cp.defaultCategory}` : ''}
              </span>
              <span className="fin-cp-meta">
                {t('fin.cpEvents', { n: events.filter((e) => e.counterpartyId === cp.id).length })}
              </span>
              <button type="button" className="icon-btn" onClick={() => startEdit(cp)} title={t('common.edit')}>
                ✎
              </button>
              <button type="button" className="icon-btn" onClick={() => setDeleting(cp)} title={t('common.delete')}>
                🗑
              </button>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>

        {deleting && (
          <ConfirmModal
            message={t('fin.cpDeleteConfirm', { name: deleting.name })}
            onConfirm={() => {
              updateData((draft) => deleteCounterparty(draft, deleting.id))
              setDeleting(null)
            }}
            onCancel={() => setDeleting(null)}
          />
        )}
      </div>
    </div>
  )
}
