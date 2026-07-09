import { useAppStore } from '../../state/useAppStore'
import { getLevelProgress } from '../../lib/xpCurve'
import AvatarUpload from './AvatarUpload'
import DisplayName from './DisplayName'
import XpBar from '../common/XpBar'
import './TitleHeader.css'

export default function TitleHeader(): JSX.Element {
  const totalXp = useAppStore((s) => s.data?.totalXp ?? 0)
  const progress = getLevelProgress(totalXp)

  return (
    <div className="title-header">
      <AvatarUpload />
      <div className="title-header-info">
        <DisplayName />
        <XpBar
          level={progress.level}
          xpIntoLevel={progress.xpIntoLevel}
          xpForNextLevel={progress.xpForNextLevel}
          size="lg"
        />
      </div>
    </div>
  )
}
