const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function reconcileDrone(predicted, authoritative, shouldReset = false) {
  if (!predicted || shouldReset) return { state: structuredClone(authoritative), snapped: true };
  const error = Math.hypot(...predicted.position.map((value, index) => value - authoritative.position[index]));
  if (error > 3 || !Number.isFinite(error)) return { state: structuredClone(authoritative), snapped: true };
  for (const key of ['position', 'velocity', 'angularVelocity', 'motors']) {
    if (!predicted[key] || !authoritative[key]) continue;
    const weight = key === 'position' ? 0.2 : 0.12;
    predicted[key] = predicted[key].map((value, index) => value + (authoritative[key][index] - value) * weight);
  }
  let rotation = authoritative.rotation;
  const dot = predicted.rotation.reduce((sum, value, index) => sum + value * rotation[index], 0);
  if (dot < 0) rotation = rotation.map(value => -value);
  const blended = predicted.rotation.map((value, index) => value * 0.84 + rotation[index] * 0.16);
  const length = Math.hypot(...blended) || 1;
  predicted.rotation = blended.map(value => value / length);
  predicted.battery = authoritative.battery;
  predicted.health = authoritative.health;
  predicted.crashed = authoritative.crashed;
  return { state: predicted, snapped: false };
}

export function interpolateSnapshots(samples, renderTime) {
  if (!samples.length) return null;
  if (samples.length === 1 || renderTime <= samples[0].time) return samples[0].state;
  let index = samples.findIndex(sample => sample.time >= renderTime);
  if (index < 0) return samples.at(-1).state;
  const older = samples[Math.max(0, index - 1)];
  const newer = samples[index];
  const span = Math.max(1, newer.time - older.time);
  const alpha = clamp((renderTime - older.time) / span, 0, 1);
  const position = older.state.position.map((value, index) => value + (newer.state.position[index] - value) * alpha);
  let newestRotation = newer.state.rotation;
  if (older.state.rotation.reduce((sum, value, index) => sum + value * newestRotation[index], 0) < 0) newestRotation = newestRotation.map(value => -value);
  const rotation = older.state.rotation.map((value, index) => value * (1 - alpha) + newestRotation[index] * alpha);
  const length = Math.hypot(...rotation) || 1;
  return { ...newer.state, position, rotation: rotation.map(value => value / length) };
}
