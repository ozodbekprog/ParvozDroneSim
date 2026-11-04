import { DRONES } from '../shared/physics.js';
import { validateFlightController } from '../shared/flight-controller.js';
import { cleanFleet, cleanBuild, originalBuild, defaultDroneId, createDroneCopy, updateDroneCopy } from '../shared/drone-fleet.js';
export { listFleetDrones, createDroneCopy, updateDroneCopy, selectFleetDrone, deleteDroneCopy } from '../shared/drone-fleet.js';
export const DRONE_FLEET_KEY = 'liftoff-drone-fleet-v1';
const VERSION=1;
const record=value=>value && typeof value==='object' && !Array.isArray(value);
function ownerKey(owner) {
  if (!['string', 'number'].includes(typeof owner) || !String(owner).trim()) throw new TypeError('A pilot ID is required to save a drone fleet.');
  // Encoding preserves distinct pilot IDs; a prefix also avoids special object keys.
  return `pilot:${encodeURIComponent(String(owner))}`;
}

function readStorage() {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(DRONE_FLEET_KEY) || 'null');
    if (record(value) && value.version === VERSION && record(value.owners)) return value;
  } catch { /* A damaged or unavailable browser store starts a clean fleet. */ }
  return { version: VERSION, owners: {} };
}

/** Check before initialization so a fresh device does not reimport /me's cloud build. */
export function hasStoredFleet(owner) {
  return Object.hasOwn(readStorage().owners, ownerKey(owner));
}

/** Load only this pilot's fleet, migrating the old single build once. */
export function readDroneFleet(owner, legacyBuild, legacyController, { initialize = true } = {}) {
  const key = ownerKey(owner);
  const storage = readStorage();
  let fleet;
  if (Object.hasOwn(storage.owners, key)) {
    fleet = cleanFleet(storage.owners[key]);
  } else {
    const droneId = Object.hasOwn(DRONES, legacyBuild?.drone) ? legacyBuild.drone : defaultDroneId();
    fleet = cleanFleet({ selectedId: `original:${droneId}` });
    if(record(legacyBuild) && legacyBuild.drone && !Object.hasOwn(DRONES,legacyBuild.drone))fleet.retiredBuild={build:structuredClone(legacyBuild),controller:structuredClone(legacyController||{})};
    const build = cleanBuild(legacyBuild, droneId);
    const controller = validateFlightController(legacyController);
    if (JSON.stringify(build) !== JSON.stringify(originalBuild(droneId)) || JSON.stringify(controller) !== JSON.stringify(validateFlightController())) {
      const created = createDroneCopy(fleet, fleet.selectedId);
      fleet = updateDroneCopy(created.fleet, created.entry.id, { build, controller });
    }
  }
  // Save the initialized marker, including pristine fleets, so later reads do
  // not mistake a server-side selected build for a new legacy migration.
  if(initialize)try { saveDroneFleet(owner, fleet); } catch { /* Reading is still possible when browser storage is disabled. */ }
  return fleet;
}

/** Persist only committed state; workbench drafts remain caller-owned. */
export function saveDroneFleet(owner, fleet) {
  const key = ownerKey(owner);
  const clean = cleanFleet(fleet);
  const storage = readStorage();
  storage.owners[key] = clean;
  if (!globalThis.localStorage) throw new Error('Browser storage is unavailable. The drone fleet could not be saved.');
  globalThis.localStorage.setItem(DRONE_FLEET_KEY, JSON.stringify(storage));
  return structuredClone(clean);
}
