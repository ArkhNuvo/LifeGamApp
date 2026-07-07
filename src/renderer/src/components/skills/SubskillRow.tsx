import { getLevelProgress } from '../../lib/xpCurve'
import XpBar from '../common/XpBar'
import type { Subskill } from '../../lib/types'

interface Props {
  subskill: Subskill
  color: string
  onDelete: () => void
}

export default function SubskillRow({ subskill, color, onDelete }: Props): JSX.Element {
  const progress = getLevelProgress(subskill.xp)

  return (
    <div className="subskill-row">
      <div className="subskill-name">{subskill.name}</div>
      <XpBar
        level={progress.level}
        xpIntoLevel={progress.xpIntoLevel}
        xpForNextLevel={progress.xpForNextLevel}
        color={color}
        size="sm"
      />
      <button type="button" className="icon-btn subskill-delete" onClick={onDelete} title="Удалить подскилл">
        ×
      </button>
    </div>
  )
}
