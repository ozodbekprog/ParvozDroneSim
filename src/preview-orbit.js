import { previewCameraDistance, previewBoundsDistance } from './menu-camera.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = value => Number.isFinite(value) ? value : 0;
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

const PART_SHOTS = {
  frame: { azimuth: 0.72, elevation: 0.42, zoom: 1 },
  motors: { azimuth: 1.15, elevation: 0.28, zoom: 0.84 },
  propellers: { azimuth: 0.65, elevation: 1.05, zoom: 0.96 },
  battery: { azimuth: -2.75, elevation: 0.8, zoom: 0.8 },
  antenna: { azimuth: -2.7, elevation: 0.4, zoom: 0.8 },
  camera: { azimuth: 0.18, elevation: 0.2, zoom: 0.78 }
};

export function focusPreviewPart(orbit, part, reducedMotion = false) {
  const shot = PART_SHOTS[part] || PART_SHOTS.frame;
  orbit.fitKey=null;
  if (reducedMotion) { Object.assign(orbit, shot, { transition: null, adjusted: true }); return; }
  orbit.transition = { from: { azimuth: orbit.azimuth, elevation: orbit.elevation, zoom: orbit.zoom }, to: shot, elapsed: 0 };
}

export function advancePreviewOrbit(orbit, dt) {
  const transition = orbit.transition;
  if (!transition) return;
  transition.elapsed += Math.max(0, finite(dt));
  const t = Math.min(1, transition.elapsed / 0.65), eased = t * t * (3 - 2 * t);
  orbit.azimuth = wrap(transition.from.azimuth + wrap(transition.to.azimuth - transition.from.azimuth) * eased);
  for (const key of ['elevation', 'zoom']) orbit[key] = transition.from[key] + (transition.to[key] - transition.from[key]) * eased;
  orbit.adjusted = true;
  if (t === 1) orbit.transition = null;
}

export function createPreviewOrbit() {
  return {
    azimuth: 0.72,
    elevation: 0.40,
    zoom: 1,
    adjusted: false,
    fitKey: null,
    baseDistance: null
  };
}

export function orbitPreviewCamera(orbit, deltaX, deltaY) {
  const x = finite(deltaX), y = finite(deltaY);
  if (!x && !y) return;
  orbit.transition = null;
  const angle = orbit.azimuth - x * 0.008;
  orbit.azimuth = Math.atan2(Math.sin(angle), Math.cos(angle));
  // Keep the inspection camera above the bench and away from the vertical pole.
  orbit.elevation = clamp(orbit.elevation + y * 0.006, 0.08, 1.35);
  orbit.adjusted = true;
}

export function zoomPreviewCamera(orbit, delta) {
  const amount = finite(delta);
  if (!amount) return;
  orbit.transition = null;
  orbit.zoom = clamp(orbit.zoom * Math.exp(clamp(amount * 0.001, -2, 2)), 0.18, 2);
  orbit.adjusted = true;
}

export function samplePreviewOrbit(orbit, center, diameter, fov, viewport, stage, bounds, limits) {
  const fitKey = [viewport.width, viewport.height, stage.width, stage.height, fov].join(':');
  if (orbit.fitKey !== fitKey || (!orbit.adjusted && (orbit.fitBounds !== bounds || orbit.fitDiameter !== diameter)) || !orbit.baseDistance) {
    const pose=orbit.transition?.to || orbit;
    orbit.baseDistance = bounds ? previewBoundsDistance(bounds,center,fov,viewport,stage,pose.azimuth,pose.elevation) : previewCameraDistance(diameter, fov, viewport, stage);
    orbit.fitKey = fitKey;
    orbit.fitBounds = bounds; orbit.fitDiameter = diameter;
  }
  // A replacement model may have different bounds. Preserve the chosen distance
  // once the player has moved the camera; only a layout resize reframes it.
  let distance = orbit.baseDistance * orbit.zoom;
  if (limits) {
    distance = clamp(distance, limits.minDistance ?? 0.18, limits.maxDistance ?? 2.2);
    // Shorten along the viewing ray so orbit direction and focus stay intact.
    const direction=[Math.sin(orbit.azimuth)*Math.cos(orbit.elevation),Math.sin(orbit.elevation),Math.cos(orbit.azimuth)*Math.cos(orbit.elevation)];
    if(limits.mapBounds)for(let axis=0;axis<3;axis++){
      if(Math.abs(direction[axis])<1e-8)continue;
      const edge=direction[axis]>0?limits.mapBounds.max[axis]-.1:limits.mapBounds.min[axis]+.1;
      const remaining=(edge-center[axis])/direction[axis];
      if(remaining>0)distance=Math.min(distance,remaining);
    }
  }
  const horizontal = Math.cos(orbit.elevation) * distance;
  return {
    position: [
      center[0] + Math.sin(orbit.azimuth) * horizontal,
      center[1] + Math.sin(orbit.elevation) * distance,
      center[2] + Math.cos(orbit.azimuth) * horizontal
    ],
    target: [...center],
    distance
  };
}
