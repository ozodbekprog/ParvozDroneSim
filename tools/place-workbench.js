// Find, verify, then persist one fixed placement per map. No runtime random placement.
import{readFileSync,writeFileSync,existsSync}from'node:fs';
import{Ray,Vector3,Quaternion,Euler,Box3,Triangle}from'three';
import{prepareCollisions,collisionCandidates,sphereContacts}from'../shared/collision.js';
const read=p=>JSON.parse(readFileSync(p)),kit=read('content/shared-assets/liftoff-workbench/workbench.json'),results=[];
for(const id of ['minus-two-demo','ironworks-v2','hangar-c03-demo','liftoff-arena-demo']){
 const profilePath='tools/import-profiles/'+id+'.json',profile=existsSync(profilePath)?read(profilePath):null,mapPath='content/maps/'+id+'/map.json';
 if(!existsSync(mapPath))continue;
 const map=read(mapPath);
 const collPath=existsSync('content/maps/'+id+'/collision.json')?'content/maps/'+id+'/collision.json':profile.staging+'/collision.json';
 let obstacles=read(collPath);obstacles=Array.isArray(obstacles)?obstacles:obstacles.items;
 const racePath=profile?'content/races/'+profile.course.id+'/race.json':'content/races/ironworks-v2-courier/race.json';
 const races=existsSync(racePath)?[read(racePath)]:[];
 obstacles=[...obstacles,...(races[0]?.colliders||[])];prepareCollisions(obstacles);
 const spawn=races[0]?.spawn?.position||map.menuCamera?.target||[0,.25,0],preferred=spawn[1]-.25;
 function support(x,z){
  const ray=new Ray(new Vector3(x,preferred+1,z),new Vector3(0,-1,0)),hits=[];
  for(const o of collisionCandidates(obstacles,[x,preferred,z],3)){
   if(o.type==='mesh')for(let i=0;i<o.vertices.length;i+=9){const t=new Triangle(new Vector3().fromArray(o.vertices,i),new Vector3().fromArray(o.vertices,i+3),new Vector3().fromArray(o.vertices,i+6));if(Math.abs(t.getNormal(new Vector3()).y)<.98)continue;const p=ray.intersectTriangle(t.a,t.b,t.c,false,new Vector3());if(p&&Math.abs(p.y-preferred)<1.1)hits.push(p.y);}
   else{const q=new Quaternion().setFromEuler(new Euler(...(o.rotation||[0,0,0]))),r=ray.clone();r.origin.sub(new Vector3(...o.position)).applyQuaternion(q.clone().invert());r.direction.applyQuaternion(q.clone().invert());const half=new Vector3(...o.size).multiplyScalar(.5),p=r.intersectBox(new Box3(half.clone().negate(),half),new Vector3());if(p&&Math.abs(p.y-half.y)<.01&&new Vector3(0,1,0).applyQuaternion(q).y>.98){p.applyQuaternion(q).add(new Vector3(...o.position));if(Math.abs(p.y-preferred)<1.1)hits.push(p.y);}}
  }
  if(hits.length)return Math.max(...hits);
  if(id==='ironworks-v2')return map.floorY||0;
  return null;
 }
 function clear(x,y,z,r=.12){return !collisionCandidates(obstacles,[x,y,z],r).some(o=>sphereContacts([x,y,z],r,o).some(c=>c.depth>.002));}
 function valid(x,z){
  const floor=support(x,z);if(floor===null)return null;
  for(const dx of [-.85,0,.85])for(const dz of [-1.15,0,1.15]){const y=support(x+dx,z+dz);if(y===null||Math.abs(y-floor)>.02)return null;}
  for(const dx of [-.85,-.42,0,.42,.85])for(const dz of [-1.2,-.6,0,.6,1.2])for(const dy of [.16,.45,.85,1.12])if(!clear(x+dx,floor+dy,z+dz))return null;
  for(let a=0;a<16;a++){const angle=a*Math.PI/8;if(!clear(x+Math.sin(angle)*2.7,floor+1.95,z+Math.cos(angle)*2.7,.2))return null;}
  if(races.some(r=>r.gates.some(g=>Math.hypot(g.position[0]-x,g.position[2]-z)<3.5)))return null;
  return floor;
 }
 let found;
 for(const radius of [6,9,12,16,20]){for(let a=0;a<16;a++){const angle=a*Math.PI/8,x=spawn[0]+Math.sin(angle)*radius,z=spawn[2]+Math.cos(angle)*radius,floor=valid(x,z);if(floor!==null){found=[x,floor,z];break;}}if(found)break;}
 if(!found)throw new Error('No verified flat workbench placement for '+id);
 const garage={model:'../../shared-assets/liftoff-workbench/delivery.glb',localOnly:true,position:found,rotation:[0,0,0],scale:1,anchor:[found[0],found[1]+kit.tabletopHeight,found[2]],selectionDistance:2.7,cameraShots:{selection:{azimuth:.72,elevation:.4,zoom:1},workbench:{azimuth:.72,elevation:.4,zoom:1}}};
 if(existsSync(mapPath)){map.garage=garage;writeFileSync(mapPath,JSON.stringify(map,null,2)+'\n');}
 if(profile){profile.map.garage=garage;writeFileSync(profilePath,JSON.stringify(profile,null,2)+'\n');}
 results.push({id,garage,checks:'9 support points; 100 volume probes; 16 camera positions; source gate clearance'});
}
writeFileSync('data/liftoff-workbench-recovery/placements.json',JSON.stringify(results,null,2));console.log(results.map(v=>({id:v.id,position:v.garage.position})));
