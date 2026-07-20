export interface Viewport { ox: number; oy: number; scale: number }
export interface XY { x: number; y: number }
export const DEFAULT_VIEWPORT: Viewport = { ox: 0, oy: 0, scale: 1 }

export const screenToWorld = (p: XY, v: Viewport): XY => ({ x: (p.x - v.ox) / v.scale, y: (p.y - v.oy) / v.scale })
export const worldToScreen = (p: XY, v: Viewport): XY => ({ x: p.x * v.scale + v.ox, y: p.y * v.scale + v.oy })
export function zoomAt(v: Viewport, screen: XY, nextScale: number): Viewport {
  const scale = Math.max(.25, Math.min(3, nextScale))
  const world = screenToWorld(screen, v)
  return { scale, ox: screen.x - world.x * scale, oy: screen.y - world.y * scale }
}
