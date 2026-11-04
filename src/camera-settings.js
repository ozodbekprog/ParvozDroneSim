import { resolveBuild } from '../shared/physics.js';

const KEY = 'liftoff-fpv-camera-v1';
const clamp = (number, low, high) => Math.min(high, Math.max(low, number));

export function cameraSettings(build) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* Restore defaults. */ }
  const entry = saved[build.drone] || {};
  return {
    tilt: clamp(Number.isFinite(Number(entry.tilt)) ? Number(entry.tilt) : 25, 0, 60),
    fov: clamp(Number.isFinite(Number(entry.fov)) ? Number(entry.fov) : resolveBuild(build).fov, 75, 125)
  };
}

export function saveCameraSettings(build, patch) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* Restore defaults. */ }
  saved[build.drone] = { ...cameraSettings(build), ...patch };
  localStorage.setItem(KEY, JSON.stringify(saved));
  return cameraSettings(build);
}

/** Keyboard and Settings share the same per-aircraft camera preferences. */
export function cameraKeyPatch(code, settings) {
  const binding = {ArrowUp:['tilt',1,0,60],ArrowDown:['tilt',-1,0,60],ArrowRight:['fov',1,75,125],ArrowLeft:['fov',-1,75,125]}[code];
  if (!binding) return null;
  const [key,delta,min,max] = binding;
  return {[key]:clamp(settings[key]+delta,min,max)};
}
