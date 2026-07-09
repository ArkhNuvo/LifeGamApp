import { useEffect, useRef, type RefObject } from 'react'

/** Calls onOutside when a mousedown lands outside the returned ref's element, but only while active. */
export function useClickOutside<T extends HTMLElement>(
  active: boolean,
  onOutside: () => void
): RefObject<T> {
  const ref = useRef<T>(null)
  const onOutsideRef = useRef(onOutside)
  onOutsideRef.current = onOutside

  useEffect(() => {
    if (!active) return
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutsideRef.current()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [active])

  return ref
}
