import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardObject, Template, Tool } from '../lib/types'
import { drawObject, redraw, makeShape, STICKY_COLORS } from '../lib/canvas'
import { denormalize, markNormalized } from '../lib/templates'
import { SignalMark } from './SignalMark'
import { Toolbar } from './Toolbar'
import { TemplatePanel } from './TemplatePanel'
import { hitTest } from '../lib/hittest'
import { uid } from '../lib/uid'
import { TOOLS } from './Toolbar'
import { History } from '../lib/history'
import { BoardDrawer } from './BoardDrawer'
import { createBoard, deleteBoard, duplicateBoard, listBoards, loadBoard, migrateLegacySession, renameBoard, saveBoard, type BoardMeta } from '../lib/store'
import { clone, nearestStickyColor, translateObject } from '../lib/objects'
import { DEFAULT_VIEWPORT, screenToWorld, worldToScreen, zoomAt, type Viewport } from '../lib/viewport'
import { objectBounds } from '../lib/hittest'

export function Board() {
  type Editor = { object: BoardObject; isNew: boolean; before?: BoardObject }
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<HTMLDivElement>(null)

  // mutable drawing state kept in refs (avoids re-render per pointermove)
  const objects = useRef<BoardObject[]>([])
  const current = useRef<BoardObject | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const drawing = useRef(false)
  const dpr = useRef(1)
  const selectedId = useRef<string | null>(null)
  const dragOrigin = useRef<{ x: number; y: number } | null>(null)
  const dragDelta = useRef({ x: 0, y: 0 })
  const erased = useRef<Array<{ object: BoardObject; index: number }>>([])
  const eraseBefore = useRef<BoardObject[]>([])
  const eraserCursor = useRef<{ x: number; y: number; radius: number } | null>(null)
  const lastErase = useRef(0)
  const history = useRef<History | null>(null)
  const initialized = useRef(false)
  const viewport = useRef<Viewport>({ ...DEFAULT_VIEWPORT })
  const spaceDown = useRef(false)
  const panning = useRef(false)
  const panOrigin = useRef<{ x: number; y: number } | null>(null)
  const activePointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; center: { x: number; y: number }; scale: number } | null>(null)

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#f0ebe3')
  const [width, setWidth] = useState(4)
  const [device, setDevice] = useState('mouse / touch / pen')
  const [toast, setToast] = useState('')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [boards, setBoards] = useState<BoardMeta[]>([])
  const [currentBoard, setCurrentBoard] = useState<BoardMeta | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null)
  const [zoomPercent, setZoomPercent] = useState(100)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')

  if (!history.current) history.current = new History(() => setHistoryVersion((v) => v + 1))

  // keep latest tool/color/width available to event handlers
  const ref = useRef({ tool, color, width })
  ref.current = { tool, color, width }

  const ctx = () => canvasRef.current!.getContext('2d')!
  const paint = useCallback(() => redraw(ctx(), dpr.current, objects.current, current.current, objects.current.find((o) => o.id === selectedId.current) || null, eraserCursor.current, viewport.current), [])

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

  const screenPosOf = (e: PointerEvent | WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const posOf = (e: PointerEvent) => ({ ...screenToWorld(screenPosOf(e), viewport.current), p: e.pressure > 0 ? e.pressure : 1 })
  const replace = (next: BoardObject[]) => { objects.current = clone(next); selectedId.current = null; paint() }

  const add = (o: BoardObject) => {
    objects.current.push(o)
    const snapshot = clone(o)
    history.current!.push({
      label: 'add',
      undo: () => { objects.current = objects.current.filter((item) => item.id !== snapshot.id); paint() },
      redo: () => { objects.current.push(clone(snapshot)); paint() },
    })
    paint()
  }

  const openNewEditor = (o: BoardObject) => {
    objects.current.push(o)
    setEditor({ object: o, isNew: true })
    paint()
  }

  const openExistingEditor = (o: BoardObject) => setEditor({ object: o, isNew: false, before: clone(o) })

  const commitEditor = () => {
    if (!editor) return
    const after = clone(editor.object)
    if (editor.isNew) {
      history.current!.push({
        label: `add ${after.type}`,
        undo: () => { objects.current = objects.current.filter((o) => o.id !== after.id); paint() },
        redo: () => { objects.current.push(clone(after)); paint() },
      })
    } else {
      const before = clone(editor.before!)
      history.current!.push({
        label: `edit ${after.type}`,
        undo: () => { const o = objects.current.find((item) => item.id === after.id); if (o) Object.assign(o, clone(before)); paint() },
        redo: () => { const o = objects.current.find((item) => item.id === after.id); if (o) Object.assign(o, clone(after)); paint() },
      })
    }
    setEditor(null); paint()
  }

  const cancelEditor = () => {
    if (!editor) return
    if (editor.isNew) objects.current = objects.current.filter((o) => o.id !== editor.object.id)
    else Object.assign(editor.object, clone(editor.before!))
    setEditor(null); paint()
  }

  const refreshBoards = () => setBoards(listBoards())

  const switchBoard = (id: string) => {
    try {
      const board = loadBoard(id)
      if (!board) return
      objects.current = clone(board.objects).map((o) => ({ ...o, id: o.id || uid() }))
      selectedId.current = null; current.current = null
      setCurrentBoard(board.meta); history.current!.clear(); setDrawerOpen(false); paint()
    } catch (error) { showToast(error instanceof Error ? error.message : 'Board load failed') }
  }

  useEffect(() => {
    try {
      let index = listBoards()
      if (!index.length) index = [migrateLegacySession().meta]
      setBoards(index); switchBoard(index[0].id); initialized.current = true
    } catch (error) { showToast(error instanceof Error ? error.message : 'Storage unavailable') }
    // Initial board load happens once; switching is user-driven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!initialized.current || !currentBoard) return
    setSaveStatus('saving')
    const timer = window.setTimeout(() => {
      try { const saved = saveBoard(currentBoard.id, currentBoard.name, objects.current); setCurrentBoard(saved.meta); refreshBoards(); setSaveStatus('saved') }
      catch (error) { setSaveStatus('error'); showToast(`${error instanceof Error ? error.message : 'Autosave failed'} · Export JSON to recover`) }
    }, 800)
    return () => window.clearTimeout(timer)
    // History changes are the autosave signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyVersion])

  const eraseAt = (p: { x: number; y: number }) => {
    const radius = Math.max(8, ref.current.width * 1.5)
    eraserCursor.current = { ...worldToScreen(p, viewport.current), radius }
    const hit = hitTest(objects.current, p.x, p.y, radius / viewport.current.scale)
    if (hit && !erased.current.some((item) => item.object.id === hit.id)) {
      const index = objects.current.indexOf(hit)
      erased.current.push({ object: clone(hit), index })
      objects.current.splice(index, 1)
      if (selectedId.current === hit.id) selectedId.current = null
    }
  }

  // pointer handlers
  useEffect(() => {
    const c = canvasRef.current!
    const down = (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId)
      const screen = screenPosOf(e)
      activePointers.current.set(e.pointerId, screen)
      if (activePointers.current.size === 2) {
        const [a, b] = [...activePointers.current.values()], center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), center, scale: viewport.current.scale }
        drawing.current = false; current.current = null; return
      }
      if (spaceDown.current) { panning.current = true; panOrigin.current = screen; return }
      const p = posOf(e); start.current = p; drawing.current = true
      setDevice(e.pointerType || 'pointer')
      const { tool, color, width } = ref.current
      if (tool === 'eraser') {
        erased.current = []; eraseBefore.current = clone(objects.current); lastErase.current = performance.now(); eraseAt(p); paint(); return
      }
      if (tool === 'select') {
        const hit = hitTest(objects.current, p.x, p.y, 6 / viewport.current.scale)
        selectedId.current = hit?.id || null
        if (hit?.norm) {
          // A normalized template object becomes pixel-based once, before moving.
          const r = stageRef.current!.getBoundingClientRect()
          const pixel = denormalize([hit], r.width, r.height)[0]
          Object.assign(hit, pixel)
        }
        dragOrigin.current = hit ? p : null
        dragDelta.current = { x: 0, y: 0 }
        paint(); return
      }
      if (tool === 'text') {
        openNewEditor({ id: uid(), type: 'text', text: '', x: p.x, y: p.y, color, width, size: 28 })
        drawing.current = false; return
      }
      if (tool === 'sticky') {
        openNewEditor({ id: uid(), type: 'sticky', text: '', x: p.x, y: p.y, w: 160, h: 120, color: STICKY_COLORS[1], width: 1 })
        drawing.current = false; return
      }
      if (tool === 'pen')
        current.current = { id: uid(), type: 'stroke', color, width, points: [p] }
      else current.current = makeShape(tool, color, width, p, p, uid())
      paint()
    }
    const move = (e: PointerEvent) => {
      const screen = screenPosOf(e)
      if (activePointers.current.has(e.pointerId)) activePointers.current.set(e.pointerId, screen)
      if (activePointers.current.size === 2 && pinch.current) {
        const [a, b] = [...activePointers.current.values()], center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        viewport.current = zoomAt(viewport.current, pinch.current.center, pinch.current.scale * distance / Math.max(1, pinch.current.distance))
        viewport.current.ox += center.x - pinch.current.center.x; viewport.current.oy += center.y - pinch.current.center.y
        setZoomPercent(Math.round(viewport.current.scale * 100)); paint(); return
      }
      if (panning.current && panOrigin.current) {
        viewport.current.ox += screen.x - panOrigin.current.x; viewport.current.oy += screen.y - panOrigin.current.y
        panOrigin.current = screen; paint(); return
      }
      const p = posOf(e); const { tool, color, width } = ref.current
      if (tool === 'eraser') {
        eraserCursor.current = { x: p.x, y: p.y, radius: Math.max(8, width * 1.5) }
        if (drawing.current && performance.now() - lastErase.current >= 16) { lastErase.current = performance.now(); eraseAt(p) }
        paint()
        return
      }
      if (!drawing.current) return
      if (tool === 'select') {
        const o = objects.current.find((item) => item.id === selectedId.current)
        if (o && dragOrigin.current) {
          translateObject(o, p.x - dragOrigin.current.x, p.y - dragOrigin.current.y)
          dragDelta.current.x += p.x - dragOrigin.current.x
          dragDelta.current.y += p.y - dragOrigin.current.y
          dragOrigin.current = p; paint()
        }
        return
      }
      if (!current.current) return
      if (tool === 'pen') current.current.points!.push(p)
      else current.current = makeShape(tool, color, width, start.current!, p, current.current.id)
      paint()
    }
    const finish = (e: PointerEvent) => {
      activePointers.current.delete(e.pointerId)
      if (activePointers.current.size < 2) pinch.current = null
      if (panning.current) { panning.current = false; panOrigin.current = null; return }
      if (!drawing.current) return
      if (ref.current.tool === 'eraser') {
        if (erased.current.length) {
          const before = clone(eraseBefore.current), after = clone(objects.current)
          history.current!.push({
          label: 'erase objects',
            undo: () => replace(before),
            redo: () => replace(after),
          })
        }
        drawing.current = false; erased.current = []; eraserCursor.current = null; paint(); return
      }
      if (ref.current.tool === 'select') {
        const id = selectedId.current, delta = { ...dragDelta.current }
        if (id && (delta.x || delta.y)) history.current!.push({
          label: 'move',
          undo: () => { const o = objects.current.find((item) => item.id === id); if (o) translateObject(o, -delta.x, -delta.y); paint() },
          redo: () => { const o = objects.current.find((item) => item.id === id); if (o) translateObject(o, delta.x, delta.y); paint() },
        })
        drawing.current = false; dragOrigin.current = null; return
      }
      if (!current.current) return
      add(current.current); current.current = null; drawing.current = false
    }
    const doubleClick = (e: MouseEvent) => {
      if (ref.current.tool !== 'select') return
      const p = screenToWorld(screenPosOf(e as unknown as PointerEvent), viewport.current)
      const o = hitTest(objects.current, p.x, p.y, 6 / viewport.current.scale)
      if (o?.type === 'text' || o?.type === 'sticky') openExistingEditor(o)
    }
    c.addEventListener('pointerdown', down)
    c.addEventListener('pointermove', move)
    c.addEventListener('pointerup', finish)
    c.addEventListener('pointercancel', finish)
    c.addEventListener('dblclick', doubleClick)
    const wheel = (e: WheelEvent) => { e.preventDefault(); viewport.current = zoomAt(viewport.current, screenPosOf(e), viewport.current.scale * Math.exp(-e.deltaY * .001)); setZoomPercent(Math.round(viewport.current.scale * 100)); paint() }
    c.addEventListener('wheel', wheel, { passive: false })
    return () => {
      c.removeEventListener('pointerdown', down)
      c.removeEventListener('pointermove', move)
      c.removeEventListener('pointerup', finish)
      c.removeEventListener('pointercancel', finish)
      c.removeEventListener('dblclick', doubleClick)
      c.removeEventListener('wheel', wheel)
    }
  }, [paint])

  // resize + keyboard
  useEffect(() => {
    resize()
    window.addEventListener('resize', resize)
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !/INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)) { spaceDown.current = true; e.preventDefault() }
      if (e.key === '0') { viewport.current = { ...DEFAULT_VIEWPORT }; setZoomPercent(100); paint() }
      if (e.key === 'p' || e.key === 'P') appRef.current!.classList.toggle('present')
      if (e.key === 'Escape') appRef.current!.classList.remove('present')
      const target = e.target as HTMLElement
      if (/INPUT|TEXTAREA/.test(target.tagName)) return
      if (e.key.toLowerCase() === 'v') setTool('select')
      if (/^[1-8]$/.test(e.key)) setTool(TOOLS[Number(e.key) - 1])
      const selected = objects.current.find((o) => o.id === selectedId.current)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        const snapshot = clone(selected), index = objects.current.indexOf(selected)
        objects.current.splice(index, 1); selectedId.current = null
        history.current!.push({ label: 'delete', undo: () => { objects.current.splice(index, 0, clone(snapshot)); paint() }, redo: () => { objects.current = objects.current.filter((o) => o.id !== snapshot.id); paint() } })
        paint(); e.preventDefault()
      }
      if (e.key === 'Escape') { selectedId.current = null; paint() }
      if (selected && e.key.startsWith('Arrow')) {
        const n = e.shiftKey ? 10 : 1
        translateObject(selected, e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0)
        const dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0
        const dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0
        const id = selected.id
        history.current!.push({
          label: 'nudge',
          undo: () => { const o = objects.current.find((item) => item.id === id); if (o) translateObject(o, -dx, -dy); paint() },
          redo: () => { const o = objects.current.find((item) => item.id === id); if (o) translateObject(o, dx, dy); paint() },
        })
        paint(); e.preventDefault()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.shiftKey ? history.current!.redo() : history.current!.undo(); e.preventDefault() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { history.current!.redo(); e.preventDefault() }
    }
    document.addEventListener('keydown', key)
    const keyup = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = false }
    document.addEventListener('keyup', keyup)
    return () => { window.removeEventListener('resize', resize); document.removeEventListener('keydown', key); document.removeEventListener('keyup', keyup) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resize])

  const undo = () => history.current!.undo()
  const redo = () => history.current!.redo()
  const restyle = (changes: Partial<Pick<BoardObject, 'color' | 'width'>>) => {
    const selected = objects.current.find((o) => o.id === selectedId.current)
    if (!selected) return false
    const before = clone(selected)
    Object.assign(selected, changes)
    if (selected.type === 'sticky' && changes.color) selected.color = nearestStickyColor(changes.color)
    const after = clone(selected)
    history.current!.push({
      label: 'restyle',
      undo: () => { const o = objects.current.find((item) => item.id === before.id); if (o) Object.assign(o, clone(before)); paint() },
      redo: () => { const o = objects.current.find((item) => item.id === after.id); if (o) Object.assign(o, clone(after)); paint() },
    })
    paint(); return true
  }
  const clear = () => {
    if (!confirm('Clear the board?') || !objects.current.length) return
    const before = clone(objects.current); replace([])
    history.current!.push({ label: 'clear', undo: () => replace(before), redo: () => replace([]) })
  }

  const exportPng = () => {
    const a = document.createElement('a')
    const bounds = objects.current.map(objectBounds)
    const minX = Math.min(...bounds.map((b) => b.x), 0), minY = Math.min(...bounds.map((b) => b.y), 0)
    const maxX = Math.max(...bounds.map((b) => b.x + b.w), 1), maxY = Math.max(...bounds.map((b) => b.y + b.h), 1), margin = 32
    const exportCanvas = document.createElement('canvas'); exportCanvas.width = Math.ceil(maxX - minX + margin * 2); exportCanvas.height = Math.ceil(maxY - minY + margin * 2)
    const exportCtx = exportCanvas.getContext('2d')!; exportCtx.translate(margin - minX, margin - minY); objects.current.forEach((o) => drawObject(exportCtx, o))
    a.download = 'bridgeboard.png'; a.href = exportCanvas.toDataURL('image/png'); a.click()
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
      try {
        const before = clone(objects.current)
        const after = (JSON.parse(r.result as string).objects || []).map((o: BoardObject) => ({ ...o, id: o.id || uid() }))
        replace(after)
        history.current!.push({ label: 'load JSON', undo: () => replace(before), redo: () => replace(after) })
        showToast('Session loaded')
      }
      catch { alert('Could not load JSON') }
    }
    r.readAsText(f)
  }

  const applyTemplate = (t: Template, mode: 'replace' | 'add') => {
    try {
      const r = stageRef.current!.getBoundingClientRect()
      const before = clone(objects.current)
      const incoming = denormalize(markNormalized(t), r.width, r.height).map((o) => ({ ...o, id: uid() }))
      const after = mode === 'replace' ? incoming : [...before, ...incoming]
      replace(after)
      history.current!.push({ label: `${mode} template`, undo: () => replace(before), redo: () => replace(after) })
      if (t.accent) setColor(t.accent)
      setPendingTemplate(null); showToast(`Applied · ${t.name}`)
    } catch { showToast('Template load failed') }
  }

  const loadTemplate = (template: Template) => {
    if (objects.current.length) setPendingTemplate(template)
    else applyTemplate(template, 'replace')
  }

  return (
    <div className="app" ref={appRef}>
      <header>
        <div className="brand">
          <SignalMark />
          <button className="name board-title" onClick={() => setDrawerOpen(true)}>
            <b>Bridgeboard<span className="ai" /></b>
            <small>{currentBoard?.name || 'Bridge Work · AI Lab'}</small>
          </button>
        </div>
          <div className="status">Input <strong>{device}</strong> · <strong className={`save-${saveStatus}`}>{saveStatus}</strong></div>
      </header>
      <main>
        <div className="stage grid" ref={stageRef}>
          <canvas ref={canvasRef} className={tool === 'eraser' ? 'eraser-active' : ''} />
          {editor && <textarea
            autoFocus
            className={`inline-editor ${editor.object.type}`}
            value={editor.object.text || ''}
            style={{
              left: worldToScreen({ x: editor.object.x!, y: editor.object.type === 'text' ? editor.object.y! - (editor.object.size || 28) : editor.object.y! }, viewport.current).x,
              top: worldToScreen({ x: editor.object.x!, y: editor.object.type === 'text' ? editor.object.y! - (editor.object.size || 28) : editor.object.y! }, viewport.current).y,
              width: (editor.object.type === 'sticky' ? editor.object.w! : 260) * viewport.current.scale,
              height: (editor.object.type === 'sticky' ? editor.object.h! : 48) * viewport.current.scale,
              color: editor.object.type === 'sticky' ? '#050505' : editor.object.color,
              background: editor.object.type === 'sticky' ? editor.object.color : 'rgba(5,5,5,.82)',
              fontSize: (editor.object.type === 'sticky' ? 15 : editor.object.size!) * viewport.current.scale,
            }}
            onChange={(e) => { editor.object.text = e.target.value; setEditor({ ...editor }); paint() }}
            onBlur={(e) => { if (e.currentTarget.dataset.cancelled !== 'true') commitEditor() }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.currentTarget.dataset.cancelled = 'true'; e.preventDefault(); e.stopPropagation(); cancelEditor() }
              else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEditor() }
            }}
          />}
          <div className="wordmark">bridge-work.ai</div>
          <div className="hint">Draw with mouse, touch or Samsung S Pen · P to present · Esc to exit</div>
          <div className="zoom-indicator">{zoomPercent}% · 0 reset</div>
        </div>
        <Toolbar
          tool={tool} color={color} width={width}
          onTool={setTool} onColor={(c) => { setColor(c); restyle({ color: c }) }} onWidth={(w) => { setWidth(w); restyle({ width: w }) }}
          onUndo={undo} onRedo={redo}
          canUndo={history.current.canUndo} canRedo={history.current.canRedo}
          onToggleGrid={() => stageRef.current!.classList.toggle('grid')}
          onPresent={() => appRef.current!.classList.toggle('present')}
          onExportPng={exportPng} onExportJson={exportJson} onLoadJson={loadJson} onClear={clear}
        />
        <TemplatePanel onLoad={loadTemplate} onNotice={showToast} />
        {pendingTemplate && <div className="template-dialog" role="dialog" aria-modal="true">
          <b>Apply {pendingTemplate.name}?</b>
          <span>This board already has objects.</span>
          <div><button onClick={() => applyTemplate(pendingTemplate, 'replace')}>Replace board</button><button onClick={() => applyTemplate(pendingTemplate, 'add')}>Add to board</button><button onClick={() => setPendingTemplate(null)}>Cancel</button></div>
        </div>}
        <BoardDrawer
          open={drawerOpen} boards={boards} currentId={currentBoard?.id || null} onClose={() => setDrawerOpen(false)} onSwitch={switchBoard}
          onNew={() => { try { const b = createBoard(`Board ${boards.length + 1}`); refreshBoards(); switchBoard(b.meta.id) } catch (e) { showToast(String(e)) } }}
          onRename={(id, name) => { try { const b = renameBoard(id, name); if (id === currentBoard?.id) setCurrentBoard(b.meta); refreshBoards() } catch (e) { showToast(String(e)) } }}
          onDuplicate={(id) => { try { duplicateBoard(id); refreshBoards() } catch (e) { showToast(String(e)) } }}
          onDelete={(id) => { try { deleteBoard(id); const remaining = listBoards(); if (!remaining.length) { const b = createBoard('Board 1'); remaining.push(b.meta) } setBoards(remaining); if (id === currentBoard?.id) switchBoard(remaining[0].id) } catch (e) { showToast(String(e)) } }}
          onExport={(id) => { const b = loadBoard(id); if (!b) return; const a = document.createElement('a'); a.download = `${b.meta.name}.json`; a.href = URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' })); a.click(); URL.revokeObjectURL(a.href) }}
          onImport={(file) => { const r = new FileReader(); r.onload = () => { try { const data = JSON.parse(String(r.result)); const b = createBoard(data.meta?.name ? `${data.meta.name} import` : file.name.replace(/\.json$/i, ''), data.objects || []); refreshBoards(); switchBoard(b.meta.id) } catch (e) { showToast('Could not import board') } }; r.readAsText(file) }}
        />
        <div className={`toast${toast ? ' show' : ''}`}>{toast}</div>
      </main>
    </div>
  )
}
