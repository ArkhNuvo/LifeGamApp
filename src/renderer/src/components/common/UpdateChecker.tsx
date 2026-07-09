import { useEffect, useState } from 'react'
import { useT } from '../../lib/i18n/useT'
import type { UpdateStatus } from '../../lib/types'
import './UpdateChecker.css'

export default function UpdateChecker(): JSX.Element {
  const t = useT()
  const [status, setStatus] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    return window.api.updates.onStatus((s) => {
      setStatus(s)
      if (s.state === 'not-available' || s.state === 'error' || s.state === 'dev-unavailable') {
        setTimeout(() => setStatus((cur) => (cur === s ? null : cur)), 4000)
      }
    })
  }, [])

  const busy = status?.state === 'checking' || status?.state === 'downloading'

  function handleClick(): void {
    if (status?.state === 'downloaded') {
      window.api.updates.quitAndInstall()
      return
    }
    if (busy) return
    window.api.updates.check()
  }

  function icon(): string {
    switch (status?.state) {
      case 'checking':
        return '⏳'
      case 'not-available':
        return '✅'
      case 'available':
      case 'downloading':
        return '⬇️'
      case 'downloaded':
        return '🔁'
      case 'error':
        return '⚠️'
      case 'dev-unavailable':
        return 'ℹ️'
      default:
        return '🔄'
    }
  }

  function tooltip(): string {
    switch (status?.state) {
      case 'checking':
        return t('updates.checking')
      case 'not-available':
        return t('updates.upToDate')
      case 'available':
        return t('updates.available', { version: status.version })
      case 'downloading':
        return t('updates.downloading', { percent: status.percent })
      case 'downloaded':
        return t('updates.readyRestart', { version: status.version })
      case 'error':
        return t('updates.error')
      case 'dev-unavailable':
        return t('updates.devUnavailable')
      default:
        return t('updates.checkTooltip')
    }
  }

  return (
    <button type="button" className="icon-btn" onClick={handleClick} disabled={busy} title={tooltip()}>
      {icon()}
      {status?.state === 'downloading' && <span className="update-percent">{status.percent}%</span>}
    </button>
  )
}
