import { useT } from '../../lib/i18n/useT'

interface Props {
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ message, onConfirm, onCancel }: Props): JSX.Element {
  const t = useT()
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {t('common.no')}
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            {t('common.yes')}
          </button>
        </div>
      </div>
    </div>
  )
}
