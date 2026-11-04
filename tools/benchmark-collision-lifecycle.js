import {readFileSync,writeFileSync} from 'node:fs';
import {prepareMapCollisions,releaseMapCollisions} from '../src/map-collisions.js';
import {loadPreparedCollisions} from '../src/collision-preparation.js';
import {prepareCollisionPayload} from '../shared/collision-preparation.js';

// CPU lifetime diagnostic with actual map data and the client's install/release
// path. No browser, worker scheduling, renderer, or GPU measurement is implied.
const [output,requested='20']=process.argv.slice(2),cycles=Number(requested);
if(!globalThis.gc||!output||!Number.isInteger(cycles)||cycles<1||cycles>100)throw Error('Usage: node --expose-gc tools/benchmark-collision-lifecycle.js result.json [1..100 cycles]');
const maps=JSON.parse(readFileSync('public/content/catalog.json','utf8')).maps.filter(map=>map.collisionFile);
if(!maps.length)throw Error('No imported map collision data');
const obstacles={},rows=[];
const memory=async()=>{await new Promise(setImmediate);globalThis.gc();const m=process.memoryUsage();return {heapMiB:m.heapUsed/2**20,arrayBufferMiB:m.arrayBuffers/2**20,rssMiB:m.rss/2**20};};
const baseline=await memory();
const prepare=url=>loadPreparedCollisions(url,{
 read:async()=>{const bytes=readFileSync('public'+url);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);},
 run:async bytes=>prepareCollisionPayload(bytes).payload
});
for(let i=0;i<cycles;i++){
 const map=maps[i%maps.length],start=performance.now();
 await prepareMapCollisions(map,'flight',{prepare,obstacles});
 const colliders=obstacles[map.id].length,active=await memory();
 releaseMapCollisions(map,obstacles);
 if(obstacles[map.id]!==map.colliders)throw Error('Retired map physics still installed');
 rows.push({cycle:i+1,map:map.id,colliders,prepareAndActiveGCMs:performance.now()-start,active,released:await memory()});
}
const result={browser:false,workerScheduling:false,gpuMeasured:false,cycles,maps:maps.map(map=>map.id),baseline,rows};
writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({cycles,maps:maps.length,baseline,firstReleased:rows[0].released,lastReleased:rows.at(-1).released,maxActiveHeapMiB:Math.max(...rows.map(row=>row.active.heapMiB)),maxActiveBuffersMiB:Math.max(...rows.map(row=>row.active.arrayBufferMiB))}));
