import { useCallback, useState } from 'react'
import Cropper, { Area } from 'react-easy-crop'
import { getCroppedImageDataUrl } from '../../lib/cropImage'

interface Props {
  imageSrc: string
  onCancel: () => void
  onSave: (dataUrl: string) => void
}

export default function AvatarCropModal({ imageSrc, onCancel, onSave }: Props): JSX.Element {
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
        <h2>Настройте аватар</h2>
        <p className="avatar-crop-hint">
          Перетаскивайте изображение и меняйте масштаб, чтобы выбрать видимую часть — круг
          показывает, как аватар будет выглядеть.
        </p>
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
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
