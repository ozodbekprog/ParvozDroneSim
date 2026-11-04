import { FIXED_DT } from './physics.js';

export function fixedSteps(accumulator, elapsed, maxAccumulation = 0.1, maxSteps = 5) {
  const pending = Math.min(maxAccumulation, Math.max(0, accumulator) + Math.max(0, elapsed));
  const steps = Math.min(maxSteps, Math.floor((pending + 1e-10) / FIXED_DT));
  const remainder = Math.max(0, Math.min(steps === maxSteps ? FIXED_DT : maxAccumulation, pending - steps * FIXED_DT));
  return { steps, remainder };
}
