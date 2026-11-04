import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateColliders } from '../shared/catalog-schema.js';
import { MAP_LIST, GAMEPLAY_OBSTACLES, getSpawn } from '../shared/content.js';
import { FIXED_DT, createDroneState, defaultBuild, resolveBuild, stepDrone, gateCrossed, resolveEnvironmentCollision } from '../shared/physics.js';

test('all locations have usable race routes and spawns', () => {
  assert.ok(MAP_LIST.length >= 1);
  assert.equal(new Set(MAP_LIST.map(map => map.id)).size, MAP_LIST.length);
  for (const map of MAP_LIST) {
    assert.ok(map.tracks.length >= 1);
    for (const track of map.tracks) {
      assert.ok(track.gates.length >= 3);
      assert.ok(getSpawn(track).position.every(Number.isFinite));
      assert.ok(track.gates.every(gate => Number.isFinite(gate.width) && gate.width > 0 && Number.isFinite(gate.height) && gate.height > 0 && gate.position.every(Number.isFinite) && Number.isFinite(gate.yaw)));
    }
  }
});

test('a drone lifts at high throttle and descends at zero throttle', () => {
  const spec = resolveBuild(defaultBuild());
  const rising = createDroneState([0, 2, 0]);
  for (let index = 0; index < 90; index++) stepDrone(rising, { throttle: 0.6 }, spec, FIXED_DT);
  assert.ok(rising.position[1] > 7, `expected lift, got ${rising.position[1]}`);
  const falling = createDroneState([0, 9, 0]);
  for (let index = 0; index < 80; index++) stepDrone(falling, { throttle: 0 }, spec, FIXED_DT);
  assert.ok(falling.position[1] < 2, `expected fall, got ${falling.position[1]}`);
});

test('elliptical checkpoint bounds reject rectangle corners',()=>{
  const gate={position:[0,2,0],yaw:0,width:4,height:4,aperture:'ellipse'};
  assert.ok(gateCrossed([1,3,-1],[1,3,1],gate));
  assert.equal(gateCrossed([1.9,3.9,-1],[1.9,3.9,1],gate),false);
});

test('gate passage requires correct direction and aperture', () => {
  const gate = { position: [0, 4, 0], yaw: 0, width: 8, height: 6 };
  assert.equal(gateCrossed([0, 4, -1], [0, 4, 1], gate), true);
  assert.equal(gateCrossed([0, 4, 1], [0, 4, -1], gate), false);
  assert.equal(gateCrossed([5, 4, -1], [5, 4, 1], gate), false);
  assert.equal(gateCrossed([0, 9, -1], [0, 9, 1], gate), false);
});

test('solid course obstacle blocks drone and removes impact energy', () => {
  const state = createDroneState([0, 1.5, 0]);
  state.position = [1.15, 1.5, 0];
  state.velocity = [-8, 0, 0];
  resolveEnvironmentCollision(state, { theme: 'canyon' }, null, [{ position: [0, 1.5, 0], size: [2, 3, 2] }]);
  assert.ok(state.position[0] >= 1.2);
  assert.ok(state.velocity[0] > 0);
  assert.ok(state.health < 1);
});

test('every location declares solid gameplay obstacles', () => {
  for (const map of MAP_LIST) {
    const sidecar = map.collisionFile ? JSON.parse(readFileSync(new URL(`../public${map.collisionFile}`, import.meta.url), 'utf8')) : [];
    const obstacles = [...GAMEPLAY_OBSTACLES[map.id], ...sidecar];
    assert.ok(obstacles.length > 0, `${map.id}: missing gameplay collision`);
    validateColliders(obstacles);
    assert.ok(obstacles.some(collider => collider.type === 'mesh' ? collider.vertices.length >= 9 : collider.size.every(size => size > 0)), `${map.id}: empty collision geometry`);
  }
});
