import type { BoardObject } from './types'
import { uid } from './uid'

export const INDEX_KEY = 'bridgeboard:index'
const BOARD_KEY = 'bridgeboard:board:'

export interface BoardMeta { id: string; name: string; updatedAt: string; objectCount: number }
export interface StoredBoard { v: 1; meta: BoardMeta; objects: BoardObject[] }

function fail(action: string, error: unknown): never {
  throw new Error(`${action}: ${error instanceof Error ? error.message : String(error)}`)
}

function writeIndex(index: BoardMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

export function listBoards(): BoardMeta[] {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]') }
  catch (error) { return fail('Could not list boards', error) }
}

export function loadBoard(id: string): StoredBoard | null {
  try {
    const raw = localStorage.getItem(`${BOARD_KEY}${id}`)
    return raw ? JSON.parse(raw) : null
  } catch (error) { return fail('Could not load board', error) }
}

export function saveBoard(id: string, name: string, objects: BoardObject[]): StoredBoard {
  try {
    const meta = { id, name, updatedAt: new Date().toISOString(), objectCount: objects.length }
    const board: StoredBoard = { v: 1, meta, objects: structuredClone(objects) }
    localStorage.setItem(`${BOARD_KEY}${id}`, JSON.stringify(board))
    const index = listBoards().filter((item) => item.id !== id)
    writeIndex([meta, ...index])
    return board
  } catch (error) { return fail('Could not save board', error) }
}

export function createBoard(name = 'Untitled board', objects: BoardObject[] = []): StoredBoard {
  try { return saveBoard(uid(), name, objects) }
  catch (error) { return fail('Could not create board', error) }
}

export function migrateLegacySession(): StoredBoard {
  try {
    const raw = localStorage.getItem('bridgeboard:session')
    const objects = raw ? (JSON.parse(raw).objects || []) : []
    const board = createBoard('Board 1', objects)
    if (raw) localStorage.removeItem('bridgeboard:session')
    return board
  } catch (error) { return fail('Could not migrate legacy session', error) }
}

export function renameBoard(id: string, name: string): StoredBoard {
  try {
    const board = loadBoard(id)
    if (!board) throw new Error('Board not found')
    return saveBoard(id, name.trim() || board.meta.name, board.objects)
  } catch (error) { return fail('Could not rename board', error) }
}

export function duplicateBoard(id: string): StoredBoard {
  try {
    const board = loadBoard(id)
    if (!board) throw new Error('Board not found')
    return createBoard(`${board.meta.name} copy`, board.objects)
  } catch (error) { return fail('Could not duplicate board', error) }
}

export function deleteBoard(id: string): void {
  try {
    localStorage.removeItem(`${BOARD_KEY}${id}`)
    writeIndex(listBoards().filter((item) => item.id !== id))
  } catch (error) { return fail('Could not delete board', error) }
}

// Phase 1 is localStorage-only. These stable functions are the component boundary
// so a Phase 2 Worker + D1/Durable Object backend can replace the implementation.
