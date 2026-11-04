import test from 'node:test';
import assert from 'node:assert/strict';
import { pageEntries } from '../src/ui-flow.js';
import { collectionLayout, championshipLayout, weeklyLayout, flightSetupLayout, settingsLayout } from '../src/menu-layouts.js';

test('paged collections expose every entry once and clamp after a list shrinks', () => {
  const entries = Array.from({ length: 24 }, (_, i) => ({ id: i }));
  const visited = Array.from({ length: 4 }, (_, i) => pageEntries(entries, i).entries).flat();
  assert.deepEqual(visited, entries);
  assert.equal(pageEntries(entries.slice(0, 2), 3).page, 0);
  assert.deepEqual(pageEntries([], -5), { entries: [], page: 0, pages: 1, start: 0 });
});

test('career selection and launch stay attached to the displayed page, with safe content labels', () => {
  const maps = { hangar: { id: 'hangar', name: 'Training', region: 'Indoor', description: '<script>bad</script>', thumbnail: '/content/map.png' } };
  const entries = Array.from({ length: 12 }, (_, i) => ({ id: `mission-${i}`, name: `Mission ${i}`, map: 'hangar', target: 100 }));
  const markup = collectionLayout({ kind: 'career', entries, selectedId: 'mission-1', requestedPage: 1, maps });
  assert.match(markup, /data-learn-entry="mission-6" aria-pressed="true"/);
  assert.doesNotMatch(markup, /data-learn-entry="mission-1"/);
  assert.match(markup, /data-action="launch-mission"/);
  assert.match(markup, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.equal((markup.match(/data-download-map="hangar"/g)||[]).length,6);
  assert.match(markup,/<\/button><button class="map-download-badge"/);
});

test('flight lessons beyond the first page keep their own topic, outline and launch target',()=>{
 const maps={hangar:{id:'hangar',name:'Hangar',region:'Indoor'}},entries=Array.from({length:10},(_,i)=>({id:`lesson-${i}`,name:`Lesson ${i}`,map:'hangar',topic:'Acro <practice>',description:'Hold & recover',steps:[{text:`Instruction ${i}`}]}));
 const markup=collectionLayout({kind:'tutorials',entries,maps,requestedPage:2,selectedId:'lesson-9'});
 assert.match(markup,/data-learn-entry="lesson-9" aria-pressed="true"/);
 assert.match(markup,/data-action="tutorial-lesson-9"/);
 assert.match(markup,/Acro &lt;practice&gt;/);assert.match(markup,/Hold &amp; recover/);
 assert.match(markup,/Instruction 9/);assert.doesNotMatch(markup,/Instruction 8/);
 assert.match(markup,/aria-label="Lesson pages"/);
});

test('weekly and championship each have a separate paged leaderboard and working launch action', () => {
  const map = { id: 'hangar', name: 'Training', region: 'Indoor', thumbnail: '/content/map.png' };
  const rows = Array.from({ length: 8 }, (_, i) => ({ username: `Pilot ${i}`, best_ms: 12345, points: 10, wins: 1 }));
  const weekly = weeklyLayout({ challenge: { map: 'hangar' }, rows, page: 1, maps: { hangar: map }, track: { name: 'Sprint', laps: 1 } });
  assert.match(weekly, /leaderboard-panel/); assert.match(weekly, /data-action="weekly-start"/);
  assert.match(weekly, /Pilot 6/); assert.doesNotMatch(weekly, /Pilot 0/);
  assert.match(championshipLayout({ rows, page: 0, map }), /data-action="host-championship"/);
});

test('flight setup keeps the selected map, course and launch actions across solo and room modes', () => {
  const maps = Array.from({ length: 12 }, (_, i) => ({ id: `map-${i}`, name: `Map ${i}`, region: 'Test', description: 'Course', thumbnail: '/content/map.png', wind: [0, 0, 0], tracks: [{ id: 'sprint', name: 'Sprint', laps: 1 }, { id: 'circuit', name: 'Circuit', laps: 2 }] }));
  const options = { maps, selectedMap: maps[6], selectedTrack: 'circuit', page: 1, droneName: 'Kestrel 5', roomOptions: { mode: 'precision', maxPlayers: 2, visibility: 'private' } };
  const race = flightSetupLayout({ ...options, mode: 'race', modeLabel: 'Race' });
  assert.match(race, /data-map="map-6" aria-label="Map 6" aria-pressed="true"/);
  assert.doesNotMatch(race, /data-map="map-0"/);
  assert.match(race, /value="circuit" selected/);
  assert.match(race, /data-action="launch"/); assert.match(race, /data-action="hangar"/);
  assert.doesNotMatch(flightSetupLayout({ ...options, mode: 'training', modeLabel: 'Free flight' }), /id="track-select"/);
  const room = flightSetupLayout({ ...options, mode: 'multiplayer', modeLabel: 'Precision Run' });
  assert.match(room, /Private room · 2 pilots max/); assert.match(room, /Create room/);
  assert.doesNotMatch(room, /flight-activity-/);
  assert.match(room, /data-action="room-options"/);
});

test('settings hub retains its paused-flight return and all category destinations', () => {
  const markup = settingsLayout('Back to flight menu');
  assert.match(markup, /data-action="settings-back" aria-label="Back to flight menu"/);
  for (const action of ['controls','camera','graphics']) assert.match(markup, new RegExp(`data-action="${action}"`));
});
