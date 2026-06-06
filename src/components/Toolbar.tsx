import type { Tool } from '../lib/types'

const TOOLS: Tool[] = ['pen', 'eraser', 'text', 'line', 'arrow', 'rect', 'circle']
const COLORS = [
  { hex: '#f0ebe3', title: 'Cream' },
  { hex: '#2a8fa0', title: 'Cyan' },
  { hex: '#1a7a6d', title: 'Teal' },
  { hex: '#8a8a8a', title: 'Grey' },
]

interface Props {
  tool: Tool; color: string; width: number
  onTool: (t: Tool) => void; onColor: (c: string) => void; onWidth: (w: number) => void
  onUndo: () => void; onRedo: () => void
  onToggleGrid: () => void; onPresent: () => void
  onExportPng: () => void; onExportJson: () => void
  onLoadJson: (f: File) => void; onClear: () => void
}

export function Toolbar(p: Props) {
  return (
    <div className="toolbar" role="toolbar">
      {TOOLS.map((t) => (
        <button key={t} className={p.tool === t ? 'active' : ''} onClick={() => p.onTool(t)}>
          {t === 'rect' ? 'Rect' : t[0].toUpperCase() + t.slice(1)}
        </button>
      ))}
      <div className="divider" />
      {COLORS.map((c) => (
        <button key={c.hex} className={`swatch${p.color === c.hex ? ' active' : ''}`} title={c.title}
          onClick={() => p.onColor(c.hex)}>
          <span style={{ background: c.hex }} />
        </button>
      ))}
      <input type="range" min={1} max={18} value={p.width} title="Stroke width"
        onChange={(e) => p.onWidth(+e.target.value)} />
      <div className="divider" />
      <button onClick={p.onUndo}>Undo</button>
      <button onClick={p.onRedo}>Redo</button>
      <button onClick={p.onToggleGrid}>Grid</button>
      <button onClick={p.onPresent}>Present</button>
      <button onClick={p.onExportPng}>PNG</button>
      <button onClick={p.onExportJson}>JSON</button>
      <label className="file">Load
        <input type="file" accept="application/json"
          onChange={(e) => e.target.files?.[0] && p.onLoadJson(e.target.files[0])} />
      </label>
      <button className="danger" onClick={p.onClear}>Clear</button>
    </div>
  )
}
