import test from 'node:test';
import assert from 'node:assert/strict';
import { createDroneState, defaultBuild, resolveBuild, stepDrone, FIXED_DT } from '../shared/physics.js';
import { DEFAULT_FLIGHT_CONTROLLER, rateDegrees } from '../shared/flight-controller.js';

test('default five-inch hover throttle stays in the intended range', () => {
  const spec = resolveBuild(defaultBuild());
  const hover = Math.pow(1 / spec.thrustToWeight, 1 / 1.85);
  assert.ok(hover >= 0.35 && hover <= 0.45, `hover at ${Math.round(hover * 100)}%`);
});

test('battery mass changes thrust-to-weight without changing motor peak thrust', () => {
  const standard = resolveBuild(defaultBuild());
  const heavy = resolveBuild({ ...defaultBuild(), battery: 'endurance' });
  assert.ok(heavy.thrustToWeight < standard.thrustToWeight);
  assert.ok(Math.abs(standard.mass * standard.thrustToWeight - heavy.mass * heavy.thrustToWeight) < 1e-10);
});

test('acro roll reaches its configured rate promptly', () => {
  const state = createDroneState([0, 5, 0]);
  const spec = resolveBuild(defaultBuild());
  for (let step = 0; step < 12; step++) stepDrone(state, { throttle: 0.42, roll: 1, pitch: 0, yaw: 0 }, spec, FIXED_DT, 'acro');
  const target = rateDegrees(1, DEFAULT_FLIGHT_CONTROLLER.rates.roll) * Math.PI / 180;
  assert.ok(Math.abs(state.angularVelocity[2] - target) < target * 0.1);
});
