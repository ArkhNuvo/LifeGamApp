import { useEffect, useState } from 'react'
import TitlePanel from '../components/title/TitlePanel'
import SkillList from '../components/skills/SkillList'
import MainPanel from '../components/main/MainPanel'
import DailyCheckinModal from '../components/title/DailyCheckinModal'
import { useAppStore } from '../state/useAppStore'
import { useModuleStore } from '../state/useModuleStore'
import FinanceModule from '../components/finance/FinanceModule'
import { todayISO } from '../lib/date'
import { syncWithTelegram } from '../lib/telegramSync'
import './Dashboard.css'

const SYNC_INTERVAL_MS = 10 * 1000

export default function Dashboard(): JSX.Element {
  const lastCheckinDate = useAppStore((s) => s.data?.energy.lastCheckinDate ?? null)
  const [dismissed, setDismissed] = useState(false)
  const showCheckin = !dismissed && lastCheckinDate !== todayISO()
  const apiToken = useAppStore((s) => s.data?.telegram.apiToken ?? null)
  const module = useModuleStore((s) => s.module)

  useEffect(() => {
    if (!apiToken) return

    const sync = (): void => {
      syncWithTelegram(apiToken)
    }

    sync()
    const interval = setInterval(sync, SYNC_INTERVAL_MS)
    window.addEventListener('focus', sync)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', sync)
    }
  }, [apiToken])

  return (
    <div className="dashboard">
      {module === 'finance' ? (
        <FinanceModule />
      ) : (
        <>
          <div className="dashboard-left">
            <TitlePanel />
            <SkillList />
          </div>
          <div className="dashboard-right">
            <MainPanel />
          </div>
        </>
      )}
      {showCheckin && <DailyCheckinModal onClose={() => setDismissed(true)} />}
    </div>
  )
}
