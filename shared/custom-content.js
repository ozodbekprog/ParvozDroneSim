import { MAPS, MAP_LIST, GAMEPLAY_OBSTACLES, CAREER } from './content.js';
import { DRONES, PARTS } from './physics.js';
import { installCatalog } from './catalog.js';
import { validateCatalog } from './catalog-schema.js';

const idPattern = /^custom-[a-z0-9-]{2,48}$/;
const assetPattern = /^\/custom\/assets\/[a-zA-Z0-9-]+\.(glb|png|jpe?g)$/;
const texturePattern = /^\/custom\/assets\/[a-zA-Z0-9-]+\.(png|jpe?g)$/;
const vector = (value, length = 3) => Array.isArray(value) && value.length === length && value.every(item => Number.isFinite(item));
const range = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;
const color = value => /^#[0-9a-fA-F]{6}$/.test(value);
const fail = message => { throw new Error(message); };

function validateMaterials(materials = []) {
  if (!Array.isArray(materials)) fail('Materials must be a list.');
  for (const item of materials) {
    if (typeof item.mesh !== 'string' || item.mesh.length > 100) fail('Material mesh name is invalid.');
    if (item.baseColor && !color(item.baseColor)) fail('Base color must be a hex color.');
    if (item.baseTexture && !texturePattern.test(item.baseTexture)) fail('Base texture path is invalid.');
    if (item.normalTexture && !texturePattern.test(item.normalTexture)) fail('Normal texture path is invalid.');
  }
}

export function validateCustomContent(input) {
  if (input?.version === 2) return validateCatalog(input);
  const value = input || {};
  if (value.version !== 1) fail('Custom content version must be 1.');
  for (const key of ['maps', 'drones', 'parts', 'challenges']) if (!Array.isArray(value[key])) fail(`${key} must be a list.`);
  const ids = new Set([...Object.keys(MAPS), ...Object.keys(DRONES), ...CAREER.map(item => item.id)]);
  const checkId = (id, type) => {
    if (!idPattern.test(id) || ids.has(id)) fail(`Invalid or duplicate ${type} ID: ${id}`);
    ids.add(id);
  };
  const trackIds = new Set(MAP_LIST.flatMap(map => map.tracks.map(track => track.id)));
  for (const map of value.maps) {
    checkId(map.id, 'map');
    if (!map.name || !map.region || !color(map.sky) || !color(map.fog) || !color(map.ground) || !color(map.sun)) fail(`Invalid map palette: ${map.id}`);
    if (!assetPattern.test(map.model) || !map.model.endsWith('.glb')) fail(`Map ${map.id} requires a GLB model.`);
    if (!vector(map.wind) || !range(map.gravity, 0.3, 2) || !vector(map.sunPosition)) fail(`Invalid atmosphere for ${map.id}`);
    validateMaterials(map.materials);
    if (!Array.isArray(map.colliders) || map.colliders.length > 500) fail(`Invalid collision proxies in ${map.id}`);
    for (const collider of map.colliders) if (!vector(collider.position) || !vector(collider.size) || collider.size.some(size => !range(size, 0.1, 500))) fail(`Invalid collision proxy in ${map.id}`);
    if (!Array.isArray(map.tracks) || !map.tracks.length) fail(`Map ${map.id} needs a course.`);
    for (const track of map.tracks) {
      if (!idPattern.test(track.id) || trackIds.has(track.id)) fail(`Invalid course ID: ${track.id}`);
      trackIds.add(track.id);
      if (!range(track.laps, 1, 20) || !Array.isArray(track.gates) || track.gates.length < 3 || track.gates.length > 100) fail(`Course ${track.id} needs 3–100 gates.`);
      for (const gate of track.gates) if (!vector(gate.position) || !range(gate.yaw, -Math.PI * 4, Math.PI * 4) || !range(gate.width, 2.1, 100) || !range(gate.height, 2.1, 100)) fail(`Invalid gate in ${track.id}`);
      if (track.spawn && (!vector(track.spawn.position) || !range(track.spawn.yaw, -Math.PI * 4, Math.PI * 4))) fail(`Invalid spawn in ${track.id}`);
    }
  }
  for (const drone of value.drones) {
    checkId(drone.id, 'drone');
    if (!drone.name || !assetPattern.test(drone.model) || !drone.model.endsWith('.glb')) fail(`Drone ${drone.id} needs a GLB model.`);
    if (!range(drone.mass, 0.1, 10) || !range(drone.arm, 0.04, 0.6) || !range(drone.thrustToWeight, 1.1, 15) || !range(drone.motorTau, 0.005, 0.2) || !vector(drone.drag) || !range(drone.angularDrag, 0, 2) || !range(drone.batterySeconds, 30, 3600)) fail(`Invalid flight parameters for ${drone.id}`);
    validateMaterials(drone.materials);
  }
  for (const part of value.parts) {
    if (!PARTS[part.category] || !idPattern.test(part.id) || PARTS[part.category].some(item => item.id === part.id) || ids.has(part.id)) fail(`Invalid part ID/category: ${part.id}`);
    ids.add(part.id);
    if (!part.name || !assetPattern.test(part.model) || !part.model.endsWith('.glb')) fail(`Part ${part.id} needs a GLB model.`);
    if (!vector(part.position) || !vector(part.rotation) || !range(part.scale, 0.01, 10)) fail(`Invalid attachment for ${part.id}`);
    for (const key of ['mass', 'thrust', 'response', 'drag', 'duration', 'durability']) if (part[key] !== undefined && !range(part[key], key === 'mass' ? -1 : 0.1, key === 'mass' ? 1 : 5)) fail(`Invalid ${key} for ${part.id}`);
    if (part.fov !== undefined && !range(part.fov, 75, 125)) fail(`Invalid FOV for ${part.id}`);
    validateMaterials(part.materials);
  }
  for (const challenge of value.challenges) {
    checkId(challenge.id, 'challenge');
    const map = value.maps.find(item => item.id === challenge.map) || MAPS[challenge.map];
    if (!challenge.name || !map?.tracks.some(track => track.id === challenge.track) || !range(challenge.target, 10, 3600) || !range(challenge.reward, 0, 10000)) fail(`Invalid challenge ${challenge.id}`);
  }
  return value;
}

export function applyCustomContent(input) {
  if (input?.version === 2) return installCatalog(validateCatalog(input));
  const value = validateCustomContent(input);
  for (const map of value.maps) {
    const entry = { ...map, theme: 'custom', seed: 0, description: map.description || '', clouds: map.clouds ?? true };
    MAPS[entry.id] = entry; MAP_LIST.push(entry);
    GAMEPLAY_OBSTACLES[entry.id] = entry.colliders;
  }
  for (const drone of value.drones) DRONES[drone.id] = { ...drone, class: drone.class || 'five', color: drone.color || '#ef855e', unlock: 'starter' };
  for (const part of value.parts) PARTS[part.category].push({ ...part, cost: 0, mass: part.mass ?? 0, thrust: part.thrust ?? 1, response: part.response ?? 1, drag: part.drag ?? 1, duration: part.duration ?? 1, durability: part.durability ?? 1 });
  for (const challenge of value.challenges) CAREER.push(challenge);
  return value;
}
