import { useCallback, useState } from 'react'
import Cropper, { Area } from 'react-easy-crop'
import { getCroppedImageDataUrl } from '../../lib/cropImage'
import { useT } from '../../lib/i18n/useT'

interface Props {
  imageSrc: string
  onCancel: () => void
  onSave: (dataUrl: string) => void
}

export default function AvatarCropModal({ imageSrc, onCancel, onSave }: Props): JSX.Element {
  const t = useT()
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  async function handleSave(): Promise<void> {
    if (!croppedAreaPixels) return
    setSaving(true)
    try {
      const dataUrl = await getCroppedImageDataUrl(imageSrc, croppedAreaPixels)
      onSave(dataUrl)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card avatar-crop-card">
        <h2>{t('avatar.cropTitle')}</h2>
        <p className="avatar-crop-hint">{t('avatar.cropHint')}</p>
        <div className="avatar-crop-area">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="avatar-crop-zoom"
        />
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? t('avatar.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
