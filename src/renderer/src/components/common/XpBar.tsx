import './XpBar.css'

interface Props {
  level: number
  xpIntoLevel: number
  xpForNextLevel: number
  color?: string
  size?: 'lg' | 'sm'
}

export default function XpBar({
  level,
  xpIntoLevel,
  xpForNextLevel,
  color,
  size = 'lg'
}: Props): JSX.Element {
  const pct = xpForNextLevel > 0 ? Math.min(100, (xpIntoLevel / xpForNextLevel) * 100) : 0

  return (
    <div className={`xp-bar xp-bar--${size}`}>
      <div className="xp-bar-level">{level} lvl</div>
      <div className="xp-bar-track">
        <div
          className="xp-bar-fill"
          style={{ width: `${pct}%`, background: color ?? 'var(--accent)' }}
        />
        <div className="xp-bar-label">
          {xpIntoLevel}/{xpForNextLevel}
        </div>
      </div>
    </div>
  )
}
