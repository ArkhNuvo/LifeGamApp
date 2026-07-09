import { useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import { newId } from '../../lib/ids'
import { totalSkillXp } from '../../lib/skillXp'
import SkillItem from './SkillItem'
import AddSkillModal from './AddSkillModal'
import { useT } from '../../lib/i18n/useT'
import './SkillsPanel.css'

export default function SkillList(): JSX.Element {
  const t = useT()
  const skills = useAppStore((s) => s.data?.skills ?? [])
  const updateData = useAppStore((s) => s.updateData)
  const [adding, setAdding] = useState(false)

  const sorted = [...skills].sort((a, b) => totalSkillXp(b) - totalSkillXp(a))

  function addSkill(name: string, color: string): void {
    updateData((draft) => {
      draft.skills.push({ id: newId(), name, color, xp: 0, subskills: [] })
    })
    setAdding(false)
  }

  return (
    <div className="skills-panel">
      <div className="skills-panel-header">{t('skills.panelHeader')}</div>
      <div className="skills-list">
        {sorted.map((skill) => (
          <SkillItem key={skill.id} skill={skill} totalXp={totalSkillXp(skill)} />
        ))}
        <button type="button" className="skill-add-btn" onClick={() => setAdding(true)}>
          {t('skills.addButton')}
        </button>
      </div>
      {adding && <AddSkillModal onCancel={() => setAdding(false)} onSave={addSkill} />}
    </div>
  )
}
