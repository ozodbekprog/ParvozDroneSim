import test from 'node:test';
import assert from 'node:assert/strict';
import { pilotProfileLayout, hostSessionLayout, flightMenuLayout } from '../src/pilot-menu-layouts.js';
import { settingsLayout } from '../src/menu-layouts.js';

const map = { id: 'hangar', name: 'Training Hangar', thumbnail: '/content/hangar.png', tracks: [{ id: 'sprint', name: 'Sprint' }] };
const data = { user: { username: '<Pilot>', xp: 650, rating: 1000, credits: 60 }, achievements: ['first-finish'], records: [{ track: 'precision-sprint', best_ms: 65432 }], freestyleScores: [{ map: 'hangar', best_score: 320 }] };

test('profile uses real account values, known course names and independently paged records', () => {
  const records = Array.from({ length: 7 }, (_, i) => ({ track: `course-${i}`, best_ms: 20000 + i }));
  const markup = pilotProfileLayout({ data, maps: { hangar: map } });
  assert.match(markup, /&lt;Pilot&gt;/);
  assert.match(markup, /Level 2/);
  assert.match(markup, /150 \/ 500 XP/);
  assert.match(markup, /Sprint/); assert.match(markup, /Precision Run/);
  assert.match(markup, /01:05.43/); assert.match(markup, /320 pts/);
  assert.doesNotMatch(markup, /<Pilot>/);
  const second = pilotProfileLayout({ data: { ...data, records }, pages: { records: 1 } });
  assert.match(second, /course 3/); assert.match(second, /course 5/);
  assert.doesNotMatch(second, /course 0|course 6/);
  assert.match(second, /data-action="profile-records-next"/);
});

test('profile account actions are reachable without mixing recovery instructions into records', () => {
  const records = pilotProfileLayout({ data });
  assert.doesNotMatch(records, /data-action="recovery-code"/);
  const account = pilotProfileLayout({ data, tab: 'account' });
  for (const action of ['recovery-code','logout']) assert.match(account, new RegExp(`data-action="${action}"`));
  assert.match(account, /Not set/);
  assert.doesNotMatch(account, /data-action="(?:export-local|import-local)"/);
  const localData = pilotProfileLayout({ data, tab: 'data' });
  for (const action of ['export-local','import-local']) assert.match(localData, new RegExp(`data-action="${action}"`));
  assert.match(pilotProfileLayout({ data: { ...data, recoveryEnabled: true }, tab: 'account' }), /Replace code/);
  const guest = pilotProfileLayout({ data: { ...data, user: { ...data.user, guest: true } }, tab: 'account' });
  assert.doesNotMatch(guest, /recovery-code|Level 2/);
  assert.match(guest, /Sign in \/ Register/);
});

test('achievement and ranking categories preserve earned state and actual server order', () => {
  assert.match(pilotProfileLayout({ data, tab: 'achievements' }), /pilot-achievement earned/);
  const rankings = Array.from({ length: 8 }, (_, i) => ({ username: `Pilot ${i}`, rating: 1200 - i }));
  const markup = pilotProfileLayout({ data, tab: 'rankings', rankings, pages: { rankings: 1 } });
  assert.match(markup, /Pilot 6/); assert.doesNotMatch(markup, /Pilot 0/);
  assert.match(markup, /data-action="profile-rankings-previous"/);
});

test('room parameter buttons do not submit; summary uses the actual options and supported modes', () => {
  const modes = { race:'Race', precision:'Precision Run', freestyle:'Freestyle Session', cup:'Championship' };
  const markup = hostSessionLayout({ options: { visibility:'private', maxPlayers:2, mode:'precision' }, map, modes });
  for (const value of Object.keys(modes)) assert.match(markup, new RegExp(`type="button"[^>]*data-room-mode="${value}"`));
  assert.match(markup, /value="2" selected/);
  assert.match(markup, /id="room-summary-mode">Precision Run/);
  assert.match(markup, /type="submit"[^>]*>.*Select map/s);
  assert.match(markup, /id="cancel-room-create"/);
});

test('pause actions distinguish frozen solo flight from continuing multiplayer', () => {
  const options = { drone: { id:'kestrel',name:'Kestrel 5' }, flightMode:'ACRO', map, trackName:'Sprint' };
  const solo = flightMenuLayout({ ...options, solo:true, canSave:true });
  assert.match(solo, /Paused/); assert.match(solo, /restart-flight/); assert.match(solo, /save-replay/);
  const multiplayer = flightMenuLayout({ ...options, solo:false, canSave:false });
  assert.match(multiplayer, /Flight continues/);
  assert.doesNotMatch(multiplayer, /restart-flight|save-replay|Paused/);
  for (const action of ['continue-flight','settings','leave']) assert.match(multiplayer, new RegExp(`data-action="${action}"`));
  assert.match(flightMenuLayout({ ...options, finished:true }), /Finished/);
});

test('settings category selection keeps shared navigation, live monitor and origin return', () => {
  const markup = settingsLayout('Back to flight menu', 'camera', '<select id="camera-mode"></select>');
  assert.match(markup, /data-action="camera" aria-pressed="true"/);
  assert.match(markup, /aria-label="Back to flight menu"/);
  assert.match(markup, /id="camera-mode"/);
  const controls = settingsLayout('Back to main menu', 'controls', 'Controls', '<section>Live radio</section>');
  assert.match(controls, /has-monitor/); assert.match(controls, /Live radio/);
});
