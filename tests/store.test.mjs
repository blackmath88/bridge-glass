import test from 'node:test'
import assert from 'node:assert/strict'

class MemoryStorage {
  data = new Map()
  getItem(key) { return this.data.get(key) ?? null }
  setItem(key, value) { this.data.set(key, String(value)) }
  removeItem(key) { this.data.delete(key) }
  clear() { this.data.clear() }
}
globalThis.localStorage = new MemoryStorage()
const store = await import('../.test-dist/lib/store.js')

test('v1 load removes pixel eraser objects', () => {
  localStorage.setItem('bridgeboard:index', JSON.stringify([]))
  localStorage.setItem('bridgeboard:board:old', JSON.stringify({ v: 1, meta: { id: 'old', name: 'Old', updatedAt: '', objectCount: 2 }, objects: [
    { id: 'e', type: 'eraser', color: '#fff', width: 2, points: [] },
    { id: 'l', type: 'line', color: '#fff', width: 2, x1: 0, y1: 0, x2: 1, y2: 1 },
  ] }))
  const board = store.loadBoard('old')
  assert.equal(board.v, 2); assert.equal(board.objects.length, 1); assert.equal(board.meta.objectCount, 1)
})

test('create, rename, duplicate and delete board', () => {
  localStorage.clear()
  const board = store.createBoard('One', [])
  assert.equal(store.renameBoard(board.meta.id, 'Renamed').meta.name, 'Renamed')
  assert.equal(store.duplicateBoard(board.meta.id).meta.name, 'Renamed copy')
  store.deleteBoard(board.meta.id)
  assert.equal(store.loadBoard(board.meta.id), null)
})
