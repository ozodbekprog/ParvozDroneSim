import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleFleetSelection, workbenchHasChanges, sortFlightResults, flightActivityLabel } from '../src/ui-flow.js';

const drones = [
  { id: 'original:kestrel', kind: 'original' },
  { id: 'original:swift', kind: 'original' },
  { id: 'modified:kestrel:1', kind: 'modified' },
  { id: 'modified:swift:1', kind: 'modified' }
];

test('fleet filter selects the visible preview before the visible active drone', () => {
  const selection = visibleFleetSelection(drones, 'modified', 'modified:swift:1', 'modified:kestrel:1');
  assert.deepEqual(selection.entries.map(entry => entry.id), ['modified:kestrel:1', 'modified:swift:1']);
  assert.equal(selection.selected.id, 'modified:swift:1');
  assert.equal(drones.length, 4);
});

test('preview outside the filter falls back to a visible active drone or first entry', () => {
  assert.equal(visibleFleetSelection(drones, 'original', 'modified:swift:1', 'original:swift').selected.id, 'original:swift');
  assert.equal(visibleFleetSelection(drones, 'modified', 'original:swift', 'original:kestrel').selected.id, 'modified:kestrel:1');
  assert.equal(visibleFleetSelection(drones, 'all', 'missing', 'original:swift').selected.id, 'original:swift');
});

test('empty Modified view has no hidden original selection', () => {
  const selection = visibleFleetSelection(drones.slice(0, 2), 'Modified', 'original:swift', 'original:kestrel');
  assert.deepEqual(selection.entries, []);
  assert.equal(selection.selected, null);
  assert.deepEqual(visibleFleetSelection([], 'all', null, null), { entries: [], selected: null });
});

test('All returns a separate visible list without changing fleet order', () => {
  const selection = visibleFleetSelection(drones, 'all', 'original:swift', 'original:kestrel');
  selection.entries.reverse();
  assert.deepEqual(drones.map(entry => entry.id), ['original:kestrel', 'original:swift', 'modified:kestrel:1', 'modified:swift:1']);
});

const saved = {
  id: 'modified:kestrel:1',
  build: { drone: 'kestrel', color: '#fc623d', motors: 'balanced' },
  controller: { rates: { roll: { rcRate: 1, expo: 0 } }, throttle: { idle: 4 } }
};

test('unchanged workbench values are clean regardless of object key order or UI state', () => {
  const draft = {
    build: { motors: 'balanced', color: '#fc623d', drone: 'kestrel' },
    controller: { throttle: { idle: 4 }, rates: { roll: { expo: 0, rcRate: 1 } } },
    tab: 'paint',
    selectedPart: 'motors'
  };
  assert.equal(workbenchHasChanges(draft, saved), false);
  assert.equal(workbenchHasChanges(null, saved), false);
  assert.equal(workbenchHasChanges(null, null), false);
});

test('modified parts and nested tuning both require saving; reverting clears dirty state', () => {
  const draft = structuredClone(saved);
  draft.controller.rates.roll.expo = 0.2;
  assert.equal(workbenchHasChanges(draft, saved), true);
  draft.controller.rates.roll.expo = 0;
  assert.equal(workbenchHasChanges(draft, saved), false);
  draft.build.motors = 'race';
  assert.equal(workbenchHasChanges(draft, saved), true);
  assert.equal(workbenchHasChanges(draft, null), true);
  assert.equal(saved.controller.rates.roll.expo, 0);
});

test('freestyle results use highest score with stable tied scores and no mutation', () => {
  const players = [{ id: 'low', score: 90, finishMs: 100 }, { id: 'high-a', score: 500, finishMs: null }, { id: 'high-b', score: 500, finishMs: 250 }, { id: 'missing', score: undefined }];
  const sorted = sortFlightResults(players, 'freestyle');
  assert.deepEqual(sorted.map(player => player.id), ['high-a', 'high-b', 'low', 'missing']);
  assert.deepEqual(players.map(player => player.id), ['low', 'high-a', 'high-b', 'missing']);
  assert.notEqual(sorted, players);
});

test('timed results put finite times first, DNF last and preserve equal finishes', () => {
  const players = [{ id: 'dnf', finishMs: null }, { id: 'slow', finishMs: 300 }, { id: 'fast-a', finishMs: 100 }, { id: 'missing' }, { id: 'fast-b', finishMs: 100 }, { id: 'invalid', finishMs: NaN }, { id: 'infinite', finishMs: Infinity }];
  for (const mode of ['race', 'time', 'precision', 'cup', 'career']) {
    assert.deepEqual(sortFlightResults(players, mode).map(player => player.id), ['fast-a', 'fast-b', 'slow', 'dnf', 'missing', 'invalid', 'infinite']);
  }
  assert.equal(players[0].id, 'dnf');
  assert.deepEqual(sortFlightResults([], 'race'), []);
});

test('flight activity labels describe what the pilot is doing', () => {
  assert.equal(flightActivityLabel('training'), 'Free flight');
  assert.equal(flightActivityLabel('time'), 'Time trial');
  assert.equal(flightActivityLabel('precision'), 'Precision run');
  assert.equal(flightActivityLabel('career'), 'Career mission');
  assert.equal(flightActivityLabel('cup'), 'Championship');
  assert.equal(flightActivityLabel('weekly'), 'Weekly challenge');
  assert.equal(flightActivityLabel('experimental_mode'), 'Experimental mode');
  assert.equal(flightActivityLabel(undefined), 'Flight');
});
