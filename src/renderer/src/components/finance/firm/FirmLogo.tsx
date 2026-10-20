import { useEffect, useState } from 'react'

const cache = new Map<string, string>()

/** A stored image as a data URL (attachments live outside the renderer's reach). */
export function useStoredImage(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(path ? (cache.get(path) ?? null) : null)
  useEffect(() => {
    if (!path) {
      setUrl(null)
      return
    }
    const hit = cache.get(path)
    if (hit) {
      setUrl(hit)
      return
    }
    let alive = true
    window.api.attachments
      .read(path)
      .then((data) => {
        cache.set(path, data)
        if (alive) setUrl(data)
      })
      .catch(() => alive && setUrl(null))
    return () => {
      alive = false
    }
  }, [path])
  return url
}

/** The firm's logo, or its initial on a coloured square when there is none. */
export default function FirmLogo({ name, logo, size = 36 }: { name: string; logo: string | null; size?: number }): JSX.Element {
  const url = useStoredImage(logo)
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  if (url) return <img className="firm-logo" src={url} alt="" style={{ width: size, height: size }} />
  return (
    <span className="firm-logo firm-logo--initial" style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {initial}
    </span>
  )
}
