import { DEFAULT_FLIGHT_CONTROLLER, validateFlightController } from '../shared/flight-controller.js';

const KEY = 'liftoff-flight-profiles-v1';
const clone = value => structuredClone(value);

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
  catch { return {}; }
}

export function initializeFlightProfiles(input) {
  if (localStorage.getItem(KEY)) return;
  const savedCalibration = input.profiles || {};
  const priorExpo = savedCalibration[input.selected]?.expo ?? Object.values(savedCalibration).find(profile => Number(profile.expo) > 0)?.expo ?? 0;
  const legacyExpo = Math.min(0.8, Math.max(0, Number(priorExpo) || 0));
  if (!legacyExpo) return;
  const all = {};
  for (const drone of ['kestrel', 'swift', 'atlas', 'viper']) {
    const profile = clone(DEFAULT_FLIGHT_CONTROLLER);
    for (const axis of ['roll', 'pitch', 'yaw']) profile.rates[axis].expo = legacyExpo;
    all[drone] = { active: 0, slots: [profile, null, null] };
  }
  localStorage.setItem(KEY, JSON.stringify(all));
  for (const profile of Object.values(savedCalibration)) profile.expo = 0;
  localStorage.setItem('liftoff-profiles', JSON.stringify(savedCalibration));
}

export function selectedSlot(drone) {
  const active = Number(read()[drone]?.active);
  return Number.isInteger(active) && active >= 0 && active < 3 ? active : 0;
}

export function getFlightProfile(drone, slot = selectedSlot(drone)) {
  return validateFlightController(read()[drone]?.slots?.[slot] || DEFAULT_FLIGHT_CONTROLLER);
}

export function saveFlightProfile(drone, slot, value) {
  const all = read();
  const current = all[drone] || { active: 0, slots: [null, null, null] };
  current.slots[slot] = validateFlightController(value);
  current.active = slot;
  all[drone] = current;
  localStorage.setItem(KEY, JSON.stringify(all));
  return clone(current.slots[slot]);
}

export function selectFlightProfile(drone, slot) {
  const all = read();
  all[drone] ||= { active: 0, slots: [null, null, null] };
  all[drone].active = slot;
  localStorage.setItem(KEY, JSON.stringify(all));
  return getFlightProfile(drone, slot);
}

export function deleteFlightProfile(drone, slot) {
  const all = read();
  if (all[drone]?.slots) all[drone].slots[slot] = null;
  localStorage.setItem(KEY, JSON.stringify(all));
}
