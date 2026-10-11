import { useEffect, useRef, useState } from 'react'
import { fromDataUrl } from '../../lib/documents'
import { useT } from '../../lib/i18n/useT'

interface Props {
  dataUrl: string
  mime: string
  name: string
  /** Fill the available space (full-size preview) instead of a compact thumbnail. */
  large?: boolean
}

const MIN_SCALE = 1
const MAX_SCALE = 10

/**
 * Full-size photo with its own zoom: mouse wheel (with or without Ctrl, which
 * is also what a touchpad pinch sends) zooms around the cursor, dragging pans,
 * double-click toggles zoom, and Ctrl +/-/0 work from the keyboard. Electron
 * doesn't give page zoom for free, hence the hand-made viewer.
 */
function ZoomableImage({ src, name }: { src: string; name: string }): JSX.Element {
  const t = useT()
  const wrapRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)

  /** Zooms by `factor`, keeping the point (cx, cy) — relative to the viewport centre — under the cursor. */
  function zoomBy(factor: number, cx = 0, cy = 0): void {
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor))
      if (scale === MIN_SCALE) return { scale, x: 0, y: 0 }
      const ratio = scale / v.scale
      return { scale, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio }
    })
  }

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    // Registered natively: React's wheel handlers are passive and can't stop the page scrolling.
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const rect = wrap.getBoundingClientRect()
      zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left - rect.width / 2, e.clientY - rect.top - rect.height / 2)
    }
    wrap.addEventListener('wheel', onWheel, { passive: false })
    return () => wrap.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === '+' || e.key === '=') zoomBy(1.25)
      else if (e.key === '-') zoomBy(0.8)
      else if (e.key === '0') setView({ scale: 1, x: 0, y: 0 })
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      ref={wrapRef}
      className={`fin-zoom${view.scale > 1 ? ' fin-zoom--zoomed' : ''}${dragging ? ' fin-zoom--dragging' : ''}`}
      onMouseDown={(e) => {
        if (view.scale === 1) return
        drag.current = { x: e.clientX, y: e.clientY, ox: view.x, oy: view.y }
        setDragging(true)
      }}
      onMouseMove={(e) => {
        const d = drag.current
        if (d) setView((v) => ({ ...v, x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }))
      }}
      onMouseUp={() => {
        drag.current = null
        setDragging(false)
      }}
      onMouseLeave={() => {
        drag.current = null
        setDragging(false)
      }}
      onDoubleClick={(e) => {
        if (view.scale > 1) {
          setView({ scale: 1, x: 0, y: 0 })
        } else {
          const rect = e.currentTarget.getBoundingClientRect()
          zoomBy(3, e.clientX - rect.left - rect.width / 2, e.clientY - rect.top - rect.height / 2)
        }
      }}
    >
      <img
        className="fin-zoom-img"
        src={src}
        alt={name}
        draggable={false}
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      />
      <div className="fin-zoom-bar" onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn" onClick={() => zoomBy(0.8)} title="Ctrl -">
          −
        </button>
        <span>{Math.round(view.scale * 100)}%</span>
        <button type="button" className="icon-btn" onClick={() => zoomBy(1.25)} title="Ctrl +">
          +
        </button>
        <button type="button" className="btn" onClick={() => setView({ scale: 1, x: 0, y: 0 })} title="Ctrl 0">
          {t('fin.zoomFit')}
        </button>
      </div>
      <div className="fin-zoom-hint">{t('fin.zoomHint')}</div>
    </div>
  )
}

/** Shows a photo or a PDF. PDFs go through a blob URL so Chromium's built-in viewer (with its own zoom) can render them. */
export default function FileViewer({ dataUrl, mime, name, large }: Props): JSX.Element {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  useEffect(() => {
    if (mime !== 'application/pdf') return
    const { dataBase64 } = fromDataUrl(dataUrl)
    const bytes = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    setPdfUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [dataUrl, mime])

  const cls = large ? 'fin-viewer fin-viewer--large' : 'fin-viewer'
  if (mime === 'application/pdf') {
    return pdfUrl ? <iframe className={cls} src={pdfUrl} title={name} /> : <div className={cls} />
  }
  if (large) return <ZoomableImage src={dataUrl} name={name} />
  return <img className={cls} src={dataUrl} alt={name} />
}
