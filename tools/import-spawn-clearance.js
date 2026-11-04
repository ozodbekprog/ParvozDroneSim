import {prepareCollisions,collisionCandidates,sphereContacts} from '../shared/collision.js';

// Keep the source horizontal position and heading. Only adapt clearance for
// the game's aircraft volume when the authored start pad intersects it.
export function clearImportedSpawn(spawn,colliders,{spheres=[],radius=.18,step=.01,maxLift=.5}={}){
  if(!Number.isFinite(step)||step<=0||!Number.isFinite(maxLift)||maxLift<0)throw Error('Invalid spawn clearance search');
  prepareCollisions(colliders);
  const c=Math.cos(spawn.yaw),s=Math.sin(spawn.yaw);
  const probes=[{position:[0,0,0],radius},...spheres.map(({position:[x,y,z],radius})=>({position:[c*x+s*z,y,-s*x+c*z],radius:radius+.003}))];
  for(let i=0;i<=Math.floor(maxLift/step);i++){
    const lift=i*step,position=spawn.position.map((v,a)=>v+(a===1?lift:0));
    if(probes.every(sphere=>{
      const center=position.map((v,a)=>v+sphere.position[a]);
      return collisionCandidates(colliders,center,sphere.radius).every(o=>sphereContacts(center,sphere.radius,o).length===0);
    }))return {spawn:{...spawn,position},lift};
  }
  throw Error('Source start cannot be cleared with a bounded vertical adjustment');
}
