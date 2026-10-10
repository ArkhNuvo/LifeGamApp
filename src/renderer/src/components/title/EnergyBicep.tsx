import './EnergyGauge.css'

interface Props {
  percent: number
}

function colorFor(pct: number): string {
  if (pct >= 60) return 'var(--accent-2)'
  if (pct >= 30) return 'var(--warn)'
  return 'var(--danger)'
}

export default function EnergyBicep({ percent }: Props): JSX.Element {
  const clamped = Math.max(0, Math.min(100, percent))
  const color = colorFor(percent)

  return (
    <div className="energy-row">
      <div className="emoji-gauge" style={{ ['--pct' as string]: `${clamped}%` }}>
        <span className="emoji-gauge-bg">💪</span>
        <span className="emoji-gauge-fill">💪</span>
      </div>
      <span className="energy-percent" style={{ color }}>
        {Math.round(percent)}%
      </span>
    </div>
  )
}
