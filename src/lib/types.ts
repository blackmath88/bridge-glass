// Board object types — mirror bridge-glass schema.
// Template coordinates are normalized 0..1; live drawing uses pixels.
// `norm` marks whether x/y/w/h are normalized (templates) or pixel (user strokes).

export type Tool = 'pen' | 'eraser' | 'text' | 'line' | 'arrow' | 'rect' | 'circle'

export interface Point { x: number; y: number; p?: number }

export interface BoardObject {
  type: 'stroke' | 'eraser' | 'line' | 'arrow' | 'rect' | 'circle' | 'text'
  color: string
  width: number
  norm?: boolean        // true => x/y/w/h/x1.. are 0..1 fractions of the stage
  // strokes
  points?: Point[]
  // shapes
  x?: number; y?: number; w?: number; h?: number
  x1?: number; y1?: number; x2?: number; y2?: number
  // text
  text?: string; size?: number   // size is normalized fraction of stage height when norm=true
}

export interface Template {
  id: string
  name: string
  description?: string
  category: string
  tags?: string[]
  style: 'bridgeboard_dark_glass'
  accent?: string
  objects: BoardObject[]
  facilitation_notes?: string[]
  system_prompt?: string
  version: string
  created_at?: string
  updated_at?: string
}

export interface TemplateIndexEntry {
  file: string
  id: string
  name: string
  category: string
  version: string
  objects: number
  tags: string[]
}

export interface TemplateIndex {
  generated: string
  count: number
  templates: TemplateIndexEntry[]
}
