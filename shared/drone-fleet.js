import { DRONES, PARTS, defaultBuild } from './physics.js';
import { validateFlightController } from './flight-controller.js';
import {isPartCompatible,canUseActionCamera} from './part-compatibility.js';

const VERSION = 1;
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;

export function defaultDroneId() {
  return DRONES[defaultBuild().drone] ? defaultBuild().drone : Object.keys(DRONES)[0];
}

export function originalBuild(droneId) {
  const build = defaultBuild(droneId);
  if (DRONES[droneId]?.accessories?.actionCamera) build.actionCamera = false;
  const stockColor = DRONES[droneId]?.color;
  if (typeof stockColor === 'string' && /^#[\da-f]{6}$/i.test(stockColor)) build.color = stockColor.toLowerCase();
  for (const category of Object.keys(PARTS)) {
    if (!PARTS[category].some(part => part.id === build[category])) build[category] = PARTS[category][0]?.id;
  }
  return build;
}

export function cleanBuild(value, droneId) {
  const baseline = originalBuild(droneId);
  const input = record(value) ? value : {};
  const build = { ...baseline };
  for (const category of Object.keys(PARTS)) {
    if (PARTS[category].some(part => part.id === input[category] && isPartCompatible(DRONES[droneId],category,part))) build[category] = input[category];
  }
  for (const category of ['color', 'led']) {
    if (typeof input[category] === 'string' && /^#[\da-f]{6}$/i.test(input[category])) build[category] = input[category].toLowerCase();
  }
  if (DRONES[droneId]?.accessories?.actionCamera) build.actionCamera = input.actionCamera === true && canUseActionCamera(DRONES[droneId]);
  return build;
}

function modifiedEntry(baseDrone, copyNumber, build, controller) {
  return {
    id: `modified:${baseDrone}:${copyNumber}`,
    kind: 'modified',
    baseDrone,
    copyNumber,
    name: `${DRONES[baseDrone].name} Copy ${copyNumber}`,
    build: cleanBuild(build, baseDrone),
    controller: validateFlightController(controller)
  };
}

export function cleanFleet(value) {
  const input = record(value) ? value : {};
  const nextCopyNumbers = {};
  for (const id of Object.keys(DRONES)) {
    const next = input.nextCopyNumbers?.[id];
    nextCopyNumbers[id] = positiveInteger(next) ? next : 1;
  }
  const modified = [];
  const retiredModified = (Array.isArray(input.retiredModified)?input.retiredModified:[]).filter(record);
  const used = new Set();
  const repairedIds = new Map();
  for (const candidate of Array.isArray(input.modified) ? input.modified : []) {
    if (!record(candidate)) continue;
    const baseDrone = candidate.baseDrone || candidate.build?.drone;
    if (!Object.hasOwn(DRONES, baseDrone)) {retiredModified.push(candidate);continue;}
    let copyNumber = candidate.copyNumber;
    if (!positiveInteger(copyNumber)) {
      const match = typeof candidate.id === 'string' && candidate.id.match(/^modified:[^:]+:(\d+)$/);
      copyNumber = match && positiveInteger(Number(match[1])) ? Number(match[1]) : nextCopyNumbers[baseDrone];
    }
    while (used.has(`${baseDrone}:${copyNumber}`)) copyNumber++;
    // Never keep a suffix that would make the next copy's counter unsafe.
    if (!positiveInteger(copyNumber + 1)) continue;
    used.add(`${baseDrone}:${copyNumber}`);
    nextCopyNumbers[baseDrone] = Math.max(nextCopyNumbers[baseDrone], copyNumber + 1);
    const entry = modifiedEntry(baseDrone, copyNumber, candidate.build, candidate.controller);
    modified.push(entry);
    if (typeof candidate.id === 'string' && !repairedIds.has(candidate.id)) repairedIds.set(candidate.id, entry.id);
  }
  const selected = repairedIds.get(input.selectedId) || input.selectedId;
  const originalId = typeof selected === 'string' && selected.startsWith('original:') ? selected.slice('original:'.length) : null;
  const selectedId = (originalId && Object.hasOwn(DRONES, originalId)) || modified.some(entry => entry.id === selected)
    ? selected : `original:${defaultDroneId()}`;
  return { version: VERSION, selectedId, modified, nextCopyNumbers, ...(retiredModified.length?{retiredModified}: {}), ...(record(input.retiredBuild)?{retiredBuild:input.retiredBuild}: {}) };
}

/** Originals are reconstructed from catalog defaults on every read. */
export function listFleetDrones(fleet) {
  const originals = Object.keys(DRONES).map(baseDrone => ({
    id: `original:${baseDrone}`,
    kind: 'original',
    baseDrone,
    name: DRONES[baseDrone].name,
    build: originalBuild(baseDrone),
    controller: validateFlightController()
  }));
  return [...originals, ...cleanFleet(fleet).modified];
}

/** Copying either kind inherits its setup, and always names the original base. */
export function createDroneCopy(fleet, sourceId) {
  const next = cleanFleet(fleet);
  const source = listFleetDrones(next).find(entry => entry.id === sourceId);
  if (!source) throw new RangeError('Choose an existing drone before creating a copy.');
  const number = next.nextCopyNumbers[source.baseDrone];
  if (!positiveInteger(number + 1)) throw new RangeError('This drone has reached its copy limit.');
  const entry = modifiedEntry(source.baseDrone, number, source.build, source.controller);
  next.modified.push(entry);
  next.nextCopyNumbers[source.baseDrone] = number + 1;
  next.selectedId = entry.id;
  return { fleet: next, entry: structuredClone(entry) };
}

/** Apply a workbench draft to a modified copy without changing its airframe. */
export function updateDroneCopy(fleet, id, { build, controller } = {}) {
  if (typeof id === 'string' && id.startsWith('original:')) throw new TypeError('Original drones cannot be edited. Create a modified copy first.');
  const next = cleanFleet(fleet);
  const entry = next.modified.find(drone => drone.id === id);
  if (!entry) throw new RangeError('The modified drone no longer exists.');
  if (build?.drone !== undefined && build.drone !== entry.baseDrone) throw new TypeError('A modified copy keeps its original drone model.');
  entry.build = cleanBuild({ ...entry.build, ...(record(build) ? build : {}) }, entry.baseDrone);
  if (controller !== undefined) entry.controller = validateFlightController(controller);
  return next;
}

export function selectFleetDrone(fleet, id) {
  const next = cleanFleet(fleet);
  if (!listFleetDrones(next).some(entry => entry.id === id)) throw new RangeError('The selected drone no longer exists.');
  next.selectedId = id;
  return next;
}

export function deleteDroneCopy(fleet, id) {
  if (typeof id === 'string' && id.startsWith('original:')) throw new TypeError('Original drones cannot be deleted.');
  const next = cleanFleet(fleet);
  const entry = next.modified.find(drone => drone.id === id);
  if (!entry) throw new RangeError('The modified drone no longer exists.');
  next.modified = next.modified.filter(drone => drone.id !== id);
  if (next.selectedId === id) next.selectedId = `original:${entry.baseDrone}`;
  return next;
}

