import { useState } from 'react'
import { useBookSelect, useUpdateBook } from '../../lib/book'
import { useRatesStore } from '../../state/useRatesStore'
import { useT } from '../../lib/i18n/useT'
import { GENERAL_ACCOUNT_ID } from '../../lib/ledger'
import {
  accountHasHistory,
  addAccount,
  canSwitchCurrency,
  changeAccountCurrency,
  removeCheckingAccount,
  removeSavingsAccount,
  type AccountKind
} from '../../lib/accountOps'
import type { CurrencyCode } from '../../lib/types'
import ConfirmModal from '../common/ConfirmModal'
import CurrencyCombobox from './CurrencyCombobox'
import { useAccounts } from './useFinance'

interface Props {
  /** Account to edit; omit to create a new one. */
  accountId?: string
  onClose: () => void
}

/** Create a new account (name, kind, currency) or edit an existing one. */
export default function AccountModal({ accountId, onClose }: Props): JSX.Element {
  const t = useT()
  const updateData = useUpdateBook()
  const generalCurrency = useBookSelect((b) => b?.finance.checking.currency ?? 'USD')
  const history = useBookSelect((b) => (accountId && b ? accountHasHistory(b, accountId) : false))
  const rates = useRatesStore((s) => s.rates?.rates ?? null)
  const accounts = useAccounts()
  const existing = accountId ? accounts.find((a) => a.id === accountId) : undefined
  const isGeneral = accountId === GENERAL_ACCOUNT_ID
  const generalName = useBookSelect((b) => b?.finance.checking.generalName)

  const [name, setName] = useState(isGeneral ? (generalName ?? '') : (existing?.name ?? ''))
  const [kind, setKind] = useState<AccountKind>(existing ? (existing.crypto ? 'crypto' : existing.group) : 'checking')
  const [currency, setCurrency] = useState<CurrencyCode>(existing?.currency ?? generalCurrency)
  const [balance, setBalance] = useState(existing ? String(existing.balance) : '')
  const [balanceTouched, setBalanceTouched] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [makeCrypto, setMakeCrypto] = useState(false)
  const isCrypto = kind === 'crypto' || makeCrypto

  const balanceValue = balance.trim() === '' ? 0 : parseFloat(balance.replace(',', '.'))
  const effectiveCurrency: CurrencyCode = isCrypto ? 'USD' : currency
  const currencyChanged = !!existing && effectiveCurrency !== existing.currency
  const rateMissing = currencyChanged && !canSwitchCurrency(existing.currency, effectiveCurrency, rates)
  const valid = (isGeneral || name.trim().length > 0) && !Number.isNaN(balanceValue) && !rateMissing

  function save(): void {
    if (!valid) return
    updateData((draft) => {
      if (!existing || !accountId) {
        addAccount(draft, { name: name.trim(), kind, currency: effectiveCurrency, balance: balanceValue })
        return
      }
      if (currencyChanged) changeAccountCurrency(draft, accountId, effectiveCurrency, rates, !balanceTouched)
      if (isGeneral) {
        // The general balance can be renamed; an empty name brings back the default label.
        draft.finance.checking.generalName = name.trim() || undefined
        if (balanceTouched) draft.finance.checking.balance = balanceValue
      } else if (existing.group === 'checking') {
        const category = draft.finance.checking.categories.find((c) => c.id === accountId)
        if (category) {
          category.name = name.trim()
          if (balanceTouched) category.balance = balanceValue
        }
      } else {
        const entry = draft.finance.savings.find((e) => e.id === accountId)
        if (entry) {
          entry.name = name.trim()
          if (balanceTouched && !entry.holdings) entry.amount = balanceValue
          if (makeCrypto && !entry.holdings) entry.holdings = []
        }
      }
    })
    onClose()
  }

  function remove(): void {
    if (!existing || !accountId) return
    updateData((draft) => {
      if (existing.group === 'checking') removeCheckingAccount(draft, accountId, rates)
      else removeSavingsAccount(draft, accountId)
    })
    onClose()
  }

  const deleteBlocked = !!existing && existing.group === 'savings' && history

  return (
    <div className="modal-overlay">
      <div className="modal-card fin-modal">
        <h2>{existing ? t('fin.accountTitle') : t('fin.newAccount')}</h2>

        <div className="form-field">
          <label>{t('fin.accountName')}</label>
          <input
            value={name}
            placeholder={isGeneral ? t('finance.categoryGeneralOption') : undefined}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-field">
          <label>{t('fin.accountKind')}</label>
          <div className="fin-type-switch fin-type-switch--3">
            {(['checking', 'savings', 'crypto'] as const).map((k) => (
              <button
                key={k}
                type="button"
                disabled={!!existing}
                className={`fin-type-btn fin-type-btn--transfer${kind === k ? ' active' : ''}`}
                onClick={() => setKind(k)}
              >
                {t(k === 'checking' ? 'fin.kindChecking' : k === 'savings' ? 'fin.kindSavings' : 'fin.kindCrypto')}
              </button>
            ))}
          </div>
        </div>

        {existing && existing.group === 'savings' && !existing.crypto && (
          <label className="fin-keep-balances">
            <input type="checkbox" checked={makeCrypto} onChange={(e) => setMakeCrypto(e.target.checked)} />
            {t('fin.makeCrypto')}
          </label>
        )}

        {!isCrypto && (
        <div className="form-field">
          <label>{t('fin.accountCurrency')}</label>
          <CurrencyCombobox value={currency} onChange={setCurrency} />
          {rateMissing && <div className="field-hint fin-negative">{t('fin.rateUnavailable')}</div>}
        </div>
        )}

        {!isCrypto && (
        <div className="form-field">
          <label>{existing ? t('fin.balance') : t('fin.startBalance')}</label>
          <input
            type="number"
            step="0.01"
            value={balance}
            placeholder="0"
            onChange={(e) => {
              setBalance(e.target.value)
              setBalanceTouched(true)
            }}
          />
        </div>
        )}
        {isCrypto && <div className="fin-hint">{t('fin.cryptoAccountHint')}</div>}

        <div className="modal-actions">
          {existing && !isGeneral && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={deleteBlocked}
              title={deleteBlocked ? t('fin.deleteBlocked') : undefined}
              onClick={() => setConfirmingDelete(true)}
            >
              {t('common.delete')}
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!valid}>
            {t('common.save')}
          </button>
        </div>

        {confirmingDelete && existing && (
          <ConfirmModal
            message={t(existing.group === 'checking' ? 'fin.deleteCheckingConfirm' : 'fin.deleteSavingsConfirm', {
              name: existing.name
            })}
            onConfirm={remove}
            onCancel={() => setConfirmingDelete(false)}
          />
        )}
      </div>
    </div>
  )
}
