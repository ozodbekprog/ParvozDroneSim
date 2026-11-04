import { Vector3, Triangle, Box3,Quaternion,Euler } from 'three';
import {buildPackedCollisionTree,visitPackedCollisionTree,packedTreeIntersectsSphere} from './packed-collision-tree.js';

const cache = new WeakMap();
const boxes = new WeakMap(), spatialIndexes = new WeakMap();
const sweepBoxes = new WeakMap();
const CELL_SIZE = 24, MAX_CELLS = 128;
const point = new Vector3(), closest = new Vector3(), visitNorm = new Vector3();
const capLocal = new Vector3(), capClosest = new Vector3();
const scStart = new Vector3(), scEnd = new Vector3(), scDelta = new Vector3(), scRadial = new Vector3(), scMotion = new Vector3(), scCentre = new Vector3(), scOrigin = new Vector3(), scNorm = new Vector3();
const boxLocal = new Vector3(), boxNorm = new Vector3();
const swStart = new Vector3(), swDelta = new Vector3();
const stNormal = new Vector3(), stTemp = new Vector3(), stProj = new Vector3(), stNormSign = new Vector3(), stRel = new Vector3(), stMot = new Vector3(), stCenter = new Vector3(), stClosest = new Vector3(), stEdge = new Vector3(), stFrom = new Vector3();
let queryStamp = 0;

function cellKey(x, y, z) {
  if (x >= -32768 && x < 32768 && y >= -32768 && y < 32768 && z >= -32768 && z < 32768) {
    return (x + 32768) * 4294967296 + (y + 32768) * 65536 + (z + 32768);
  }
  return `${x},${y},${z}`;
}

function capsuleContact(center,radius,obstacle){
  const {position,rotation,inverse}=boxData(obstacle);
  capLocal.fromArray(center).sub(position);if(inverse)capLocal.applyQuaternion(inverse);
  capClosest.set(0,0,0);capClosest.setComponent(obstacle.axis,Math.max(-obstacle.halfLength,Math.min(obstacle.halfLength,capLocal.getComponent(obstacle.axis))));
  const normal=capLocal.sub(capClosest),length=normal.length(),depth=radius+obstacle.radius-length;
  if(depth<=0)return [];
  if(length>1e-10)normal.divideScalar(length);else {normal.set(0,0,0);normal.setComponent((obstacle.axis+1)%3,1);}
  if(rotation)normal.applyQuaternion(rotation);
  return [{normal:normal.toArray(),depth}];
}
function sweepCapsule(from,to,radius,obstacle){
  const {position,rotation,inverse}=boxData(obstacle);
  scStart.fromArray(from).sub(position);scEnd.fromArray(to).sub(position);
  if(inverse){scStart.applyQuaternion(inverse);scEnd.applyQuaternion(inverse);}
  const delta=scDelta.copy(scEnd).sub(scStart),axis=obstacle.axis,half=obstacle.halfLength,total=radius+obstacle.radius;
  let hit=null;
  const accept=(time,centre)=>{
    if(time<0||time>1||hit&&time>=hit.time)return;
    scNorm.copy(scStart).addScaledVector(delta,time).sub(centre).normalize();
    if(rotation)scNorm.applyQuaternion(rotation);hit={time,normal:scNorm.toArray()};
  };
  const quadratic=(origin,velocity,acceptRoot)=>{
    const a=velocity.lengthSq(),b=origin.dot(velocity),c=origin.lengthSq()-total*total;
    if(a<1e-16)return;const discriminant=b*b-a*c;if(discriminant<0)return;
    acceptRoot((-b-Math.sqrt(discriminant))/a);
  };
  scRadial.copy(scStart).setComponent(axis,0);scMotion.copy(delta).setComponent(axis,0);
  quadratic(scRadial,scMotion,time=>{
    const along=scStart.getComponent(axis)+delta.getComponent(axis)*time;
    if(Math.abs(along)<=half){scCentre.set(0,0,0).setComponent(axis,along);accept(time,scCentre);}
  });
  for(const sign of half===0?[0]:[-1,1]){
    scCentre.set(0,0,0).setComponent(axis,sign*half);
    quadratic(scOrigin.copy(scStart).sub(scCentre),delta,time=>accept(time,scCentre));
  }
  return hit;
}
function boxData(obstacle) {
  if (!boxes.has(obstacle)) {
    const rotation=obstacle.rotation?new Quaternion().setFromEuler(new Euler(...obstacle.rotation)):null;
    const half=obstacle.size.map(v=>v/2), position=new Vector3().fromArray(obstacle.position);
    const extent=new Vector3(...half);
    if (rotation) {
      const axes=[[half[0],0,0],[0,half[1],0],[0,0,half[2]]].map(a=>new Vector3(...a).applyQuaternion(rotation));
      extent.set(...[0,1,2].map(i=>axes.reduce((sum,a)=>sum+Math.abs(a.getComponent(i)),0)));
    }
    boxes.set(obstacle,{half,position,rotation,inverse:rotation?.clone().invert(),bounds:new Box3(position.clone().sub(extent),position.clone().add(extent))});
  }
  return boxes.get(obstacle);
}
function tree(triangles) {
  const bounds = new Box3();
  for (const t of triangles) bounds.expandByPoint(t.a).expandByPoint(t.b).expandByPoint(t.c);
  if (triangles.length <= 16) return { bounds, triangles };
  const size = bounds.getSize(new Vector3()); const axis = size.x > size.y && size.x > size.z ? 'x' : size.y > size.z ? 'y' : 'z';
  triangles.sort((a,b)=>(a.a[axis]+a.b[axis]+a.c[axis])-(b.a[axis]+b.b[axis]+b.c[axis]));
  const middle = triangles.length >> 1;
  return { bounds, left: tree(triangles.slice(0,middle)), right: tree(triangles.slice(middle)) };
}
function trianglesFor(obstacle) {
  if (!cache.has(obstacle)) {
    installCollisionTree(obstacle,buildPackedCollisionTree(obstacle.vertices));
  }
  return cache.get(obstacle);
}
export function installCollisionTree(obstacle,packed){
  cache.set(obstacle,{packed,bounds:new Box3(new Vector3().fromArray(packed.bounds),new Vector3().fromArray(packed.bounds,3))});
}
function eachCellBounds(minX, minY, minZ, maxX, maxY, maxZ, visitCell) {
  const lx = Math.floor(minX / CELL_SIZE), ly = Math.floor(minY / CELL_SIZE), lz = Math.floor(minZ / CELL_SIZE);
  const hx = Math.floor(maxX / CELL_SIZE), hy = Math.floor(maxY / CELL_SIZE), hz = Math.floor(maxZ / CELL_SIZE);
  const count = (hx - lx + 1) * (hy - ly + 1) * (hz - lz + 1);
  if (count > MAX_CELLS) return false;
  for (let x = lx; x <= hx; x++) for (let y = ly; y <= hy; y++) for (let z = lz; z <= hz; z++) visitCell(cellKey(x, y, z));
  return true;
}
function* buildSpatialIndex(obstacles){
    const cells=new Map(),overflow=[],entries=[];
    for(let index=0;index<obstacles.length;index++) {
      const obstacle=obstacles[index],bounds=obstacle.type==='mesh'?trianglesFor(obstacle).bounds:boxData(obstacle).bounds;
      const entry={obstacle,index,bounds,stamp:0};entries.push(entry);
      if(index%128===0)yield;
      if(bounds.isEmpty())continue;
      const fitted=eachCellBounds(bounds.min.x,bounds.min.y,bounds.min.z,bounds.max.x,bounds.max.y,bounds.max.z,key=>{
        let bucket=cells.get(key);if(!bucket){bucket=[];cells.set(key,bucket);}bucket.push(entry);
      });
      if(!fitted)overflow.push(entry);
    }
    return {cells,overflow,entries};
}
function spatialIndex(obstacles) {
  if (!spatialIndexes.has(obstacles)) {
    const build=buildSpatialIndex(obstacles);let step;do{step=build.next();}while(!step.done);
    spatialIndexes.set(obstacles,step.value);
  }
  return spatialIndexes.get(obstacles);
}
export function prepareCollisions(obstacles) { spatialIndex(obstacles); }
export async function prepareCollisionsAsync(obstacles,{signal,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0)),budgetMs=8}={}){
  signal?.throwIfAborted();if(spatialIndexes.has(obstacles))return;
  const build=buildSpatialIndex(obstacles);let slice=performance.now(),step;
  do{
    signal?.throwIfAborted();step=build.next();
    if(!step.done&&performance.now()-slice>=budgetMs){await yieldTask();slice=performance.now();}
  }while(!step.done);
  signal?.throwIfAborted();spatialIndexes.set(obstacles,step.value);
}
function boxBoundsWithinRadius(bounds, cx, cy, cz, radius) {
  const dx = Math.max(bounds.min.x - cx, 0, cx - bounds.max.x);
  const dy = Math.max(bounds.min.y - cy, 0, cy - bounds.max.y);
  const dz = Math.max(bounds.min.z - cz, 0, cz - bounds.max.z);
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}
export function candidateEntries(obstacles, center, radius, after = -1) {
  const index = spatialIndex(obstacles);
  const cx = center[0], cy = center[1], cz = center[2];
  const lx = Math.floor((cx - radius) / CELL_SIZE), ly = Math.floor((cy - radius) / CELL_SIZE), lz = Math.floor((cz - radius) / CELL_SIZE);
  const hx = Math.floor((cx + radius) / CELL_SIZE), hy = Math.floor((cy + radius) / CELL_SIZE), hz = Math.floor((cz + radius) / CELL_SIZE);
  const count = (hx - lx + 1) * (hy - ly + 1) * (hz - lz + 1);
  const result = [];
  if (count > MAX_CELLS) {
    for (let i = 0; i < index.entries.length; i++) {
      const entry = index.entries[i];
      if (entry.index > after && boxBoundsWithinRadius(entry.bounds, cx, cy, cz, radius)) result.push(entry);
    }
    return result;
  }
  const stamp = ++queryStamp;
  for (let i = 0; i < index.overflow.length; i++) {
    const entry = index.overflow[i];
    entry.stamp = stamp;
    if (entry.index > after && boxBoundsWithinRadius(entry.bounds, cx, cy, cz, radius)) {
      if (entry.obstacle.type !== 'mesh' || packedTreeIntersectsSphere(trianglesFor(entry.obstacle).packed, cx, cy, cz, radius)) {
        result.push(entry);
      }
    }
  }
  for (let x = lx; x <= hx; x++) for (let y = ly; y <= hy; y++) for (let z = lz; z <= hz; z++) {
    const bucket = index.cells.get(cellKey(x, y, z));
    if (!bucket) continue;
    for (let i = 0; i < bucket.length; i++) {
      const entry = bucket[i];
      if (entry.stamp === stamp) continue;
      entry.stamp = stamp;
      if (entry.index > after && boxBoundsWithinRadius(entry.bounds, cx, cy, cz, radius)) result.push(entry);
    }
  }
  if (result.length > 1) result.sort((a, b) => a.index - b.index);
  return result;
}
export function nearbyBoxObstacles(obstacles, center, radius, after = -1) {
  if (!obstacles.length) return obstacles;
  const cx = center[0], cy = center[1], cz = center[2];
  let result = null;
  for (let i = after + 1; i < obstacles.length; i++) {
    const obstacle = obstacles[i];
    if (boxBoundsWithinRadius(boxData(obstacle).bounds, cx, cy, cz, radius)) {
      if (!result) result = [];
      result.push(obstacle);
    }
  }
  return result || [];
}
// Static arrays and their collider objects are immutable for their flight lifetime.
export function collisionCandidates(obstacles,center,radius) {
  return candidateEntries(obstacles,center,radius).map(entry=>entry.obstacle);
}
export function* iterateNearbyColliders(obstacles,getCenter,radius,extra=[]) {
  let center=[...getCenter()],pending=candidateEntries(obstacles,center,radius),cursor=0;
  while(cursor<pending.length) {
    const entry=pending[cursor++];
    yield entry.obstacle;
    const current=getCenter();
    if(current[0]!==center[0]||current[1]!==center[1]||current[2]!==center[2]) {
      // A deep contact can move the body into a previously distant collider.
      // Requery later entries, matching the original full-array iteration order.
      center=[...current];pending=candidateEntries(obstacles,center,radius,entry.index);cursor=0;
    }
  }
  yield* extra;
}
function visit(node, center, radius, hits) {
  if(node.packed){
    visitPackedCollisionTree(node.packed,bounds=>bounds.distanceToPoint(center)<=radius,t=>{
      t.closestPointToPoint(center,closest);const distance=center.distanceTo(closest);
      if(distance<radius){const normal=distance>1e-7?visitNorm.copy(center).sub(closest).divideScalar(distance):t.getNormal(visitNorm);hits.push({normal:[normal.x,normal.y,normal.z],depth:radius-distance});}
    });return;
  }
  if (node.bounds.distanceToPoint(center)>radius) return;
  if (node.triangles) { for (const t of node.triangles) { t.closestPointToPoint(center,closest); const distance=center.distanceTo(closest); if(distance<radius) { const normal = distance>1e-7 ? visitNorm.copy(center).sub(closest).divideScalar(distance) : t.getNormal(visitNorm); hits.push({normal:[normal.x,normal.y,normal.z],depth:radius-distance}); } } }
  else { visit(node.left,center,radius,hits); visit(node.right,center,radius,hits); }
}
export function sphereContacts(center,radius,obstacle) {
  if(obstacle.type==='capsule')return capsuleContact(center,radius,obstacle);
  if (obstacle.type==='mesh') { const hits=[]; visit(trianglesFor(obstacle),point.fromArray(center),radius,hits); return hits; }
  const {rotation,inverse,half,position}=boxData(obstacle);
  let lx,ly,lz;
  if(rotation){
    boxLocal.fromArray(center).sub(position).applyQuaternion(inverse);
    lx=boxLocal.x;ly=boxLocal.y;lz=boxLocal.z;
  }else{
    lx=center[0]-obstacle.position[0];ly=center[1]-obstacle.position[1];lz=center[2]-obstacle.position[2];
  }
  const dx=lx-Math.max(-half[0],Math.min(half[0],lx));
  const dy=ly-Math.max(-half[1],Math.min(half[1],ly));
  const dz=lz-Math.max(-half[2],Math.min(half[2],lz));
  const length=Math.hypot(dx,dy,dz);
  if(length>=radius) return [];
  const worldNormal=(nx,ny,nz)=>{
    if(!rotation)return [nx,ny,nz];
    boxNorm.set(nx,ny,nz).applyQuaternion(rotation);
    return [boxNorm.x,boxNorm.y,boxNorm.z];
  };
  if(length>1e-8) return [{normal:worldNormal(dx/length,dy/length,dz/length),depth:radius-length}];
  const px=half[0]-Math.abs(lx),py=half[1]-Math.abs(ly),pz=half[2]-Math.abs(lz);
  const minP=Math.min(px,py,pz);
  const axis=px===minP?0:py===minP?1:2;
  const normal=[0,0,0]; normal[axis]=Math.sign(axis===0?lx:axis===1?ly:lz)||1;
  return [{normal:worldNormal(normal[0],normal[1],normal[2]),depth:radius+(axis===0?px:axis===1?py:pz)}];
}

// Continuous sphere collision against faces, edges and vertices. Both sides of
// imported triangles are solid, independently of winding and render materials.
function segmentBounds(start,delta,radius,bounds,limit=1) {
  let low=0,high=limit;
  for(let axis=0;axis<3;axis++){
    const p=start.getComponent(axis),d=delta.getComponent(axis);
    const min=bounds.min.getComponent(axis)-radius,max=bounds.max.getComponent(axis)+radius;
    if(Math.abs(d)<1e-12){if(p<min||p>max)return false;continue;}
    let a=(min-p)/d,b=(max-p)/d;if(a>b)[a,b]=[b,a];
    low=Math.max(low,a);high=Math.min(high,b);if(low>high)return false;
  }
  return true;
}
function sweepTriangle(start,delta,radius,triangle,limit) {
  let hit=null;
  const accept=(time,normal)=>{
    if(time< -1e-8||time>limit||delta.dot(normal)>=-1e-9)return;
    limit=Math.max(0,time);hit={time:limit,normal:[normal.x,normal.y,normal.z]};
  };
  const normal=triangle.getNormal(stNormal),distance=stTemp.copy(start).sub(triangle.a).dot(normal),speed=delta.dot(normal);
  if(Math.abs(speed)>1e-12)for(let sign=-1;sign<=1;sign+=2){
    const time=(sign*radius-distance)/speed;
    if(time< -1e-8||time>limit)continue;
    stProj.copy(start).addScaledVector(delta,time).addScaledVector(normal,-sign*radius);
    if(triangle.containsPoint(stProj))accept(time,stNormSign.copy(normal).multiplyScalar(sign));
  }
  const quadratic=(relative,motion,closestAt)=>{
    const a=motion.lengthSq(),b=relative.dot(motion),c=relative.lengthSq()-radius*radius;
    if(a<1e-14||c< -1e-8)return;
    const discriminant=b*b-a*c;if(discriminant<0)return;
    const time=(-b-Math.sqrt(discriminant))/a;
    if(time< -1e-8||time>limit)return;
    stCenter.copy(start).addScaledVector(delta,time);
    const point=closestAt(time);
    if(point)accept(time,stCenter.sub(point).normalize());
  };
  const va=triangle.a,vb=triangle.b,vc=triangle.c;
  quadratic(stRel.copy(start).sub(va),delta,()=>va);
  quadratic(stRel.copy(start).sub(vb),delta,()=>vb);
  quadratic(stRel.copy(start).sub(vc),delta,()=>vc);
  const sweepEdge=(a,b)=>{
    const edge=stEdge.copy(b).sub(a),length=edge.lengthSq();if(length<1e-14)return;
    const from=stFrom.copy(start).sub(a),along=from.dot(edge)/length,travel=delta.dot(edge)/length;
    quadratic(from.addScaledVector(edge,-along),stMot.copy(delta).addScaledVector(edge,-travel),time=>{
      const fraction=along+travel*time;return fraction>=0&&fraction<=1?stClosest.copy(a).addScaledVector(edge,fraction):null;
    });
  };
  sweepEdge(va,vb);sweepEdge(vb,vc);sweepEdge(vc,va);
  return hit;
}
function boxSweepTree(obstacle){
  if(!sweepBoxes.has(obstacle)){
    const {half,position,rotation}=boxData(obstacle),vertices=[];
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
      const p=new Vector3(x*half[0],y*half[1],z*half[2]);if(rotation)p.applyQuaternion(rotation);vertices.push(p.add(position));
    }
    const faces=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]],triangles=[];
    for(const [a,b,c,d] of faces)triangles.push(new Triangle(vertices[a],vertices[b],vertices[c]),new Triangle(vertices[a],vertices[c],vertices[d]));
    sweepBoxes.set(obstacle,tree(triangles));
  }
  return sweepBoxes.get(obstacle);
}
export function sweepSphere(from,to,radius,obstacle){
  if(obstacle.type==='capsule')return sweepCapsule(from,to,radius,obstacle);
  const start=swStart.fromArray(from),delta=swDelta.fromArray(to).sub(start);
  if(delta.lengthSq()<1e-16)return null;
  let hit=null;
  function visitSweep(node){
    if(node.packed){
      visitPackedCollisionTree(node.packed,bounds=>segmentBounds(start,delta,radius,bounds,hit?.time??1),triangle=>{
        const next=sweepTriangle(start,delta,radius,triangle,hit?.time??1);if(next)hit=next;
      });return;
    }
    if(!segmentBounds(start,delta,radius,node.bounds,hit?.time??1))return;
    if(node.triangles)for(const triangle of node.triangles){
      const next=sweepTriangle(start,delta,radius,triangle,hit?.time??1);if(next)hit=next;
    }
    else {visitSweep(node.left);visitSweep(node.right);}
  }
  visitSweep(obstacle.type==='mesh'?trianglesFor(obstacle):boxSweepTree(obstacle));
  return hit;
}
