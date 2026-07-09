import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAppStore } from '../../state/useAppStore'
import { currentMonthKey } from '../../lib/month'
import ScopeSelector, { ALL_TIME_SCOPE } from './ScopeSelector'
import type { ColumnStatus } from '../../lib/types'
import { STATUS_LABEL_KEYS } from '../kanban/statusLabels'
import { useT } from '../../lib/i18n/useT'

const STATUS_COLOR: Record<ColumnStatus, string> = {
  TODO: '#7c5cff',
  PLANNED: '#4ea1ff',
  IN_PROGRESS: '#ffb454',
  DONE: '#34d1a0'
}

export default function StatusBreakdownWidget(): JSX.Element {
  const t = useT()
  const months = useAppStore((s) => s.data?.kanban.months ?? {})
  const monthOptions = Object.keys(months).sort()
  const [scope, setScope] = useState<string>(
    monthOptions.includes(currentMonthKey()) ? currentMonthKey() : ALL_TIME_SCOPE
  )

  const counts: Record<ColumnStatus, number> = { TODO: 0, PLANNED: 0, IN_PROGRESS: 0, DONE: 0 }
  const monthsToScan = scope === ALL_TIME_SCOPE ? Object.values(months) : months[scope] ? [months[scope]] : []
  monthsToScan.forEach((m) => {
    m.columns.forEach((col) => {
      counts[col.status] += col.cards.length
    })
  })
  const data = (Object.keys(counts) as ColumnStatus[]).map((status) => ({
    status: t(STATUS_LABEL_KEYS[status]),
    count: counts[status],
    color: STATUS_COLOR[status]
  }))
  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="widget-with-month">
      <ScopeSelector value={scope} monthOptions={monthOptions} onChange={setScope} />
      {total === 0 ? (
        <div className="widget-empty">{t('stats.emptyStatusPeriod')}</div>
      ) : (
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12 }}>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="status"
              width={88}
              tick={{ fill: 'var(--text-1)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 12 }}
            />
            <Bar dataKey="count" radius={4}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
