import {collisionCandidates,sphereContacts} from '../shared/collision.js';
import {createDroneState,rotate,gateCrossed} from '../shared/physics.js';

// Source portals can legitimately have a post or tree near their centre. Test
// a legal aperture point with the aircraft's full volume without moving a gate.
export function importedGatePassage(gate,colliders,spec){
  const normal=gate.axes?.normal||[Math.sin(gate.yaw),0,Math.cos(gate.yaw)],right=gate.axes?.right||[Math.cos(gate.yaw),0,-Math.sin(gate.yaw)],up=gate.axes?.up||[0,1,0];
  const rotation=createDroneState([0,0,0],gate.yaw).rotation;
  const probes=[{position:[0,0,0],radius:.18},...(spec.collision?.spheres||[]).map(sphere=>({...sphere,position:rotate(rotation,sphere.position),radius:sphere.radius+.003}))];
  const clear=point=>probes.every(sphere=>{
    const centre=point.map((v,a)=>v+sphere.position[a]);
    return collisionCandidates(colliders,centre,sphere.radius).every(collider=>sphereContacts(centre,sphere.radius,collider).length===0);
  });
  const offsets=size=>{
    const values=[0];for(let v=-size/2+.24;v<=size/2-.24;v+=.25)if(Math.abs(v)>.01)values.push(v);
    return values.sort((a,b)=>Math.abs(a)-Math.abs(b));
  };
  for(const y of offsets(gate.height))for(const x of offsets(gate.width)){
    const point=gate.position.map((v,a)=>v+right[a]*x+up[a]*y);
    if(gateCrossed(point.map((v,a)=>v-normal[a]*.3),point.map((v,a)=>v+normal[a]*.3),gate)&&[-1,-.5,0,.5,1].every(t=>clear(point.map((v,a)=>v+normal[a]*t))))return point;
  }
  return null;
}
