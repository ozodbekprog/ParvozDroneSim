import test from 'node:test';
import assert from 'node:assert/strict';
import { createDroneState } from '../shared/physics.js';
import { reconcileDrone, interpolateSnapshots } from '../src/flight-smoothing.js';

test('small server corrections preserve the predicted state object', () => {
  const predicted = createDroneState([1, 2, 3]);
  const authority = createDroneState([1.5, 2, 3]);
  const result = reconcileDrone(predicted, authority);
  assert.equal(result.snapped, false);
  assert.equal(result.state, predicted);
  assert.ok(predicted.position[0] > 1 && predicted.position[0] < 1.5);
});

test('reset and large desync snap to authoritative state', () => {
  const predicted = createDroneState([1, 2, 3]);
  const authority = createDroneState([9, 2, 3]);
  assert.equal(reconcileDrone(predicted, authority).snapped, true);
  assert.deepEqual(reconcileDrone(predicted, authority, true).state.position, [9, 2, 3]);
});

test('remote snapshots interpolate positions and normalized orientations', () => {
  const a = createDroneState([0, 1, 0]);
  const b = createDroneState([10, 1, 0]);
  b.rotation = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
  const state = interpolateSnapshots([{ time: 100, state: a }, { time: 200, state: b }], 150);
  assert.equal(state.position[0], 5);
  assert.ok(Math.abs(Math.hypot(...state.rotation) - 1) < 1e-12);
});

test('remote interpolation brackets render time across the whole buffer',()=>{
  const samples=[0,50,100,150].map(time=>({time,state:createDroneState([time,1,0])}));
  assert.equal(interpolateSnapshots(samples,75).position[0],75);
  assert.equal(interpolateSnapshots(samples,125).position[0],125);
  assert.equal(interpolateSnapshots(samples,175).position[0],150);
});
