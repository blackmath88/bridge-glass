import type { BoardObject } from './types.js'
import { STICKY_COLORS } from './canvas.js'

export const clone = <T,>(value: T): T => structuredClone(value)

export function translateObject(o: BoardObject, dx: number, dy: number) {
  if (o.points) o.points.forEach((p) => { p.x += dx; p.y += dy })
  if (o.x != null) o.x += dx
  if (o.y != null) o.y += dy
  if (o.x1 != null) o.x1 += dx
  if (o.y1 != null) o.y1 += dy
  if (o.x2 != null) o.x2 += dx
  if (o.y2 != null) o.y2 += dy
}

export function nearestStickyColor(hex: string): string {
  const rgb = (value: string) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16))
  const target = rgb(hex)
  const distance = (value: string) => rgb(value).reduce((sum, part, i) => sum + (part - target[i]) ** 2, 0)
  return STICKY_COLORS.reduce((best, candidate) => distance(candidate) < distance(best) ? candidate : best)
}
