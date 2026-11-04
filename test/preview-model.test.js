import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePreviewModel } from '../src/preview-model.js';
import { PreviewRequest } from '../src/drone-preview.js';
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('first Hangar aircraft starts before the environment completes and commits only after both', async () => {
  const map = deferred(), model = deferred(), mesh = { assetsReady: model.promise }, events = [];
  const request = new PreviewRequest();
  const ready = request.run(signal => preparePreviewModel(map.promise, () => { events.push('aircraft started'); return mesh; }, () => events.push('discard'), { signal }), value => events.push(value), () => {});
  assert.deepEqual(events, ['aircraft started']);
  model.resolve(); await Promise.resolve(); assert.equal(events.length, 1);
  map.resolve(); assert.equal(await ready, true); assert.deepEqual(events, ['aircraft started', mesh]);
});
test('leaving Hangar cancels its detached aircraft immediately and late completion cannot commit', async () => {
  const map = deferred(), model = deferred(), mesh = { assetsReady: model.promise };
  let disposed = 0, committed = 0;
  const request = new PreviewRequest();
  const ready = request.run(signal => preparePreviewModel(map.promise, () => mesh, () => disposed++, { signal }), () => committed++, () => disposed++);
  request.cancel(); assert.equal(disposed, 1); assert.equal(await ready, false);
  map.resolve(); model.resolve(); await Promise.resolve(); assert.equal(disposed, 1); assert.equal(committed, 0);
});
test('environment failure discards the parallel aircraft once and reports the original error', async () => {
  const map = deferred(), model = deferred(), error = new Error('environment interrupted');
  let disposed = 0;
  const ready = preparePreviewModel(map.promise, () => ({ assetsReady: model.promise }), () => disposed++);
  map.reject(error); await assert.rejects(ready, e => e === error); model.reject(new Error('aircraft canceled'));
  await Promise.resolve(); assert.equal(disposed, 1);
});

test('selecting another aircraft aborts the first request and commits only the replacement', async () => {
  const map = deferred(), first = deferred(), second = deferred(), commits = [], discarded = [];
  const request = new PreviewRequest();
  const start = (name, model) => request.run(signal => preparePreviewModel(map.promise, () => ({ name, assetsReady: model.promise }), mesh => discarded.push(mesh.name), { signal }), mesh => commits.push(mesh.name), mesh => discarded.push(mesh.name));
  const old = start('first', first), latest = start('second', second);
  assert.deepEqual(discarded, ['first']); assert.equal(await old, false);
  first.resolve(); map.resolve(); second.resolve(); assert.equal(await latest, true);
  assert.deepEqual(commits, ['second']); assert.deepEqual(discarded, ['first']);
  request.cancel(); assert.deepEqual(discarded, ['first'], 'the installed aircraft now belongs to the world');
});

test('canceling a real detached drone reaches its asset loader before the environment is ready', async () => {
  const previous = globalThis.document, gradient = { addColorStop() {} };
  const context = new Proxy({ createRadialGradient: () => gradient, createLinearGradient: () => gradient }, { get: (object, key) => object[key] || (() => {}) });
  let recipes;
  try { globalThis.document = { createElement: () => ({ getContext: () => context }) }; recipes = await import('../public/content/recipes.js'); }
  finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
  const map = deferred(), request = new PreviewRequest();
  let assetSignal, mesh, committed = false;
  const ready = request.run(signal => preparePreviewModel(map.promise, () => {
    mesh = recipes.createDrone({ model: '/content/assets/test-drone.glb' }, {
      load: (_url, _node, { signal }) => {
        assetSignal = signal; return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
      },
    }); return mesh;
  }, recipes.disposeObject, { signal }), () => committed = true, recipes.disposeObject);
  assert.equal(assetSignal.aborted, false); request.cancel();
  assert.equal(assetSignal.aborted, true); assert.equal(mesh.userData.disposed, true);
  assert.equal(await ready, false); map.resolve(); assert.equal(committed, false);
});
