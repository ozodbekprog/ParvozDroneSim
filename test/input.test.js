import test from 'node:test';
import assert from 'node:assert/strict';
import { calibratedChannels, InputManager, throttleFromAxis } from '../src/input.js';

const neutral = { throttle: 0, yaw: 0, pitch: 0, roll: 0 };

function withInputEnvironment(selected, run) {
  const descriptors = Object.fromEntries(['window', 'document', 'navigator', 'localStorage'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const eventTarget = () => {
    const listeners = new Map();
    return {
      addEventListener(name, listener) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(listener); },
      dispatch(name, values = {}) { for (const listener of listeners.get(name) || []) listener({ preventDefault() {}, ...values }); }
    };
  };
  const browserWindow = eventTarget();
  const browserDocument = { ...eventTarget(), hidden: false, activeElement: { tagName: 'BODY' }, querySelector: () => null };
  const storage = new Map([['liftoff-device', selected]]);
  let pads = [];
  for (const [name, value] of Object.entries({
    window: browserWindow, document: browserDocument,
    navigator: { getGamepads: () => pads },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
  })) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  try { run(new InputManager(), browserWindow, browserDocument, next => { pads = next; }); }
  finally {
    for (const [name, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

test('RC throttle uses the whole stick range while a centered gamepad idles at zero', () => {
  const profile = {
    min: { throttle: -1 }, max: { throttle: 1 }, center: { throttle: 0 },
    invert: { throttle: false }, throttleMode: 'full'
  };
  assert.equal(throttleFromAxis(-1, profile), 0);
  assert.equal(throttleFromAxis(0, profile), 0.5);
  assert.equal(throttleFromAxis(1, profile), 1);

  profile.throttleMode = 'centered'; profile.invert.throttle = true;
  assert.equal(throttleFromAxis(0, profile), 0);
  assert.equal(throttleFromAxis(-1, profile), 1);
  assert.equal(throttleFromAxis(1, profile), 0);

  profile.min.throttle = -0.8; profile.center.throttle = 0.1;
  assert.ok(Math.abs(throttleFromAxis(-0.35, profile) - 0.5) < 1e-12);
});

test('keyboard selection ignores connected radios and gamepads', () => {
  const selected = InputManager.prototype.selectedDevice.call({ selected: 'keyboard', devices: () => [{ id: 'RadioMaster TX12', index: 0 }] });
  assert.equal(selected, null);
});

test('remapping reports timeout and device changes without saving accidental calibration', () => {
  withInputEnvironment('RadioMaster TX12', (input, _window, _document, setPads) => {
    assert.equal(input.beginCapture('roll', () => assert.fail('No device')), false);
    setPads([{ id: 'RadioMaster TX12', axes: [0, 0, -1, 0] }]);
    const reasons = [];
    assert.equal(input.beginCapture('roll', () => assert.fail('No movement'), reason => reasons.push(reason)), true);
    assert.equal(input.beginCalibration(() => assert.fail('Overlapping calibration')), false);
    input.capture.until = -1;
    input.pollCapture();
    assert.deepEqual(reasons, ['timeout']);
    assert.equal(input.capture, null);
    input.beginCapture('pitch', () => assert.fail('Device changed'), reason => reasons.push(reason));
    input.selectDevice('keyboard');
    assert.deepEqual(reasons, ['timeout', 'device-changed']);
    assert.deepEqual(input.profiles, {});
  });
});

test('focus loss clears latched keyboard throttle and ignores controls until focus returns', () => {
  withInputEnvironment('keyboard', (input, browserWindow) => {
    browserWindow.dispatch('keydown', { code: 'ShiftLeft' });
    assert.equal(input.read(0.5).throttle, 0.36);
    browserWindow.dispatch('keyup', { code: 'ShiftLeft' });
    browserWindow.dispatch('keydown', { code: 'KeyW' });
    browserWindow.dispatch('blur');
    browserWindow.dispatch('keydown', { code: 'ShiftLeft' });
    assert.deepEqual(input.read(0.5), neutral);
    browserWindow.dispatch('focus');
    assert.deepEqual(input.read(0.5), neutral);
    browserWindow.dispatch('keydown', { code: 'KeyD' });
    assert.equal(input.read().roll, 1);
  });
});

test('hidden or unfocused pages send neutral radio controls instead of stale sticks', () => {
  withInputEnvironment('RadioMaster TX12', (input, browserWindow, browserDocument, setPads) => {
    setPads([{ id: 'RadioMaster TX12', axes: [0, 0, 1, 0] }]);
    assert.equal(input.read().throttle, 1);
    browserDocument.hidden = true;
    browserDocument.dispatch('visibilitychange');
    assert.deepEqual(input.read(), neutral);
    browserDocument.hidden = false;
    browserWindow.dispatch('blur');
    assert.deepEqual(input.read(), neutral);
    browserWindow.dispatch('focus');
    assert.equal(input.read().throttle, 1);
  });
});

test('an unavailable selected radio stays neutral until explicitly switched to keyboard', () => {
  withInputEnvironment('RadioMaster TX12', (input, browserWindow) => {
    input.throttle = 0.8;
    browserWindow.dispatch('keydown', { code: 'KeyW' });
    assert.deepEqual(input.read(), neutral);
    input.selectDevice('keyboard');
    assert.deepEqual(input.read(), neutral);
    browserWindow.dispatch('keydown', { code: 'ShiftLeft' });
    assert.equal(input.read(0.5).throttle, 0.36);
  });
});

test('missing or invalid radio channels are neutral until their first valid report', () => {
  const profile = {
    axis: { throttle: 2, yaw: 3, pitch: 1, roll: 0 },
    min: {}, max: {}, center: { pitch: 0.2 }, invert: {}, deadzone: 0.04, throttleMode: 'full'
  };
  assert.deepEqual(calibratedChannels([], profile), neutral);
  assert.deepEqual(calibratedChannels([NaN, undefined, Infinity, null], profile), neutral);
  assert.equal(calibratedChannels([0, 0.2, -1, 0], profile).throttle, 0);
  assert.equal(calibratedChannels([0, 0.2, 1, 0], profile).throttle, 1);
});

test('automatic keyboard fallback after repeated disconnects starts with cleared controls', () => {
  withInputEnvironment('', (input, browserWindow, browserDocument, setPads) => {
    browserWindow.dispatch('keydown', { code: 'ShiftLeft' });
    assert.equal(input.read(0.5).throttle, 0.36);
    setPads([{ id: 'Gamepad', axes: [0, 0, 0, 0], connected: true }]);
    browserWindow.dispatch('gamepadconnected');
    assert.equal(input.read().throttle, 0);
    browserWindow.dispatch('keydown', { code: 'KeyW' });
    setPads([{ id: 'Gamepad', axes: [0, 0, 0, 0], connected: false }]);
    browserWindow.dispatch('gamepaddisconnected');
    browserWindow.dispatch('gamepaddisconnected');
    assert.deepEqual(input.read(), neutral);
    browserWindow.dispatch('blur');
    browserWindow.dispatch('blur');
    browserWindow.dispatch('focus');
    browserWindow.dispatch('focus');
    assert.deepEqual(input.read(), neutral);
    browserWindow.dispatch('keydown', { code: 'KeyW' });
    assert.equal(input.read().pitch, 1);
    input.reset();
    input.reset();
    assert.deepEqual(input.read(), neutral);
  });
});
