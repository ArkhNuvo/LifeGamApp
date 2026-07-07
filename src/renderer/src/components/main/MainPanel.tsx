import { useState } from 'react'
import Board from '../kanban/Board'
import StatsGrid from '../stats/StatsGrid'
import ThemeSwitcher from '../common/ThemeSwitcher'
import TelegramLinkModal from '../common/TelegramLinkModal'
import { useAppStore } from '../../state/useAppStore'
import { syncWithTelegram } from '../../lib/telegramSync'
import './MainPanel.css'

type Tab = 'kanban' | 'stats'

export default function MainPanel(): JSX.Element {
  const [tab, setTab] = useState<Tab>('kanban')
  const username = useAppStore((s) => s.username)
  const logout = useAppStore((s) => s.logout)
  const apiToken = useAppStore((s) => s.data?.telegram.apiToken ?? null)
  const [telegramOpen, setTelegramOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)

  async function handleRefresh(): Promise<void> {
    if (!apiToken || syncing) return
    setSyncing(true)
    await syncWithTelegram(apiToken)
    setSyncing(false)
  }

  return (
    <div className="main-panel">
      <div className="main-panel-topbar">
        <div className="main-panel-tabs">
          <button
            type="button"
            className={tab === 'kanban' ? 'main-tab active' : 'main-tab'}
            onClick={() => setTab('kanban')}
          >
            Kanban
          </button>
          <button
            type="button"
            className={tab === 'stats' ? 'main-tab active' : 'main-tab'}
            onClick={() => setTab('stats')}
          >
            Stats
          </button>
        </div>
        <div className="main-panel-user">
          {apiToken && (
            <button
              type="button"
              className="icon-btn"
              onClick={handleRefresh}
              disabled={syncing}
              title="Проверить новые карточки из Telegram сейчас"
            >
              {syncing ? '⏳' : '🔄'}
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={() => setTelegramOpen(true)}
            title={apiToken ? 'Telegram подключён' : 'Подключить Telegram'}
          >
            {apiToken ? '🔗' : '📱'}
          </button>
          <ThemeSwitcher />
          <span>{username}</span>
          <button type="button" className="btn" onClick={logout}>
            Выйти
          </button>
        </div>
      </div>
      <div className="main-panel-body">{tab === 'kanban' ? <Board /> : <StatsGrid />}</div>
      {telegramOpen && <TelegramLinkModal onClose={() => setTelegramOpen(false)} />}
    </div>
  )
}
