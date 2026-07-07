import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { newId } from '../../lib/ids'
import type { SavingsEntry } from '../../lib/types'
import './FinancePanel.css'

interface RowFormState {
  name: string
  amount: string
}

const EMPTY_FORM: RowFormState = { name: '', amount: '' }

export default function FinancePanel(): JSX.Element {
  const savings = useAppStore((s) => s.data?.finance.savings ?? [])
  const checkingBalance = useAppStore((s) => s.data?.finance.checking.balance ?? 0)
  const updateData = useAppStore((s) => s.updateData)

  const [expanded, setExpanded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<RowFormState>(EMPTY_FORM)
  const [editingChecking, setEditingChecking] = useState(false)
  const [checkingInput, setCheckingInput] = useState('')

  const total = savings.reduce((sum, e) => sum + e.amount, 0)

  function startEditChecking(): void {
    setCheckingInput(String(checkingBalance))
    setEditingChecking(true)
  }

  function submitChecking(): void {
    const value = parseFloat(checkingInput.replace(',', '.'))
    if (Number.isNaN(value)) return
    updateData((draft) => {
      draft.finance.checking.balance = value
    })
    setEditingChecking(false)
  }

  function startEdit(entry: SavingsEntry): void {
    setEditingId(entry.id)
    setAdding(false)
    setForm({ name: entry.name, amount: String(entry.amount) })
  }

  function startAdd(): void {
    setAdding(true)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function cancelForm(): void {
    setEditingId(null)
    setAdding(false)
    setForm(EMPTY_FORM)
  }

  function submitForm(): void {
    const amount = parseFloat(form.amount.replace(',', '.'))
    if (!form.name.trim() || Number.isNaN(amount)) return
    updateData((draft) => {
      if (editingId) {
        const entry = draft.finance.savings.find((e) => e.id === editingId)
        if (entry) {
          entry.name = form.name.trim()
          entry.amount = amount
        }
      } else {
        draft.finance.savings.push({
          id: newId(),
          name: form.name.trim(),
          amount
        })
      }
    })
    cancelForm()
  }

  function removeEntry(id: string): void {
    updateData((draft) => {
      draft.finance.savings = draft.finance.savings.filter((e) => e.id !== id)
    })
  }

  return (
    <div className="finance-panel">
      <div className="finance-checking">
        <span className="finance-label">Расчётный счёт</span>
        {editingChecking ? (
          <div className="finance-checking-edit">
            <input
              value={checkingInput}
              onChange={(e) => setCheckingInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && submitChecking()}
            />
            <button type="button" className="icon-btn" onClick={submitChecking}>
              ✓
            </button>
            <button type="button" className="icon-btn" onClick={() => setEditingChecking(false)}>
              ✕
            </button>
          </div>
        ) : (
          <div className="finance-checking-view">
            <span className="finance-checking-amount">${checkingBalance.toFixed(2)}</span>
            <button type="button" className="icon-btn" onClick={startEditChecking} title="Редактировать">
              ✎
            </button>
          </div>
        )}
      </div>

      <button type="button" className="finance-savings-toggle" onClick={() => setExpanded((v) => !v)}>
        <span>Сбережения</span>
        <span className="finance-savings-total">${total.toFixed(2)}</span>
      </button>

      {expanded && (
        <div className="finance-savings-list">
          {savings.map((entry) =>
            editingId === entry.id ? (
              <div className="finance-row finance-row--form" key={entry.id}>
                <input
                  placeholder="Название"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                  placeholder="Сумма, $"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
                <button type="button" className="icon-btn" onClick={submitForm}>
                  ✓
                </button>
                <button type="button" className="icon-btn" onClick={cancelForm}>
                  ✕
                </button>
              </div>
            ) : (
              <div className="finance-row" key={entry.id}>
                <span className="finance-row-name">{entry.name}</span>
                <span className="finance-row-amount">${entry.amount.toFixed(2)}</span>
                <button type="button" className="icon-btn" onClick={() => startEdit(entry)} title="Редактировать">
                  ✎
                </button>
                <button type="button" className="icon-btn" onClick={() => removeEntry(entry.id)} title="Удалить">
                  🗑
                </button>
              </div>
            )
          )}

          {adding ? (
            <div className="finance-row finance-row--form">
              <input
                placeholder="Название"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
              <input
                placeholder="Сумма, $"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
              <button type="button" className="icon-btn" onClick={submitForm}>
                ✓
              </button>
              <button type="button" className="icon-btn" onClick={cancelForm}>
                ✕
              </button>
            </div>
          ) : (
            <button type="button" className="finance-add-row" onClick={startAdd}>
              +
            </button>
          )}
        </div>
      )}
    </div>
  )
}
