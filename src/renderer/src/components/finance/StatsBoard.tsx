import { useEffect, useMemo, useRef, useState } from 'react'
import { useBookSelect, useUpdateBook } from '../../lib/book'
import { useRatesStore } from '../../state/useRatesStore'
import { useCryptoStore } from '../../state/useCryptoStore'
import { useLanguageStore } from '../../state/useLanguageStore'
import { todayISO } from '../../lib/date'
import { convert } from '../../lib/currency'
import { computeMetric, defaultWidgets, metricDef, widgetId, type StatsContext } from '../../lib/finStats'
import { GRID_COLS, findFreeSpot, settleLayout, type Rect } from '../../lib/statsLayout'
import { makeLabel } from '../../lib/statsLabels'
import type { FinWidgetConfig } from '../../lib/types'
import ConfirmModal from '../common/ConfirmModal'
import StatsWidgetBody from './StatsWidgetBody'
import StatsWidgetModal from './StatsWidgetModal'
import { useAccounts, useMainCurrency } from './useFinance'

const ROW_H = 64
const GAP = 8

type Mode = 'move' | 'se' | 'e' | 's'

interface DragState {
  id: string
  mode: Mode
  startX: number
  startY: number
  colW: number
  orig: Rect
  base: Rect[]
}

const rectOf = (w: FinWidgetConfig): Rect => ({ id: w.id, x: w.x, y: w.y, w: w.w, h: w.h })

/**
 * The statistics tab: a board of widgets the user assembles — each one a metric
 * drawn with a chart that suits it. Widgets can be dragged by their grip and
 * stretched from the right edge, bottom edge or corner; the neighbours make room.
 */
export default function StatsBoard({ month }: { month: string }): JSX.Element {
  const lang = useLanguageStore((s) => s.language)
  const L = useMemo(() => makeLabel(lang), [lang])
  const updateData = useUpdateBook()
  const stats = useBookSelect((b) => b?.financeStats)
  const events = useBookSelect((b) => b?.ledger.events)
  const subscriptions = useBookSelect((b) => b?.ledger.subscriptions)
  const counterparties = useBookSelect((b) => b?.ledger.counterparties)
  const savings = useBookSelect((b) => b?.finance.savings)
  const rates = useRatesStore((s) => s.rates?.rates ?? null)
  const prices = useCryptoStore((s) => s.prices)
  const accounts = useAccounts()
  const main = useMainCurrency()
  const today = todayISO()

  // First visit: persist the default board so ids stay stable from then on.
  useEffect(() => {
    if (!stats) {
      updateData((draft) => {
        if (!draft.financeStats) draft.financeStats = { widgets: defaultWidgets(), snapshots: {} }
      })
    }
  }, [stats, updateData])

  const widgets = useMemo(() => stats?.widgets ?? [], [stats])
  const snapshots = useMemo(() => stats?.snapshots ?? {}, [stats])

  const holdings = useMemo(
    () => (savings ?? []).flatMap((e) => (e.holdings ?? []).map((h) => ({ account: e.name, ticker: h.ticker, amount: h.amount }))),
    [savings]
  )

  // One snapshot per day (refreshed as prices arrive) so net worth and the crypto portfolio gain a history.
  useEffect(() => {
    if (!stats || accounts.length === 0) return
    const total = Math.round(accounts.reduce((s, a) => s + convert(a.balance, a.currency, main, rates), 0))
    const crypto = Math.round(
      accounts.filter((a) => a.crypto).reduce((s, a) => s + convert(a.balance, a.currency, main, rates), 0)
    )
    const prev = stats.snapshots[today]
    if (prev && Math.abs(prev.total - total) < 1 && Math.abs(prev.crypto - crypto) < 1) return
    updateData((draft) => {
      if (draft.financeStats) draft.financeStats.snapshots[today] = { total, crypto }
    })
  }, [stats, accounts, main, rates, today, prices, updateData])

  const ctx: StatsContext = useMemo(
    () => ({
      events: events ?? [],
      accounts,
      subscriptions: subscriptions ?? [],
      counterparties: counterparties ?? [],
      rates,
      main,
      today,
      month,
      prices,
      holdings,
      snapshots,
      lang,
      L
    }),
    [events, accounts, subscriptions, counterparties, rates, main, today, month, prices, holdings, snapshots, lang, L]
  )

  // ---- layout, with live feedback while dragging ----
  const [live, setLive] = useState<Rect[] | null>(null)
  const liveRef = useRef<Rect[] | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(1000)

  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  const rects = live ?? widgets.map(rectOf)
  const colW = width / GRID_COLS
  const rows = Math.max(4, ...rects.map((r) => r.y + r.h))

  useEffect(() => {
    function onMove(ev: PointerEvent): void {
      const d = dragRef.current
      if (!d) return
      const dx = Math.round((ev.clientX - d.startX) / d.colW)
      const dy = Math.round((ev.clientY - d.startY) / ROW_H)
      const o = d.orig
      const next: Rect =
        d.mode === 'move'
          ? { ...o, x: o.x + dx, y: o.y + dy }
          : { ...o, w: d.mode === 's' ? o.w : o.w + dx, h: d.mode === 'e' ? o.h : o.h + dy }
      const layout = settleLayout(d.base.map((r) => (r.id === d.id ? next : r)), d.id)
      liveRef.current = layout
      setLive(layout)
    }
    function onUp(): void {
      const layout = liveRef.current
      dragRef.current = null
      liveRef.current = null
      setActiveId(null)
      if (layout) {
        updateData((draft) => {
          for (const r of layout) {
            const w = draft.financeStats?.widgets.find((x) => x.id === r.id)
            if (w) Object.assign(w, { x: r.x, y: r.y, w: r.w, h: r.h })
          }
        })
      }
      setLive(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [updateData])

  function startDrag(e: React.PointerEvent, id: string, mode: Mode): void {
    e.preventDefault()
    e.stopPropagation()
    const base = widgets.map(rectOf)
    const orig = base.find((r) => r.id === id)
    if (!orig) return
    dragRef.current = { id, mode, startX: e.clientX, startY: e.clientY, colW, orig, base }
    setActiveId(id)
  }

  // ---- widget actions ----
  const [editing, setEditing] = useState<FinWidgetConfig | 'new' | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  function commitLayout(draftWidgets: FinWidgetConfig[], anchor?: string): void {
    const layout = settleLayout(draftWidgets.map(rectOf), anchor)
    for (const r of layout) {
      const w = draftWidgets.find((x) => x.id === r.id)
      if (w) Object.assign(w, { x: r.x, y: r.y, w: r.w, h: r.h })
    }
  }

  function saveWidget(
    draft: Pick<FinWidgetConfig, 'metric' | 'chart' | 'period' | 'accountId' | 'title'>,
    size: { w: number; h: number }
  ): void {
    updateData((d) => {
      if (!d.financeStats) d.financeStats = { widgets: [], snapshots: {} }
      const list = d.financeStats.widgets
      if (editing && editing !== 'new') {
        const target = list.find((w) => w.id === editing.id)
        if (target) Object.assign(target, draft)
      } else {
        const spot = findFreeSpot(list.map(rectOf), size.w, size.h)
        list.push({ id: widgetId(), ...draft, ...spot, ...size })
      }
      commitLayout(list)
    })
    setEditing(null)
  }

  function remove(id: string): void {
    updateData((d) => {
      if (!d.financeStats) return
      d.financeStats.widgets = d.financeStats.widgets.filter((w) => w.id !== id)
      commitLayout(d.financeStats.widgets)
    })
  }

  function duplicate(w: FinWidgetConfig): void {
    updateData((d) => {
      if (!d.financeStats) return
      const list = d.financeStats.widgets
      const spot = findFreeSpot(list.map(rectOf), w.w, w.h)
      list.push({ ...w, id: widgetId(), ...spot })
      commitLayout(list)
    })
  }

  const results = useMemo(() => new Map(widgets.map((w) => [w.id, computeMetric(ctx, w)])), [widgets, ctx])

  return (
    <div className="fin-board-wrap">
      <div className="fin-board-bar">
        <span className="fin-hint">{L('ui.hint')}</span>
        <div className="reward-row">
          <button type="button" className="btn" onClick={() => setConfirmReset(true)}>
            {L('ui.reset')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            {L('ui.addWidget')}
          </button>
        </div>
      </div>

      <div ref={boardRef} className="fin-board" style={{ height: rows * ROW_H }}>
        {widgets.length === 0 && <div className="fin-empty">{L('ui.empty')}</div>}
        {widgets.map((w) => {
          const r = rects.find((x) => x.id === w.id) ?? rectOf(w)
          const def = metricDef(w.metric)
          return (
            <div
              key={w.id}
              className={`fin-widget${activeId === w.id ? ' dragging' : ''}`}
              style={{
                left: r.x * colW,
                top: r.y * ROW_H,
                width: Math.max(0, r.w * colW - GAP),
                height: r.h * ROW_H - GAP
              }}
            >
              <div className="fin-widget-head">
                <span className="fin-widget-grip" title={L('ui.drag')} onPointerDown={(e) => startDrag(e, w.id, 'move')}>
                  ⠿
                </span>
                <span className="fin-widget-title">{w.title || L(`m.${w.metric}`)}</span>
                <span className="fin-widget-actions">
                  <button type="button" className="icon-btn" title={L('ui.settings')} onClick={() => setEditing(w)}>
                    ⚙
                  </button>
                  <button type="button" className="icon-btn" title={L('ui.duplicate')} onClick={() => duplicate(w)}>
                    ⧉
                  </button>
                  <button type="button" className="icon-btn" title={L('ui.remove')} onClick={() => remove(w.id)}>
                    ✕
                  </button>
                </span>
              </div>
              <div className="fin-widget-body">
                {def ? <StatsWidgetBody w={w} result={results.get(w.id) ?? {}} ctx={ctx} /> : null}
              </div>
              <span className="fin-resize fin-resize--e" onPointerDown={(e) => startDrag(e, w.id, 'e')} />
              <span className="fin-resize fin-resize--s" onPointerDown={(e) => startDrag(e, w.id, 's')} />
              <span className="fin-resize fin-resize--se" title={L('ui.resize')} onPointerDown={(e) => startDrag(e, w.id, 'se')} />
            </div>
          )
        })}
      </div>

      {editing && (
        <StatsWidgetModal
          initial={editing === 'new' ? undefined : editing}
          onSave={(draft, def) => saveWidget(draft, def.size)}
          onClose={() => setEditing(null)}
        />
      )}
      {confirmReset && (
        <ConfirmModal
          message={L('ui.resetConfirm')}
          onConfirm={() => {
            updateData((d) => {
              if (d.financeStats) d.financeStats.widgets = defaultWidgets()
            })
            setConfirmReset(false)
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  )
}
