import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneTransition } from '../src/scene-transition.js';

test('a scene commit failure releases its draft and permits retry of the same scene', async () => {
  const transition = new SceneTransition();
  let disposed = 0, committed = 0;
  await assert.rejects(transition.request('preview:map', () => ({ ready: Promise.resolve(), commit() { throw new Error('graphics failed'); }, dispose() { disposed++; } })), /graphics failed/);
  assert.equal(disposed, 1); assert.equal(transition.pending, null);
  assert.equal(await transition.request('preview:map', () => ({ ready: Promise.resolve(), commit() { committed++; }, dispose() {} })), true);
  assert.equal(committed, 1);
});

test('a canceled draft cannot commit or clear a replacement when its readiness settles later', async () => {
  const transition = new SceneTransition();
  let fail, finish, oldDisposed = 0, newCommitted = 0;
  const old = transition.request('old', () => ({ ready: new Promise((_, reject) => { fail = reject; }), commit() { assert.fail('stale commit'); }, dispose() { oldDisposed++; } }));
  const next = transition.request('new', () => ({ ready: new Promise(resolve => { finish = resolve; }), commit() { newCommitted++; }, dispose() { assert.fail('replacement disposed'); } }));
  fail(new Error('late download')); assert.equal(await old, false);
  assert.equal(transition.pending.key, 'new'); assert.equal(oldDisposed, 1);
  finish(); assert.equal(await next, true); assert.equal(newCommitted, 1);
});
