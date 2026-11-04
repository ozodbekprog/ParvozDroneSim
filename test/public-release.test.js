import test from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter, clientAddress } from '../server/rate-limit.js';
import { SampleWindow } from '../server/performance-metrics.js';
import { validateLocalBackup } from '../src/local-backup.js';

test('rate limits have an exact rolling window and respect proxy configuration', () => {
  const limit = new RateLimiter(1000, 2);
  assert.equal(limit.allow('pilot', 0).allowed, true);
  assert.equal(limit.allow('pilot', 500).allowed, true);
  assert.equal(limit.allow('pilot', 501).allowed, false);
  assert.equal(limit.allow('pilot', 1000).allowed, true);
  const request = { headers: { 'x-forwarded-for': '198.51.100.4, 10.0.0.1' }, socket: { remoteAddress: '127.0.0.1' } };
  assert.equal(clientAddress(request), '127.0.0.1');
  assert.equal(clientAddress(request, true), '198.51.100.4');
});

test('tick metrics report the measured 95th percentile', () => {
  const samples = new SampleWindow(4);
  [1, 2, 3, 4, 5].forEach(value => samples.add(value));
  assert.equal(samples.percentile(.95), 5);
  samples.clear();
  assert.equal(samples.percentile(.95), 0);
});

test('local backup excludes auth tokens and rejects malformed replay data', () => {
  const valid = { format: 'drone-liftoff-local', version: 1,
    settings: { 'liftoff-flight-mode': 'acro', 'liftoff-token': 'secret-token' },
    replays: [{ id: '1234567890abcdef', name: 'Test flight', map: 'hangar', track: 'hangar-circuit', duration: 1000, frames: [{ time: 0, players: [] }] }] };
  const parsed = validateLocalBackup(valid);
  assert.equal(parsed.settings['liftoff-flight-mode'], 'acro');
  assert.equal(parsed.settings['liftoff-token'], undefined);
  assert.equal(parsed.replays.length, 1);
  assert.throws(() => validateLocalBackup({ ...valid, replays: [{ name: 'broken' }] }), /invalid replay/);
});
