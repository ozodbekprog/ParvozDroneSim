import test from 'node:test';
import assert from 'node:assert/strict';
import { SingleAction, requestJSON } from '../src/client-request.js';

test('repeated sign-in actions cannot overwrite the first session and failures allow retry', async () => {
  const gate = new SingleAction();
  let finish, calls = 0, session;
  const first = gate.run(async () => { calls++; session = await new Promise(resolve => { finish = resolve; }); });
  await gate.run(async () => { calls++; session = 'duplicate'; });
  assert.equal(calls, 1);
  finish('original'); await first;
  assert.equal(session, 'original');
  await assert.rejects(gate.run(async () => { throw new Error('offline'); }), /offline/);
  await gate.run(async () => { session = 'retry'; });
  assert.equal(session, 'retry'); assert.equal(gate.busy, false);
});

test('JSON requests retain authentication status, handle invalid responses and abort stalled requests', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Wrong password' }), { status: 401 });
  await assert.rejects(requestJSON('/api/login'), error => error.status === 401 && error.message === 'Wrong password');
  globalThis.fetch = async () => new Response('<html>unavailable</html>');
  await assert.rejects(requestJSON('/api/catalog'), /valid response/);
  let aborted = false;
  globalThis.fetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
  });
  await assert.rejects(requestJSON('/api/catalog', {}, 5), /too long/);
  assert.equal(aborted, true);
});
