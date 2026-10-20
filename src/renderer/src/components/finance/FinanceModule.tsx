import { useEffect, useState } from 'react'
import { useBookSelect, useUpdateBook } from '../../lib/book'
import { useRatesStore } from '../../state/useRatesStore'
import { useModuleStore } from '../../state/useModuleStore'
import { useT } from '../../lib/i18n/useT'
import { todayISO } from '../../lib/date'
import { monthOf, materializeSubscriptions } from '../../lib/ledger'
import type { LedgerEvent } from '../../lib/types'
import SettingsButton from '../common/SettingsButton'
import AccountModal from './AccountModal'
import AiSettingsModal from './AiSettingsModal'
import CalendarTab from './CalendarTab'
import KpirTab from './firm/KpirTab'
import { useFirm } from '../../lib/book'
import CounterpartiesModal from './CounterpartiesModal'
import EventModal from './EventModal'
import EventsTab from './EventsTab'
import FinanceProfile from './FinanceProfile'
import CryptoModal from './CryptoModal'
import { useCryptoSync } from './useCryptoSync'
import DetectSubscriptionsModal from './DetectSubscriptionsModal'
import ImportModal from './ImportModal'
import MonthStepper from './MonthStepper'
import StatsBoard from './StatsBoard'
import SubscriptionModal from './SubscriptionModal'
import './Finance.css'

type Tab = 'events' | 'stats' | 'calendar' | 'kpir'

interface EventModalState {
  initial?: LedgerEvent
  defaultDate?: string
}

/**
 * The finance module: replaces the dashboard's two columns (profile + main)
 * with its own — accounts and subscriptions on the left, events / statistics
 * / calendar on the right.
 */
export default function FinanceModule(): JSX.Element {
  const t = useT()
  const setModule = useModuleStore((s) => s.setModule)
  const updateData = useUpdateBook()
  const subscriptions = useBookSelect((b) => b?.ledger.subscriptions)
  const fetchRates = useRatesStore((s) => s.fetchIfNeeded)

  const [tab, setTab] = useState<Tab>('events')
  const firm = useFirm()
  // The KPiR tab exists only for firms; leaving a firm falls back to the events.
  const shownTab: Tab = tab === 'kpir' && !firm ? 'events' : tab
  const tabs: Tab[] = firm ? ['events', 'stats', 'calendar', 'kpir'] : ['events', 'stats', 'calendar']
  const [month, setMonth] = useState(monthOf(todayISO()))
  const [eventModal, setEventModal] = useState<EventModalState | null>(null)
  const [subscriptionId, setSubscriptionId] = useState<string | 'new' | null>(null)
  const [accountModal, setAccountModal] = useState<{ accountId?: string } | null>(null)
  const [counterpartiesOpen, setCounterpartiesOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [detectOpen, setDetectOpen] = useState(false)
  const [cryptoId, setCryptoId] = useState<string | null>(null)
  useCryptoSync()

  useEffect(() => {
    fetchRates()
  }, [fetchRates])

  // Recurring payments appear as planned events a few months ahead; this is
  // idempotent, so running it whenever the templates change is safe.
  useEffect(() => {
    // Also plan ahead as far as the viewed month, so a calendar page far in the future isn't empty.
    updateData((draft) => materializeSubscriptions(draft, todayISO(), `${month}-31`))
  }, [subscriptions, month, updateData])

  return (
    <>
      <div className="dashboard-left">
        <div className="title-panel fin-left">
          <FinanceProfile
            month={month}
            onAddAccount={() => setAccountModal({})}
            onEditAccount={(accountId) => setAccountModal({ accountId })}
            onNewSubscription={() => setSubscriptionId('new')}
            onEditSubscription={setSubscriptionId}
            onDetectSubscriptions={() => setDetectOpen(true)}
            onOpenCrypto={setCryptoId}
          />
        </div>
      </div>
      <div className="dashboard-right">
        <div className="main-panel fin-main">
          <div className="main-panel-topbar">
            <div className="main-panel-tabs">
              {tabs.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={shownTab === id ? 'main-tab active' : 'main-tab'}
                  onClick={() => setTab(id)}
                >
                  {id === 'kpir' ? 'KPiR' : t(id === 'events' ? 'fin.tabEvents' : id === 'stats' ? 'fin.tabStats' : 'fin.tabCalendar')}
                </button>
              ))}
            </div>
            <div className="main-panel-user">
              <SettingsButton />
              <button type="button" className="btn" onClick={() => setCounterpartiesOpen(true)}>
                {t('fin.counterparties')}
              </button>
              <button type="button" className="btn" onClick={() => setModule('life')}>
                {t('fin.backToTasks')}
              </button>
            </div>
          </div>
          <div className="fin-toolbar">
            <MonthStepper month={month} onChange={setMonth} />
            <div className="reward-row">
              <button type="button" className="btn" onClick={() => setAiOpen(true)} title={t('fin.aiSettingsTitle')}>
                ✨ {t('fin.aiButton')}
              </button>
              <button type="button" className="btn" onClick={() => setImportOpen(true)}>
                {t('fin.import')}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setEventModal({})}>
                {t('fin.addEvent')}
              </button>
            </div>
          </div>
          <div className="main-panel-body fin-body">
            {shownTab === 'events' && <EventsTab month={month} onEdit={(initial) => setEventModal({ initial })} />}
            {shownTab === 'stats' && <StatsBoard month={month} />}
            {shownTab === 'kpir' && firm && (
              <KpirTab firm={firm} month={month} onEdit={(initial) => setEventModal({ initial })} />
            )}
            {shownTab === 'calendar' && (
              <CalendarTab
                month={month}
                onEdit={(initial) => setEventModal({ initial })}
                onNewOnDate={(defaultDate) => setEventModal({ defaultDate })}
              />
            )}
          </div>
        </div>
      </div>

      {eventModal && <EventModal {...eventModal} onClose={() => setEventModal(null)} />}
      {subscriptionId && <SubscriptionModal subscriptionId={subscriptionId} onClose={() => setSubscriptionId(null)} />}
      {accountModal && <AccountModal {...accountModal} onClose={() => setAccountModal(null)} />}
      {counterpartiesOpen && <CounterpartiesModal onClose={() => setCounterpartiesOpen(false)} />}
      {aiOpen && <AiSettingsModal onClose={() => setAiOpen(false)} />}
      {cryptoId && (
        <CryptoModal
          accountId={cryptoId}
          onClose={() => setCryptoId(null)}
          onSettings={() => {
            setAccountModal({ accountId: cryptoId })
            setCryptoId(null)
          }}
        />
      )}
      {detectOpen && <DetectSubscriptionsModal onClose={() => setDetectOpen(false)} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} />}
    </>
  )
}
