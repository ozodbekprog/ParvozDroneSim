import test from 'node:test';
import assert from 'node:assert/strict';
import { bindPreviewControls } from '../src/preview-controls.js';

test('repeated appearance previews keep a single drag and wheel handler', () => {
  class Stage extends EventTarget {
    capture = new Set(); clientHeight = 500;
    setPointerCapture(id) { this.capture.add(id); }
    hasPointerCapture(id) { return this.capture.has(id); }
    releasePointerCapture(id) { this.capture.delete(id); }
    emit(type, values) { const event = new Event(type, { cancelable: true }); Object.assign(event, values); this.dispatchEvent(event); }
  }
  const stage = new Stage(), moves = [], zooms = [];
  const world = { orbitHangarPreview: (...movement) => moves.push(movement), zoomHangarPreview: amount => zooms.push(amount) };
  for (let colorUpdate = 0; colorUpdate < 30; colorUpdate++) bindPreviewControls(stage, world);
  stage.emit('pointerdown', { button: 0, pointerId: 7, clientX: 100, clientY: 100 });
  stage.emit('pointermove', { pointerId: 7, clientX: 140, clientY: 115 });
  stage.emit('wheel', { deltaMode: 0, deltaY: 30 });
  stage.emit('pointerup', { pointerId: 7 });
  stage.emit('pointermove', { pointerId: 7, clientX: 200, clientY: 200 });
  assert.deepEqual(moves, [[40, 15]]);
  assert.deepEqual(zooms, [30]);
  assert.equal(stage.capture.size, 0);
});
