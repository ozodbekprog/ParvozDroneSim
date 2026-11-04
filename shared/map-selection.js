// A removed package must never leave menus or rooms pointing at a missing map.
export function defaultMap(maps) {
  const map = maps['ironworks-v2'] || maps['minus-two-demo'] || maps.hangar || Object.values(maps)[0];
  if (!map) throw new Error('Install at least one map package.');
  return map;
}

export function selectedMap(maps, id) { return maps[id] || defaultMap(maps); }
