import type { BoardObject, Point } from './types'

export interface Bounds { x: number; y: number; w: number; h: number }

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

export function objectBounds(o: BoardObject): Bounds {
  if (o.points?.length) {
    const xs = o.points.map((p) => p.x), ys = o.points.map((p) => p.y)
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
  }
  if (o.x1 != null && o.y1 != null && o.x2 != null && o.y2 != null) {
    return { x: Math.min(o.x1, o.x2), y: Math.min(o.y1, o.y2), w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1) }
  }
  if (o.type === 'text') {
    const size = o.size || 26
    return { x: o.x!, y: o.y! - size, w: Math.max(size * .6, (o.text?.length || 1) * size * .58), h: size * 1.2 }
  }
  return { x: o.x || 0, y: o.y || 0, w: o.w || 0, h: o.h || 0 }
}

function hits(o: BoardObject, x: number, y: number, tolerance: number): boolean {
  if (o.type === 'stroke' || o.type === 'eraser') {
    const points = o.points || []
    if (points.length === 1) return Math.hypot(x - points[0].x, y - points[0].y) <= tolerance + o.width / 2
    return points.some((p, i) => i > 0 && distanceToSegment({ x, y }, points[i - 1], p) <= tolerance + o.width / 2)
  }
  if (o.type === 'line' || o.type === 'arrow')
    return distanceToSegment({ x, y }, { x: o.x1!, y: o.y1! }, { x: o.x2!, y: o.y2! }) <= tolerance + o.width / 2
  if (o.type === 'rect') {
    const b = objectBounds(o), band = tolerance + o.width / 2
    const outer = x >= b.x - band && x <= b.x + b.w + band && y >= b.y - band && y <= b.y + b.h + band
    const inner = x > b.x + band && x < b.x + b.w - band && y > b.y + band && y < b.y + b.h - band
    return outer && !inner
  }
  if (o.type === 'circle') {
    const rx = Math.abs(o.w! / 2), ry = Math.abs(o.h! / 2)
    if (!rx || !ry) return false
    const d = Math.hypot((x - (o.x! + o.w! / 2)) / rx, (y - (o.y! + o.h! / 2)) / ry)
    return Math.abs(d - 1) * Math.min(rx, ry) <= tolerance + o.width / 2
  }
  const b = objectBounds(o)
  return x >= b.x - tolerance && x <= b.x + b.w + tolerance && y >= b.y - tolerance && y <= b.y + b.h + tolerance
}

export function hitTest(objects: BoardObject[], x: number, y: number, tolerance = 6): BoardObject | null {
  for (let i = objects.length - 1; i >= 0; i--) if (hits(objects[i], x, y, tolerance)) return objects[i]
  return null
}
