import { useEffect, useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useRatesStore } from '../../state/useRatesStore'
import { convertToUsd, CURRENCY_SYMBOLS } from '../../lib/currency'
import type { CurrencyCode } from '../../lib/types'
import { useT } from '../../lib/i18n/useT'
import EnergyBattery from './EnergyBattery'
import EnergyBicep from './EnergyBicep'
import EnergyQuizModal from './EnergyQuizModal'
import './ResourceSummary.css'

export type FinanceSection = 'checking' | 'savings'

interface Props {
  /** Which finance section is currently open below (for the active highlight). */
  openSection: FinanceSection | null
  onOpenFinance: (section: FinanceSection) => void
}

interface Entry {
  name: string
  amount: number
  currency: CurrencyCode
}

function formatAmount(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/** Read-only hover list of a finance section's entries — editing lives in the finance block. */
function EntryList({
  title,
  entries,
  emptyText
}: {
  title: string
  entries: Entry[]
  emptyText: string
}): JSX.Element {
  return (
    <div className="resource-tooltip" role="tooltip">
      <div className="resource-tooltip-title">{title}</div>
      {entries.length === 0 ? (
        <div className="resource-tooltip-empty">{emptyText}</div>
      ) : (
        entries.map((e, i) => (
          <div className="resource-tooltip-row" key={i}>
            <span className="resource-tooltip-name">{e.name}</span>
            <span className="resource-tooltip-amount">
              {formatAmount(e.amount)} {CURRENCY_SYMBOLS[e.currency]}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

export default function ResourceSummary({ openSection, onOpenFinance }: Props): JSX.Element {
  const t = useT()
  const energy = useAppStore((s) => s.data?.energy)
  const checking = useAppStore((s) => s.data?.finance.checking)
  const savings = useAppStore((s) => s.data?.finance.savings ?? [])
  const rates = useRatesStore((s) => s.rates?.rates ?? null)
  const fetchRates = useRatesStore((s) => s.fetchIfNeeded)
  const [quizKind, setQuizKind] = useState<'mental' | 'physical' | null>(null)

  // Totals are USD-converted; the finance block (which used to trigger the
  // rate fetch) is now collapsed by default, so fetch them here too.
  useEffect(() => {
    fetchRates()
  }, [fetchRates])

  const checkingEntries: Entry[] = checking
    ? [
        {
          name: t('finance.categoryGeneralOption'),
          amount: checking.balance,
          currency: checking.currency
        },
        ...checking.categories.map((c) => ({
          name: c.name,
          amount: c.balance,
          currency: c.currency
        }))
      ]
    : []
  const savingsEntries: Entry[] = savings.map((e) => ({
    name: e.name,
    amount: e.amount,
    currency: e.currency
  }))
  const total = (entries: Entry[]): number =>
    Math.round(entries.reduce((sum, e) => sum + convertToUsd(e.amount, e.currency, rates), 0))

  return (
    <div className="resource-summary">
      <div className="resource-col">
        <button
          type="button"
          className="resource-item"
          title={t('energyBlock.mentalTooltip')}
          onClick={() => setQuizKind('mental')}
        >
          <EnergyBattery percent={energy?.mental ?? 100} />
        </button>
        <button
          type="button"
          className="resource-item"
          title={t('energyBlock.physicalTooltip')}
          onClick={() => setQuizKind('physical')}
        >
          <EnergyBicep percent={energy?.physical ?? 100} />
        </button>
      </div>

      <div className="resource-col">
        <div className="resource-hover">
          <button
            type="button"
            className={`resource-item resource-money${openSection === 'checking' ? ' active' : ''}`}
            onClick={() => onOpenFinance('checking')}
          >
            <span className="resource-money-icon">💲</span>
            <span className="resource-money-value">{total(checkingEntries)}</span>
          </button>
          <EntryList
            title={t('finance.checkingLabel')}
            entries={checkingEntries}
            emptyText={t('finance.emptyList')}
          />
        </div>
        <div className="resource-hover">
          <button
            type="button"
            className={`resource-item resource-money${openSection === 'savings' ? ' active' : ''}`}
            onClick={() => onOpenFinance('savings')}
          >
            <span className="resource-money-icon">💰</span>
            <span className="resource-money-value">{total(savingsEntries)}</span>
          </button>
          <EntryList
            title={t('finance.savingsLabel')}
            entries={savingsEntries}
            emptyText={t('finance.emptyList')}
          />
        </div>
      </div>

      {quizKind && <EnergyQuizModal kind={quizKind} onClose={() => setQuizKind(null)} />}
    </div>
  )
}
