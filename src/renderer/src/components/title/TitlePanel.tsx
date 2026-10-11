import TitleHeader from './TitleHeader'
import ResourceSummary from './ResourceSummary'
import './TitlePanel.css'

export default function TitlePanel(): JSX.Element {
  return (
    <div className="title-panel">
      <TitleHeader>
        <ResourceSummary />
      </TitleHeader>
    </div>
  )
}
