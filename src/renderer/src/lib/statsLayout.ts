/** A widget's place on the board: grid units (12 columns wide, unbounded height). */
export interface Rect {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export const GRID_COLS = 12
export const MIN_W = 2
export const MIN_H = 2

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/** Keeps a rectangle inside the board and above the size floor. */
export function clampRect(r: Rect): Rect {
  const w = Math.min(GRID_COLS, Math.max(MIN_W, Math.round(r.w)))
  const h = Math.max(MIN_H, Math.round(r.h))
  const x = Math.min(GRID_COLS - w, Math.max(0, Math.round(r.x)))
  const y = Math.max(0, Math.round(r.y))
  return { ...r, x, y, w, h }
}

/**
 * Resolves overlaps after a widget was moved or resized: the widget in
 * `anchorId` keeps exactly where the user put it, everything else is placed
 * in reading order as high as it fits — so neighbours slide out of the way and
 * gaps close up.
 */
export function settleLayout(rects: Rect[], anchorId?: string): Rect[] {
  const placed: Rect[] = []
  const anchor = anchorId ? rects.find((r) => r.id === anchorId) : undefined
  if (anchor) placed.push(clampRect(anchor))
  const rest = rects
    .filter((r) => r.id !== anchorId)
    .map(clampRect)
    .sort((a, b) => a.y - b.y || a.x - b.x)
  for (const item of rest) {
    let y = 0
    let candidate = { ...item, y }
    while (placed.some((p) => overlaps(candidate, p))) {
      y += 1
      candidate = { ...item, y }
    }
    placed.push(candidate)
  }
  const order = new Map(rects.map((r, i) => [r.id, i]))
  return placed.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}

/** The first free spot of the given size, scanning rows top to bottom. */
export function findFreeSpot(rects: Rect[], w: number, h: number): { x: number; y: number } {
  for (let y = 0; ; y++) {
    for (let x = 0; x + w <= GRID_COLS; x++) {
      const probe = { id: '', x, y, w, h }
      if (!rects.some((r) => overlaps(probe, r))) return { x, y }
    }
  }
}
