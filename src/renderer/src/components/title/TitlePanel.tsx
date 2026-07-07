import TitleHeader from './TitleHeader'
import EnergyBlock from './EnergyBlock'
import FinancePanel from './FinancePanel'
import './TitlePanel.css'

export default function TitlePanel(): JSX.Element {
  return (
    <div className="title-panel">
      <TitleHeader />
      <EnergyBlock />
      <FinancePanel />
    </div>
  )
}
