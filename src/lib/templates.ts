import type { Template, TemplateIndex, BoardObject } from './types'

// Single source of truth: the bridge-glass content repo (raw GitHub).
// Override at build time with VITE_TEMPLATE_BASE for a CDN or proxy.
const BASE =
  import.meta.env.VITE_TEMPLATE_BASE ??
  'https://raw.githubusercontent.com/blackmath88/bridge-glass_content/main/bridgeboard/templates'

export async function fetchTemplateIndex(): Promise<TemplateIndex> {
  const res = await fetch(`${BASE}/index.json`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`index ${res.status}`)
  return res.json()
}

export async function fetchTemplate(file: string): Promise<Template> {
  const res = await fetch(`${BASE}/${file}`, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`template ${res.status}`)
  return res.json()
}

// Convert a template's normalized objects into pixel-space objects for the
// current stage size. Templates store 0..1; the canvas draws in pixels.
export function denormalize(objects: BoardObject[], w: number, h: number): BoardObject[] {
  const sx = (v?: number) => (v ?? 0) * w
  const sy = (v?: number) => (v ?? 0) * h
  return objects.map((o) => {
    if (!o.norm) return o
    const out: BoardObject = { ...o, norm: false }
    if (o.x != null) out.x = sx(o.x)
    if (o.y != null) out.y = sy(o.y)
    if (o.w != null) out.w = sx(o.w)
    if (o.h != null) out.h = sy(o.h)
    if (o.x1 != null) out.x1 = sx(o.x1)
    if (o.y1 != null) out.y1 = sy(o.y1)
    if (o.x2 != null) out.x2 = sx(o.x2)
    if (o.y2 != null) out.y2 = sy(o.y2)
    if (o.size != null) out.size = o.size * h // size is fraction of stage height
    if (o.points) out.points = o.points.map((p) => ({ ...p, x: p.x * w, y: p.y * h }))
    return out
  })
}

// Templates in the repo are authored with norm=true implicitly (no flag set but
// values are 0..1). Mark them so denormalize() knows to scale.
export function markNormalized(t: Template): BoardObject[] {
  return t.objects.map((o) => ({ ...o, norm: true }))
}
