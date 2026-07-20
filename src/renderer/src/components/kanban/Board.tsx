import { useEffect, useMemo, useRef, useState } from 'react'
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd'
import { useAppStore } from '../../state/useAppStore'
import { currentMonthKey, buildMonthOptions, computeMonthsWithActivity } from '../../lib/month'
import { createDefaultColumns } from '../../lib/kanbanDefaults'
import { newId } from '../../lib/ids'
import { syncCardDoneState, revertCardEffects } from '../../lib/kanbanXp'
import Column from './Column'
import ColumnModal from './ColumnModal'
import MonthPicker from './MonthPicker'
import UnassignedStrip from './UnassignedStrip'
import type { ColumnStatus } from '../../lib/types'
import { useT } from '../../lib/i18n/useT'
import './Kanban.css'

export default function Board(): JSX.Element {
  const t = useT()
  const data = useAppStore((s) => s.data)
  const updateData = useAppStore((s) => s.updateData)
  const [monthKey, setMonthKey] = useState(currentMonthKey())
  const [addingColumn, setAddingColumn] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const columnsRef = useRef<HTMLDivElement | null>(null)

  const monthExists = !!data?.kanban.months[monthKey]

  useEffect(() => {
    if (data && !monthExists) {
      updateData((draft) => {
        if (!draft.kanban.months[monthKey]) {
          draft.kanban.months[monthKey] = { columns: createDefaultColumns() }
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, monthExists])

  const month = data?.kanban.months[monthKey]
  const columns = useMemo(
    () => (month ? [...month.columns].sort((a, b) => a.order - b.order) : []),
    [month]
  )
  const monthOptions = buildMonthOptions(Object.keys(data?.kanban.months ?? {}))
  const monthsWithActivity = useMemo(
    () => computeMonthsWithActivity(data?.kanban.months ?? {}),
    [data]
  )
  const zoom = data?.kanban.zoom ?? 1

  // @hello-pangea/dnd only auto-scrolls droppables matching the dragged
  // item's type, so dragging a CARD never auto-scrolls the horizontal
  // COLUMN strip that holds it. Drive that scroll ourselves while a drag
  // (of any type) is in progress, based on raw cursor position.
  useEffect(() => {
    if (!isDragging) return
    const container = columnsRef.current
    if (!container) return

    const EDGE = 80
    const MAX_SPEED = 18
    let mouseX = 0
    let rafId: number

    function handleMouseMove(e: MouseEvent): void {
      mouseX = e.clientX
    }

    function tick(): void {
      const rect = container!.getBoundingClientRect()
      if (mouseX < rect.left + EDGE) {
        const intensity = Math.min(1, (rect.left + EDGE - mouseX) / EDGE)
        container!.scrollLeft -= MAX_SPEED * intensity
      } else if (mouseX > rect.right - EDGE) {
        const intensity = Math.min(1, (mouseX - (rect.right - EDGE)) / EDGE)
        container!.scrollLeft += MAX_SPEED * intensity
      }
      rafId = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', handleMouseMove)
    rafId = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(rafId)
    }
  }, [isDragging])

  function changeZoom(delta: number): void {
    updateData((draft) => {
      draft.kanban.zoom = Math.round(Math.min(1.2, Math.max(0.5, draft.kanban.zoom + delta)) * 100) / 100
    })
  }

  function addColumn(name: string, status: ColumnStatus): void {
    updateData((draft) => {
      const m = draft.kanban.months[monthKey]
      if (!m) return
      m.columns.push({
        id: newId(),
        name,
        status,
        order: m.columns.length,
        cards: []
      })
    })
    setAddingColumn(false)
  }

  function onDragEnd(result: DropResult): void {
    setIsDragging(false)
    const { source, destination, type } = result
    if (!destination) return

    updateData((draft) => {
      const m = draft.kanban.months[monthKey]
      if (!m) return

      if (type === 'COLUMN') {
        const cols = [...m.columns].sort((a, b) => a.order - b.order)
        const [moved] = cols.splice(source.index, 1)
        cols.splice(destination.index, 0, moved)
        cols.forEach((c, i) => (c.order = i))
        m.columns = cols
        return
      }

      const getList = (droppableId: string) =>
        droppableId === 'unassigned'
          ? draft.kanban.unassigned
          : m.columns.find((c) => c.id === droppableId)?.cards

      const sourceList = getList(source.droppableId)
      const destList = getList(destination.droppableId)
      if (!sourceList || !destList) return
      const [card] = sourceList.splice(source.index, 1)
      destList.splice(destination.index, 0, card)

      if (destination.droppableId === 'unassigned') {
        if (card.effectsApplied) revertCardEffects(draft, card)
        card.done = false
        card.effectsApplied = false
      } else {
        const destCol = m.columns.find((c) => c.id === destination.droppableId)
        if (destCol) syncCardDoneState(draft, card, destCol.status)
      }
    })
  }

  return (
    <div className="kanban-board-wrapper">
      <div className="kanban-toolbar">
        <MonthPicker
          value={monthKey}
          options={monthOptions}
          monthsWithActivity={monthsWithActivity}
          onChange={setMonthKey}
        />
        <div className="kanban-zoom">
          <button type="button" className="icon-btn" onClick={() => changeZoom(-0.1)} title={t('kanban.zoomOutTooltip')}>
            −
          </button>
          <span className="kanban-zoom-value">{Math.round(zoom * 100)}%</span>
          <button type="button" className="icon-btn" onClick={() => changeZoom(0.1)} title={t('kanban.zoomInTooltip')}>
            +
          </button>
        </div>
      </div>

      <DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={onDragEnd}>
        <Droppable droppableId="board" direction="horizontal" type="COLUMN">
          {(provided) => (
            <div
              className="kanban-columns"
              ref={(el) => {
                columnsRef.current = el
                provided.innerRef(el)
              }}
              {...provided.droppableProps}
              style={{ zoom }}
            >
              {columns.map((col, i) => (
                <Column key={col.id} column={col} index={i} monthKey={monthKey} />
              ))}
              {provided.placeholder}
              <button type="button" className="kanban-create-column-btn" onClick={() => setAddingColumn(true)}>
                {t('kanban.createColumnButton')}
              </button>
            </div>
          )}
        </Droppable>

        {addingColumn && <ColumnModal onCancel={() => setAddingColumn(false)} onSave={addColumn} />}

        <UnassignedStrip />
      </DragDropContext>
    </div>
  )
}
