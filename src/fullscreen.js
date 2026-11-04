export const FULLSCREEN_PREFERENCE_KEY = 'liftoff-fullscreen-v1';

function browserStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

/** Browser state is authoritative; the saved preference only controls the next startup. */
export function createFullscreenController({
  document: documentRef = globalThis.document,
  storage = browserStorage(),
  element = documentRef?.documentElement,
  transitionTimeoutMs = 3000
} = {}) {
  let preferred = true, error = null, operation = null, disposed = false;
  const listeners = new Set();
  try { preferred = storage?.getItem(FULLSCREEN_PREFERENCE_KEY) !== 'false'; } catch { /* Private storage may be unavailable. */ }

  const active = () => Boolean(documentRef?.fullscreenElement || documentRef?.webkitFullscreenElement);
  function entryAPI() {
    if (disposed || !element || documentRef?.fullscreenEnabled === false) return null;
    if (typeof element.requestFullscreen === 'function') return element.requestFullscreen;
    if (documentRef?.webkitFullscreenEnabled !== false && typeof element.webkitRequestFullscreen === 'function') return element.webkitRequestFullscreen;
    return null;
  }
  function exitAPI() {
    if (disposed) return null;
    if (typeof documentRef?.exitFullscreen === 'function') return documentRef.exitFullscreen;
    if (typeof documentRef?.webkitExitFullscreen === 'function') return documentRef.webkitExitFullscreen;
    return null;
  }
  function getState() {
    return { available: Boolean(entryAPI()), active: active(), preferred, pending: Boolean(operation), error };
  }
  function notify() {
    const state = getState();
    for (const listener of listeners) {
      try { listener(state); } catch { /* A UI subscriber must not break the browser request. */ }
    }
  }
  function savePreference(value) {
    preferred = value;
    try { storage?.setItem(FULLSCREEN_PREFERENCE_KEY, String(value)); } catch { /* Retain the preference for this session. */ }
  }
  const result = status => ({ status, ...getState() });
  function settle(current, failure, forcedStatus) {
    if (current.settled) return;
    current.settled = true;
    clearTimeout(current.timeout);
    const reached = active() === current.entering;
    const status = forcedStatus || (reached ? (current.entering ? 'entered' : 'exited') : (current.entering ? 'denied' : 'error'));
    if (operation === current) {
      operation = null;
      error = reached || forcedStatus ? null : (failure?.message || (current.entering ? 'Fullscreen request was denied.' : 'Could not exit fullscreen.'));
      notify();
    }
    current.resolve(result(status));
  }
  function change() {
    error = null;
    if (operation && active() === operation.entering) settle(operation);
    else notify();
  }
  function fullscreenError() {
    if (operation) settle(operation, new Error('Fullscreen request was denied.'));
    else { error = 'Fullscreen request was denied.'; notify(); }
  }
  const events = [['fullscreenchange', change], ['webkitfullscreenchange', change], ['fullscreenerror', fullscreenError], ['webkitfullscreenerror', fullscreenError]];
  for (const [name, listener] of events) documentRef?.addEventListener?.(name, listener);

  function perform(entering, method) {
    const current = { entering, settled: false };
    current.promise = new Promise(resolve => { current.resolve = resolve; });
    operation = current;
    error = null;
    try {
      // Keep this call in the initiating click's stack, before any await or Promise callback.
      const requested = method.call(entering ? element : documentRef);
      if (requested && typeof requested.then === 'function') {
        Promise.resolve(requested).then(() => settle(current), failure => settle(current, failure));
      } else if (!current.settled) {
        // Older WebKit returns void and confirms completion through its fullscreen events.
        current.timeout = setTimeout(() => settle(current), transitionTimeoutMs);
      }
      if (active() === entering) settle(current);
      else if (!current.settled) notify();
    } catch (failure) { settle(current, failure); }
    return current.promise;
  }
  function enter({ persist = true } = {}) {
    if (persist) savePreference(true);
    if (disposed) return Promise.resolve(result('unavailable'));
    if (active()) { error = null; notify(); return Promise.resolve(result('unchanged')); }
    if (operation?.entering) { notify(); return operation.promise; }
    const method = entryAPI();
    if (!method) { error = null; notify(); return Promise.resolve(result('unavailable')); }
    return perform(true, method);
  }
  function exit({ persist = true } = {}) {
    if (persist) savePreference(false);
    if (disposed) return Promise.resolve(result('unavailable'));
    if (operation?.entering) {
      // An explicit Off while entry is pending must still leave the browser windowed.
      const entering = operation.promise;
      notify();
      return entering.then(() => exit({ persist: false }));
    }
    if (!active()) { error = null; notify(); return Promise.resolve(result('unchanged')); }
    if (operation) { notify(); return operation.promise; }
    const method = exitAPI();
    if (!method) { error = null; notify(); return Promise.resolve(result('unavailable')); }
    return perform(false, method);
  }

  return {
    getState,
    enter,
    exit,
    set: (enabled, options) => enabled ? enter(options) : exit(options),
    toggle: options => active() ? exit(options) : enter(options),
    startup: () => preferred ? enter({ persist: false }) : Promise.resolve(result('disabled')),
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      try { listener(getState()); } catch { /* Same isolation as later notifications. */ }
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      for (const [name, listener] of events) documentRef?.removeEventListener?.(name, listener);
      if (operation) settle(operation, null, 'unavailable');
      listeners.clear();
    }
  };
}
