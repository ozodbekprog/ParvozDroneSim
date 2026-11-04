import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FLIGHT_CONTROLLER, rateDegrees, throttleOutput, validateFlightController } from '../shared/flight-controller.js';
import { FIXED_DT, createDroneState, defaultBuild, resolveBuild, stepDrone } from '../shared/physics.js';

test('Betaflight rates match the displayed maximum rates and remain symmetric', () => {
  assert.equal(Math.round(rateDegrees(1, DEFAULT_FLIGHT_CONTROLLER.rates.roll)), 667);
  assert.equal(Math.round(rateDegrees(1, DEFAULT_FLIGHT_CONTROLLER.rates.pitch)), 500);
  assert.equal(Math.round(rateDegrees(1, DEFAULT_FLIGHT_CONTROLLER.rates.yaw)), 417);
  assert.equal(rateDegrees(-0.6, DEFAULT_FLIGHT_CONTROLLER.rates.roll), -rateDegrees(0.6, DEFAULT_FLIGHT_CONTROLLER.rates.roll));
});

test('controller values are bounded before authoritative simulation', () => {
  const profile = validateFlightController({ rates: { roll: { superRate: 99 } }, pid: { roll: { p: -20 } }, throttle: { idle: 99 } });
  assert.equal(profile.rates.roll.superRate, 0.95);
  assert.equal(profile.pid.roll.p, 0);
  assert.equal(profile.throttle.idle, 15);
  assert.equal(profile.pid.yaw.d, 0);
});

test('throttle curve keeps endpoints and changes the midpoint', () => {
  const baseline = DEFAULT_FLIGHT_CONTROLLER.throttle;
  assert.equal(throttleOutput(0, baseline), 0);
  assert.equal(throttleOutput(1, baseline), 1);
  const curve = { ...baseline, mid: 65 };
  assert.ok(throttleOutput(0.5, curve) > 0.5);
});

test('PID tuning changes angular response without producing invalid state', () => {
  const low = validateFlightController({ pid: { roll: { p: 0, i: 0, d: 0 } } });
  const high = validateFlightController(DEFAULT_FLIGHT_CONTROLLER);
  const a = createDroneState([0, 3, 0]);
  const b = createDroneState([0, 3, 0]);
  const spec = resolveBuild(defaultBuild());
  for (let index = 0; index < 20; index++) {
    stepDrone(a, { throttle: 0.5, roll: 0.2 }, spec, FIXED_DT, 'acro', [0, 0, 0], 1, low);
    stepDrone(b, { throttle: 0.5, roll: 0.2 }, spec, FIXED_DT, 'acro', [0, 0, 0], 1, high);
  }
  assert.ok(Math.abs(b.angularVelocity[2]) > Math.abs(a.angularVelocity[2]));
  assert.ok([...b.position, ...b.rotation, ...b.angularVelocity].every(Number.isFinite));
});

test('three featured drones are immediately available and old builds resolve', () => {
  for (const drone of ['kestrel', 'swift', 'atlas']) assert.equal(resolveBuild({ ...defaultBuild(), drone }).unlock, 'starter');
  assert.equal(resolveBuild(defaultBuild()).name, 'Kestrel 5');
});
