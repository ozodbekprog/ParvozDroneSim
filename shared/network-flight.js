import { defaultBuild } from './physics.js';

// Contact impulses and rotor geometry must agree in prediction and authority.
export const NETWORK_PROTOCOL = 13;
export const INPUT_TIMEOUT_MS = 2000;

// Publish the build actually used by physics, asset preparation and replay data.
export function effectiveFlightBuild(build, ranked = false) {
  return ranked ? defaultBuild() : build;
}

export function resetCommandStream(item, now = Date.now()) {
  item.commands = []; item.lastSeq = 0; item.tickCredit = 8;
  item.lastInputAt = now; item.failSafe = false; item.recovering = false;
  item.input = { throttle: 0, pitch: 0, roll: 0, yaw: 0 };
}

export function enqueueCommands(item, frames, now = Date.now()) {
  if (item.failSafe) return 'resync';
  for (const frame of (Array.isArray(frames) ? frames : []).slice(0, 8)) {
    const expected = (item.commands.at(-1)?.seq ?? item.lastSeq) + 1;
    if (!Number.isSafeInteger(frame.seq) || frame.seq < expected) continue;
    if (frame.seq !== expected || item.commands.length >= 240) return 'resync';
    const input = Object.fromEntries(['throttle', 'roll', 'pitch', 'yaw'].map(key => [key, Math.min(1, Math.max(key === 'throttle' ? 0 : -1, Number(frame.input?.[key]) || 0))]));
    const flightMode = ['angle', 'horizon', 'acro'].includes(frame.flightMode) ? frame.flightMode : 'acro';
    item.commands.push({ seq: frame.seq, input, flightMode });
    item.input = input; item.flightMode = flightMode; item.lastInputAt = now; item.recovering = false;
  }
  return 'ok';
}

export function takeCommands(item, now = Date.now()) {
  item.tickCredit = Math.min(12, item.tickCredit + 1);
  if (item.recovering) return [];
  if (!item.commands.length && now - item.lastInputAt > INPUT_TIMEOUT_MS) {
    item.failSafe = true;
    // Explicit failsafe snapshots are not command acknowledgements.
    return [{ input: { throttle: 0, pitch: 0, roll: 0, yaw: 0 }, flightMode: item.flightMode }];
  }
  const commands = item.commands.splice(0, Math.min(item.commands.length, Math.floor(item.tickCredit), 8));
  item.tickCredit -= commands.length;
  return commands;
}

export function roomPreparationKey(room) {
  return JSON.stringify([room.code, room.contentRevision, room.map, room.track, room.players.map(item => [item.id, item.build])]);
}

export function canStartRoom(room) {
  return [...room.players.values()].every(item => item.ready && item.controllerReady);
}
