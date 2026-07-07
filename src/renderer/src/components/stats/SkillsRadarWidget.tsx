import { useState } from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { useAppStore } from '../../state/useAppStore'
import { totalSkillXp } from '../../lib/skillXp'
import { skillXpForMonth } from '../../lib/skillXpByMonth'
import ScopeSelector, { ALL_TIME_SCOPE } from './ScopeSelector'

export default function SkillsRadarWidget(): JSX.Element {
  const skills = useAppStore((s) => s.data?.skills ?? [])
  const months = useAppStore((s) => s.data?.kanban.months ?? {})
  const [scope, setScope] = useState<string>(ALL_TIME_SCOPE)
  const monthOptions = Object.keys(months).sort()

  const monthXp = scope !== ALL_TIME_SCOPE ? skillXpForMonth(months, scope) : null

  const data = skills.map((s) => ({
    skill: s.name,
    xp: monthXp ? monthXp[s.id] ?? 0 : totalSkillXp(s)
  }))

  return (
    <div className="widget-with-month">
      <ScopeSelector value={scope} monthOptions={monthOptions} onChange={setScope} />
      {data.length < 3 ? (
        <div className="widget-empty">Добавь хотя бы 3 навыка, чтобы увидеть розу ветров</div>
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          <RadarChart data={data} outerRadius="70%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="skill" tick={{ fill: 'var(--text-1)', fontSize: 10 }} />
            <PolarRadiusAxis tick={{ fill: 'var(--text-2)', fontSize: 9 }} axisLine={false} />
            <Radar dataKey="xp" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.4} />
            <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 12 }} />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
