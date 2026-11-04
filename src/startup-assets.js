import {flightAssetURLs} from './asset-progress.js';
import {inspectionBuild} from './drone-preview.js';

/** Startup owns one workshop, one inspection aircraft and small roster pictures. */
export function startupAssetURLs(map,spec,drones=[]) {
  const {collisionFile,preparedCollisionFile,colliders,...visualMap}=map;
  return [...new Set([...flightAssetURLs(visualMap,[inspectionBuild(spec)],map.garage?[map.garage]:[],null,{course:false}),
    ...drones.map(drone=>drone.thumbnail).filter(Boolean)])];
}
