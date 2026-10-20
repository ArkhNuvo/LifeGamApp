import { useState } from 'react'
import { useAppStore } from '../../../state/useAppStore'
import { useModuleStore } from '../../../state/useModuleStore'
import { useFirmLabel } from '../../../lib/firmLabels'
import { useT } from '../../../lib/i18n/useT'
import { formatNip } from '../../../lib/polishTax'
import type { Firm } from '../../../lib/types'
import ConfirmModal from '../../common/ConfirmModal'
import FirmLogo from './FirmLogo'
import FirmModal from './FirmModal'

/** Choose which firm to open, or create, edit and delete firms. */
export default function FirmPickerModal({ onClose }: { onClose: () => void }): JSX.Element {
  const F = useFirmLabel()
  const t = useT()
  const firms = useAppStore((s) => s.data?.firms ?? [])
  const updateData = useAppStore((s) => s.updateData)
  const scope = useModuleStore((s) => s.scope)
  const setScope = useModuleStore((s) => s.setScope)
  const [editing, setEditing] = useState<Firm | 'new' | null>(firms.length === 0 ? 'new' : null)
  const [deleting, setDeleting] = useState<Firm | null>(null)

  function open(id: string): void {
    setScope(id)
    onClose()
  }

  function remove(firm: Firm): void {
    // Files kept with the firm (logo, receipts) go together with it.
    const files = [firm.logo, ...firm.ledger.events.flatMap((e) => e.attachments.map((a) => a.path))].filter(Boolean) as string[]
    for (const path of files) void window.api.attachments.remove(path)
    updateData((draft) => {
      draft.firms = (draft.firms ?? []).filter((f) => f.id !== firm.id)
    })
    if (scope === firm.id) setScope('personal')
    setDeleting(null)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card fin-modal">
        <h2>{F('firms.title')}</h2>
        <div className="fin-cp-list">
          {firms.length === 0 && <div className="fin-empty">{F('firms.empty')}</div>}
          {firms.map((f) => (
            <div key={f.id} className={`fin-cp-row firm-row${scope === f.id ? ' active' : ''}`}>
              <button type="button" className="firm-row-main" onClick={() => open(f.id)}>
                <FirmLogo name={f.name} logo={f.logo} size={32} />
                <span className="firm-row-text">
                  <span className="fin-cp-name">{f.name}</span>
                  <span className="fin-cp-meta">NIP {formatNip(f.nip)}</span>
                </span>
              </button>
              <button type="button" className="icon-btn" title={t('common.edit')} onClick={() => setEditing(f)}>
                ✎
              </button>
              <button type="button" className="icon-btn" title={t('common.delete')} onClick={() => setDeleting(f)}>
                🗑
              </button>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={() => setEditing('new')}>
            {F('firms.new')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>

        {editing && (
          <FirmModal
            firm={editing === 'new' ? undefined : editing}
            onClose={() => {
              const created = editing === 'new'
              setEditing(null)
              if (created && useModuleStore.getState().scope !== scope) onClose()
            }}
          />
        )}
        {deleting && (
          <ConfirmModal
            message={F('firms.deleteConfirm', { name: deleting.name })}
            onConfirm={() => remove(deleting)}
            onCancel={() => setDeleting(null)}
          />
        )}
      </div>
    </div>
  )
}
