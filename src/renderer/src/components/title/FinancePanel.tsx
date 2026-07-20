import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useRatesStore } from '../../state/useRatesStore'
import { newId } from '../../lib/ids'
import { convert, convertToUsd } from '../../lib/currency'
import type { CheckingCategory, CurrencyCode, SavingsEntry } from '../../lib/types'
import { useT } from '../../lib/i18n/useT'
import CurrencyPicker from '../common/CurrencyPicker'
import ExchangeRatesButton from '../common/ExchangeRatesButton'
import './FinancePanel.css'

interface RowFormState {
  name: string
  amount: string
  currency: CurrencyCode
}

const EMPTY_FORM: RowFormState = { name: '', amount: '', currency: 'USD' }
const GENERAL_ID = '__general__'

export default function FinancePanel(): JSX.Element {
  const t = useT()
  const savings = useAppStore((s) => s.data?.finance.savings ?? [])
  const checkingBalance = useAppStore((s) => s.data?.finance.checking.balance ?? 0)
  const checkingCurrency = useAppStore((s) => s.data?.finance.checking.currency ?? 'USD')
  const checkingCategories = useAppStore((s) => s.data?.finance.checking.categories ?? [])
  const updateData = useAppStore((s) => s.updateData)
  const rates = useRatesStore((s) => s.rates?.rates ?? null)

  const [expanded, setExpanded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<RowFormState>(EMPTY_FORM)

  const [checkingExpanded, setCheckingExpanded] = useState(false)
  const [editingCheckingId, setEditingCheckingId] = useState<string | null>(null)
  const [addingChecking, setAddingChecking] = useState(false)
  const [checkingForm, setCheckingForm] = useState<RowFormState>(EMPTY_FORM)

  const total = savings.reduce((sum, e) => sum + convertToUsd(e.amount, e.currency, rates), 0)
  const checkingTotal =
    convertToUsd(checkingBalance, checkingCurrency, rates) +
    checkingCategories.reduce((sum, c) => sum + convertToUsd(c.balance, c.currency, rates), 0)

  function startEdit(entry: SavingsEntry): void {
    setEditingId(entry.id)
    setAdding(false)
    setForm({ name: entry.name, amount: String(entry.amount), currency: entry.currency })
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
          entry.currency = form.currency
        }
      } else {
        draft.finance.savings.push({
          id: newId(),
          name: form.name.trim(),
          amount,
          currency: form.currency
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

  function setSavingsCurrency(id: string, currency: CurrencyCode): void {
    updateData((draft) => {
      const entry = draft.finance.savings.find((e) => e.id === id)
      if (entry) entry.currency = currency
    })
  }

  function startEditGeneral(): void {
    setEditingCheckingId(GENERAL_ID)
    setAddingChecking(false)
    setCheckingForm({ name: '', amount: String(checkingBalance), currency: checkingCurrency })
  }

  function startEditChecking(entry: CheckingCategory): void {
    setEditingCheckingId(entry.id)
    setAddingChecking(false)
    setCheckingForm({ name: entry.name, amount: String(entry.balance), currency: entry.currency })
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
        draft.finance.checking.currency = checkingForm.currency
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
          category.currency = checkingForm.currency
        }
      } else {
        draft.finance.checking.categories.push({
          id: newId(),
          name: checkingForm.name.trim(),
          balance: amount,
          currency: checkingForm.currency
        })
      }
    })
    cancelCheckingForm()
  }

  function removeCheckingCategory(id: string): void {
    updateData((draft) => {
      const category = draft.finance.checking.categories.find((c) => c.id === id)
      if (category) {
        draft.finance.checking.balance += convert(
          category.balance,
          category.currency,
          draft.finance.checking.currency,
          rates
        )
      }
      draft.finance.checking.categories = draft.finance.checking.categories.filter((c) => c.id !== id)
    })
  }

  function setCheckingCategoryCurrency(id: string, currency: CurrencyCode): void {
    updateData((draft) => {
      const category = draft.finance.checking.categories.find((c) => c.id === id)
      if (category) category.currency = currency
    })
  }

  function setGeneralCurrency(currency: CurrencyCode): void {
    updateData((draft) => {
      draft.finance.checking.currency = currency
    })
  }

  return (
    <div className="finance-panel">
      <div className="finance-header">
        <ExchangeRatesButton />
      </div>

      <button type="button" className="finance-savings-toggle" onClick={() => setCheckingExpanded((v) => !v)}>
        <span>{t('finance.checkingLabel')}</span>
        <span className="finance-savings-total">${checkingTotal.toFixed(2)}</span>
      </button>

      {checkingExpanded && (
        <div className="finance-savings-list">
          {editingCheckingId === GENERAL_ID ? (
            <div className="finance-row finance-row--form">
              <span className="finance-row-name">{t('finance.categoryGeneralOption')}</span>
              <span className="finance-amount-with-currency">
                <input
                  placeholder={t('finance.amountPlaceholder')}
                  value={checkingForm.amount}
                  onChange={(e) => setCheckingForm({ ...checkingForm, amount: e.target.value })}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && submitCheckingForm()}
                />
                <CurrencyPicker
                  value={checkingForm.currency}
                  onChange={(c) => setCheckingForm({ ...checkingForm, currency: c })}
                />
              </span>
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
              <span className="finance-amount-with-currency">
                <CurrencyPicker value={checkingCurrency} onChange={setGeneralCurrency} />
                <span className="finance-row-amount">{checkingBalance.toFixed(2)}</span>
              </span>
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
                <span className="finance-amount-with-currency">
                  <input
                    placeholder={t('finance.amountPlaceholder')}
                    value={checkingForm.amount}
                    onChange={(e) => setCheckingForm({ ...checkingForm, amount: e.target.value })}
                  />
                  <CurrencyPicker
                    value={checkingForm.currency}
                    onChange={(c) => setCheckingForm({ ...checkingForm, currency: c })}
                  />
                </span>
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
                <span className="finance-amount-with-currency">
                  <CurrencyPicker
                    value={entry.currency}
                    onChange={(c) => setCheckingCategoryCurrency(entry.id, c)}
                  />
                  <span className="finance-row-amount">{entry.balance.toFixed(2)}</span>
                </span>
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
              <span className="finance-amount-with-currency">
                <input
                  placeholder={t('finance.amountPlaceholder')}
                  value={checkingForm.amount}
                  onChange={(e) => setCheckingForm({ ...checkingForm, amount: e.target.value })}
                />
                <CurrencyPicker
                  value={checkingForm.currency}
                  onChange={(c) => setCheckingForm({ ...checkingForm, currency: c })}
                />
              </span>
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
                <span className="finance-amount-with-currency">
                  <input
                    placeholder={t('finance.amountPlaceholder')}
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                  <CurrencyPicker value={form.currency} onChange={(c) => setForm({ ...form, currency: c })} />
                </span>
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
                <span className="finance-amount-with-currency">
                  <CurrencyPicker value={entry.currency} onChange={(c) => setSavingsCurrency(entry.id, c)} />
                  <span className="finance-row-amount">{entry.amount.toFixed(2)}</span>
                </span>
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
              <span className="finance-amount-with-currency">
                <input
                  placeholder={t('finance.amountPlaceholder')}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
                <CurrencyPicker value={form.currency} onChange={(c) => setForm({ ...form, currency: c })} />
              </span>
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
