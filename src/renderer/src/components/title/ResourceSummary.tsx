import { useEffect, useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { useRatesStore } from '../../state/useRatesStore'
import { useModuleStore } from '../../state/useModuleStore'
import { canConvert, convert, CURRENCY_SYMBOLS } from '../../lib/currency'
import type { CurrencyCode } from '../../lib/types'
import { useT } from '../../lib/i18n/useT'
import { formatMain } from '../finance/useFinance'
import EnergyBattery from './EnergyBattery'
import EnergyBicep from './EnergyBicep'
import EnergyQuizModal from './EnergyQuizModal'
import './ResourceSummary.css'


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
  emptyText,
  main,
  rates
}: {
  title: string
  entries: Entry[]
  emptyText: string
  main: CurrencyCode
  rates: Record<string, number> | null
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
              {e.currency !== main && canConvert(e.currency, main, rates) && (
                <small className="resource-tooltip-converted">
                  ≈ {formatMain(convert(e.amount, e.currency, main, rates), main)}
                </small>
              )}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

export default function ResourceSummary(): JSX.Element {
  const setModule = useModuleStore((s) => s.setModule)
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
  const main = useAppStore((s) => s.data?.settings.mainCurrency ?? 'USD')
  const total = (entries: Entry[]): string =>
    formatMain(
      entries.reduce((sum, e) => sum + convert(e.amount, e.currency, main, rates), 0),
      main
    )

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
            className="resource-item resource-money"
            onClick={() => setModule('finance')}
          >
            <span className="resource-money-icon">💲</span>
            <span className="resource-money-value">{total(checkingEntries)}</span>
          </button>
          <EntryList
            title={t('finance.checkingLabel')}
            entries={checkingEntries}
            emptyText={t('finance.emptyList')}
            main={main}
            rates={rates}
          />
        </div>
        <div className="resource-hover">
          <button
            type="button"
            className="resource-item resource-money"
            onClick={() => setModule('finance')}
          >
            <span className="resource-money-icon">💰</span>
            <span className="resource-money-value">{total(savingsEntries)}</span>
          </button>
          <EntryList
            title={t('finance.savingsLabel')}
            entries={savingsEntries}
            emptyText={t('finance.emptyList')}
            main={main}
            rates={rates}
          />
        </div>
      </div>

      {quizKind && <EnergyQuizModal kind={quizKind} onClose={() => setQuizKind(null)} />}
    </div>
  )
}
