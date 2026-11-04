import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DRONES, defaultBuild } from '../shared/physics.js';
import { validateFlightController } from '../shared/flight-controller.js';
import { DRONE_FLEET_KEY, readDroneFleet, saveDroneFleet, listFleetDrones, createDroneCopy, updateDroneCopy, selectFleetDrone, deleteDroneCopy } from '../src/drone-fleet.js';

let previousStorage;
beforeEach(() => {
  previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  } });
});
afterEach(() => {
  if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
  else delete globalThis.localStorage;
});

test('originals remain canonical and cannot be edited or deleted', () => {
  const fleet = readDroneFleet('pilot-one', defaultBuild());
  const originals = listFleetDrones(fleet);
  assert.equal(originals.length, Object.keys(DRONES).length);
  assert.ok(originals.every(entry => entry.kind === 'original'));
  assert.throws(() => updateDroneCopy(fleet, 'original:kestrel', { build: { color: '#ffffff' } }), /cannot be edited/);
  assert.throws(() => deleteDroneCopy(fleet, 'original:kestrel'), /cannot be deleted/);
  originals.find(entry => entry.baseDrone === 'kestrel').build.color = '#000000';
  assert.deepEqual(listFleetDrones(fleet).find(entry => entry.baseDrone === 'kestrel').build, defaultBuild());
  assert.equal(listFleetDrones(fleet).find(entry => entry.baseDrone === 'armattan-gecko').build.color, DRONES["armattan-gecko"].color.toLowerCase());
});

test('numbered copies inherit modified setup and never reuse a deleted suffix', () => {
  const initial = readDroneFleet('pilot-one', defaultBuild());
  const first = createDroneCopy(initial, 'original:kestrel');
  const controller = validateFlightController({ rates: { roll: { rcRate: 1.5 } } });
  const tuned = updateDroneCopy(first.fleet, first.entry.id, { build: { motors: 'race', color: '#aabbcc' }, controller });
  const second = createDroneCopy(tuned, first.entry.id);
  assert.equal(second.entry.name, 'Kestrel 5 Copy 2');
  assert.equal(second.entry.build.motors, 'race');
  assert.deepEqual(second.entry.controller, controller);
  const deleted = deleteDroneCopy(second.fleet, second.entry.id);
  const third = createDroneCopy(deleted, 'original:kestrel');
  assert.equal(third.entry.name, 'Kestrel 5 Copy 3');
  assert.equal(initial.modified.length, 0);
  assert.equal(first.fleet.modified[0].build.motors, defaultBuild().motors);
  assert.throws(() => updateDroneCopy(third.fleet, third.entry.id, { build: { drone: 'armattan-gecko' } }), /original drone model/);
});

test('deleting the selected copy falls back to the corresponding original', () => {
  const created = createDroneCopy(readDroneFleet('pilot-one'), 'original:armattan-gecko');
  const selected = selectFleetDrone(created.fleet, created.entry.id);
  const deleted = deleteDroneCopy(selected, created.entry.id);
  assert.equal(deleted.selectedId, 'original:armattan-gecko');
  assert.equal(selected.selectedId, created.entry.id);
  assert.throws(() => selectFleetDrone(deleted, created.entry.id), /no longer exists/);
});

test('storage round trips copies and keeps distinct pilot IDs separate', () => {
  const created = createDroneCopy(readDroneFleet('pilot/a'), 'original:luma-5');
  const tuned = updateDroneCopy(created.fleet, created.entry.id, { build: { battery: 'endurance', color: '#fedcba' } });
  saveDroneFleet('pilot/a', tuned);
  const other = readDroneFleet('pilot%2Fa');
  assert.equal(other.modified.length, 0);
  assert.equal(readDroneFleet(' pilot/a').modified.length, 0);
  assert.deepEqual(readDroneFleet('pilot/a'), tuned);
  readDroneFleet('__proto__');
  assert.deepEqual(readDroneFleet('pilot/a'), tuned);
  assert.throws(() => readDroneFleet(''), /pilot ID/);
});

test('legacy custom builds migrate once; choosing another original needs no copy', () => {
  const legacy = { ...defaultBuild(), drone: 'armattan-gecko', frame: 'light', color: '#aabbcc' };
  const migrated = readDroneFleet('pilot-one', legacy);
  assert.equal(migrated.modified.length, 1);
  assert.equal(migrated.modified[0].name, 'Armattan Gecko 3″ Copy 1');
  assert.equal(migrated.selectedId, migrated.modified[0].id);
  assert.deepEqual(readDroneFleet('pilot-one', legacy), migrated);
  const original = readDroneFleet('pilot-two', { ...defaultBuild(), drone: 'luma-5', color: DRONES["luma-5"].color });
  assert.equal(original.selectedId, 'original:luma-5');
  assert.equal(original.modified.length, 0);
  // An existing pristine fleet must not be remigrated after a later server update.
  assert.equal(readDroneFleet('pilot-two', legacy).modified.length, 0);
});

test('legacy build retains its actual color when different from original stock paint', () => {
  const legacy = { ...defaultBuild(), drone: 'armattan-gecko' };
  const fleet = readDroneFleet('pilot-one', legacy);
  assert.equal(fleet.modified.length, 1);
  assert.equal(fleet.modified[0].build.color, legacy.color);
  assert.equal(listFleetDrones(fleet).find(entry => entry.id === 'original:armattan-gecko').build.color, DRONES["armattan-gecko"].color.toLowerCase());
});

test('nondefault legacy flight controller is preserved in a modified copy', () => {
  const controller = validateFlightController({ pid: { pitch: { p: 70 } } });
  const fleet = readDroneFleet('pilot-one', defaultBuild(), controller);
  assert.equal(fleet.modified.length, 1);
  assert.deepEqual(fleet.modified[0].controller, controller);
});

test('workbench edits stay isolated until the caller commits the fleet', () => {
  const created = createDroneCopy(readDroneFleet('pilot-one'), 'original:kestrel');
  saveDroneFleet('pilot-one', created.fleet);
  const draft = updateDroneCopy(created.fleet, created.entry.id, { build: { motors: 'race' } });
  assert.equal(readDroneFleet('pilot-one').modified[0].build.motors, 'balanced');
  saveDroneFleet('pilot-one', draft);
  assert.equal(readDroneFleet('pilot-one').modified[0].build.motors, 'race');
  draft.modified[0].build.motors = 'smooth';
  assert.equal(readDroneFleet('pilot-one').modified[0].build.motors, 'race');
});

test('corrupt stored values are repaired without trusting names, parts or controllers', () => {
  localStorage.setItem(DRONE_FLEET_KEY, JSON.stringify({ version: 1, owners: { 'pilot:pilot-one': {
    selectedId: 'missing', nextCopyNumbers: { kestrel: 0 }, modified: [
      { id: 'broken', baseDrone: 'kestrel', copyNumber: 1, name: '<script>', build: { drone: 'armattan-gecko', motors: 'nonexistent', color: 'url(bad)', led: '#ABCDEF' }, controller: { rates: { roll: { superRate: 99 } } } },
      { id: 'duplicate', baseDrone: 'kestrel', copyNumber: 1 },
      { baseDrone: 'removed-model', copyNumber: 8 }
    ]
  } } }));
  const repaired = readDroneFleet('pilot-one');
  assert.equal(repaired.selectedId, 'original:kestrel');
  assert.equal(repaired.modified.length, 2);
  assert.deepEqual(repaired.modified.map(entry => entry.copyNumber), [1, 2]);
  assert.equal(repaired.modified[0].name, 'Kestrel 5 Copy 1');
  assert.equal(repaired.modified[0].build.drone, 'kestrel');
  assert.equal(repaired.modified[0].build.motors, 'balanced');
  assert.equal(repaired.modified[0].build.color, defaultBuild().color);
  assert.equal(repaired.modified[0].build.led, '#abcdef');
  assert.equal(repaired.modified[0].controller.rates.roll.superRate, 0.95);
  assert.equal(createDroneCopy(repaired, 'original:kestrel').entry.copyNumber, 3);
});

test('invalid JSON does not prevent the fleet from initializing', () => {
  localStorage.setItem(DRONE_FLEET_KEY, '{broken json');
  assert.equal(readDroneFleet('pilot-one').selectedId, 'original:kestrel');
  assert.doesNotThrow(() => JSON.parse(localStorage.getItem(DRONE_FLEET_KEY)));
});

test('retired airframes leave the selectable fleet while their existing builds remain recoverable',()=>{
  const retired={id:'modified:swift:2',baseDrone:'swift',copyNumber:2,build:{drone:'swift',color:'#aabbcc',motors:'race'}};
  localStorage.setItem(DRONE_FLEET_KEY,JSON.stringify({version:1,owners:{'pilot:retired-pilot':{selectedId:retired.id,modified:[retired]}}}));
  const fleet=readDroneFleet('retired-pilot');
  assert.equal(fleet.selectedId,'original:kestrel');assert.deepEqual(fleet.retiredModified,[retired]);
  assert.ok(!listFleetDrones(fleet).some(entry=>entry.baseDrone==='swift'));
  assert.deepEqual(readDroneFleet('retired-pilot').retiredModified,[retired]);
  const legacy={drone:'atlas',battery:'endurance',color:'#aabbcc'};
  assert.deepEqual(readDroneFleet('legacy-retired',legacy).retiredBuild.build,legacy);
});

test('storage write failures reach the caller when committing a fleet', () => {
  const fleet = readDroneFleet('pilot-one');
  localStorage.setItem = () => { throw new Error('Storage quota exceeded'); };
  assert.throws(() => saveDroneFleet('pilot-one', fleet), /quota exceeded/);
  assert.doesNotThrow(() => readDroneFleet('pilot-one'));
});
