import { useEffect, useState } from 'react'
import type { BoardMeta } from '../lib/store'

interface Props {
  open: boolean
  boards: BoardMeta[]
  currentId: string | null
  onClose: () => void
  onSwitch: (id: string) => void
  onNew: () => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onExport: (id: string) => void
  onImport: (file: File) => void
}

export function BoardDrawer(p: Props) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [name, setName] = useState('')
  useEffect(() => { if (!p.open) setRenaming(null) }, [p.open])

  return <aside className={`board-drawer${p.open ? ' open' : ''}`} aria-hidden={!p.open}>
    <div className="drawer-head"><h2>Boards</h2><button onClick={p.onClose}>×</button></div>
    <div className="drawer-actions">
      <button onClick={p.onNew}>New board</button>
      <label className="file">Import JSON<input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && p.onImport(e.target.files[0])} /></label>
    </div>
    <div className="board-list">{p.boards.map((board) => <section key={board.id} className={board.id === p.currentId ? 'current' : ''}>
      {renaming === board.id ? <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { p.onRename(board.id, name); setRenaming(null) }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setRenaming(null) }} /> :
        <button className="board-main" onClick={() => p.onSwitch(board.id)}><b>{board.name}</b><span>{new Date(board.updatedAt).toLocaleString()} · {board.objectCount} objects</span></button>}
      <div className="board-actions">
        <button onClick={() => { setName(board.name); setRenaming(board.id) }}>Rename</button>
        <button onClick={() => p.onDuplicate(board.id)}>Duplicate</button>
        <button onClick={() => p.onExport(board.id)}>Export</button>
        <button className="danger" onClick={() => confirm(`Delete “${board.name}”?`) && p.onDelete(board.id)}>Delete</button>
      </div>
    </section>)}</div>
  </aside>
}
