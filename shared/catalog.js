import source from '../public/content/catalog.json' with { type: 'json' };

export const MAPS = {};
export const MAP_LIST = [];
export const GAMEPLAY_OBSTACLES = {};
export const DRONES = {};
export const PARTS = { frame: [], motors: [], propellers: [], battery: [], camera: [], antenna: [] };
export const CAREER = [];
export const TUTORIALS = [];
export let installedRevision;
export let installedAssets=[];

export function installCatalog(value) {
  const data = structuredClone(value);
  for (const collection of [MAPS, DRONES, GAMEPLAY_OBSTACLES]) for (const key of Object.keys(collection)) delete collection[key];
  MAP_LIST.splice(0, MAP_LIST.length, ...data.maps);
  for (const map of MAP_LIST) { MAPS[map.id] = map; GAMEPLAY_OBSTACLES[map.id] = map.colliders || []; }
  for (const drone of data.drones) DRONES[drone.id] = drone;
  for (const category of Object.keys(PARTS)) PARTS[category].splice(0, PARTS[category].length, ...data.parts.filter(part => part.category === category));
  CAREER.splice(0, CAREER.length, ...data.challenges);
  TUTORIALS.splice(0, TUTORIALS.length, ...(data.tutorials || []));
  installedRevision=data.revision;
  installedAssets=data.assets||[];
  return data;
}
installCatalog(source);
