import { useState } from 'react'
import TitleHeader from './TitleHeader'
import FinancePanel from './FinancePanel'
import ResourceSummary, { type FinanceSection } from './ResourceSummary'
import './TitlePanel.css'

export default function TitlePanel(): JSX.Element {
  // The editable finance block stays hidden until the user clicks 💲 or 💰
  // in the resource summary; clicking the same icon again closes it.
  const [financeSection, setFinanceSection] = useState<FinanceSection | null>(null)

  return (
    <div className="title-panel">
      <TitleHeader>
        <ResourceSummary
          openSection={financeSection}
          onOpenFinance={(section) => setFinanceSection((cur) => (cur === section ? null : section))}
        />
      </TitleHeader>
      {financeSection && <FinancePanel key={financeSection} focus={financeSection} />}
    </div>
  )
}
