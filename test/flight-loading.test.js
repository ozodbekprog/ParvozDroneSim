import test from 'node:test';
import assert from 'node:assert/strict';
import { FlightLoading, preparedBytes } from '../src/flight-loading.js';

function browserStubs(t, fetcher) {
  const previous = Object.fromEntries(['document', 'requestAnimationFrame', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const app = { appendChild() {} };
  globalThis.document = {
    querySelector: () => app,
    createElement: () => {
      const nodes = new Map();
      return {
        setAttribute() {}, append() {}, remove() { this.removed = true; },
        querySelector(selector) {
          if (!nodes.has(selector)) nodes.set(selector, { textContent: '', after() {}, classList: { remove(name) { this.removed = name; } } });
          return nodes.get(selector);
        }
      };
    }
  };
  globalThis.requestAnimationFrame = callback => queueMicrotask(callback);
  globalThis.fetch = fetcher;
  t.after(() => {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
}

function response(chunks) {
  let cursor = 0;
  return { ok: true, body: { getReader: () => ({ read: async () => cursor < chunks.length ? { value: Uint8Array.from(chunks[cursor++]), done: false } : { done: true } }) } };
}

test('streamed downloads deduplicate files, prepare exact bytes and release them after flight preparation', async t => {
  const requests = [];
  browserStubs(t, async url => { requests.push(url); return response(url.endsWith('map.glb') ? [[1, 2], [3]] : [[4, 5]]); });
  const map = '/content/assets/loading-map.glb', drone = '/content/assets/loading-drone.glb';
  const loading = new FlightLoading([map, drone, map], [{ url: map, bytes: 3 }, { url: drone, bytes: 2 }]);
  t.after(() => loading.cancel());
  assert.equal(loading.overlay.querySelector('.loading-percent').textContent, '0%');
  await loading.download();
  assert.equal(requests.length, 2);
  assert.deepEqual([...new Uint8Array(preparedBytes(map))], [1, 2, 3]);
  assert.deepEqual([...new Uint8Array(preparedBytes(drone))], [4, 5]);
  assert.deepEqual(loading.progress.value(), { loaded: 5, total: 5, filesDone: 2, files: 2, done: true });
  assert.equal(loading.overlay.querySelector('.loading-percent').textContent, '80%');
  loading.stage('Processing models');
  assert.equal(loading.overlay.querySelector('.loading-phase').textContent,'Processing models');
  assert.match(loading.overlay.querySelector('.loading-metrics').textContent,/^\d+:\d{2}$/);
  loading.finish();
  assert.equal(preparedBytes(map), undefined);
  assert.equal(preparedBytes(drone), undefined);
  assert.equal(loading.overlay.removed, true);
});

test('cancellation prevents a late network response from publishing assets or completing preparation', async t => {
  let entered, completeRead, signal;
  const reading = new Promise(resolve => { entered = resolve; });
  const lateRead = new Promise(resolve => { completeRead = resolve; });
  browserStubs(t, async (_url, options) => {
    signal = options.signal;
    return { ok: true, body: { getReader: () => ({ read: () => { entered(); return lateRead; } }) } };
  });
  const url = '/content/assets/loading-cancel.glb';
  const loading = new FlightLoading([url], [{ url, bytes: 3 }]);
  const downloading = loading.download();
  const rejected = assert.rejects(downloading, { name: 'AbortError' });
  await reading;
  loading.cancel();
  completeRead({ value: Uint8Array.from([1, 2, 3]), done: false });
  await rejected;
  assert.equal(signal.aborted, true);
  assert.equal(preparedBytes(url), undefined);
  assert.equal(loading.overlay.removed, true);
  assert.throws(() => loading.stage('Ready'), { name: 'AbortError' });
});

test('download errors expose Retry, release old buffers and allow a fresh successful attempt', async t => {
  const first = '/content/assets/loading-first.glb', second = '/content/assets/loading-failure.glb';
  let fail = true;
  browserStubs(t, async url => {
    if (url === second && fail) {
      await new Promise(resolve => setImmediate(resolve));
      return { ok: false, status: 503 };
    }
    return response([[9, 8]]);
  });
  const broken = new FlightLoading([first, second], [{ url: first, bytes: 2 }, { url: second, bytes: 2 }]);
  t.after(() => broken.cancel());
  await assert.rejects(broken.download(), /503/);
  assert.ok(preparedBytes(first));
  broken.error(new Error('Download failed (503)'));
  assert.equal(preparedBytes(first), undefined);
  assert.equal(broken.abort.signal.aborted, true);
  assert.equal(broken.overlay.querySelector('.loading-retry').classList.removed, 'hidden');
  assert.match(broken.overlay.querySelector('.loading-error').textContent, /503/);
  fail = false;
  const retry = new FlightLoading([second], [{ url: second, bytes: 2 }]);
  t.after(() => retry.cancel());
  await retry.download();
  assert.deepEqual([...new Uint8Array(preparedBytes(second))], [9, 8]);
  retry.finish();
  assert.equal(preparedBytes(second), undefined);
});
