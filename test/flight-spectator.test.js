import test from 'node:test';
import assert from 'node:assert/strict';
import { spectatorPilotId } from '../src/flight-spectator.js';

const players = [
  { id: 'self', finishMs: 25000 },
  { id: 'a', finishMs: null },
  { id: 'b', finishMs: null },
  { id: 'done', finishMs: 26000 }
];

test('own finished drone returning in snapshots never replaces the selected spectator', () => {
  let watched = 'b';
  for (let snapshot = 0; snapshot < 20; snapshot++) watched = spectatorPilotId(players, 'self', watched, ['self','a','b','done']);
  assert.equal(watched, 'b');
  assert.equal(spectatorPilotId(players, 'self', 'self', ['self','a','b','done']), 'a');
});

test('a watched finish or departure moves to an unfinished rendered pilot', () => {
  assert.equal(spectatorPilotId(players.map(player => player.id === 'b' ? {...player, finishMs:27000} : player), 'self', 'b', ['self','a','b','done']), 'a');
  assert.equal(spectatorPilotId(players, 'self', 'b', ['self','a','done']), 'a');
  assert.equal(spectatorPilotId(players, 'self', 'b', ['self','done']), null);
});

test('Next pilot cycles live rivals and handles the final remaining pilot', () => {
  assert.equal(spectatorPilotId(players, 'self', 'a', ['self','a','b','done'], true), 'b');
  assert.equal(spectatorPilotId(players, 'self', 'b', ['self','a','b','done'], true), 'a');
  assert.equal(spectatorPilotId(players, 'self', 'a', ['self','a','done'], true), 'a');
});
