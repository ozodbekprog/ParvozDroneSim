import { Vector3 } from 'three';
import { collisionCandidates, sweepSphere } from '../shared/collision.js';

export function cameraNearRadius(camera){
  const halfHeight=camera.near*Math.tan(camera.fov*Math.PI/360)/Math.max(.01,camera.zoom||1);
  return Math.max(.03,Math.hypot(camera.near,halfHeight,halfHeight*camera.aspect))+.005;
}

/** Keep the near plane on the aircraft's side of solid walls, including thin meshes. */
export function constrainCamera(anchor,desired,obstacles=[],radius=.045) {
  const from=Array.isArray(anchor)?anchor:anchor.toArray(),to=Array.isArray(desired)?desired:desired.toArray();
  const distance=Math.hypot(...to.map((value,i)=>value-from[i]));
  if(distance<1e-8)return new Vector3(...from);
  const center=from.map((value,i)=>(value+to[i])*.5);
  let fraction=1;
  for(const collider of collisionCandidates(obstacles,center,distance*.5+radius)){
    const hit=sweepSphere(from,to,radius,collider);
    if(hit)fraction=Math.min(fraction,Math.max(0,hit.time-.002/distance));
  }
  return new Vector3(...from.map((value,i)=>value+(to[i]-value)*fraction));
}

/** Authored camera sockets include the model's transform and the chosen assembly. */
export function fpvCameraOffset(mesh,spec) {
  mesh.updateWorldMatrix(true,true);
  let socket;
  const names=spec.mounts?.camera || [];
  for(const child of mesh.children)child.traverseVisible(object=>{if(!socket&&names.includes(object.name))socket=object;});
  if(!socket)return new Vector3(0,.04,Math.min(.1,spec.arm||.1));
  return mesh.worldToLocal(socket.getWorldPosition(new Vector3()));
}
