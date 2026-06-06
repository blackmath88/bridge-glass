import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardObject, Tool } from '../lib/types'
import { redraw, makeShape } from '../lib/canvas'
import { fetchTemplate, denormalize, markNormalized } from '../lib/templates'
import { SignalMark } from './SignalMark'
import { Toolbar } from './Toolbar'
import { TemplatePanel } from './TemplatePanel'

export function Board() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<HTMLDivElement>(null)

  // mutable drawing state kept in refs (avoids re-render per pointermove)
  const objects = useRef<BoardObject[]>([])
  const redoStack = useRef<BoardObject[]>([])
  const current = useRef<BoardObject | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const drawing = useRef(false)
  const dpr = useRef(1)

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#f0ebe3')
  const [width, setWidth] = useState(4)
  const [device, setDevice] = useState('mouse / touch / pen')
  const [toast, setToast] = useState('')

  // keep latest tool/color/width available to event handlers
  const ref = useRef({ tool, color, width })
  ref.current = { tool, color, width }

  const ctx = () => canvasRef.current!.getContext('2d')!
  const paint = useCallback(() => redraw(ctx(), dpr.current, objects.current, current.current), [])

  const showToast = (m: string) => { setToast(m); window.clearTimeout((showToast as any).t); (showToast as any).t = window.setTimeout(() => setToast(''), 1600) }

  const resize = useCallback(() => {
    const c = canvasRef.current!, s = stageRef.current!
    const r = s.getBoundingClientRect()
    dpr.current = Math.max(1, window.devicePixelRatio || 1)
    c.width = Math.round(r.width * dpr.current)
    c.height = Math.round(r.height * dpr.current)
    c.style.width = r.width + 'px'
    c.style.height = r.height + 'px'
    ctx().setTransform(dpr.current, 0, 0, dpr.current, 0, 0)
    paint()
  }, [paint])

  const posOf = (e: PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pressure > 0 ? e.pressure : 1 }
  }

  const add = (o: BoardObject) => { objects.current.push(o); redoStack.current = []; paint() }

  // pointer handlers
  useEffect(() => {
    const c = canvasRef.current!
    const down = (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId)
      const p = posOf(e); start.current = p; drawing.current = true
      setDevice(e.pointerType || 'pointer')
      const { tool, color, width } = ref.current
      if (tool === 'text') {
        const text = prompt('Text on glass:')
        if (text) add({ type: 'text', text, x: p.x, y: p.y, color, width, size: 28 })
        drawing.current = false; return
      }
      if (tool === 'pen' || tool === 'eraser')
        current.current = { type: tool === 'eraser' ? 'eraser' : 'stroke', color, width: tool === 'eraser' ? width * 3 : width, points: [p] }
      else current.current = makeShape(tool, color, width, p, p)
      paint()
    }
    const move = (e: PointerEvent) => {
      if (!drawing.current || !current.current) return
      const p = posOf(e); const { tool, color, width } = ref.current
      if (tool === 'pen' || tool === 'eraser') current.current.points!.push(p)
      else current.current = makeShape(tool, color, width, start.current!, p)
      paint()
    }
    const finish = () => {
      if (!drawing.current || !current.current) return
      add(current.current); current.current = null; drawing.current = false
    }
    c.addEventListener('pointerdown', down)
    c.addEventListener('pointermove', move)
    c.addEventListener('pointerup', finish)
    c.addEventListener('pointercancel', finish)
    return () => {
      c.removeEventListener('pointerdown', down)
      c.removeEventListener('pointermove', move)
      c.removeEventListener('pointerup', finish)
      c.removeEventListener('pointercancel', finish)
    }
  }, [paint])

  // resize + keyboard
  useEffect(() => {
    resize()
    window.addEventListener('resize', resize)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') appRef.current!.classList.toggle('present')
      if (e.key === 'Escape') appRef.current!.classList.remove('present')
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo()
    }
    document.addEventListener('keydown', key)
    return () => { window.removeEventListener('resize', resize); document.removeEventListener('keydown', key) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resize])

  const undo = () => { const o = objects.current.pop(); if (o) { redoStack.current.push(o); paint() } }
  const redo = () => { const o = redoStack.current.pop(); if (o) { objects.current.push(o); paint() } }
  const clear = () => { if (confirm('Clear the board?')) { objects.current = []; redoStack.current = []; paint() } }

  const exportPng = () => {
    const a = document.createElement('a')
    a.download = 'bridgeboard.png'; a.href = canvasRef.current!.toDataURL('image/png'); a.click()
    showToast('PNG exported')
  }
  const exportJson = () => {
    const data = JSON.stringify({ app: 'Bridgeboard', version: '0.3', objects: objects.current }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const a = document.createElement('a')
    a.download = 'bridgeboard-session.json'; a.href = URL.createObjectURL(blob); a.click()
    URL.revokeObjectURL(a.href); showToast('JSON exported')
  }
  const loadJson = (f: File) => {
    const r = new FileReader()
    r.onload = () => {
      try { objects.current = JSON.parse(r.result as string).objects || []; redoStack.current = []; paint(); showToast('Session loaded') }
      catch { alert('Could not load JSON') }
    }
    r.readAsText(f)
  }

  const loadTemplate = async (file: string) => {
    try {
      const t = await fetchTemplate(file)
      const r = stageRef.current!.getBoundingClientRect()
      objects.current = denormalize(markNormalized(t), r.width, r.height)
      redoStack.current = []; paint(); showToast(`Loaded · ${t.name}`)
    } catch { showToast('Template load failed') }
  }

  return (
    <div className="app" ref={appRef}>
      <header>
        <div className="brand">
          <SignalMark />
          <div className="name">
            <b>Bridgeboard<span className="ai" /></b>
            <small>Bridge Work · AI Lab</small>
          </div>
        </div>
        <div className="status">Input <strong>{device}</strong></div>
      </header>
      <main>
        <div className="stage grid" ref={stageRef}>
          <canvas ref={canvasRef} />
          <div className="wordmark">bridge-work.ai</div>
          <div className="hint">Draw with mouse, touch or Samsung S Pen · P to present · Esc to exit</div>
        </div>
        <Toolbar
          tool={tool} color={color} width={width}
          onTool={setTool} onColor={setColor} onWidth={setWidth}
          onUndo={undo} onRedo={redo}
          onToggleGrid={() => stageRef.current!.classList.toggle('grid')}
          onPresent={() => appRef.current!.classList.toggle('present')}
          onExportPng={exportPng} onExportJson={exportJson} onLoadJson={loadJson} onClear={clear}
        />
        <TemplatePanel onLoad={loadTemplate} />
        <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
      </main>
    </div>
  )
}
