// Convert recovered, enabled, non-trigger Unity colliders into game coordinates.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { Matrix4, Vector3, Quaternion, Euler } from 'three';
import {recoveryFolder} from './content-import-profile.js';
import {profile} from './content-import-profile.js';
import {sourceHierarchy} from './import-source-hierarchy.js';
const folder=recoveryFolder;
const resources=JSON.parse(readFileSync(folder+'resources.json','utf8'));
const records=JSON.parse(readFileSync(folder+resources.records,'utf8'));
const hierarchy=sourceHierarchy(records);
const excluded=new Set(existsSync(folder+'source-exclusions.json')?JSON.parse(readFileSync(folder+'source-exclusions.json','utf8')).objects:[]);
const transforms=new Map(Object.values(records).filter(r=>r.type==='Transform').map(r=>[r.data.m_GameObject.m_PathID,r.data]));
const reflection=new Matrix4().makeScale(-1,1,1), cache=new Map();
const vector=v=>new Vector3(v.m_X,v.m_Y,v.m_Z);
function world(go){
  if(cache.has(go))return cache.get(go);
  const t=transforms.get(go),q=t.m_LocalRotation;
  if([q.m_X,q.m_Y,q.m_Z,q.m_W].some(x=>x===null))throw new Error('Invalid transform: '+go);
  const m=new Matrix4().compose(vector(t.m_LocalPosition),new Quaternion(q.m_X,q.m_Y,q.m_Z,q.m_W),vector(t.m_LocalScale));
  if(t.m_Father.m_PathID!=='0')m.premultiply(world(records[t.m_Father.m_PathID].data.m_GameObject.m_PathID));
  cache.set(go,m);return m;
}
function active(go){
  if(!records[go]?.data.m_IsActive)return false;
  const parent=transforms.get(go)?.m_Father.m_PathID;
  return parent==='0'||Boolean(parent&&active(records[parent].data.m_GameObject.m_PathID));
}
function meshKey(ptr){
  const collection=resources.collectionDependencies[JSON.stringify(resources.scene)][ptr.m_FileID];
  return JSON.stringify(collection)+':'+ptr.m_PathID;
}
function meshTriangles(file,matrix){
  const b=readFileSync(folder+file),j=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
  const binaryOffset=20+b.readUInt32LE(12)+8;
  function accessor(index,n){
    const a=j.accessors[index],v=j.bufferViews[a.bufferView],width=a.type==='VEC3'?3:1;
    const bytes=a.componentType===5126||a.componentType===5125?4:2;
    const start=binaryOffset+(v.byteOffset||0)+(a.byteOffset||0)+n*(v.byteStride||bytes*width);
    return Array.from({length:width},(_,k)=>a.componentType===5126?b.readFloatLE(start+k*bytes):bytes===4?b.readUInt32LE(start+k*bytes):b.readUInt16LE(start+k*bytes));
  }
  const result=[];
  for(const mesh of j.meshes)for(const primitive of mesh.primitives){
    const count=j.accessors[primitive.indices].count;
    for(let n=0;n<count;n++)result.push(...new Vector3(...accessor(primitive.attributes.POSITION,accessor(primitive.indices,n)[0])).applyMatrix4(matrix).toArray());
  }
  return result;
}
const items=[],skipped=[],padded=[],roundSources=[];
for(const [identity,r] of Object.entries(records)){
  if(!['BoxCollider','MeshCollider','SphereCollider','CapsuleCollider'].includes(r.type))continue;
  const d=r.data,go=d.m_GameObject.m_PathID;
  if(excluded.has(go)||hierarchy.excluded(go,profile.excludeCollisionObjectPrefixes||[])||!d.m_Enabled||d.m_IsTrigger||!active(go))continue;
  let source;
  try{source=world(go);}catch(e){skipped.push({identity,reason:e.message});continue;}
  const matrix=reflection.clone().multiply(source).multiply(reflection);
  if(r.type==='MeshCollider'){
    if(d.m_Mesh.m_PathID==='0'){skipped.push({identity,reason:'Enabled Unity MeshCollider with no mesh has no collision surface'});continue;}
    const mesh=resources.meshes.find(m=>m.key===meshKey(d.m_Mesh));
    if(!mesh)throw new Error('Missing collision mesh: '+identity);
    const vertices=meshTriangles(mesh.file,matrix);
    if(vertices.length>900000)throw new Error('Collision mesh exceeds the existing schema budget');
    items.push({type:'mesh',vertices});continue;
  }
  const centre=vector(d.m_Center).applyMatrix4(reflection).applyMatrix4(matrix);
  const scale=new Vector3(),rotation=new Quaternion();matrix.decompose(new Vector3(),rotation,scale);
  if(r.type==='SphereCollider'||r.type==='CapsuleCollider'){
    const axis=r.type==='CapsuleCollider'?d.m_Direction:1,scales=scale.toArray().map(Math.abs);
    const radius=Math.max(.005,d.m_Radius*Math.max(...scales.filter((_,i)=>r.type==='SphereCollider'||i!==axis)));
    const halfLength=r.type==='CapsuleCollider'?Math.max(0,d.m_Height*scales[axis]/2-radius):0;
    const size=[0,1,2].map(i=>2*(radius+(i===axis?halfLength:0))),euler=new Euler().setFromQuaternion(rotation,'XYZ');
    items.push({type:'capsule',position:centre.toArray(),size,rotation:[euler.x,euler.y,euler.z],radius,halfLength,axis});
    roundSources.push({identity,type:r.type,object:records[go]?.name,index:items.length-1});continue;
  }
  let size;
  if(r.type==='BoxCollider'){size=vector(d.m_Size);size.set(Math.abs(size.x),Math.abs(size.y),Math.abs(size.z));}
  else {size=new Vector3(d.m_Radius*2,d.m_Radius*2,d.m_Radius*2);if(r.type==='CapsuleCollider')size.setComponent(d.m_Direction,Math.max(d.m_Height,d.m_Radius*2));}
  size.multiply(new Vector3(Math.abs(scale.x),Math.abs(scale.y),Math.abs(scale.z)));
  if(size.toArray().some(x=>!Number.isFinite(x)||x<0))throw new Error('Invalid collision size: '+identity);
  if(size.toArray().some(x=>x<.01)){
    padded.push(identity);
    size.max(new Vector3(.01,.01,.01));
  }
  const euler=new Euler().setFromQuaternion(rotation,'XYZ');
  items.push({position:centre.toArray(),size:size.toArray(),rotation:[euler.x,euler.y,euler.z]});
}
writeFileSync(folder+'collision.json',JSON.stringify({items}));
writeFileSync(folder+'collision-report.json',JSON.stringify({colliders:items.length,meshTriangles:items.reduce((s,c)=>s+(c.vertices?.length||0)/9,0),skipped,paddedToSchemaMinimum:padded,roundSources,roundProxies:'Analytic capsules and spheres retain source direction, dimensions and world transform. Capsule radius uses maximum perpendicular scale; height includes both hemispheres.'},null,2));
console.log({colliders:items.length,meshTriangles:items.reduce((s,c)=>s+(c.vertices?.length||0)/9,0),skipped:skipped.length});
