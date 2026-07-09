import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import type { CardLocation } from '../../lib/kanbanMove'
import type { CardReward, KanbanCard } from '../../lib/types'
import { formatMonthLabel } from '../../lib/month'
import { todayISO } from '../../lib/date'
import { useT, type TFunction } from '../../lib/i18n/useT'
import type { TranslationKey } from '../../lib/i18n'

export interface CardFormValues {
  title: string
  description: string
  rewards: CardReward[]
  energyMental: number
  energyPhysical: number
  money: number
  createdDate: string
  completedDate: string | null
}

interface Props {
  initial?: KanbanCard
  currentLocation?: CardLocation
  onCancel: () => void
  onSave: (values: CardFormValues, target?: CardLocation) => void
}

const UNASSIGNED_OPTION = '__unassigned__'

const XP_TIERS: { labelKey: TranslationKey; xp: number }[] = [
  { labelKey: 'kanban.xpTier.trivial', xp: 5 },
  { labelKey: 'kanban.xpTier.easy', xp: 10 },
  { labelKey: 'kanban.xpTier.medium', xp: 20 },
  { labelKey: 'kanban.xpTier.hard', xp: 40 },
  { labelKey: 'kanban.xpTier.epic', xp: 80 }
]

function SignToggle({
  sign,
  onToggle,
  t
}: {
  sign: 1 | -1
  onToggle: () => void
  t: TFunction
}): JSX.Element {
  return (
    <button
      type="button"
      className={sign < 0 ? 'sign-toggle sign-toggle--minus' : 'sign-toggle sign-toggle--plus'}
      onClick={onToggle}
      title={sign < 0 ? t('kanban.costSignTooltip') : t('kanban.restoreSignTooltip')}
    >
      {sign < 0 ? '−' : '+'}
    </button>
  )
}

export default function CardModal({ initial, currentLocation, onCancel, onSave }: Props): JSX.Element {
  const t = useT()
  const skills = useAppStore((s) => s.data?.skills ?? [])
  const months = useAppStore((s) => s.data?.kanban.months ?? {})

  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [rewards, setRewards] = useState<CardReward[]>(initial?.rewards ?? [])

  const [energyMentalSign, setEnergyMentalSign] = useState<1 | -1>(
    initial && initial.energyMental > 0 ? 1 : -1
  )
  const [energyMentalAbs, setEnergyMentalAbs] = useState(Math.abs(initial?.energyMental ?? 0))
  const [energyPhysicalSign, setEnergyPhysicalSign] = useState<1 | -1>(
    initial && initial.energyPhysical > 0 ? 1 : -1
  )
  const [energyPhysicalAbs, setEnergyPhysicalAbs] = useState(Math.abs(initial?.energyPhysical ?? 0))
  const [moneySign, setMoneySign] = useState<1 | -1>(initial && initial.money > 0 ? 1 : -1)
  const [moneyAbs, setMoneyAbs] = useState(Math.abs(initial?.money ?? 0))

  const [createdDate, setCreatedDate] = useState(initial?.createdDate ?? todayISO())
  const [completedDate, setCompletedDate] = useState<string | null>(initial?.completedDate ?? null)

  const monthOptions = Object.keys(months).sort()
  const initialMonthKey = currentLocation?.type === 'column' ? currentLocation.monthKey : monthOptions[0]
  const [targetMonthKey, setTargetMonthKey] = useState<string>(initialMonthKey ?? UNASSIGNED_OPTION)
  const [targetColumnId, setTargetColumnId] = useState<string>(
    currentLocation?.type === 'column' ? currentLocation.columnId : ''
  )

  const targetColumns =
    targetMonthKey !== UNASSIGNED_OPTION
      ? months[targetMonthKey]?.columns.slice().sort((a, b) => a.order - b.order) ?? []
      : []

  function addReward(): void {
    setRewards((rs) => [...rs, { skillId: skills[0]?.id ?? '', subskillId: null, xp: 10 }])
  }

  function updateReward(index: number, patch: Partial<CardReward>): void {
    setRewards((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function removeReward(index: number): void {
    setRewards((rs) => rs.filter((_, i) => i !== index))
  }

  function submit(): void {
    if (!title.trim()) return
    const cleanRewards = rewards.filter((r) => r.skillId && r.xp)
    const values: CardFormValues = {
      title: title.trim(),
      description,
      rewards: cleanRewards,
      energyMental: energyMentalSign * (Number(energyMentalAbs) || 0),
      energyPhysical: energyPhysicalSign * (Number(energyPhysicalAbs) || 0),
      money: moneySign * (Number(moneyAbs) || 0),
      createdDate,
      completedDate
    }

    if (!currentLocation) {
      onSave(values)
      return
    }

    const target: CardLocation =
      targetMonthKey === UNASSIGNED_OPTION || !targetColumnId
        ? { type: 'unassigned' }
        : { type: 'column', monthKey: targetMonthKey, columnId: targetColumnId }

    onSave(values, target)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>{initial ? t('kanban.editCardTitle') : t('kanban.newCardTitle')}</h2>
        <div className="form-field">
          <label>{t('common.nameLabel')}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>

        <div className="form-field">
          <label>{t('kanban.descriptionLabel')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={t('kanban.descriptionPlaceholder')}
          />
        </div>

        <div className="form-field">
          <label>{t('kanban.rewardLabel')}</label>
          {rewards.map((reward, i) => {
            const skill = skills.find((s) => s.id === reward.skillId)
            return (
              <div className="reward-block" key={i}>
                <div className="reward-row">
                  <select
                    value={reward.skillId}
                    onChange={(e) => updateReward(i, { skillId: e.target.value, subskillId: null })}
                  >
                    <option value="">{t('kanban.rewardSkillPlaceholder')}</option>
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {skill && skill.subskills.length > 0 && (
                    <select
                      value={reward.subskillId ?? ''}
                      onChange={(e) => updateReward(i, { subskillId: e.target.value || null })}
                    >
                      <option value="">{t('kanban.rewardSubskillPlaceholder')}</option>
                      {skill.subskills.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <input
                    type="number"
                    min={0}
                    value={reward.xp}
                    onChange={(e) => updateReward(i, { xp: Number(e.target.value) })}
                    placeholder={t('kanban.rewardXpPlaceholder')}
                  />
                  <button type="button" className="icon-btn" onClick={() => removeReward(i)}>
                    ×
                  </button>
                </div>
                <div className="reward-tiers">
                  {XP_TIERS.map((tier) => (
                    <button
                      key={tier.labelKey}
                      type="button"
                      className={reward.xp === tier.xp ? 'tier-btn active' : 'tier-btn'}
                      onClick={() => updateReward(i, { xp: tier.xp })}
                      title={`${tier.xp} XP`}
                    >
                      {t(tier.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          <button type="button" className="reward-add-btn" onClick={addReward}>
            {t('kanban.rewardAddButton')}
          </button>
        </div>

        <div className="form-field">
          <label>{t('kanban.mentalEnergyLabel')}</label>
          <div className="signed-field-row">
            <SignToggle sign={energyMentalSign} onToggle={() => setEnergyMentalSign((s) => (s === 1 ? -1 : 1))} t={t} />
            <input
              type="number"
              min={0}
              max={100}
              value={energyMentalAbs}
              onChange={(e) => setEnergyMentalAbs(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="form-field">
          <label>{t('kanban.physicalEnergyLabel')}</label>
          <div className="signed-field-row">
            <SignToggle
              sign={energyPhysicalSign}
              onToggle={() => setEnergyPhysicalSign((s) => (s === 1 ? -1 : 1))}
              t={t}
            />
            <input
              type="number"
              min={0}
              max={100}
              value={energyPhysicalAbs}
              onChange={(e) => setEnergyPhysicalAbs(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="form-field">
          <label>{t('kanban.moneyLabel')}</label>
          <div className="signed-field-row">
            <SignToggle sign={moneySign} onToggle={() => setMoneySign((s) => (s === 1 ? -1 : 1))} t={t} />
            <input
              type="number"
              min={0}
              value={moneyAbs}
              onChange={(e) => setMoneyAbs(Number(e.target.value))}
              placeholder="$"
            />
          </div>
        </div>

        <div className="form-field">
          <label>{t('kanban.createdDateLabel')}</label>
          <input type="date" value={createdDate} onChange={(e) => setCreatedDate(e.target.value)} />
        </div>
        <div className="form-field">
          <label>{t('kanban.completedDateLabel')}</label>
          {completedDate === null ? (
            <div className="signed-field-row">
              <span className="field-hint" style={{ margin: 0 }}>
                {t('kanban.completedDateEmptyHint')}
              </span>
              <button type="button" className="btn" onClick={() => setCompletedDate(todayISO())}>
                {t('kanban.setDateButton')}
              </button>
            </div>
          ) : (
            <div className="signed-field-row">
              <input type="date" value={completedDate} onChange={(e) => setCompletedDate(e.target.value)} />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setCompletedDate(null)}
                title={t('kanban.clearDateTooltip')}
              >
                ×
              </button>
            </div>
          )}
          <span className="field-hint">{t('kanban.completedDateHint')}</span>
        </div>

        {currentLocation && (
          <div className="form-field">
            <label>{t('kanban.moveToLabel')}</label>
            <div className="reward-row">
              <select
                value={targetMonthKey}
                onChange={(e) => {
                  setTargetMonthKey(e.target.value)
                  const cols =
                    e.target.value !== UNASSIGNED_OPTION
                      ? months[e.target.value]?.columns ?? []
                      : []
                  setTargetColumnId(cols[0]?.id ?? '')
                }}
              >
                <option value={UNASSIGNED_OPTION}>{t('kanban.unassignedOption')}</option>
                {monthOptions.map((key) => (
                  <option key={key} value={key}>
                    {formatMonthLabel(key, t)}
                  </option>
                ))}
              </select>
              {targetMonthKey !== UNASSIGNED_OPTION && (
                <select value={targetColumnId} onChange={(e) => setTargetColumnId(e.target.value)}>
                  {targetColumns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
