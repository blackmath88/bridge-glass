import type { BoardObject } from './types'

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

  if (o.type === 'stroke' || o.type === 'eraser') {
    ctx.globalCompositeOperation = o.type === 'eraser' ? 'destination-out' : 'source-over'
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
  ctx.restore()
}

export function redraw(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  objects: BoardObject[],
  current: BoardObject | null
) {
  ctx.clearRect(0, 0, ctx.canvas.width / dpr, ctx.canvas.height / dpr)
  objects.forEach((o) => drawObject(ctx, o))
  if (current) drawObject(ctx, current, true)
}

export function makeShape(
  tool: BoardObject['type'] | 'pen' | 'eraser' | 'text',
  color: string,
  width: number,
  start: { x: number; y: number },
  p: { x: number; y: number }
): BoardObject {
  if (tool === 'rect' || tool === 'circle') {
    return {
      type: tool, color, width,
      x: Math.min(start.x, p.x), y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y),
    }
  }
  return { type: tool as 'line' | 'arrow', color, width, x1: start.x, y1: start.y, x2: p.x, y2: p.y }
}
