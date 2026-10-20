import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../state/useAppStore'
import { useT } from '../lib/i18n/useT'
import type { TranslationKey } from '../lib/i18n'

const POLL_MS = 2500

type Stage =
  | { kind: 'starting' }
  | { kind: 'waiting'; id: string; code: string; bot: string }
  | { kind: 'found'; username: string }
  | { kind: 'error'; text: string }

/**
 * For when both the login and the password are forgotten: the app shows a
 * one-time code, the owner sends it to the bot from their Telegram, and the
 * account linked to that Telegram can then get a new password.
 */
export default function TelegramRecover({ remember, onClose }: { remember: boolean; onClose: () => void }): JSX.Element {
  const t = useT()
  const completeLogin = useAppStore((s) => s.completeLogin)
  const [stage, setStage] = useState<Stage>({ kind: 'starting' })
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    void window.api.auth.recoverStart().then((res) => {
      if (!alive.current) return
      if (!res.ok) setStage({ kind: 'error', text: t('auth.tgNetwork') })
      else setStage({ kind: 'waiting', id: res.id, code: res.code, bot: res.bot })
    })
    return () => {
      alive.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (stage.kind !== 'waiting') return
    const timer = setInterval(async () => {
      const res = await window.api.auth.recoverPoll(stage.id)
      if (!alive.current) return
      if (res.status === 'approved') {
        clearInterval(timer)
        setStage({ kind: 'found', username: res.username })
      } else if (res.status === 'no_local') {
        clearInterval(timer)
        setStage({ kind: 'error', text: t('auth.recoverNoLocal', { username: res.username }) })
      } else if (res.status === 'mismatch') {
        clearInterval(timer)
        setStage({ kind: 'error', text: t('auth.recoverMismatch') })
      } else if (res.status === 'expired') {
        clearInterval(timer)
        setStage({ kind: 'error', text: t('auth.tgExpired') })
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [stage, t])

  async function save(): Promise<void> {
    if (stage.kind !== 'found') return
    if (pw !== pw2) {
      setSaveError(t('auth.passwordsDiffer'))
      return
    }
    const res = await window.api.auth.resetPassword(stage.username, pw)
    if (!res.ok) {
      setSaveError(t(`auth.error.${res.error ?? 'login_failed'}` as TranslationKey))
      return
    }
    await completeLogin(stage.username, remember)
  }

  return (
    <div className="auth-telegram">
      {stage.kind === 'starting' && <p>…</p>}
      {stage.kind === 'waiting' && (
        <>
          <p>{t('auth.recoverIntro', { bot: stage.bot })}</p>
          <div className="auth-code">{stage.code}</div>
          <a className="auth-tg-open" href={`https://t.me/${stage.bot}?start=recover_${stage.code}`} target="_blank" rel="noreferrer">
            ✈ {t('auth.recoverOpen')}
          </a>
          <p className="field-hint">{t('auth.recoverCommand', { code: stage.code })}</p>
          <p className="auth-telegram-wait">
            <span className="auth-spinner" /> {t('auth.recoverWaiting')}
          </p>
        </>
      )}
      {stage.kind === 'error' && <div className="auth-error">{stage.text}</div>}
      {stage.kind === 'found' && (
        <div className="auth-form">
          <p>{t('auth.recoverFound', { username: stage.username })}</p>
          <label>
            {t('auth.newPassword')}
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
          </label>
          <label>
            {t('auth.repeatPassword')}
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </label>
          {saveError && <div className="auth-error">{saveError}</div>}
          <button type="button" className="auth-submit" onClick={() => void save()} disabled={!pw}>
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
