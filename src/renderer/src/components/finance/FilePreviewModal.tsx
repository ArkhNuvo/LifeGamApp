import { useEffect, useState } from 'react'
import { useT } from '../../lib/i18n/useT'
import type { Attachment } from '../../lib/types'
import FileViewer from './FileViewer'

interface Props {
  /** Stored attachments to browse, or a single in-memory file that isn't saved yet. */
  attachments?: Attachment[]
  draft?: { name: string; mime: string; dataUrl: string }
  onClose: () => void
}

/** Full-size look at a document, to check what the AI read against the original. */
export default function FilePreviewModal({ attachments = [], draft, onClose }: Props): JSX.Element {
  const t = useT()
  const [index, setIndex] = useState(0)
  const [dataUrl, setDataUrl] = useState<string | null>(draft?.dataUrl ?? null)
  const [error, setError] = useState(false)
  const current = draft ?? attachments[index]

  useEffect(() => {
    if (draft || !attachments[index]) return
    setDataUrl(null)
    setError(false)
    window.api.attachments
      .read(attachments[index].path)
      .then(setDataUrl)
      .catch(() => setError(true))
  }, [attachments, index, draft])

  return (
    <div className="modal-overlay">
      <div className="modal-card fin-preview">
        <div className="fin-preview-head">
          <h2>{current?.name ?? t('fin.docViewTitle')}</h2>
          {attachments.length > 1 && !draft && (
            <div className="fin-chips">
              {attachments.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  className={i === index ? 'fin-chip active' : 'fin-chip'}
                  onClick={() => setIndex(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="fin-preview-body">
          {error && <div className="fin-empty">{t('fin.docMissing')}</div>}
          {dataUrl && current && <FileViewer dataUrl={dataUrl} mime={current.mime} name={current.name} large />}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
