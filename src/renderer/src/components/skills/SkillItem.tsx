import { useState } from 'react'
import { getLevelProgress } from '../../lib/xpCurve'
import { newId } from '../../lib/ids'
import { useAppStore } from '../../state/useAppStore'
import type { Skill } from '../../lib/types'
import XpBar from '../common/XpBar'
import SubskillRow from './SubskillRow'
import NameModal from './NameModal'
import AddSkillModal from './AddSkillModal'
import ConfirmModal from '../common/ConfirmModal'

interface Props {
  skill: Skill
  totalXp: number
}

export default function SkillItem({ skill, totalXp }: Props): JSX.Element {
  const updateData = useAppStore((s) => s.updateData)
  const [addingSubskill, setAddingSubskill] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const progress = getLevelProgress(totalXp)

  function addSubskill(name: string): void {
    updateData((draft) => {
      const s = draft.skills.find((sk) => sk.id === skill.id)
      s?.subskills.push({ id: newId(), name, xp: 0 })
    })
    setAddingSubskill(false)
    setExpanded(true)
  }

  function saveSkillEdit(name: string, color: string): void {
    updateData((draft) => {
      const s = draft.skills.find((sk) => sk.id === skill.id)
      if (s) {
        s.name = name
        s.color = color
      }
    })
    setEditing(false)
  }

  function deleteSkill(): void {
    updateData((draft) => {
      draft.skills = draft.skills.filter((sk) => sk.id !== skill.id)
    })
    setConfirmingDelete(false)
  }

  function deleteSubskill(subId: string): void {
    updateData((draft) => {
      const s = draft.skills.find((sk) => sk.id === skill.id)
      if (s) s.subskills = s.subskills.filter((sub) => sub.id !== subId)
    })
  }

  return (
    <div className="skill-item">
      <div className="skill-item-header">
        <button
          type="button"
          className="skill-item-toggle"
          onClick={() => setExpanded((v) => !v)}
          disabled={skill.subskills.length === 0}
          title={skill.subskills.length === 0 ? undefined : expanded ? 'Свернуть подскиллы' : 'Показать подскиллы'}
        >
          {skill.subskills.length > 0 ? (expanded ? '▾' : '▸') : ''}
        </button>
        <div className="skill-item-main">
          <div className="skill-item-name">{skill.name}</div>
          <XpBar
            level={progress.level}
            xpIntoLevel={progress.xpIntoLevel}
            xpForNextLevel={progress.xpForNextLevel}
            color={skill.color}
            size="lg"
          />
        </div>
        <div className="skill-item-actions">
          <button
            type="button"
            className="icon-btn"
            title="Добавить подскилл"
            onClick={() => setAddingSubskill(true)}
          >
            +
          </button>
          <button type="button" className="icon-btn" title="Редактировать навык" onClick={() => setEditing(true)}>
            ✎
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Удалить навык"
            onClick={() => setConfirmingDelete(true)}
          >
            🗑
          </button>
        </div>
      </div>

      {expanded && skill.subskills.length > 0 && (
        <div className="subskill-list">
          {skill.subskills.map((sub) => (
            <SubskillRow
              key={sub.id}
              subskill={sub}
              color={skill.color}
              onDelete={() => deleteSubskill(sub.id)}
            />
          ))}
        </div>
      )}

      {addingSubskill && (
        <NameModal
          title="Новый подскилл"
          label="Название"
          onCancel={() => setAddingSubskill(false)}
          onSave={addSubskill}
        />
      )}
      {editing && (
        <AddSkillModal
          initialName={skill.name}
          initialColor={skill.color}
          onCancel={() => setEditing(false)}
          onSave={saveSkillEdit}
        />
      )}
      {confirmingDelete && (
        <ConfirmModal
          message="Вы действительно хотите удалить это умение?"
          onConfirm={deleteSkill}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  )
}
