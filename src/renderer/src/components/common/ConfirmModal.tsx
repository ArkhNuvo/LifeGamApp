interface Props {
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ message, onConfirm, onCancel }: Props): JSX.Element {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Нет
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            Да
          </button>
        </div>
      </div>
    </div>
  )
}
