import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoomOptions, sanitizeChat, cupCourses, cupRoundPoints, cupStandings, publicRoomListing } from '../server/room-rules.js';

test('room visibility and capacity are validated; in-progress cups cannot accept late pilots', () => {
  assert.deepEqual(normalizeRoomOptions({ visibility: 'public', maxPlayers: 2, mode: 'cup' }), { visibility: 'public', maxPlayers: 2, mode: 'cup' });
  assert.deepEqual(normalizeRoomOptions({ visibility: 'bad', maxPlayers: 99, mode: 'bad' }), { visibility: 'private', maxPlayers: 8, mode: 'race' });
  const room = { code: 'ABC123', visibility: 'public', map: {id:'hangar'}, track: {id:'sprint'}, mode: 'cup', players: new Map([['one', {}]]), maxPlayers: 2, status: 'lobby' };
  assert.equal(publicRoomListing([room, {...room, visibility:'private'}]).length, 1);
  assert.equal(publicRoomListing([room])[0].joinable, true);
  assert.equal(publicRoomListing([{...room, cupRound:1}])[0].joinable, false);
  assert.equal(publicRoomListing([{...room, status:'running'}])[0].joinable, false);
  assert.equal(publicRoomListing([{...room, maxPlayers:1}])[0].joinable, false);
});

test('chat rejects non-text, strips control characters, and bounds payload size', () => {
  assert.equal(sanitizeChat({text:'bad'}), '');
  assert.equal(sanitizeChat('  Hi\u0000\n everyone  '), 'Hi everyone');
  assert.equal(sanitizeChat('x'.repeat(1000)).length, 180);
});

test('cup retains the chosen first course and awards only finishers', () => {
  const maps = ['a','b','c','d'].map(id => ({id, tracks:[{id:`${id}-first`}]}));
  assert.deepEqual(cupCourses(maps,'c','c-technical'), [{map:'c',track:'c-technical'},{map:'d',track:'d-first'},{map:'a',track:'a-first'}]);
  const items = [{player:{id:'slow'},finishMs:2000},{player:{id:'dnf'},finishMs:null},{player:{id:'fast'},finishMs:1000}];
  assert.deepEqual(cupRoundPoints(items), [{id:'fast',points:10,timeMs:1000},{id:'slow',points:6,timeMs:2000}]);
  assert.deepEqual(cupRoundPoints([{player:{id:'dnf'},finishMs:null}]), []);
});

test('cup ties use finish count then combined time, and remove departed players', () => {
  const scores = new Map([
    ['a',{points:16,finishes:2,totalMs:3000}], ['b',{points:16,finishes:2,totalMs:2500}],
    ['c',{points:16,finishes:1,totalMs:1000}], ['gone',{points:30,finishes:3,totalMs:1000}]
  ]);
  assert.deepEqual(cupStandings(scores,['a','b','c']).map(entry => entry.id), ['b','a','c']);
  assert.equal(cupStandings(new Map([[1,{points:0,finishes:0,totalMs:0}],[2,{points:0,finishes:0,totalMs:0}]]),[1,2]).length,2);
});
