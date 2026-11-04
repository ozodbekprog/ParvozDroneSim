import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCustomContent } from '../shared/custom-content.js';

const empty = () => ({ version: 1, maps: [], drones: [], parts: [], challenges: [] });

test('empty custom content remains publishable', () => {
  assert.equal(validateCustomContent(empty()).version, 1);
});

test('published map needs a real course, collider data, and a safe model path', () => {
  const content = empty();
  content.maps.push({ id: 'custom-test-map', name: 'Test', region: 'Test', model: '/custom/assets/model.glb', sky: '#112233', fog: '#112233', ground: '#112233', sun: '#ffffff', sunPosition: [2, 4, 1], wind: [0, 0, 0], gravity: 1, colliders: [], tracks: [{ id: 'custom-test-course', name: 'Course', laps: 1, gates: Array.from({ length: 3 }, (_, index) => ({ position: [index * 10, 3, 0], yaw: 0, width: 8, height: 6 })) }] });
  assert.equal(validateCustomContent(content).maps.length, 1);
  content.maps[0].model = '/../private.glb';
  assert.throws(() => validateCustomContent(content), /GLB model/);
});
