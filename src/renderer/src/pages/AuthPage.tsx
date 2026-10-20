import { FormEvent, useState } from 'react'
import { useAppStore } from '../state/useAppStore'
import LanguageSwitcher from '../components/common/LanguageSwitcher'
import { useT } from '../lib/i18n/useT'
import type { TranslationKey } from '../lib/i18n'
import TelegramAuth from './TelegramAuth'
import TelegramRecover from './TelegramRecover'
import './AuthPage.css'

export default function AuthPage(): JSX.Element {
  const t = useT()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [telegram, setTelegram] = useState<'login' | 'reset' | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [needName, setNeedName] = useState(false)
  const login = useAppStore((s) => s.login)
  const register = useAppStore((s) => s.register)
  const status = useAppStore((s) => s.status)
  const error = useAppStore((s) => s.error)

  function startTelegram(purpose: 'login' | 'reset'): void {
    // The request goes to the Telegram chat linked to this account, so the account must be named.
    if (!username.trim()) {
      setNeedName(true)
      return
    }
    setNeedName(false)
    setTelegram(purpose)
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (mode === 'login') {
      await login(username, password, remember)
    } else {
      await register(username, password, remember)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-language-corner">
          <LanguageSwitcher />
        </div>
        <h1 className="auth-title">LifeGam</h1>
        <p className="auth-subtitle">{t('auth.subtitle')}</p>

        <div className="auth-tabs">
          <button
            className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => setMode('login')}
            type="button"
          >
            {t('auth.tabLogin')}
          </button>
          <button
            className={mode === 'register' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => setMode('register')}
            type="button"
          >
            {t('auth.tabRegister')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            {t('auth.usernameLabel')}
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </label>
          <label>
            {t('auth.passwordLabel')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label className="auth-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            {t('auth.rememberMe')}
          </label>
          {error && <div className="auth-error">{t(`auth.error.${error}` as TranslationKey)}</div>}
          <button type="submit" className="auth-submit" disabled={status === 'loading'}>
            {status === 'loading'
              ? t('auth.submitLoading')
              : mode === 'login'
                ? t('auth.submitLogin')
                : t('auth.submitRegister')}
          </button>
        </form>

        {mode === 'login' && !telegram && !recovering && (
          <div className="auth-alt">
            <button type="button" className="auth-link" onClick={() => startTelegram('login')}>
              ✈ {t('auth.tgLogin')}
            </button>
            <button type="button" className="auth-link" onClick={() => startTelegram('reset')}>
              {t('auth.forgot')}
            </button>
          </div>
        )}
        {mode === 'login' && !telegram && !recovering && (
          <button type="button" className="auth-link auth-link--center" onClick={() => setRecovering(true)}>
            {t('auth.recoverAll')}
          </button>
        )}
        {recovering && <TelegramRecover remember={remember} onClose={() => setRecovering(false)} />}
        {needName && !telegram && <div className="auth-error">{t('auth.tgNeedUsername')}</div>}
        {telegram && (
          <TelegramAuth purpose={telegram} username={username.trim()} remember={remember} onClose={() => setTelegram(null)} />
        )}
      </div>
    </div>
  )
}
