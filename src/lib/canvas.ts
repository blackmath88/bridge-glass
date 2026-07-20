import type { BoardObject } from './types.js'
import { objectBounds } from './hittest.js'
import type { Viewport } from './viewport.js'

// Mirrored from the token palette in src/styles/index.css (the source of truth).
export const STICKY_COLORS = ['#1a7a6d', '#f0ebe3', '#d4416b', '#2a8fa0'] as const
export const STICKY_TEXT_COLOR = '#050505'

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = word }
      else line = test
    }
    lines.push(line)
  }
  return lines
}

export function drawObject(
  ctx: CanvasRenderingContext2D,
  o: BoardObject,
  preview = false
) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = o.color
  ctx.fillStyle = o.color
  ctx.globalAlpha = preview ? 0.72 : 1
  ctx.lineWidth = o.width

  if (o.type === 'stroke') {
    ctx.beginPath()
    o.points?.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.stroke()
  }

  if (o.type === 'line' || o.type === 'arrow') {
    ctx.beginPath()
    ctx.moveTo(o.x1!, o.y1!)
    ctx.lineTo(o.x2!, o.y2!)
    ctx.stroke()
    if (o.type === 'arrow') {
      const a = Math.atan2(o.y2! - o.y1!, o.x2! - o.x1!)
      const len = 16 + o.width
      ctx.beginPath()
      ctx.moveTo(o.x2!, o.y2!)
      ctx.lineTo(o.x2! - len * Math.cos(a - Math.PI / 6), o.y2! - len * Math.sin(a - Math.PI / 6))
      ctx.moveTo(o.x2!, o.y2!)
      ctx.lineTo(o.x2! - len * Math.cos(a + Math.PI / 6), o.y2! - len * Math.sin(a + Math.PI / 6))
      ctx.stroke()
    }
  }

  if (o.type === 'rect') ctx.strokeRect(o.x!, o.y!, o.w!, o.h!)

  if (o.type === 'circle') {
    const rx = o.w! / 2, ry = o.h! / 2
    ctx.beginPath()
    ctx.ellipse(o.x! + rx, o.y! + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  if (o.type === 'text') {
    ctx.font = `${o.size || 26}px Inter, system-ui, sans-serif`
    ctx.fillText(o.text || '', o.x!, o.y!)
  }
  if (o.type === 'sticky') {
    const x = o.x!, y = o.y!, w = o.w || 160, h = o.h || 120
    ctx.fillStyle = o.color
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill()
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.clip()
    ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 8
    ctx.beginPath(); ctx.moveTo(x + 4, y + h - 4); ctx.lineTo(x + w - 4, y + h - 4); ctx.stroke()
    ctx.fillStyle = STICKY_TEXT_COLOR; ctx.font = '15px Inter, system-ui, sans-serif'
    wrapText(ctx, o.text || '', w - 16).forEach((line, i) => ctx.fillText(line, x + 8, y + 23 + i * 19))
    ctx.restore()
  }
  ctx.restore()
}

export function redraw(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  objects: BoardObject[],
  current: BoardObject | null,
  selected: BoardObject | null = null,
  eraserCursor: { x: number; y: number; radius: number } | null = null,
  viewport: Viewport = { ox: 0, oy: 0, scale: 1 }
) {
  ctx.clearRect(0, 0, ctx.canvas.width / dpr, ctx.canvas.height / dpr)
  ctx.save()
  ctx.translate(viewport.ox, viewport.oy)
  ctx.scale(viewport.scale, viewport.scale)
  objects.forEach((o) => drawObject(ctx, o))
  if (current) drawObject(ctx, current, true)
  if (selected) {
    const b = objectBounds(selected), pad = 6
    ctx.save()
    ctx.strokeStyle = '#2a8fa0' // --accent in src/styles/index.css
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 6])
    ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2)
    ctx.restore()
  }
  ctx.restore()
  if (eraserCursor) {
    ctx.save(); ctx.strokeStyle = 'rgba(240,235,227,.8)'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(eraserCursor.x, eraserCursor.y, eraserCursor.radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
  }
}

export function makeShape(
  tool: BoardObject['type'] | 'pen' | 'eraser' | 'text',
  color: string,
  width: number,
  start: { x: number; y: number },
  p: { x: number; y: number },
  id: string
): BoardObject {
  if (tool === 'rect' || tool === 'circle') {
    return {
      id, type: tool, color, width,
      x: Math.min(start.x, p.x), y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y),
    }
  }
  return { id, type: tool as 'line' | 'arrow', color, width, x1: start.x, y1: start.y, x2: p.x, y2: p.y }
}
