import { DRONES, PARTS, defaultBuild } from '../shared/physics.js';
import { cleanFleet, listFleetDrones } from '../shared/drone-fleet.js';
import {isPartCompatible} from '../shared/part-compatibility.js';

const fail=(status,message)=>Object.assign(new Error(message),{status});

/** Additive migration: existing accounts, progress and selected builds stay intact. */
export function migrateDroneFleets(db) {
  db.exec('CREATE TABLE IF NOT EXISTS drone_fleets (user_id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, fleet TEXT NOT NULL, updated_at INTEGER NOT NULL)');
}

export function readAccountFleet(db,id) {
  const row=db.prepare('SELECT revision,fleet,updated_at FROM drone_fleets WHERE user_id=?').get(id);
  return row ? {revision:row.revision,fleet:JSON.parse(row.fleet),updatedAt:row.updated_at} : {revision:0,fleet:null,updatedAt:null};
}

export function saveAccountFleet(db,id,{fleet,revision},canUse) {
  if(!Number.isSafeInteger(revision)||revision<0 || !Number.isSafeInteger(revision+1) || !fleet || !Array.isArray(fleet.modified) || fleet.modified.length>64 || JSON.stringify(fleet).length>250000)throw fail(400,'Invalid fleet (maximum 64 copies).');
  for(const entry of fleet.modified){
    const input=entry?.build,build=input&&{...input,antenna:input.antenna??defaultBuild(entry.baseDrone).antenna};
    if(!Object.hasOwn(DRONES,entry?.baseDrone) || build?.drone!==entry.baseDrone || !Number.isSafeInteger(entry.copyNumber) || entry.copyNumber<1 || !Number.isSafeInteger(entry.copyNumber+1))throw fail(400,'Invalid drone copy.');
    for(const category of Object.keys(PARTS)){
      const part=PARTS[category].find(part=>part.id===build[category]);
      if(!isPartCompatible(DRONES[build.drone],category,part))throw fail(400,'Invalid or incompatible drone component.');
    }
    if(!canUse(build))throw fail(403,'Unlock the drone and buy selected parts before saving this build.');
  }
  const clean=cleanFleet(fleet);
  // Normalization must never turn a successful save into silently lost copies
  // (for example duplicate suffixes at the safe-integer limit).
  if(clean.modified.length!==fleet.modified.length)throw fail(400,'Invalid drone copy numbering.');
  const selected=listFleetDrones(clean).find(entry=>entry.id===clean.selectedId);
  if(!canUse(selected.build))throw fail(403,'Unlock the selected drone and its parts first.');
  db.exec('BEGIN IMMEDIATE');
  try {
    if(readAccountFleet(db,id).revision!==revision)throw fail(409,'Your Hangar changed on another device. Reopen Hangar to load it; this draft has not been saved.');
    const updatedAt=Date.now();
    db.prepare('INSERT INTO drone_fleets VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,fleet=excluded.fleet,updated_at=excluded.updated_at').run(id,revision+1,JSON.stringify(clean),updatedAt);
    db.prepare('UPDATE users SET build=? WHERE id=?').run(JSON.stringify(selected.build),id);
    db.exec('COMMIT');
    return {fleet:clean,revision:revision+1,updatedAt};
  }catch(error){db.exec('ROLLBACK');throw error;}
}
