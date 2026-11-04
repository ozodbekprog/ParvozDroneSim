import test from 'node:test';
import assert from 'node:assert/strict';
import { createFullscreenController, FULLSCREEN_PREFERENCE_KEY } from '../src/fullscreen.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture({ stored, supported = true, webkit = false, storageBlocked = false } = {}) {
  const values = new Map(stored === undefined ? [] : [[FULLSCREEN_PREFERENCE_KEY, stored]]);
  const storage = {
    getItem(key) { if (storageBlocked) throw new Error('Storage denied'); return values.get(key) ?? null; },
    setItem(key, value) { if (storageBlocked) throw new Error('Storage denied'); values.set(key, value); }
  };
  const document = new EventTarget(), element = {};
  document.documentElement = element;
  document.fullscreenElement = null;
  document.webkitFullscreenElement = null;
  let requests = 0, exits = 0;
  let request = () => Promise.resolve().then(() => setActive(true));
  let leave = () => Promise.resolve().then(() => setActive(false));
  function setActive(value) {
    document[webkit ? 'webkitFullscreenElement' : 'fullscreenElement'] = value ? element : null;
    document.dispatchEvent(new Event(webkit ? 'webkitfullscreenchange' : 'fullscreenchange'));
  }
  if (supported) {
    element[webkit ? 'webkitRequestFullscreen' : 'requestFullscreen'] = function () {
      assert.equal(this, element);
      requests++;
      return request();
    };
    document[webkit ? 'webkitExitFullscreen' : 'exitFullscreen'] = function () {
      assert.equal(this, document);
      exits++;
      return leave();
    };
  }
  return {
    document, element, storage, values, setActive,
    requestWith(value) { request = value; },
    exitWith(value) { leave = value; },
    get requests() { return requests; },
    get exits() { return exits; },
    controller(options) { return createFullscreenController({ document, storage, ...options }); }
  };
}

test('fullscreen request starts synchronously and reports active only after browser confirmation', async () => {
  const browser = fixture(), request = deferred(), controller = browser.controller(), states = [];
  browser.requestWith(() => request.promise);
  controller.subscribe(state => states.push(state));
  const entered = controller.enter();
  assert.equal(browser.requests, 1, 'request is made in the click stack');
  assert.equal(controller.getState().active, false);
  assert.equal(controller.getState().pending, true);
  assert.equal(states.some(state => state.active), false);
  browser.setActive(true);
  request.resolve();
  assert.equal((await entered).status, 'entered');
  assert.deepEqual(controller.getState(), { available: true, active: true, preferred: true, pending: false, error: null });
  assert.equal((await controller.enter()).status, 'unchanged');
  assert.equal(browser.requests, 1);
  controller.dispose();
});

test('startup defaults on and explicit Off persists across controllers and future startups', async () => {
  const browser = fixture(), first = browser.controller();
  assert.equal(first.getState().preferred, true);
  assert.equal((await first.startup()).status, 'entered');
  assert.equal(browser.values.has(FULLSCREEN_PREFERENCE_KEY), false, 'automatic entry does not replace a saved choice');
  assert.equal((await first.set(false)).status, 'exited');
  assert.equal(browser.values.get(FULLSCREEN_PREFERENCE_KEY), 'false');
  first.dispose();
  const next = browser.controller();
  assert.equal(next.getState().preferred, false);
  assert.equal((await next.startup()).status, 'disabled');
  assert.equal(browser.requests, 1);
  assert.equal((await next.toggle()).status, 'entered');
  assert.equal(browser.values.get(FULLSCREEN_PREFERENCE_KEY), 'true');
  next.dispose();
});

test('Esc synchronizes UI and never requests fullscreen again by itself', async () => {
  const browser = fixture(), controller = browser.controller(), states = [];
  const unsubscribe = controller.subscribe(state => states.push(state));
  await controller.enter();
  browser.setActive(false);
  await Promise.resolve();
  assert.equal(controller.getState().active, false);
  assert.equal(states.at(-1).active, false);
  assert.equal(controller.getState().preferred, true);
  assert.equal(browser.requests, 1);
  unsubscribe();
  const count = states.length;
  browser.setActive(true);
  assert.equal(states.length, count);
  controller.dispose();
});

test('unsupported and policy-disabled fullscreen resolves unavailable without blocking normal startup', async () => {
  const browser = fixture({ supported: false }), controller = browser.controller();
  assert.equal(controller.getState().available, false);
  assert.equal((await controller.startup()).status, 'unavailable');
  await controller.set(false);
  assert.equal(browser.values.get(FULLSCREEN_PREFERENCE_KEY), 'false');
  controller.dispose();
  const blocked = fixture();
  blocked.document.fullscreenEnabled = false;
  const policyController = blocked.controller();
  assert.equal((await policyController.enter()).status, 'unavailable');
  assert.equal(blocked.requests, 0);
  policyController.dispose();
  const absent = createFullscreenController({ document: undefined, storage: null });
  assert.equal((await absent.enter()).status, 'unavailable');
  absent.dispose();
});

test('rejected startup request resolves denied and permits synchronous retry from Play', async () => {
  const browser = fixture(), controller = browser.controller();
  browser.requestWith(() => Promise.reject(new TypeError('User activation is required')));
  const denied = await controller.startup();
  assert.equal(denied.status, 'denied');
  assert.equal(denied.active, false);
  assert.equal(denied.pending, false);
  assert.match(denied.error, /activation/);
  browser.requestWith(() => Promise.resolve().then(() => browser.setActive(true)));
  const play = controller.enter();
  assert.equal(browser.requests, 2);
  assert.equal((await play).status, 'entered');
  assert.equal(controller.getState().error, null);
  controller.dispose();
});

test('throwing browser APIs and fullscreenerror are handled without rejecting callers', async () => {
  const browser = fixture(), controller = browser.controller();
  browser.requestWith(() => { throw new Error('Permission denied'); });
  assert.equal((await controller.enter()).status, 'denied');
  const request = deferred();
  browser.requestWith(() => request.promise);
  const entered = controller.enter();
  browser.document.dispatchEvent(new Event('fullscreenerror'));
  assert.equal((await entered).status, 'denied');
  request.reject(new Error('The browser also rejects its promise'));
  await Promise.resolve();
  controller.dispose();
});

test('a fulfilled request without actual browser fullscreen remains off', async () => {
  const browser = fixture(), controller = browser.controller();
  browser.requestWith(() => Promise.resolve());
  assert.equal((await controller.enter()).status, 'denied');
  assert.equal(controller.getState().active, false);
  controller.dispose();
});

test('exit failures keep browser state active while remembering the requested Off preference', async () => {
  const browser = fixture(), controller = browser.controller();
  await controller.enter();
  browser.exitWith(() => Promise.reject(new Error('Exit failed')));
  const failed = await controller.exit();
  assert.equal(failed.status, 'error');
  assert.equal(failed.active, true);
  assert.equal(failed.preferred, false);
  assert.equal(browser.values.get(FULLSCREEN_PREFERENCE_KEY), 'false');
  controller.dispose();
});

test('storage failures retain a functional session preference and isolate throwing UI subscribers', async () => {
  const browser = fixture({ storageBlocked: true }), controller = browser.controller();
  controller.subscribe(() => { throw new Error('Unmounted UI'); });
  assert.equal((await controller.enter()).status, 'entered');
  assert.equal((await controller.exit()).status, 'exited');
  assert.equal((await controller.startup()).status, 'disabled');
  controller.dispose();
});

test('WebKit void API confirms entry and exit through prefixed browser events', async () => {
  const browser = fixture({ webkit: true }), controller = browser.controller();
  browser.requestWith(() => undefined);
  browser.exitWith(() => undefined);
  const entered = controller.enter();
  assert.equal(browser.requests, 1);
  assert.equal(controller.getState().active, false);
  browser.setActive(true);
  assert.equal((await entered).status, 'entered');
  const exited = controller.exit();
  browser.setActive(false);
  assert.equal((await exited).status, 'exited');
  controller.dispose();
});

test('WebKit denial and absent completion resolve gracefully and cleanup settles pending work', async () => {
  const browser = fixture({ webkit: true }), controller = browser.controller({ transitionTimeoutMs: 5 });
  browser.requestWith(() => undefined);
  const denied = controller.enter();
  browser.document.dispatchEvent(new Event('webkitfullscreenerror'));
  assert.equal((await denied).status, 'denied');
  assert.equal((await controller.enter()).status, 'denied');
  const pending = controller.enter();
  controller.dispose();
  assert.equal((await pending).status, 'unavailable');
  assert.equal((await controller.enter()).status, 'unavailable');
});

test('Off during pending entry exits as soon as entry completes and duplicate requests share the pending result', async () => {
  const browser = fixture(), controller = browser.controller(), request = deferred();
  browser.requestWith(() => request.promise);
  const entered = controller.enter(), duplicate = controller.enter();
  assert.equal(entered, duplicate);
  assert.equal(browser.requests, 1);
  const exited = controller.exit();
  browser.setActive(true);
  request.resolve();
  await entered;
  assert.equal((await exited).active, false);
  assert.equal(browser.exits, 1);
  assert.equal(controller.getState().preferred, false);
  controller.dispose();
});
