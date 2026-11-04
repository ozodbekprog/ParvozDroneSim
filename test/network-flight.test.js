import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultBuild, resolveBuild } from '../shared/physics.js';
import { effectiveFlightBuild, canStartRoom } from '../shared/network-flight.js';

test('ranked flights publish and resolve the canonical drone regardless of customization', () => {
  const custom = { ...defaultBuild(), drone: 'atlas', motors: 'race', propellers: 'efficient', battery: 'endurance', color: '#abcdef', led: '#123456' };
  const snapshot = structuredClone(custom);
  const ranked = effectiveFlightBuild(custom, true);
  assert.deepEqual(ranked, defaultBuild());
  assert.deepEqual(resolveBuild(ranked), resolveBuild(defaultBuild()));
  assert.notEqual(resolveBuild(ranked).mass, resolveBuild(custom).mass);
  assert.deepEqual(custom, snapshot);
});

test('ranked defaults are fresh builds and cannot leak modifications between pilots', () => {
  const first = effectiveFlightBuild(undefined, true);
  first.color = '#000000';
  first.motors = 'race';
  assert.deepEqual(effectiveFlightBuild(null, true), defaultBuild());
});

test('unranked flights preserve the supplied customized build', () => {
  const custom = { ...defaultBuild(), drone: 'swift', frame: 'light', camera: 'classic', color: '#fedcba' };
  assert.equal(effectiveFlightBuild(custom, false), custom);
  assert.deepEqual(resolveBuild(effectiveFlightBuild(custom, false)), resolveBuild(custom));
  assert.equal(effectiveFlightBuild(custom), custom);
});

test('a weekly pilot must have both prepared assets and an acknowledged controller', () => {
  const pilot = { ready: false, controllerReady: false };
  const room = { solo: true, mode: 'weekly', players: new Map([['pilot', pilot]]) };
  assert.equal(canStartRoom(room), false);
  pilot.controllerReady = true;
  assert.equal(canStartRoom(room), false);
  pilot.ready = true;
  assert.equal(canStartRoom(room), true);
  // A new preparation invalidates the previous controller acknowledgement.
  pilot.controllerReady = false;
  assert.equal(canStartRoom(room), false);
});
