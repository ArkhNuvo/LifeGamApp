import { useEffect } from 'react'
import { useAppStore } from './state/useAppStore'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import { THEMES } from './lib/themes'

export default function App(): JSX.Element {
  const username = useAppStore((s) => s.username)
  const data = useAppStore((s) => s.data)
  const theme = data?.theme

  useEffect(() => {
    const colors = THEMES[theme ?? 'violetAmber']
    document.documentElement.style.setProperty('--accent', colors.accent)
    document.documentElement.style.setProperty('--accent-2', colors.accent2)
  }, [theme])

  if (!username || !data) {
    return <AuthPage />
  }
  return <Dashboard />
}
