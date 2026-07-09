import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { newId } from '../../lib/ids'
import type { CheckingCategory, SavingsEntry } from '../../lib/types'
import { useT } from '../../lib/i18n/useT'
import './FinancePanel.css'

interface RowFormState {
  name: string
  amount: string
}

const EMPTY_FORM: RowFormState = { name: '', amount: '' }
const GENERAL_ID = '__general__'

export default function FinancePanel(): JSX.Element {
  const t = useT()
  const savings = useAppStore((s) => s.data?.finance.savings ?? [])
  const checkingBalance = useAppStore((s) => s.data?.finance.checking.balance ?? 0)
  const checkingCategories = useAppStore((s) => s.data?.finance.checking.categories ?? [])
  const updateData = useAppStore((s) => s.updateData)

  const [expanded, setExpanded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<RowFormState>(EMPTY_FORM)

  const [checkingExpanded, setCheckingExpanded] = useState(false)
  const [editingCheckingId, setEditingCheckingId] = useState<string | null>(null)
  const [addingChecking, setAddingChecking] = useState(false)
  const [checkingForm, setCheckingForm] = useState<RowFormState>(EMPTY_FORM)

  const total = savings.reduce((sum, e) => sum + e.amount, 0)
  const checkingTotal = checkingBalance + checkingCategories.reduce((sum, c) => sum + c.balance, 0)

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

  function startEditGeneral(): void {
    setEditingCheckingId(GENERAL_ID)
    setAddingChecking(false)
    setCheckingForm({ name: '', amount: String(checkingBalance) })
  }

  function startEditChecking(entry: CheckingCategory): void {
    setEditingCheckingId(entry.id)
    setAddingChecking(false)
    setCheckingForm({ name: entry.name, amount: String(entry.balance) })
  }

  function startAddChecking(): void {
    setAddingChecking(true)
    setEditingCheckingId(null)
    setCheckingForm(EMPTY_FORM)
  }

  function cancelCheckingForm(): void {
    setEditingCheckingId(null)
    setAddingChecking(false)
    setCheckingForm(EMPTY_FORM)
  }

  function submitCheckingForm(): void {
    const amount = parseFloat(checkingForm.amount.replace(',', '.'))
    if (Number.isNaN(amount)) return
    if (editingCheckingId === GENERAL_ID) {
      updateData((draft) => {
        draft.finance.checking.balance = amount
      })
      cancelCheckingForm()
      return
    }
    if (!checkingForm.name.trim()) return
    updateData((draft) => {
      if (editingCheckingId) {
        const category = draft.finance.checking.categories.find((c) => c.id === editingCheckingId)
        if (category) {
          category.name = checkingForm.name.trim()
          category.balance = amount
        }
      } else {
        draft.finance.checking.categories.push({
          id: newId(),
          name: checkingForm.name.trim(),
          balance: amount
        })
      }
    })
    cancelCheckingForm()
  }

  function removeCheckingCategory(id: string): void {
    updateData((draft) => {
      const category = draft.finance.checking.categories.find((c) => c.id === id)
      if (category) {
        draft.finance.checking.balance += category.balance
      }
      draft.finance.checking.categories = draft.finance.checking.categories.filter((c) => c.id !== id)
    })
  }

  return (
    <div className="finance-panel">
      <button type="button" className="finance-savings-toggle" onClick={() => setCheckingExpanded((v) => !v)}>
        <span>{t('finance.checkingLabel')}</span>
        <span className="finance-savings-total">${checkingTotal.toFixed(2)}</span>
      </button>

      {checkingExpanded && (
        <div className="finance-savings-list">
          {editingCheckingId === GENERAL_ID ? (
            <div className="finance-row finance-row--form">
              <span className="finance-row-name">{t('finance.categoryGeneralOption')}</span>
              <input
                placeholder={t('finance.amountPlaceholder')}
                value={checkingForm.amount}
                onChange={(e) => setCheckingForm({ ...checkingForm, amount: e.target.value })}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && submitCheckingForm()}
              />
              <button type="button" className="icon-btn" onClick={submitCheckingForm}>
                ✓
              </button>
              <button type="button" className="icon-btn" onClick={cancelCheckingForm}>
                ✕
              </button>
            </div>
          ) : (
            <div className="finance-row">
              <span className="finance-row-name">{t('finance.categoryGeneralOption')}</span>
              <span className="finance-row-amount">${checkingBalance.toFixed(2)}</span>
              <button type="button" className="icon-btn" onClick={startEditGeneral} title={t('common.edit')}>
                ✎
              </button>
              <span />
            </div>
          )}

          {checkingCategories.map((entry) =>
            editingCheckingId === entry.id ? (
              <div className="finance-row finance-row--form" key={entry.id}>
                <input
                  placeholder={t('common.nameLabel')}
                  value={checkingForm.name}
                  onChange={(e) => setCheckingForm({ ...checkingForm, name: e.target.value })}
                />
                <input
                  placeholder={t('finance.amountPlaceholder')}
                  value={checkingForm.amount}
                  onChange={(e) => setCheckingForm({ ...checkingForm, amount: e.target.value })}
                />
                <button type="button" className="icon-btn" onClick={submitCheckingForm}>
                  ✓
                </button>
                <button type="button" className="icon-btn" onClick={cancelCheckingForm}>
                  ✕
                </button>
              </div>
            ) : (
              <div className="finance-row" key={entry.id}>
                <span className="finance-row-name">{entry.name}</span>
                <span className="finance-row-amount">${entry.balance.toFixed(2)}</span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => startEditChecking(entry)}
                  title={t('common.edit')}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => removeCheckingCategory(entry.id)}
                  title={t('common.delete')}
                >
                  🗑
                </button>
              </div>
            )
          )}

          {addingChecking ? (
            <div className="finance-row finance-row--form">
              <input
                placeholder={t('common.nameLabel')}
                value={checkingForm.name}
                onChange={(e) => setCheckingForm({ ...checkingForm, name: e.target.value })}
                autoFocus
              />
              <input
                placeholder={t('finance.amountPlaceholder')}
                value={checkingForm.amount}
                onChange={(e) => setCheckingForm({ ...checkingForm, amount: e.target.value })}
              />
              <button type="button" className="icon-btn" onClick={submitCheckingForm}>
                ✓
              </button>
              <button type="button" className="icon-btn" onClick={cancelCheckingForm}>
                ✕
              </button>
            </div>
          ) : (
            <button type="button" className="finance-add-row" onClick={startAddChecking}>
              +
            </button>
          )}
        </div>
      )}

      <button type="button" className="finance-savings-toggle" onClick={() => setExpanded((v) => !v)}>
        <span>{t('finance.savingsLabel')}</span>
        <span className="finance-savings-total">${total.toFixed(2)}</span>
      </button>

      {expanded && (
        <div className="finance-savings-list">
          {savings.map((entry) =>
            editingId === entry.id ? (
              <div className="finance-row finance-row--form" key={entry.id}>
                <input
                  placeholder={t('common.nameLabel')}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                  placeholder={t('finance.amountPlaceholder')}
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
                <button type="button" className="icon-btn" onClick={() => startEdit(entry)} title={t('common.edit')}>
                  ✎
                </button>
                <button type="button" className="icon-btn" onClick={() => removeEntry(entry.id)} title={t('common.delete')}>
                  🗑
                </button>
              </div>
            )
          )}

          {adding ? (
            <div className="finance-row finance-row--form">
              <input
                placeholder={t('common.nameLabel')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />
              <input
                placeholder={t('finance.amountPlaceholder')}
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
