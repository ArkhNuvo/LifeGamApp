import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../state/useAppStore'
import { useT } from '../lib/i18n/useT'
import type { TranslationKey } from '../lib/i18n'

const POLL_MS = 2000

interface Props {
  purpose: 'login' | 'reset'
  username: string
  remember: boolean
  onClose: () => void
}

type Stage =
  | { kind: 'starting' }
  | { kind: 'waiting'; id: string }
  | { kind: 'newPassword'; username: string }
  | { kind: 'error'; key: TranslationKey }

/**
 * Signing in — or resetting a forgotten password — by confirming in the
 * Telegram bot linked to the account, instead of typing the password.
 */
export default function TelegramAuth({ purpose, username, remember, onClose }: Props): JSX.Element {
  const t = useT()
  const completeLogin = useAppStore((s) => s.completeLogin)
  const [stage, setStage] = useState<Stage>({ kind: 'starting' })
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [saveError, setSaveError] = useState<TranslationKey | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    void (async () => {
      const res = await window.api.auth.telegramStart(username, purpose)
      if (!alive.current) return
      if (!res.ok) {
        setStage({
          kind: 'error',
          key: res.error === 'not_linked' ? 'auth.tgNotLinked' : res.error === 'user_not_found' ? 'auth.error.user_not_found' : 'auth.tgNetwork'
        })
        return
      }
      setStage({ kind: 'waiting', id: res.id })
    })()
    return () => {
      alive.current = false
    }
  }, [username, purpose])

  useEffect(() => {
    if (stage.kind !== 'waiting') return
    const timer = setInterval(async () => {
      const res = await window.api.auth.telegramPoll(stage.id)
      if (!alive.current) return
      if (res.status === 'approved') {
        clearInterval(timer)
        if (res.purpose === 'login') void completeLogin(res.username, remember)
        else setStage({ kind: 'newPassword', username: res.username })
      } else if (res.status === 'denied' || res.status === 'expired') {
        clearInterval(timer)
        setStage({ kind: 'error', key: res.status === 'denied' ? 'auth.tgDenied' : 'auth.tgExpired' })
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [stage, remember, completeLogin])

  async function savePassword(): Promise<void> {
    if (stage.kind !== 'newPassword') return
    if (pw !== pw2) {
      setSaveError('auth.passwordsDiffer')
      return
    }
    const res = await window.api.auth.resetPassword(stage.username, pw)
    if (!res.ok) {
      setSaveError(`auth.error.${res.error ?? 'login_failed'}` as TranslationKey)
      return
    }
    await completeLogin(stage.username, remember)
  }

  return (
    <div className="auth-telegram">
      {stage.kind === 'starting' && <p>…</p>}
      {stage.kind === 'waiting' && (
        <p className="auth-telegram-wait">
          <span className="auth-spinner" /> {t(purpose === 'login' ? 'auth.tgWaiting' : 'auth.tgWaitingReset')}
        </p>
      )}
      {stage.kind === 'error' && <div className="auth-error">{t(stage.key)}</div>}
      {stage.kind === 'newPassword' && (
        <div className="auth-form">
          <label>
            {t('auth.newPassword')}
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
          </label>
          <label>
            {t('auth.repeatPassword')}
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </label>
          {saveError && <div className="auth-error">{t(saveError)}</div>}
          <button type="button" className="auth-submit" onClick={() => void savePassword()} disabled={!pw}>
            {t('auth.savePassword')}
          </button>
        </div>
      )}
      <button type="button" className="auth-link" onClick={onClose}>
        {t('auth.tgCancel')}
      </button>
    </div>
  )
}
