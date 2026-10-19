import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  Treemap,
  XAxis,
  YAxis
} from 'recharts'
import { formatValue, type MetricResult, type StatsContext } from '../../lib/finStats'
import type { FinWidgetConfig } from '../../lib/types'

const PALETTE = ['#6c8cff', '#34d1a0', '#ffb74d', '#ff5c72', '#b388ff', '#4dd0e1', '#f06292', '#a1887f', '#9e9e9e']
const UP = '#34d1a0'
const DOWN = '#ff5c72'
const GRID = 'rgba(128,128,128,0.25)'

const compact = (n: number): string =>
  Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : Math.abs(n) >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n * 10) / 10)

function Empty({ text }: { text: string }): JSX.Element {
  return <div className="fin-empty fin-widget-empty">{text}</div>
}

function Spark({ values }: { values: number[] }): JSX.Element {
  const data = values.map((v, i) => ({ i, v }))
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
        <Line type="monotone" dataKey="v" stroke={PALETTE[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function Tile({ result, ctx }: { result: MetricResult; ctx: StatsContext }): JSX.Element {
  const v = result.value
  if (!v) return <Empty text={ctx.L('d.noChart')} />
  const delta = v.delta
  return (
    <div className="fin-widget-tile">
      <div className="fin-widget-tile-value">{formatValue(ctx, v)}</div>
      {delta != null && (
        <div className="fin-widget-tile-delta" style={{ color: delta >= 0 ? UP : DOWN }}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))}%
        </div>
      )}
      {result.note && <div className="fin-widget-note">{result.note}</div>}
      {v.spark && v.spark.length > 1 && (
        <div className="fin-widget-spark">
          <Spark values={v.spark} />
        </div>
      )}
    </div>
  )
}

function Progress({ result, ctx }: { result: MetricResult; ctx: StatsContext }): JSX.Element {
  const v = result.value
  if (!v) return <Empty text={ctx.L('d.noChart')} />
  const target = v.target ?? Math.max(v.value, 1)
  const ratio = Math.min(1, v.value / target)
  return (
    <div className="fin-widget-progress">
      <div className="fin-widget-tile-value">{formatValue(ctx, v)}</div>
      <div className="fin-progress">
        <div className="fin-progress-bar" style={{ width: `${ratio * 100}%`, background: ratio >= 1 ? UP : PALETTE[0] }} />
      </div>
      <div className="fin-widget-note">
        {ctx.L('d.target')}: {v.format === 'percent' ? `${target}%` : target}
      </div>
    </div>
  )
}

function SeriesChart({ chart, result, w, ctx }: { chart: string; result: MetricResult; w: FinWidgetConfig; ctx: StatsContext }): JSX.Element {
  const s = result.series
  if (!s || s.labels.length === 0) return <Empty text={result.note ?? ctx.L('d.noData')} />
  const data = s.labels.map((label, i) => {
    const row: Record<string, string | number | null> = { label }
    for (const item of s.series) row[item.key] = item.values[i] ?? null
    return row
  })
  const common = { data, margin: { top: 8, right: 8, left: 0, bottom: 0 } }
  const axes = (
    <>
      <CartesianGrid stroke={GRID} vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
      <YAxis tick={{ fontSize: 11 }} tickFormatter={compact} width={42} />
      <Tooltip formatter={(value) => (typeof value === 'number' ? value.toLocaleString() : String(value))} />
      {s.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
    </>
  )
  const stack = w.metric === 'category_by_month' ? 'a' : undefined
  let body: JSX.Element
  if (chart === 'area') {
    body = (
      <AreaChart {...common}>
        {axes}
        {s.series.map((item, i) => (
          <Area key={item.key} type="monotone" dataKey={item.key} name={item.name} stackId={stack} stroke={PALETTE[i % PALETTE.length]} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.25} connectNulls={false} />
        ))}
      </AreaChart>
    )
  } else if (chart === 'line') {
    body = (
      <LineChart {...common}>
        {axes}
        {s.series.map((item, i) => (
          <Line key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={s.labels.length < 20} strokeDasharray={item.key === 'forecast' ? '5 4' : undefined} connectNulls={false} />
        ))}
      </LineChart>
    )
  } else if (chart === 'diverging') {
    const first = s.series[0]
    body = (
      <BarChart {...common}>
        {axes}
        <Bar dataKey={first.key} name={first.name}>
          {data.map((row, i) => (
            <Cell key={i} fill={Number(row[first.key]) >= 0 ? UP : DOWN} />
          ))}
        </Bar>
      </BarChart>
    )
  } else {
    const incomeExpense = w.metric === 'income_expense'
    body = (
      <BarChart {...common}>
        {axes}
        {s.series.map((item, i) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.name}
            stackId={chart === 'stacked' ? 'a' : undefined}
            fill={incomeExpense ? (item.key === 'income' ? UP : DOWN) : PALETTE[i % PALETTE.length]}
            radius={chart === 'stacked' ? 0 : [3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    )
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      {body}
    </ResponsiveContainer>
  )
}

function PartsChart({ chart, result, ctx, invert }: { chart: string; result: MetricResult; ctx: StatsContext; invert: boolean }): JSX.Element {
  const parts = result.parts
  if (!parts || parts.length === 0) return <Empty text={ctx.L('d.noData')} />
  const fmtValue = (n: number): string => formatValue(ctx, { value: n, format: 'money' })
  if (chart === 'donut') {
    const positive = parts.filter((p) => p.value > 0)
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={positive} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={1} isAnimationActive={false}>
            {positive.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => fmtValue(Number(value))} />
          <Legend wrapperStyle={{ fontSize: 11 }} layout="vertical" align="right" verticalAlign="middle" />
        </PieChart>
      </ResponsiveContainer>
    )
  }
  if (chart === 'treemap') {
    const data = parts.filter((p) => p.value > 0).map((p, i) => ({ name: p.name, size: p.value, fill: PALETTE[i % PALETTE.length] }))
    return (
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data}
          dataKey="size"
          nameKey="name"
          isAnimationActive={false}
          content={(props: { x?: number; y?: number; width?: number; height?: number; name?: string; fill?: string }) => (
            <g>
              <rect x={props.x} y={props.y} width={props.width} height={props.height} fill={props.fill} stroke="rgba(0,0,0,0.25)" />
              {(props.width ?? 0) > 54 && (props.height ?? 0) > 24 && (
                <text x={(props.x ?? 0) + 6} y={(props.y ?? 0) + 16} fontSize={11} fill="#fff">
                  {props.name}
                </text>
              )}
            </g>
          )}
        />
      </ResponsiveContainer>
    )
  }
  const horizontal = chart === 'hbar'
  const signed = chart === 'diverging' || parts.some((p) => p.value < 0)
  // Signed bars: green is good — except where a rise is bad news (a category spending more).
  const colorFor = (p: { value: number }, i: number): string =>
    signed ? ((p.value >= 0) !== invert ? UP : DOWN) : PALETTE[i % PALETTE.length]
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={parts} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, left: horizontal ? 8 : 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={compact} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={96} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={parts.length > 6 ? -30 : 0} height={parts.length > 6 ? 50 : 24} textAnchor={parts.length > 6 ? 'end' : 'middle'} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={compact} width={42} />
          </>
        )}
        <Tooltip formatter={(value) => Number(value).toLocaleString()} />
        <Bar dataKey="value" name={ctx.L('d.amount')} radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]} isAnimationActive={false}>
          {parts.map((p, i) => (
            <Cell key={i} fill={colorFor(p, i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function Heat({ result, ctx }: { result: MetricResult; ctx: StatsContext }): JSX.Element {
  const h = result.heat
  if (!h) return <Empty text={ctx.L('d.noChart')} />
  const max = Math.max(1, ...h.cells.flat())
  return (
    <div className="fin-heat" style={{ gridTemplateColumns: `auto repeat(${h.xLabels.length}, 1fr)` }}>
      <span />
      {h.xLabels.map((x) => (
        <span key={x} className="fin-heat-x">
          {x}
        </span>
      ))}
      {h.yLabels.map((y, r) => (
        <div key={y} className="fin-heat-row">
          <span className="fin-heat-y">{y}</span>
          {h.cells[r].map((v, c) => (
            <span
              key={c}
              className="fin-heat-cell"
              title={Math.round(v).toLocaleString()}
              style={{ background: `rgba(108,140,255,${v > 0 ? 0.12 + (v / max) * 0.88 : 0.05})` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function Table({ result, ctx }: { result: MetricResult; ctx: StatsContext }): JSX.Element {
  const t = result.table
  if (!t || t.rows.length === 0) return <Empty text={ctx.L('d.noData')} />
  return (
    <div className="fin-widget-table">
      <table>
        <thead>
          <tr>
            {t.columns.map((c, i) => (
              <th key={i} className={c.align === 'right' ? 'num' : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) => (
                <td key={i} className={t.columns[i]?.align === 'right' ? 'num' : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Flow({ result, ctx }: { result: MetricResult; ctx: StatsContext }): JSX.Element {
  const f = result.flows
  if (!f || f.links.length === 0) return <Empty text={ctx.L('d.noData')} />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Sankey
        data={{ nodes: f.nodes.map((name) => ({ name })), links: f.links }}
        nodePadding={24}
        margin={{ top: 8, right: 110, bottom: 8, left: 8 }}
        link={{ stroke: PALETTE[0], strokeOpacity: 0.3 }}
        node={{ fill: PALETTE[0] }}
      >
        <Tooltip />
      </Sankey>
    </ResponsiveContainer>
  )
}

/** Draws the chosen chart for a metric's result; says so when the metric can't show that chart. */
export default function StatsWidgetBody({
  w,
  result,
  ctx
}: {
  w: FinWidgetConfig
  result: MetricResult
  ctx: StatsContext
}): JSX.Element {
  const chart = w.chart
  const note = result.note && chart !== 'tile' ? <div className="fin-widget-note fin-widget-note--bottom">{result.note}</div> : null
  let body: JSX.Element
  if (chart === 'tile') body = <Tile result={result} ctx={ctx} />
  else if (chart === 'progress') body = <Progress result={result} ctx={ctx} />
  else if (chart === 'table') body = <Table result={result} ctx={ctx} />
  else if (chart === 'heat') body = <Heat result={result} ctx={ctx} />
  else if (chart === 'sankey') body = <Flow result={result} ctx={ctx} />
  else if (chart === 'donut' || chart === 'treemap' || chart === 'hbar') body = <PartsChart chart={chart} result={result} ctx={ctx} invert={w.metric === 'category_trend'} />
  else if (chart === 'diverging' && !result.series) body = <PartsChart chart={chart} result={result} ctx={ctx} invert={w.metric === 'category_trend'} />
  else if (chart === 'bar' && !result.series && result.parts) body = <PartsChart chart={chart} result={result} ctx={ctx} invert={w.metric === 'category_trend'} />
  else body = <SeriesChart chart={chart} result={result} w={w} ctx={ctx} />
  return (
    <div className="fin-widget-body-inner">
      <div className="fin-widget-chart">{body}</div>
      {note}
    </div>
  )
}
