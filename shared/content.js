export { MAPS, MAP_LIST, GAMEPLAY_OBSTACLES, CAREER, TUTORIALS } from './catalog.js';
import { MAPS } from './catalog.js';
import { GAMEPLAY_OBSTACLES } from './catalog.js';
import { selectedMap } from './map-selection.js';
const trackCollisionCache=new WeakMap();
export function getTrackObstacles(mapId,trackId,{course=true}={}){
  const track=typeof trackId==='object'?trackId:getTrack(mapId,trackId),base=GAMEPLAY_OBSTACLES[mapId]||[];
  if(!course)return base;
  if(!track.colliders?.length)return base;
  let cache=trackCollisionCache.get(track);if(!cache||cache.base!==base||cache.colliders!==track.colliders){cache={base,colliders:track.colliders,items:[...base,...track.colliders]};trackCollisionCache.set(track,cache);}
  return cache.items;
}

export function getTrack(mapId, trackId) {
  const map = selectedMap(MAPS, mapId);
  return map.tracks.find(item => item.id === trackId) || map.tracks[0];
}

export function getSpawn(track) {
  if (track.spawn) return track.spawn;
  const first = track.gates[0];
  return {
    position: [first.position[0] - Math.sin(first.yaw) * 12, first.position[1], first.position[2] - Math.cos(first.yaw) * 12],
    yaw: first.yaw
  };
}
