import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {validateColliders} from '../shared/catalog-schema.js';
import {prepareCollisions,sphereContacts,sweepSphere,collisionCandidates} from '../shared/collision.js';

// CPU diagnostic only. Run in a fresh process for each map/version; not an FPS test.
const mapId=process.argv[2]||'liftoff-the-green-demo',output=process.argv[3];
const catalog=JSON.parse(readFileSync('public/content/catalog.json','utf8'));
const map=catalog.maps.find(item=>item.id===mapId);
if(!map?.collisionFile)throw Error(`Unknown imported map: ${mapId}`);
let raw=readFileSync('public'+map.collisionFile,'utf8');
const bytes=Buffer.byteLength(raw),start=performance.now();
const data=JSON.parse(raw),parsed=performance.now();raw=null;
const obstacles=validateColliders(data),validated=performance.now();
prepareCollisions(obstacles);const prepared=performance.now();
globalThis.gc?.();
const memory=process.memoryUsage(),hash=createHash('sha256');
let probes=0;
for(let i=0;i<obstacles.length;i+=Math.max(1,Math.floor(obstacles.length/200))){
 const obstacle=obstacles[i];
 const center=obstacle.type==='mesh'&&obstacle.vertices.length>=9
  ?[0,1,2].map(axis=>(obstacle.vertices[axis]+obstacle.vertices[axis+3]+obstacle.vertices[axis+6])/3)
  :obstacle.position;
 if(!center)continue;
 for(const axis of [0,1,2]){
  const from=[...center],to=[...center];from[axis]-=1;to[axis]+=1;
  hash.update(JSON.stringify([sphereContacts(center,.2,obstacle),sweepSphere(from,to,.15,obstacle),collisionCandidates(obstacles,center,.2).map(item=>obstacles.indexOf(item))]));probes++;
 }
}
const result={mapId,revision:catalog.revision,bytes,colliders:obstacles.length,triangles:obstacles.reduce((sum,item)=>sum+(item.vertices?.length||0)/9,0),parseMs:parsed-start,validateMs:validated-parsed,prepareMs:prepared-validated,totalMs:prepared-start,heapMiB:memory.heapUsed/2**20,arrayBufferMiB:memory.arrayBuffers/2**20,rssMiB:memory.rss/2**20,forcedGC:!!globalThis.gc,probes,contactHash:hash.digest('hex')};
if(output){mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));
