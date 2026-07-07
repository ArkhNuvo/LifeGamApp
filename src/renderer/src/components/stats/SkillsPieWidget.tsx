import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useAppStore } from '../../state/useAppStore'
import { totalSkillXp } from '../../lib/skillXp'
import { skillXpForMonth } from '../../lib/skillXpByMonth'
import ScopeSelector, { ALL_TIME_SCOPE } from './ScopeSelector'

export default function SkillsPieWidget(): JSX.Element {
  const skills = useAppStore((s) => s.data?.skills ?? [])
  const months = useAppStore((s) => s.data?.kanban.months ?? {})
  const [scope, setScope] = useState<string>(ALL_TIME_SCOPE)
  const monthOptions = Object.keys(months).sort()

  const monthXp = scope !== ALL_TIME_SCOPE ? skillXpForMonth(months, scope) : null

  const data = skills
    .map((s) => ({
      name: s.name,
      value: monthXp ? monthXp[s.id] ?? 0 : totalSkillXp(s),
      color: s.color
    }))
    .filter((d) => d.value > 0)

  return (
    <div className="widget-with-month">
      <ScopeSelector value={scope} monthOptions={monthOptions} onChange={setScope} />
      {data.length === 0 ? (
        <div className="widget-empty">Пока нет опыта по навыкам</div>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={28} outerRadius={55} paddingAngle={2}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
