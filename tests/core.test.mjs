import test from 'node:test'
import assert from 'node:assert/strict'
import { History } from '../.test-dist/lib/history.js'
import { hitTest } from '../.test-dist/lib/hittest.js'
import { translateObject } from '../.test-dist/lib/objects.js'
import { screenToWorld, worldToScreen, zoomAt } from '../.test-dist/lib/viewport.js'

test('history undo/redo and cap', () => {
  let value = 0
  const history = new History()
  value = 1; history.push({ label: 'set', undo: () => { value = 0 }, redo: () => { value = 1 } })
  history.undo(); assert.equal(value, 0); assert.equal(history.canRedo, true)
  history.redo(); assert.equal(value, 1); assert.equal(history.canUndo, true)
  for (let i = 0; i < 205; i++) history.push({ label: 'noop', undo() {}, redo() {} })
  for (let i = 0; i < 200; i++) history.undo()
  assert.equal(history.canUndo, false)
})

test('hit testing prefers the topmost object', () => {
  const objects = [
    { id: 'back', type: 'line', color: '#fff', width: 2, x1: 0, y1: 0, x2: 100, y2: 0 },
    { id: 'front', type: 'sticky', color: '#fff', width: 1, x: 10, y: -10, w: 30, h: 30 },
  ]
  assert.equal(hitTest(objects, 20, 0, 2)?.id, 'front')
})

test('translation moves every coordinate representation', () => {
  const object = { id: 's', type: 'stroke', color: '#fff', width: 2, x: 1, y: 2, x1: 3, y1: 4, x2: 5, y2: 6, points: [{ x: 7, y: 8 }] }
  translateObject(object, 10, -2)
  assert.deepEqual(object.points[0], { x: 17, y: 6 }); assert.equal(object.x2, 15); assert.equal(object.y, 0)
})

test('viewport conversion round-trips and zooms around pointer', () => {
  const viewport = { ox: 40, oy: -20, scale: 2 }
  const world = { x: 12, y: 9 }, screen = worldToScreen(world, viewport)
  assert.deepEqual(screenToWorld(screen, viewport), world)
  const zoomed = zoomAt(viewport, screen, 3)
  assert.deepEqual(screenToWorld(screen, zoomed), world)
  assert.equal(zoomAt(viewport, screen, 99).scale, 3)
})
