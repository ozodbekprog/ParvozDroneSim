// Width and height always describe the unobstructed opening, in metres.
export const GATE_CLASSES = Object.freeze({
  'precision-5': Object.freeze({ frameThickness: .10 }),
  'sport-7': Object.freeze({ frameThickness: .13 }),
  open: Object.freeze({ frameThickness: .16 })
});

export function gateFrameBoxes(gate) {
  const thickness = gate.frameThickness ?? (GATE_CLASSES[gate.gateClass] || GATE_CLASSES.open).frameThickness;
  const halfWidth = gate.width / 2, halfHeight = gate.height / 2;
  const boxes = [];
  const add = (kind, position, size) => boxes.push({kind,position,size});
  for (const sign of [-1, 1]) add('frame', [sign * (halfWidth + thickness / 2), 0, 0], [thickness, gate.height, thickness]);
  add('frame', [0, halfHeight + thickness / 2, 0], [gate.width + 2 * thickness, thickness, thickness]);
  const support = gate.support || {type:'ground',baseY:0};
  const anchorY = support.baseY - gate.position[1];
  const footWidth = thickness * 3, footHeight = thickness;
  if (support.type === 'ground' || support.type === 'roof') {
    const length = -halfHeight - anchorY;
    if (length >= 0) for (const sign of [-1, 1]) {
      if (length > 0) add('support', [sign * (halfWidth + thickness / 2), anchorY + length / 2, 0], [thickness, length, thickness]);
      // The foot extends outwards from the clear opening, never across it.
      add('base', [sign * (halfWidth + footWidth / 2), anchorY + footHeight / 2, 0], [footWidth, footHeight, footWidth]);
    }
  } else if (support.type === 'suspended') {
    const top = halfHeight + thickness, length = anchorY - top;
    if (length >= 0) for (const sign of [-1, 1]) {
      if (length > 0) add('support', [sign * (halfWidth + thickness / 2), top + length / 2, 0], [thickness, length, thickness]);
      add('base', [sign * (halfWidth + footWidth / 2), anchorY - footHeight / 2, 0], [footWidth, footHeight, footWidth]);
    }
  }
  return boxes;
}

const collisionCache = new WeakMap();
const trackGateCache = new WeakMap();
export function gateCollisionBoxes(gate) {
  // Embedded frames use their authored map/track colliders, not a generic box.
  if (gate.frameSource === 'track' || gate.frameSource === 'map') return [];
  const p = gate.position, st = gate.support?.type, sb = gate.support?.baseY;
  const cached = collisionCache.get(gate);
  if (cached && cached.px === p[0] && cached.py === p[1] && cached.pz === p[2] && cached.yaw === gate.yaw
    && cached.w === gate.width && cached.h === gate.height && cached.ft === gate.frameThickness
    && cached.gc === gate.gateClass && cached.st === st && cached.sb === sb) return cached.boxes;
  const cosine = Math.cos(gate.yaw), sine = Math.sin(gate.yaw);
  const boxes = gateFrameBoxes(gate).map(({position:[x,y,z],size}) => ({
    position:[p[0]+x*cosine+z*sine,p[1]+y,p[2]-x*sine+z*cosine],
    size, rotation:[0,gate.yaw,0]
  }));
  collisionCache.set(gate,{px:p[0],py:p[1],pz:p[2],yaw:gate.yaw,w:gate.width,h:gate.height,ft:gate.frameThickness,gc:gate.gateClass,st,sb,boxes});
  return boxes;
}

export function trackGateCollisionBoxes(track) {
  const gates = track?.gates;
  if (!gates?.length) return [];
  const cached = trackGateCache.get(track);
  if (cached && cached.gates === gates && cached.perGate.length === gates.length) {
    let unchanged = true;
    for (let i = 0; i < gates.length; i++) {
      if (gateCollisionBoxes(gates[i]) !== cached.perGate[i]) { unchanged = false; break; }
    }
    if (unchanged) return cached.boxes;
  }
  const perGate = new Array(gates.length);
  const boxes = [];
  for (let i = 0; i < gates.length; i++) {
    const g = gateCollisionBoxes(gates[i]);
    perGate[i] = g;
    for (let j = 0; j < g.length; j++) boxes.push(g[j]);
  }
  trackGateCache.set(track, { gates, perGate, boxes });
  return boxes;
}
