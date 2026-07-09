import { useEffect } from 'react'
import { useAppStore } from './state/useAppStore'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import { THEMES } from './lib/themes'

export default function App(): JSX.Element {
  const username = useAppStore((s) => s.username)
  const data = useAppStore((s) => s.data)
  const status = useAppStore((s) => s.status)
  const init = useAppStore((s) => s.init)
  const theme = data?.theme
  const colorMode = data?.colorMode ?? 'dark'

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    const colors = THEMES[theme ?? 'violetAmber']
    document.documentElement.style.setProperty('--accent', colors.accent)
    document.documentElement.style.setProperty('--accent-2', colors.accent2)
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorMode)
  }, [colorMode])

  if (!username || !data) {
    // While a remembered session is still being restored, avoid flashing the login form.
    if (status === 'loading') return <></>
    return <AuthPage />
  }
  return <Dashboard />
}
