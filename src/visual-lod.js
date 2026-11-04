import { Box3, Group, Vector3 } from 'three';
import {setBatchLODVisible,isBatchedScenerySource} from './scenery-batches.js';

const position = new Vector3(), cameraPosition = new Vector3(), size = new Vector3();
const levelBox=new Box3(),meshBox=new Box3(),worldBox=new Box3();
const sourceBoundsCache=new WeakMap();
function visibleLevelBounds(root){
  const sourceNode=root.userData?.parvozSourceNode;
  if(sourceNode&&sourceBoundsCache.has(sourceNode))return sourceBoundsCache.get(sourceNode);
  levelBox.makeEmpty();root.updateWorldMatrix(true,true);
  root.traverseVisible(object=>{
    if(!object.isMesh||object.userData.collider||object.userData.excludedSceneryMarker)return;
    if(object.isInstancedMesh){if(!object.boundingBox)object.computeBoundingBox();meshBox.copy(object.boundingBox);}
    else{if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();meshBox.copy(object.geometry.boundingBox);}
    levelBox.union(meshBox.applyMatrix4(object.matrixWorld));
  });
  const result=levelBox.isEmpty()?null:{min:levelBox.min.toArray(),max:levelBox.max.toArray()};
  if(sourceNode)sourceBoundsCache.set(sourceNode,result);
  return result;
}

export function selectLODIndex(distances, distance, minimum = 0, previous = -1, hysteresis = 0.12) {
  let selected = minimum;
  for (let i = minimum + 1; i < distances.length; i++) {
    const threshold = distances[i] * (previous >= i ? 1 - hysteresis : 1 + hysteresis);
    if (distance >= threshold) selected = i;
  }
  return selected;
}

/** Preload a selected asset's levels before flight; no network requests during LOD changes. */
export async function loadVisualLOD(definition, load, discard) {
  if (!definition.modelLods?.length) return load(definition.model);
  const results = await Promise.allSettled(definition.modelLods.map(level => load(level.model,level.modelNode)));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) {
    for (const result of results) if (result.status === 'fulfilled') discard(result.value);
    throw failure.reason;
  }
  const group = new Group(); group.name = 'Visual LOD';
  group.userData.visualLod = { distances: definition.modelLods.map(level => level.distance), minimumLow: definition.lowLod ?? 0, active: -1 };
  results.forEach((result, i) => { result.value.visible = i === 0; group.add(result.value); });
  group.userData.visualLod.bounds=visibleLevelBounds(group.children[0]);
  return group;
}

export function updateVisualLODs(root, camera, { low = false, preview = false, distanceScale = 1 } = {}) {
  camera.getWorldPosition(cameraPosition);
  const camX = cameraPosition.x, camY = cameraPosition.y, camZ = cameraPosition.z;
  const zoom = Math.max(camera.zoom, 0.01), scale = Math.max(.25, Math.min(4, Number(distanceScale) || 1)), viewFactor = zoom * scale;
  root.updateWorldMatrix(true, false);
  const update=object=>{
    const lod = object.userData.visualLod;
    if (!lod) return;
    let rawDistance, footprintScale = 1;
    const sw = !object.matrixWorldAutoUpdate ? lod.staticWorld : null;
    if (sw) {
      const b = low ? null : sw.bounds;
      if (b) {
        const dx = camX < b.minX ? b.minX - camX : camX > b.maxX ? camX - b.maxX : 0;
        const dy = camY < b.minY ? b.minY - camY : camY > b.maxY ? camY - b.maxY : 0;
        const dz = camZ < b.minZ ? b.minZ - camZ : camZ > b.maxZ ? camZ - b.maxZ : 0;
        rawDistance = Math.hypot(dx, dy, dz);
        footprintScale = b.footprintScale;
      } else {
        rawDistance = Math.hypot(sw.x - camX, sw.y - camY, sw.z - camZ);
      }
    } else {
      object.getWorldPosition(position);
      // Spatial chunks can be tens of metres tall. Distance to their centre can
      // select an atlas LOD even when the camera is beside a rock or on the floor.
      const bounds=low?null:lod.bounds;
      rawDistance=position.distanceTo(cameraPosition);
      if(bounds){
        worldBox.min.fromArray(bounds.min);worldBox.max.fromArray(bounds.max);worldBox.applyMatrix4(object.matrixWorld);
        rawDistance=worldBox.distanceToPoint(cameraPosition);
        // Imported chunks share 16/22 m cutovers, including 125 m grandstands.
        // Keep the same angular detail as a 32 m chunk instead of reducing a
        // stadium-sized surface to its atlas while it still fills the view.
        worldBox.getSize(size);footprintScale=Math.max(1,Math.max(size.x,size.y,size.z)/32);
      }
    }
    const distance = rawDistance / (footprintScale * viewFactor);
    const index = preview ? 0 : selectLODIndex(lod.distances, distance, low ? lod.minimumLow : 0, lod.active);
    if(index!==lod.active){
      const children = object.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i], active = i === index;
        child.visible = active && !isBatchedScenerySource(child);
        setBatchLODVisible(child, active);
      }
      lod.active = index;
    }
  };
  const visit=object=>{
    if(!object.visible)return;
    const frozen=object.userData.staticVisualLods;
    if(frozen){
      if(!frozen.length)return;
      const prev=object.userData.staticLodState;
      if(prev&&prev.low===low&&prev.preview===preview&&prev.viewFactor===viewFactor){
        const dx=camX-prev.x,dy=camY-prev.y,dz=camZ-prev.z;
        if(dx*dx+dy*dy+dz*dz<0.16)return;
      }
      for(let i=0;i<frozen.length;i++)update(frozen[i]);
      object.userData.staticLodState={x:camX,y:camY,z:camZ,low,preview,viewFactor};
      return;
    }
    update(object);
    for(const child of object.children)visit(child);
  };
  visit(root);
}

/** Resolve the same named mount in each LOD without losing its parent's transform. */
export function findPartMounts(root, build, category) {
  if(category==='antenna'&&build.customization?.slots?.antenna?.[0]?.matrix){
    return (root.userData.visualLod?root.children:[root]).map(object=>({object,index:0}));
  }
  const names = build.mounts?.[category];
  if (!names) return null;
  const found = [];
  const levels = root.userData.visualLod ? root.children : [root];
  for (const level of levels) {
    const entries = [];
    level.traverse(object => {
      const index = names.indexOf(object.name);
      if (index >= 0) entries.push({ object, index });
    });
    if (names.some(name => entries.filter(entry => entry.object.name === name).length !== 1)) {
      throw new Error(`Missing or duplicate ${category} mount in model LOD: ${names.join(', ')}`);
    }
    found.push(...entries);
  }
  return found;
}
