// Plan a new course through the recovered garage using real collision clearance.
import {readFileSync,writeFileSync} from 'node:fs';
import {collisionCandidates,sphereContacts,prepareCollisions} from '../shared/collision.js';
import {profile,recoveryFolder} from './content-import-profile.js';
const folder=recoveryFolder,course=profile.course,items=JSON.parse(readFileSync(folder+'collision.json','utf8')).items;
prepareCollisions(items);
const clear=(x,y,z,r=.35)=>collisionCandidates(items,[x,y,z],r).every(o=>sphereContacts([x,y,z],r,o).length===0);
const floor=(x,z)=>collisionCandidates(items,[x,course.floorY+.08,z],.16).some(o=>sphereContacts([x,course.floorY+.08,z],.16,o).some(c=>c.normal[1]>.6));
let free=new Set();const key=(x,z)=>x+','+z;
for(let x=course.gridBounds[0];x<=course.gridBounds[1];x++)for(let z=course.gridBounds[2];z<=course.gridBounds[3];z++)if(clear(x,course.clearanceHeight,z,.5)&&floor(x,z))free.add(key(x,z));
if(!free.size)throw new Error('No clear course floor; review the profile floor and grid.');
function nearest(point){return [...free].map(k=>({k,p:k.split(',').map(Number)})).sort((a,b)=>Math.hypot(a.p[0]-point[0],a.p[1]-point[1])-Math.hypot(b.p[0]-point[0],b.p[1]-point[1]))[0].k;}
function route(a,b){
  const queue=[a],parent=new Map([[a,null]]);let cursor=0;
  while(cursor<queue.length){const current=queue[cursor++];if(current===b)break;const [x,z]=current.split(',').map(Number);
    for(const [dx,dz] of [[0,1],[1,0],[-1,0],[0,-1]]){const next=key(x+dx,z+dz);if(free.has(next)&&!parent.has(next)){parent.set(next,current);queue.push(next);}}
  }
  if(!parent.has(b))throw new Error('Unreachable course waypoint: '+b);
  const result=[];for(let k=b;k;k=parent.get(k))result.push(k.split(',').map(Number));return result.reverse();
}
// Keep this first course on the contiguous entry floor; ramps remain free to explore.
const connected=new Set(),queue=[nearest([course.spawn.position[0],course.spawn.position[2]])];let cursor=0;
connected.add(queue[0]);
while(cursor<queue.length){const [x,z]=queue[cursor++].split(',').map(Number);for(const [dx,dz] of [[0,1],[1,0],[-1,0],[0,-1]]){const next=key(x+dx,z+dz);if(free.has(next)&&!connected.has(next)){connected.add(next);queue.push(next);}}}
free=connected;
const waypoints=course.waypoints;
const nodes=waypoints.map(nearest),path=[];
for(let n=1;n<nodes.length;n++)path.push(...route(nodes[n-1],nodes[n]).slice(n>1?1:0));
const gates=[];let last=-12;
for(let n=6;n<path.length-4;n++){
  if(n-last<10)continue;
  const [x,z]=path[n],before=path[n-3],after=path[n+3],dx=after[0]-before[0],dz=after[1]-before[1];
  if(Math.hypot(dx,dz)<5.9)continue; // Place gates on straight lanes, away from bends.
  const yaw=Math.atan2(dx,dz),right=[Math.cos(yaw),-Math.sin(yaw)];
  let fits=true;
  for(const offset of [-course.width/2-.15,-course.width/4,0,course.width/4,course.width/2+.15])for(const y of [course.gateY-course.height/2-.04,course.gateY,course.gateY+course.height/2+.08])if(!clear(x+right[0]*offset,y,z+right[1]*offset,.08))fits=false;
  if(!fits)continue;
  gates.push({position:[x,course.gateY,z],yaw,width:course.width,height:course.height,gateClass:'open',frameThickness:.12,support:{type:'ground',baseY:course.floorY}});last=n;
}
if(gates.length<course.minimumGates)throw new Error('Insufficient clear gate sites: '+gates.length);
const race={id:course.id,name:course.name,map:profile.id,laps:course.laps,spawn:course.spawn,gates};
writeFileSync(folder+'race.json',JSON.stringify(race,null,2));
writeFileSync(folder+'course-report.json',JSON.stringify({freeCells:free.size,waypoints,nodes,path,distanceMetres:path.length,gates:gates.length},null,2));
console.log({freeCells:free.size,distanceMetres:path.length,gates:gates.length});
