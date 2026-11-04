import test from 'node:test';
import assert from 'node:assert/strict';
import { fixedSteps } from '../shared/timing.js';
import { deleteFlightProfile, getFlightProfile, initializeFlightProfiles, saveFlightProfile, selectFlightProfile } from '../src/flight-profiles.js';

test('fixed 60 Hz simulation accumulates high-refresh frames and bounds catch-up', () => {
  const first = fixedSteps(0, 1 / 120);
  const second = fixedSteps(first.remainder, 1 / 120);
  assert.equal(first.steps, 0);
  assert.equal(second.steps, 1);
  assert.ok(second.remainder < 1e-8);
  assert.equal(fixedSteps(0, 0.5).steps, 5);
});

test('per-drone flight profiles save, select, undo source, and delete independently', () => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const tuned = getFlightProfile('swift');
  tuned.rates.roll.rcRate = 1.25;
  saveFlightProfile('swift', 1, tuned);
  selectFlightProfile('swift', 1);
  assert.equal(getFlightProfile('swift').rates.roll.rcRate, 1.25);
  assert.equal(getFlightProfile('kestrel').rates.roll.rcRate, 1);
  deleteFlightProfile('swift', 1);
  assert.equal(getFlightProfile('swift').rates.roll.rcRate, 1);
  delete globalThis.localStorage;
});

test('saved legacy radio expo migrates once to flight rates', () => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const input = { selected: '0:radio', profiles: { '0:radio': { expo: 0.3 } } };
  initializeFlightProfiles(input);
  assert.equal(getFlightProfile('kestrel').rates.pitch.expo, 0.3);
  assert.equal(input.profiles['0:radio'].expo, 0);
  delete globalThis.localStorage;
});
