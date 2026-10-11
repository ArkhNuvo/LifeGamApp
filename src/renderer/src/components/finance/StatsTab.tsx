import { useMemo } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAppStore } from '../../state/useAppStore'
import { useRatesStore } from '../../state/useRatesStore'
import { useT } from '../../lib/i18n/useT'
import { todayISO } from '../../lib/date'
import { convert } from '../../lib/currency'
import { MONTH_NAME_KEYS } from '../../lib/month'
import {
  counterpartyName,
  monthOf,
  monthlyCost,
  shiftMonth,
  summarizeMonth
} from '../../lib/ledger'
import { formatMain, formatMoney, useAccounts, useMainCurrency } from './useFinance'

const INCOME_COLOR = '#34d1a0'
const EXPENSE_COLOR = '#ff5c72'

export default function StatsTab({ month }: { month: string }): JSX.Element {
  const t = useT()
  const events = useAppStore((s) => s.data?.ledger.events ?? [])
  const subscriptions = useAppStore((s) => s.data?.ledger.subscriptions ?? [])
  const counterparties = useAppStore((s) => s.data?.ledger.counterparties ?? [])
  const rates = useRatesStore((s) => s.rates?.rates ?? null)
  const accounts = useAccounts()
  const main = useMainCurrency()
  const today = todayISO()

  const summary = useMemo(() => summarizeMonth(events, accounts, month, rates, main), [events, accounts, month, rates, main])

  const series = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const key = shiftMonth(month, i - 5)
        const s = summarizeMonth(events, accounts, key, rates, main)
        const monthIndex = Number(key.slice(5)) - 1
        return {
          month: t(MONTH_NAME_KEYS[monthIndex]).slice(0, 3),
          income: Math.round(s.income),
          expense: Math.round(s.expense)
        }
      }),
    [events, accounts, month, rates, main, t]
  )

  const { categories, topCounterparties } = useMemo(() => {
    const byCategory = new Map<string, number>()
    const byCounterparty = new Map<string, number>()
    for (const ev of events) {
      if (!ev.confirmed || ev.type !== 'expense' || monthOf(ev.date) !== month) continue
      const currency = accounts.find((a) => a.id === ev.accountId)?.currency ?? 'USD'
      const usd = convert(ev.amount, currency, main, rates)
      const category = ev.category || '—'
      byCategory.set(category, (byCategory.get(category) ?? 0) + usd)
      const who = counterpartyName(counterparties, ev.counterpartyId)
      if (who) byCounterparty.set(who, (byCounterparty.get(who) ?? 0) + usd)
    }
    const sorted = (m: Map<string, number>): [string, number][] => [...m.entries()].sort((a, b) => b[1] - a[1])
    return { categories: sorted(byCategory).slice(0, 6), topCounterparties: sorted(byCounterparty).slice(0, 5) }
  }, [events, accounts, counterparties, month, rates, main])

  const isCurrentMonth = monthOf(today) === month
  const [year, monthNumber] = month.split('-').map(Number)
  const daysCounted = isCurrentMonth ? Number(today.slice(8)) : new Date(year, monthNumber, 0).getDate()
  const dailyExpense = daysCounted > 0 ? summary.expense / daysCounted : 0
  const savingsRate = summary.income > 0 ? (summary.result / summary.income) * 100 : null

  const activeSubs = subscriptions.filter((s) => s.active)
  const monthlySubs = activeSubs.reduce((sum, s) => sum + monthlyCost(s, accounts, rates, main), 0)
  const upcoming = events
    .filter((e) => e.subscriptionId && !e.confirmed && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  const maxCategory = categories[0]?.[1] ?? 0
  const hasData = summary.income > 0 || summary.expense > 0

  return (
    <div className="fin-tab">
      <div className="fin-tiles fin-tiles--5">
        <div className="fin-tile fin-tile--income">
          <span className="fin-tile-label">{t('fin.tileIncome')}</span>
          <span className="fin-tile-value">+{formatMain(summary.income, main)}</span>
        </div>
        <div className="fin-tile fin-tile--expense">
          <span className="fin-tile-label">{t('fin.tileExpense')}</span>
          <span className="fin-tile-value">-{formatMain(summary.expense, main)}</span>
        </div>
        <div className="fin-tile">
          <span className="fin-tile-label">{t('fin.tileResult')}</span>
          <span className="fin-tile-value">
            {summary.result >= 0 ? '+' : '-'}
            {formatMain(Math.abs(summary.result), main)}
          </span>
        </div>
        <div className="fin-tile">
          <span className="fin-tile-label">{t('fin.tileSavingsRate')}</span>
          <span className="fin-tile-value">{savingsRate === null ? '—' : `${Math.round(savingsRate)}%`}</span>
        </div>
        <div className="fin-tile">
          <span className="fin-tile-label">{t('fin.tileDailyExpense')}</span>
          <span className="fin-tile-value">{formatMain(dailyExpense, main)}</span>
        </div>
      </div>

      <div className="fin-grid-2">
        <div className="fin-card">
          <h3>{t('fin.statsMonthly')}</h3>
          <div className="fin-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <XAxis dataKey="month" tick={{ fill: 'var(--text-2)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'rgba(127,127,127,0.12)' }}
                  contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8 }}
                  formatter={(value) => formatMain(Number(value), main)}
                />
                <Bar dataKey="income" name={t('fin.tileIncome')} fill={INCOME_COLOR} radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" name={t('fin.tileExpense')} fill={EXPENSE_COLOR} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="fin-card">
          <h3>{t('fin.statsCategories')}</h3>
          {categories.length === 0 && <div className="fin-empty">{t('fin.statsEmpty')}</div>}
          {categories.map(([name, value]) => (
            <div key={name} className="fin-bar-row">
              <span className="fin-bar-name">{name}</span>
              <div className="fin-bar-track">
                <div className="fin-bar-fill" style={{ width: `${maxCategory ? (value / maxCategory) * 100 : 0}%` }} />
              </div>
              <span className="fin-bar-value">
                {formatMain(value, main)} · {summary.expense ? Math.round((value / summary.expense) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>

        <div className="fin-card">
          <h3>{t('fin.statsTopCounterparties')}</h3>
          {topCounterparties.length === 0 && <div className="fin-empty">{hasData ? '—' : t('fin.statsEmpty')}</div>}
          {topCounterparties.map(([name, value]) => (
            <div key={name} className="fin-list-row">
              <span>{name}</span>
              <span>{formatMain(value, main)}</span>
            </div>
          ))}
        </div>

        <div className="fin-card">
          <h3>{t('fin.statsSubs')}</h3>
          <div className="fin-tiles fin-tiles--2">
            <div className="fin-tile">
              <span className="fin-tile-label">{t('fin.perMonth')}</span>
              <span className="fin-tile-value">{formatMain(monthlySubs, main)}</span>
            </div>
            <div className="fin-tile">
              <span className="fin-tile-label">{t('fin.perYear')}</span>
              <span className="fin-tile-value">{formatMain(monthlySubs * 12, main)}</span>
            </div>
          </div>
          <h4>{t('fin.statsUpcoming')}</h4>
          {upcoming.length === 0 && <div className="fin-empty">—</div>}
          {upcoming.map((ev) => {
            const currency = accounts.find((a) => a.id === ev.accountId)?.currency ?? 'USD'
            return (
              <div key={ev.id} className="fin-list-row">
                <span>
                  {ev.date.slice(5).split('-').reverse().join('.')}, {ev.title}
                </span>
                <span>{formatMoney(ev.amount, currency)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
