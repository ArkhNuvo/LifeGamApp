import { useEffect, useState } from 'react'
import { useAppStore } from '../../state/useAppStore'
import AvatarCropModal from './AvatarCropModal'
import { useT } from '../../lib/i18n/useT'
import './AvatarUpload.css'

export default function AvatarUpload(): JSX.Element {
  const t = useT()
  const username = useAppStore((s) => s.username)
  const avatarFile = useAppStore((s) => s.data?.profile.avatar.file)
  const updateData = useAppStore((s) => s.updateData)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (avatarFile) {
      window.api.files.readAsDataUrl(avatarFile).then((url) => {
        if (!cancelled) setAvatarDataUrl(url)
      })
    } else {
      setAvatarDataUrl(null)
    }
    return () => {
      cancelled = true
    }
  }, [avatarFile])

  async function handleClick(): Promise<void> {
    const picked = await window.api.files.pickImage()
    if (!picked) return
    const dataUrl = await window.api.files.readAsDataUrl(picked)
    setPendingImage(dataUrl)
  }

  async function handleSave(dataUrl: string): Promise<void> {
    if (!username) return
    const savedPath = await window.api.files.saveAvatar(username, dataUrl)
    updateData((draft) => {
      draft.profile.avatar.file = savedPath
    })
    setPendingImage(null)
  }

  return (
    <>
      <button type="button" className="avatar-upload" onClick={handleClick} title={t('avatar.changeTooltip')}>
        {avatarDataUrl ? (
          <img src={avatarDataUrl} alt={t('avatar.altText')} className="avatar-img" />
        ) : (
          <span className="avatar-placeholder">+</span>
        )}
      </button>
      {pendingImage && (
        <AvatarCropModal
          imageSrc={pendingImage}
          onCancel={() => setPendingImage(null)}
          onSave={handleSave}
        />
      )}
    </>
  )
}
