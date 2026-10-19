import { useMemo, useState } from 'react'
import { GROUP_ORDER, METRICS, PERIODS, metricDef, type ChartType, type MetricDef } from '../../lib/finStats'
import { useStatsLabel } from '../../lib/statsLabels'
import type { FinWidgetConfig } from '../../lib/types'
import { useAccounts } from './useFinance'

interface Props {
  /** The widget being edited; omitted when adding. */
  initial?: FinWidgetConfig
  onSave: (draft: Pick<FinWidgetConfig, 'metric' | 'chart' | 'period' | 'accountId' | 'title'>, def: MetricDef) => void
  onClose: () => void
}

/** Pick a metric from the catalogue, then a chart that suits it, a period and an optional account. */
export default function StatsWidgetModal({ initial, onSave, onClose }: Props): JSX.Element {
  const L = useStatsLabel()
  const accounts = useAccounts()
  const [metric, setMetric] = useState(initial?.metric ?? 'expense_by_category')
  const [chart, setChart] = useState<ChartType>((initial?.chart as ChartType) ?? 'donut')
  const [period, setPeriod] = useState(initial?.period ?? 'month')
  const [accountId, setAccountId] = useState(initial?.accountId ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [query, setQuery] = useState('')

  const def = metricDef(metric) ?? METRICS[0]
  const needle = query.trim().toLowerCase()
  const groups = useMemo(
    () =>
      GROUP_ORDER.map((id) => ({
        id,
        items: METRICS.filter((m) => m.group === id && (!needle || L(`m.${m.id}`).toLowerCase().includes(needle)))
      })).filter((g) => g.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [needle, L]
  )

  function pick(m: MetricDef): void {
    if (m.unavailable) return
    setMetric(m.id)
    // Keep the current chart when it suits the new metric, else use the metric's default.
    if (!m.charts.includes(chart)) setChart(m.charts[0])
    if (!m.accountFilter) setAccountId('')
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card fin-modal fin-modal--wide fin-widget-modal">
        <h2>{initial ? L('ui.editWidget') : L('ui.newWidget')}</h2>

        <div className="fin-widget-modal-grid">
          <div className="fin-widget-metrics">
            <input value={query} placeholder={L('ui.search')} onChange={(e) => setQuery(e.target.value)} />
            <div className="fin-widget-metric-list">
              {groups.map((g) => (
                <div key={g.id}>
                  <div className="fin-group-title">{L(`group.${g.id}`)}</div>
                  {g.items.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!!m.unavailable}
                      title={m.unavailable ? `${L('ui.unavailable')}: ${L(m.unavailable)}` : undefined}
                      className={`fin-widget-metric${metric === m.id ? ' active' : ''}`}
                      onClick={() => pick(m)}
                    >
                      {L(`m.${m.id}`)}
                      {m.unavailable && <small> · {L(m.unavailable)}</small>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="fin-widget-options">
            <div className="form-field">
              <label>{L('ui.chart')}</label>
              <div className="fin-widget-chart-picker">
                {def.charts.map((c) => (
                  <button key={c} type="button" className={`btn${chart === c ? ' btn-primary' : ''}`} onClick={() => setChart(c)}>
                    {L(`chart.${c}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-field">
              <label>{L('ui.period')}</label>
              <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                {PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {L(`period.${p}`)}
                  </option>
                ))}
              </select>
            </div>
            {def.accountFilter && (
              <div className="form-field">
                <label>{L('ui.account')}</label>
                <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  <option value="">{L('ui.allAccounts')}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-field">
              <label>{L('ui.title')}</label>
              <input value={title} placeholder={L(`m.${metric}`)} onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            {L('ui.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSave({ metric, chart, period, accountId: accountId || null, title: title.trim() }, def)}
          >
            {initial ? L('ui.save') : L('ui.add')}
          </button>
        </div>
      </div>
    </div>
  )
}
