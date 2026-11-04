import test from 'node:test';
import assert from 'node:assert/strict';
import { resetFreestyle, scoreFreestyle } from '../shared/freestyle.js';

const gate = { position: [0, 3, 0], yaw: 0, width: 8, height: 6 };
const track = { gates: [gate] };

test('freestyle rewards varied tricks, chains combos, and respects cooldowns', () => {
  const item = { state: { position: [0, 3, 1], velocity: [0, 0, 10], angularVelocity: [0, 0, 0], crashed: false } };
  resetFreestyle(item);
  assert.equal(scoreFreestyle(item, [0, 3, -1], track, [], 10_000, 1 / 60)[0].name, 'GATE THREAD');
  assert.equal(item.score, 35);
  assert.equal(scoreFreestyle(item, [0, 3, -1], track, [], 10_100, 1 / 60).length, 0);

  item.state.position = [6.7, 3, 1];
  const obstacle = { position: [5, 3, 1], size: [2, 4, 2] };
  assert.equal(scoreFreestyle(item, [6, 3, 1], track, [obstacle], 11_000, 1 / 60)[0].name, 'CLOSE PASS');
  assert.equal(item.combo, 2);

  item.state.angularVelocity = [7, 0, 0];
  assert.equal(scoreFreestyle(item, [6.7, 3, 1], track, [], 12_000, 1)[0].points, 100);
  assert.equal(item.score, 160);

  item.state.angularVelocity = [0, 0, 0];
  item.state.position = [0, 8, 4]; item.state.velocity = [0, -7, 0];
  scoreFreestyle(item, [0, 9, 4], track, [], 13_000, 1 / 60);
  item.state.position = [0, 2, 4]; item.state.velocity = [0, -1, 0];
  assert.equal(scoreFreestyle(item, [0, 4, 4], track, [], 13_500, 1 / 60)[0].name, 'DIVE RECOVERY');

  item.state.velocity = [0, 0, 0];
  scoreFreestyle(item, [0, 2, 4], track, [], 20_000, 1 / 60);
  assert.equal(item.combo, 0);
  const savedScore = item.score;
  resetFreestyle(item, true);
  assert.equal(item.score, savedScore);
  assert.equal(item.lastTrick, '');
});
