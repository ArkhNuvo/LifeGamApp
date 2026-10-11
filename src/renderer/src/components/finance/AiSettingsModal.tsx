import { useEffect, useState } from 'react'
import { useT } from '../../lib/i18n/useT'
import type { AiStatus } from '../../lib/types'

/** Where the user's own Claude API key is entered. The key is stored encrypted in the main process only. */
export default function AiSettingsModal({ onClose }: { onClose: (changed: boolean) => void }): JSX.Element {
  const t = useT()
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.ai.status().then((s) => {
      setStatus(s)
      setModel(s.model)
    })
  }, [])

  async function save(): Promise<void> {
    const result = await window.api.ai.setConfig({ apiKey: apiKey.trim() || undefined, model })
    if (!result.ok) {
      setError(t(result.error === 'invalid_key' ? 'fin.aiKeyInvalid' : 'fin.aiNoEncryption'))
      return
    }
    onClose(true)
  }

  async function clearKey(): Promise<void> {
    await window.api.ai.setConfig({ apiKey: null })
    onClose(true)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card fin-modal">
        <h2>{t('fin.aiSettingsTitle')}</h2>
        <div className="form-field">
          <label>{t('fin.aiKeyLabel')}</label>
          <input
            type="password"
            value={apiKey}
            placeholder={status?.hasKey ? '••••••••••••' : 'sk-ant-...'}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          <div className="field-hint">{status?.hasKey ? t('fin.aiKeySaved') : t('fin.aiKeyMissing')}</div>
        </div>
        <div className="form-field">
          <label>{t('fin.aiModelLabel')}</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
        <div className="field-hint">{t('fin.aiKeyHint')}</div>
        {error && <div className="field-hint fin-negative">{error}</div>}
        <div className="modal-actions">
          {status?.hasKey && (
            <button type="button" className="btn btn-danger" onClick={clearKey}>
              {t('fin.aiClear')}
            </button>
          )}
          <button type="button" className="btn" onClick={() => onClose(false)}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
