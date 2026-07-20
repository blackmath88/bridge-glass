import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoardObject, Tool } from '../lib/types'
import { redraw, makeShape, STICKY_COLORS } from '../lib/canvas'
import { fetchTemplate, denormalize, markNormalized } from '../lib/templates'
import { SignalMark } from './SignalMark'
import { Toolbar } from './Toolbar'
import { TemplatePanel } from './TemplatePanel'
import { hitTest } from '../lib/hittest'
import { uid } from '../lib/uid'
import { TOOLS } from './Toolbar'
import { History } from '../lib/history'
import { BoardDrawer } from './BoardDrawer'
import { createBoard, deleteBoard, duplicateBoard, listBoards, loadBoard, migrateLegacySession, renameBoard, saveBoard, type BoardMeta } from '../lib/store'

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
  const eraserCursor = useRef<{ x: number; y: number; radius: number } | null>(null)
  const lastErase = useRef(0)
  const history = useRef<History | null>(null)
  const initialized = useRef(false)

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

  if (!history.current) history.current = new History(() => setHistoryVersion((v) => v + 1))

  // keep latest tool/color/width available to event handlers
  const ref = useRef({ tool, color, width })
  ref.current = { tool, color, width }

  const ctx = () => canvasRef.current!.getContext('2d')!
  const paint = useCallback(() => redraw(ctx(), dpr.current, objects.current, current.current, objects.current.find((o) => o.id === selectedId.current) || null, eraserCursor.current), [])

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

  const clone = <T,>(value: T): T => structuredClone(value)
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
    const timer = window.setTimeout(() => {
      try { const saved = saveBoard(currentBoard.id, currentBoard.name, objects.current); setCurrentBoard(saved.meta); refreshBoards() }
      catch (error) { showToast(error instanceof Error ? error.message : 'Autosave failed') }
    }, 800)
    return () => window.clearTimeout(timer)
    // History changes are the autosave signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyVersion])

  const translate = (o: BoardObject, dx: number, dy: number) => {
    if (o.points) o.points.forEach((p) => { p.x += dx; p.y += dy })
    if (o.x != null) o.x += dx
    if (o.y != null) o.y += dy
    if (o.x1 != null) o.x1 += dx
    if (o.y1 != null) o.y1 += dy
    if (o.x2 != null) o.x2 += dx
    if (o.y2 != null) o.y2 += dy
  }

  const eraseAt = (p: { x: number; y: number }) => {
    const radius = Math.max(8, ref.current.width * 1.5)
    eraserCursor.current = { x: p.x, y: p.y, radius }
    const hit = hitTest(objects.current, p.x, p.y, radius)
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
      const p = posOf(e); start.current = p; drawing.current = true
      setDevice(e.pointerType || 'pointer')
      const { tool, color, width } = ref.current
      if (tool === 'eraser') {
        erased.current = []; lastErase.current = performance.now(); eraseAt(p); paint(); return
      }
      if (tool === 'select') {
        const hit = hitTest(objects.current, p.x, p.y, 6)
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
          translate(o, p.x - dragOrigin.current.x, p.y - dragOrigin.current.y)
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
    const finish = () => {
      if (!drawing.current) return
      if (ref.current.tool === 'eraser') {
        const removed = clone(erased.current)
        if (removed.length) history.current!.push({
          label: 'erase objects',
          undo: () => { removed.slice().sort((a, b) => a.index - b.index).forEach((item) => objects.current.splice(Math.min(item.index, objects.current.length), 0, clone(item.object))); paint() },
          redo: () => { const ids = new Set(removed.map((item) => item.object.id)); objects.current = objects.current.filter((o) => !ids.has(o.id)); paint() },
        })
        drawing.current = false; erased.current = []; eraserCursor.current = null; paint(); return
      }
      if (ref.current.tool === 'select') {
        const id = selectedId.current, delta = { ...dragDelta.current }
        if (id && (delta.x || delta.y)) history.current!.push({
          label: 'move',
          undo: () => { const o = objects.current.find((item) => item.id === id); if (o) translate(o, -delta.x, -delta.y); paint() },
          redo: () => { const o = objects.current.find((item) => item.id === id); if (o) translate(o, delta.x, delta.y); paint() },
        })
        drawing.current = false; dragOrigin.current = null; return
      }
      if (!current.current) return
      add(current.current); current.current = null; drawing.current = false
    }
    const doubleClick = (e: MouseEvent) => {
      if (ref.current.tool !== 'select') return
      const r = c.getBoundingClientRect(), o = hitTest(objects.current, e.clientX - r.left, e.clientY - r.top, 6)
      if (o?.type === 'text' || o?.type === 'sticky') openExistingEditor(o)
    }
    c.addEventListener('pointerdown', down)
    c.addEventListener('pointermove', move)
    c.addEventListener('pointerup', finish)
    c.addEventListener('pointercancel', finish)
    c.addEventListener('dblclick', doubleClick)
    return () => {
      c.removeEventListener('pointerdown', down)
      c.removeEventListener('pointermove', move)
      c.removeEventListener('pointerup', finish)
      c.removeEventListener('pointercancel', finish)
      c.removeEventListener('dblclick', doubleClick)
    }
  }, [paint])

  // resize + keyboard
  useEffect(() => {
    resize()
    window.addEventListener('resize', resize)
    const key = (e: KeyboardEvent) => {
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
        translate(selected, e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0)
        const dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0
        const dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0
        const id = selected.id
        history.current!.push({
          label: 'nudge',
          undo: () => { const o = objects.current.find((item) => item.id === id); if (o) translate(o, -dx, -dy); paint() },
          redo: () => { const o = objects.current.find((item) => item.id === id); if (o) translate(o, dx, dy); paint() },
        })
        paint(); e.preventDefault()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.shiftKey ? history.current!.redo() : history.current!.undo(); e.preventDefault() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { history.current!.redo(); e.preventDefault() }
    }
    document.addEventListener('keydown', key)
    return () => { window.removeEventListener('resize', resize); document.removeEventListener('keydown', key) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resize])

  const undo = () => history.current!.undo()
  const redo = () => history.current!.redo()
  const nearestStickyColor = (hex: string) => {
    const rgb = (value: string) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16))
    const target = rgb(hex)
    return STICKY_COLORS.reduce((best, candidate) => {
      const a = rgb(best), b = rgb(candidate)
      return b.reduce((sum, value, i) => sum + (value - target[i]) ** 2, 0) < a.reduce((sum, value, i) => sum + (value - target[i]) ** 2, 0) ? candidate : best
    })
  }
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

  const loadTemplate = async (file: string) => {
    try {
      const t = await fetchTemplate(file)
      const r = stageRef.current!.getBoundingClientRect()
      const before = clone(objects.current)
      const after = denormalize(markNormalized(t), r.width, r.height).map((o) => ({ ...o, id: o.id || uid() }))
      replace(after)
      history.current!.push({ label: 'apply template', undo: () => replace(before), redo: () => replace(after) })
      showToast(`Loaded · ${t.name}`)
    } catch { showToast('Template load failed') }
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
        <div className="status">Input <strong>{device}</strong></div>
      </header>
      <main>
        <div className="stage grid" ref={stageRef}>
          <canvas ref={canvasRef} className={tool === 'eraser' ? 'eraser-active' : ''} />
          {editor && <textarea
            autoFocus
            className={`inline-editor ${editor.object.type}`}
            value={editor.object.text || ''}
            style={{
              left: editor.object.x,
              top: editor.object.type === 'text' ? editor.object.y! - (editor.object.size || 28) : editor.object.y,
              width: editor.object.type === 'sticky' ? editor.object.w : 260,
              height: editor.object.type === 'sticky' ? editor.object.h : 48,
              color: editor.object.type === 'sticky' ? '#050505' : editor.object.color,
              background: editor.object.type === 'sticky' ? editor.object.color : 'rgba(5,5,5,.82)',
              fontSize: editor.object.type === 'sticky' ? 15 : editor.object.size,
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
        <TemplatePanel onLoad={loadTemplate} />
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
