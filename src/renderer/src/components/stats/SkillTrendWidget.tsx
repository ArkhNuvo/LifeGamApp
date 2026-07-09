import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAppStore } from '../../state/useAppStore'
import { skillXpForMonth } from '../../lib/skillXpByMonth'
import { formatMonthLabel } from '../../lib/month'
import { useT } from '../../lib/i18n/useT'

export default function SkillTrendWidget(): JSX.Element {
  const t = useT()
  const skills = useAppStore((s) => s.data?.skills ?? [])
  const months = useAppStore((s) => s.data?.kanban.months ?? {})
  const [selected, setSelected] = useState<Set<string> | null>(null)

  const monthKeys = Object.keys(months).sort()
  const selectedIds = selected ?? new Set(skills.map((s) => s.id))

  const chartData = useMemo(() => {
    const running: Record<string, number> = {}
    return monthKeys.map((key) => {
      const gained = skillXpForMonth(months, key)
      const point: Record<string, number | string> = { month: formatMonthLabel(key, t) }
      for (const skill of skills) {
        running[skill.id] = (running[skill.id] ?? 0) + (gained[skill.id] ?? 0)
        point[skill.id] = running[skill.id]
      }
      return point
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, skills, t])

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev ?? skills.map((s) => s.id))
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll(): void {
    setSelected((prev) => {
      const cur = prev ?? new Set(skills.map((s) => s.id))
      return cur.size === skills.length ? new Set() : new Set(skills.map((s) => s.id))
    })
  }

  if (skills.length === 0) {
    return <div className="widget-empty">{t('stats.emptyTrendNoSkills')}</div>
  }
  if (monthKeys.length === 0) {
    return <div className="widget-empty">{t('stats.emptyTrendNoMonths')}</div>
  }

  return (
    <div className="trend-widget">
      <div className="trend-skill-list">
        <label className="trend-skill-item">
          <input type="checkbox" checked={selectedIds.size === skills.length} onChange={toggleAll} />
          <span>{t('stats.trendAllLabel')}</span>
        </label>
        {skills.map((skill) => (
          <label className="trend-skill-item" key={skill.id}>
            <input type="checkbox" checked={selectedIds.has(skill.id)} onChange={() => toggle(skill.id)} />
            <span style={{ color: skill.color }}>{skill.name}</span>
          </label>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={chartData}>
          <XAxis dataKey="month" tick={{ fill: 'var(--text-2)', fontSize: 9 }} />
          <YAxis tick={{ fill: 'var(--text-2)', fontSize: 9 }} allowDecimals={false} />
          <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 12 }} />
          {skills
            .filter((s) => selectedIds.has(s.id))
            .map((skill) => (
              <Line
                key={skill.id}
                type="monotone"
                dataKey={skill.id}
                name={skill.name}
                stroke={skill.color}
                dot={false}
                strokeWidth={2}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
