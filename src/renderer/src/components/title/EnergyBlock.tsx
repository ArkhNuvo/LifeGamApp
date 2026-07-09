import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import EnergyBattery from './EnergyBattery'
import EnergyBicep from './EnergyBicep'
import EnergyQuizModal from './EnergyQuizModal'
import { useT } from '../../lib/i18n/useT'
import './EnergyBlock.css'

export default function EnergyBlock(): JSX.Element {
  const t = useT()
  const energy = useAppStore((s) => s.data?.energy)
  const [quizKind, setQuizKind] = useState<'mental' | 'physical' | null>(null)

  return (
    <div className="energy-block">
      <div className="energy-line">
        <EnergyBattery percent={energy?.mental ?? 100} />
        <button
          type="button"
          className="icon-btn"
          title={t('energyBlock.mentalTooltip')}
          onClick={() => setQuizKind('mental')}
        >
          ✏️
        </button>
      </div>
      <div className="energy-line">
        <EnergyBicep percent={energy?.physical ?? 100} />
        <button
          type="button"
          className="icon-btn"
          title={t('energyBlock.physicalTooltip')}
          onClick={() => setQuizKind('physical')}
        >
          ✏️
        </button>
      </div>
      {quizKind && <EnergyQuizModal kind={quizKind} onClose={() => setQuizKind(null)} />}
    </div>
  )
}
