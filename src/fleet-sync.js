import { cleanFleet, createDroneCopy, updateDroneCopy, selectFleetDrone } from '../shared/drone-fleet.js';
import { DRONE_FLEET_KEY, saveDroneFleet } from './drone-fleet.js';

/** One-time import is additive; a same-number copy from another PC is never replaced. */
export function mergeLegacyFleet(remote, local) {
  if (!remote) return cleanFleet(local);
  let merged = cleanFleet(remote);
  const legacy = cleanFleet(local);
  for (const entry of legacy.modified) {
    const same = merged.modified.some(other => other.baseDrone === entry.baseDrone && JSON.stringify(other.build) === JSON.stringify(entry.build) && JSON.stringify(other.controller) === JSON.stringify(entry.controller));
    if (same) continue;
    const created = createDroneCopy(merged, `original:${entry.baseDrone}`);
    merged = selectFleetDrone(updateDroneCopy(created.fleet, created.entry.id, entry), merged.selectedId);
  }
  // Retired airframes are recoverable source data even though they cannot be flown.
  const retired = [...(merged.retiredModified || [])];
  const preserve = entry => {
    if (!retired.some(other => JSON.stringify(other) === JSON.stringify(entry))) retired.push(structuredClone(entry));
  };
  for (const entry of legacy.retiredModified || []) preserve(entry);
  if (legacy.retiredBuild) {
    if (!merged.retiredBuild) merged.retiredBuild = structuredClone(legacy.retiredBuild);
    else if (JSON.stringify(merged.retiredBuild) !== JSON.stringify(legacy.retiredBuild)) preserve(legacy.retiredBuild);
  }
  if (retired.length) merged.retiredModified = retired;
  return merged;
}

const staleFleet = () => Object.assign(new Error('Your Hangar changed while this action was waiting. Reopen Hangar before trying again; this draft has not been saved.'), { status: 409 });

export class FleetSync {
  constructor(api, owner) {
    this.api = api;
    this.owner = owner;
    this.revision = 0;
    this.updatedAt = null;
    this.migrated = false;
    this.ready = false;
    this.pending = Promise.resolve();
  }
  get marker() { return `${DRONE_FLEET_KEY}:cloud:${encodeURIComponent(this.owner)}`; }
  enqueue(action) {
    const result = this.pending.then(action);
    this.pending = result.catch(() => {});
    return result;
  }
  mirror(fleet) {
    // Record migration first and independently: a full fleet store must not
    // prevent the smaller marker or resurrect old copies on the next load.
    this.migrated = true;
    this.ready = true;
    try { globalThis.localStorage?.setItem(this.marker, '1'); } catch {}
    try { saveDroneFleet(this.owner, fleet); } catch {}
    return fleet;
  }
  load(local, { hasLocalFleet } = {}) {
    if(typeof hasLocalFleet==='boolean')this.hasLocalFleet=hasLocalFleet;
    hasLocalFleet=this.hasLocalFleet??true;
    const snapshot = structuredClone(local);
    return this.enqueue(() => this.read(snapshot, { hasLocalFleet }));
  }
  /** Explicit backup imports remain additive after this device's initial migration. */
  importLocal(local) {
    const snapshot = structuredClone(local);
    return this.enqueue(() => this.read(snapshot, { importLocal: true }));
  }
  async read(local, { hasLocalFleet = true, importLocal = false } = {}) {
    const remote = await this.api('/fleet');
    let migrated = this.migrated;
    try { migrated ||= globalThis.localStorage?.getItem(this.marker) === '1'; } catch {}
    const next = remote.fleet && !importLocal && (migrated || !hasLocalFleet)
      ? cleanFleet(remote.fleet) : mergeLegacyFleet(remote.fleet, local);
    if (!remote.fleet || JSON.stringify(next) !== JSON.stringify(remote.fleet)) return this.write(next, remote.revision);
    this.revision=remote.revision;this.updatedAt=remote.updatedAt;
    return this.mirror(next);
  }
  save(fleet) {
    if(!this.ready)return Promise.reject(new Error('Hangar has not synced yet. Reopen Hangar to retry; your draft is preserved.'));
    const snapshot = structuredClone(fleet), revision = this.revision;
    return this.enqueue(() => {
      // Two queued editors must not implicitly adopt the first one's revision.
      if (revision !== this.revision) throw staleFleet();
      return this.write(snapshot, revision);
    });
  }
  async write(fleet, revision) {
    const result = await this.api('/fleet', 'POST', { fleet, revision });
    this.revision = result.revision;
    this.updatedAt = result.updatedAt;
    return this.mirror(result.fleet);
  }
}
