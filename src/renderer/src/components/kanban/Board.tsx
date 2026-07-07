import { useEffect, useMemo, useState } from 'react'
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
import './Kanban.css'

export default function Board(): JSX.Element {
  const data = useAppStore((s) => s.data)
  const updateData = useAppStore((s) => s.updateData)
  const [monthKey, setMonthKey] = useState(currentMonthKey())
  const [addingColumn, setAddingColumn] = useState(false)

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
          <button type="button" className="icon-btn" onClick={() => changeZoom(-0.1)} title="Уменьшить масштаб">
            −
          </button>
          <span className="kanban-zoom-value">{Math.round(zoom * 100)}%</span>
          <button type="button" className="icon-btn" onClick={() => changeZoom(0.1)} title="Увеличить масштаб">
            +
          </button>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board" direction="horizontal" type="COLUMN">
          {(provided) => (
            <div
              className="kanban-columns"
              ref={provided.innerRef}
              {...provided.droppableProps}
              style={{ zoom }}
            >
              {columns.map((col, i) => (
                <Column key={col.id} column={col} index={i} monthKey={monthKey} />
              ))}
              {provided.placeholder}
              <button type="button" className="kanban-create-column-btn" onClick={() => setAddingColumn(true)}>
                + Создать колонку
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
