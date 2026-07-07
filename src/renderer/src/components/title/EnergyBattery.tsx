interface Props {
  percent: number
}

function colorFor(pct: number): string {
  if (pct >= 60) return 'var(--accent-2)'
  if (pct >= 30) return 'var(--warn)'
  return 'var(--danger)'
}

export default function EnergyBattery({ percent }: Props): JSX.Element {
  const color = colorFor(percent)
  const fillWidth = Math.max(0, Math.min(100, percent))

  return (
    <div className="energy-row">
      <svg width="52" height="26" viewBox="0 0 52 26" className="energy-icon">
        <rect x="1" y="1" width="44" height="24" rx="4" fill="none" stroke="var(--text-2)" strokeWidth="2" />
        <rect x="46" y="8" width="5" height="10" rx="1.5" fill="var(--text-2)" />
        <rect x="4" y="4" width={38 * (fillWidth / 100)} height="18" rx="2" fill={color} />
        <line x1="14.5" y1="1" x2="14.5" y2="25" stroke="var(--bg-1)" strokeWidth="1" opacity="0.5" />
        <line x1="24.5" y1="1" x2="24.5" y2="25" stroke="var(--bg-1)" strokeWidth="1" opacity="0.5" />
        <line x1="34.5" y1="1" x2="34.5" y2="25" stroke="var(--bg-1)" strokeWidth="1" opacity="0.5" />
      </svg>
      <span className="energy-percent" style={{ color }}>
        {Math.round(percent)}%
      </span>
    </div>
  )
}
