import { gateCrossed } from './physics.js';

const COMBO_WINDOW_MS = 6000;
const COOLDOWN_MS = 5000;

export function resetFreestyle(item, preserveScore = false) {
  if (!preserveScore) item.score = 0;
  item.combo = 0;
  item.lastTrick = '';
  item.freestyle = { spin: 0, diveArmed: false, comboUntil: 0, gates: {}, obstacles: {} };
}

export function scoreFreestyle(item, previous, track, obstacles, now, dt) {
  if (!item.freestyle) resetFreestyle(item, true);
  const state = item.state;
  const progress = item.freestyle;
  if (now > progress.comboUntil && item.combo) { item.combo = 0; item.lastTrick = ''; }
  const awarded = [];
  const award = (name, points) => {
    item.combo = now <= progress.comboUntil ? item.combo + 1 : 1;
    progress.comboUntil = now + COMBO_WINDOW_MS;
    const multiplier = Math.min(5, 1 + Math.floor((item.combo - 1) / 2));
    const total = points * multiplier;
    item.score += total;
    item.lastTrick = `${name} +${total} · ${item.combo} COMBO`;
    awarded.push({ name, points: total, combo: item.combo });
  };

  if (state.crashed) {
    item.combo = 0;
    item.lastTrick = '';
    progress.spin = 0;
    progress.diveArmed = false;
    progress.comboUntil = 0;
    return awarded;
  }

  const speed = Math.hypot(...state.velocity);
  const spinRate = Math.abs(state.angularVelocity[0]) + Math.abs(state.angularVelocity[2]);
  progress.spin = state.position[1] > 1.5 && spinRate > 3
    ? progress.spin + spinRate * dt
    : Math.max(0, progress.spin - 4 * dt);
  if (progress.spin >= Math.PI * 2) {
    progress.spin -= Math.PI * 2;
    award('FULL ROTATION', 50);
  }

  if (previous[1] > 7 && state.velocity[1] < -6) progress.diveArmed = true;
  if (progress.diveArmed && state.position[1] < 3 && state.velocity[1] > -2) {
    progress.diveArmed = false;
    award('DIVE RECOVERY', 70);
  }
  if (state.position[1] < 0.5) progress.diveArmed = false;

  if (speed > 8) for (let index = 0; index < (track?.gates.length || 0); index++) {
    if (now - (progress.gates[index] || 0) < COOLDOWN_MS) continue;
    if (!gateCrossed(previous, state.position, track.gates[index])) continue;
    progress.gates[index] = now;
    award('GATE THREAD', 35);
  }

  if (speed > 9) for (let index = 0; index < obstacles.length; index++) {
    if (now - (progress.obstacles[index] || 0) < COOLDOWN_MS) continue;
    const obstacle = obstacles[index];
    const distance = Math.hypot(...state.position.map((value, axis) => Math.max(0, Math.abs(value - obstacle.position[axis]) - obstacle.size[axis] / 2)));
    if (distance < 0.35 || distance > 1.15) continue;
    progress.obstacles[index] = now;
    award('CLOSE PASS', 25);
  }
  return awarded;
}
