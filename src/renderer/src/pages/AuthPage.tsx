import { FormEvent, useState } from 'react'
import { useAppStore } from '../state/useAppStore'
import './AuthPage.css'

export default function AuthPage(): JSX.Element {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const login = useAppStore((s) => s.login)
  const register = useAppStore((s) => s.register)
  const status = useAppStore((s) => s.status)
  const error = useAppStore((s) => s.error)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (mode === 'login') {
      await login(username, password)
    } else {
      await register(username, password)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">LifeGam</h1>
        <p className="auth-subtitle">Геймификация твоей жизни</p>

        <div className="auth-tabs">
          <button
            className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => setMode('login')}
            type="button"
          >
            Вход
          </button>
          <button
            className={mode === 'register' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => setMode('register')}
            type="button"
          >
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Имя пользователя
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-submit" disabled={status === 'loading'}>
            {status === 'loading' ? '...' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>
      </div>
    </div>
  )
}
