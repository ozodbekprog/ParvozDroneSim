import { createDroneState, stepDrone, resolveEnvironmentCollision, FIXED_DT } from './physics.js';
import { getSpawn } from './content.js';

export function checkpointSpawn(track, nextGate, lap = 1) {
  if (nextGate === 0 && lap === 1) return getSpawn(track);
  const gate = track.gates[(nextGate - 1 + track.gates.length) % track.gates.length];
  if(gate.respawn)return {position:[...gate.respawn.position],yaw:gate.respawn.yaw};
  const normal=gate.axes?.normal || [Math.sin(gate.yaw),0,Math.cos(gate.yaw)];
  return { position: gate.position.map((value,index)=>value+normal[index]*1.3), yaw: gate.yaw };
}

export function resetAtCheckpoint(item, room, spawnOverride) {
  const spawn = spawnOverride || (['training', 'freestyle'].includes(room.mode) ? getSpawn(room.track) : checkpointSpawn(room.track, item.gate, item.lap));
  item.state = createDroneState(spawn.position, spawn.yaw);
  item.resetId++;
  item.commands = [];
  item.lastSeq = 0; item.tickCredit = 8; item.lastInputAt = Date.now();
  item.failSafe = false; item.recovering = false;
  item.input = { throttle: 0, pitch: 0, roll: 0, yaw: 0 };
  return item.state;
}

export function simulateCommand(state, command, spec, map, track, obstacles, controller) {
  stepDrone(state, command.input, spec, FIXED_DT, command.flightMode, map.wind, map.gravity, controller,map.floorY ?? 0,
    (previous,dt)=>resolveEnvironmentCollision(state,map,track,obstacles,spec,previous,dt,true));
  return state;
}

export function replayPending(authoritative, pending, spec, map, track, obstacles, controller) {
  const state = structuredClone(authoritative);
  for (const command of pending) simulateCommand(state, command, spec, map, track, obstacles, controller);
  return state;
}
