import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { startPairing, checkPairingStatus } from '../../lib/telegramSync'
import { useT } from '../../lib/i18n/useT'
import './TelegramLinkModal.css'

interface Props {
  onClose: () => void
}

export default function TelegramLinkModal({ onClose }: Props): JSX.Element {
  const t = useT()
  const username = useAppStore((s) => s.username)
  const apiToken = useAppStore((s) => s.data?.telegram.apiToken ?? null)
  const updateData = useAppStore((s) => s.updateData)
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  async function handleStart(): Promise<void> {
    if (!username) return
    setError(null)
    try {
      const newCode = await startPairing(username)
      setCode(newCode)
      pollRef.current = setInterval(async () => {
        try {
          const token = await checkPairingStatus(newCode)
          if (token) {
            if (pollRef.current) clearInterval(pollRef.current)
            updateData((draft) => {
              draft.telegram.apiToken = token
            })
            setCode(null)
          }
        } catch {
          // transient network error while polling — try again next tick
        }
      }, 3000)
    } catch {
      setError(t('telegram.errorNetwork'))
    }
  }

  function handleUnlink(): void {
    updateData((draft) => {
      draft.telegram.apiToken = null
    })
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card telegram-modal">
        <h2>Telegram</h2>
        {apiToken ? (
          <>
            <p className="telegram-status telegram-status--ok">{t('telegram.connected')}</p>
            <p className="field-hint">{t('telegram.hintConnected')}</p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={onClose}>
                {t('common.close')}
              </button>
              <button type="button" className="btn btn-danger" onClick={handleUnlink}>
                {t('telegram.unlink')}
              </button>
            </div>
          </>
        ) : code ? (
          <>
            <p>{t('telegram.sendCommand')}</p>
            <div className="telegram-code">/link {code}</div>
            <p className="field-hint">{t('telegram.waiting')}</p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={onClose}>
                {t('common.close')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="field-hint">{t('telegram.hintDisconnected')}</p>
            {error && <div className="auth-error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleStart}>
                {t('telegram.connect')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
