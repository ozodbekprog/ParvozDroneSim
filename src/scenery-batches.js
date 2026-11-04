import {BatchedMesh,Group,Material,Matrix4,Mesh,Vector3,Color} from 'three';
import {mergeGeometries,deinterleaveGeometry} from 'three/addons/utils/BufferGeometryUtils.js';
import {SceneryInstances,instanceDescription} from './scenery-instances.js';
import {releaseResources} from './resource-cleanup.js';

const lodBindings=new WeakMap();
const activeCounts=new WeakMap();
const sources=new WeakSet();
export const isBatchedScenerySource=object=>sources.has(object);
export function setBatchLODVisible(level,visible){for(const {batch,id} of lodBindings.get(level)||[]){
 if(batch.getVisibleAt(id)===visible)continue;
 batch.setVisibleAt(id,visible);const active=activeCounts.get(batch)+(visible?1:-1);activeCounts.set(batch,active);batch.visible=active>0;
}}
const ignored=new Set(['id','uuid','name','version','userData','_listeners']);
const registeredMaterials=new WeakSet();
const constructorKeys=new WeakMap();
const geometryLayoutCache=new WeakMap();
// Only explicitly owned, shared node materials may bypass the generic key.
export function registerSceneryMaterial(material){registeredMaterials.add(material);}
function encodeMaterialValue(value){
 if(value===null)return 'null';
 const type=typeof value;
 if(type==='number'||type==='boolean')return String(value);
 if(type==='string')return JSON.stringify(value);
 if(type==='undefined')return 'undef';
 if(value.isTexture)return 'tex:'+value.uuid;
 if(value.isNode)return 'node:'+value.uuid;
 if(value.isColor)return 'col:'+value.r+','+value.g+','+value.b;
 if(value.isVector2)return 'v2:'+value.x+','+value.y;
 if(value.isVector3)return 'v3:'+value.x+','+value.y+','+value.z;
 if(value.isVector4)return 'v4:'+value.x+','+value.y+','+value.z+','+value.w;
 if(value.toArray)return 'arr:'+value.toArray().join(',');
 if(Array.isArray(value))return '['+value.map(encodeMaterialValue).join(',')+']';
 if(Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+encodeMaterialValue(value[k])).join(',')+'}';
 throw new Error('Custom material value');
}
function sortedMaterialKeys(material){
 const raw=Object.keys(material),ctor=material.constructor;
 const cached=ctor&&constructorKeys.get(ctor);
 if(cached&&cached.raw.length===raw.length){
  let same=true;
  for(let i=0;i<raw.length;i++)if(raw[i]!==cached.raw[i]){same=false;break;}
  if(same)return cached.sorted;
 }
 const sorted=raw.filter(k=>!ignored.has(k)).sort();
 if(ctor)constructorKeys.set(ctor,{raw,sorted});
 return sorted;
}
export function sceneryMaterialKey(material){
 if(material&&!material.transparent&&registeredMaterials.has(material))return 'shared:'+material.uuid;
 if(!material||material.transparent||material.isNodeMaterial||material.onBeforeCompile!==Material.prototype.onBeforeCompile)return null;
 try{
  const keys=sortedMaterialKeys(material);
  let out=(material.userData.parvozSourceMaterial||'')+'|';
  for(let i=0;i<keys.length;i++){const k=keys[i];out+=k+'='+encodeMaterialValue(material[k])+';';}
  return out;
 }catch{return null;}
}
function encodeShaderValue(value){
 if(value&&value.isTexture)return `tex:${value.mapping}:${value.channel||0}:${value.colorSpace||''}:${value.flipY?1:0}:${value.magFilter}:${value.minFilter}:${value.wrapS}:${value.wrapT}:${value.wrapR||''}`;
 if(Array.isArray(value))return '['+value.map(encodeShaderValue).join(',')+']';
 return encodeMaterialValue(value);
}
export function shaderMaterialKey(material){
 if(!material||material.isNodeMaterial||material.onBeforeCompile!==Material.prototype.onBeforeCompile)return null;
 try{
  const keys=sortedMaterialKeys(material);
  let out=material.type+'|'+material.customProgramCacheKey()+'|';
  for(let i=0;i<keys.length;i++){const k=keys[i];out+=k+'='+encodeShaderValue(material[k])+';';}
  return out;
 }catch{return null;}
}
const geometryIdsByRef=new WeakMap();let nextGeometryRefId=1;
function geometryRefId(geometry){
 let id=geometryIdsByRef.get(geometry);
 if(!id){id=nextGeometryRefId++;geometryIdsByRef.set(geometry,id);}
 return id;
}
function matrixWorldKey(matrixWorld){
 const e=matrixWorld.elements;
 let out='';
 for(let i=0;i<16;i++){
  const v=e[i];
  out+=(i?',':'')+(Math.abs(v)<1e-6?'0':v.toFixed(4));
 }
 return out;
}
function collectLevelMeshes(levelRoot){
 const map=new Map();
 let other=false;
 const visit=node=>{
  if(node!==levelRoot&&!node.visible)return;
  if(node.userData?.excludedSceneryMarker||node.userData?.collider)return;
  if(node!==levelRoot&&node.userData?.visualLod){other=true;return;}
  if(node.isMesh){
   if(node.children.length||node.isInstancedMesh||node.isBatchedMesh||node.isSkinnedMesh||Array.isArray(node.material)){other=true;}
   else{
    const matKey=sceneryMaterialKey(node.material),geomKey=geometryKey(node.geometry);
    if(!matKey||!geomKey||node.matrixWorld.determinant()<=0){other=true;}
    else{
     const base=geometryRefId(node.geometry)+'|'+matKey+'|'+(node.castShadow?1:0)+'|'+(node.receiveShadow?1:0)+'|'+matrixWorldKey(node.matrixWorld);
     let sig=base,dup=0;
     while(map.has(sig))sig=base+'#'+(++dup);
     map.set(sig,{mesh:node,matKey,geomKey});
    }
   }
  }
  for(const child of node.children)visit(child);
 };
 visit(levelRoot);
 return {map,other};
}
function extractInvariantLODMeshes(lodGroup){
 const children=lodGroup.children;
 if(children.length<2)return null;
 const levels=children.map(collectLevelMeshes);
 if(!levels[0].map.size)return null;
 const invariant=[];
 let varying=false;
 for(const [sig,first] of levels[0].map){
  let allHave=true;
  for(let i=1;i<levels.length;i++){
   if(!levels[i].map.has(sig)){allHave=false;break;}
  }
  if(allHave){
   const duplicates=[];
   for(let i=1;i<levels.length;i++)duplicates.push(levels[i].map.get(sig).mesh);
   invariant.push({primary:first.mesh,matKey:first.matKey,geomKey:first.geomKey,duplicates});
  }else varying=true;
 }
 if(!invariant.length)return null;
 const fullyInvariant=!varying&&levels.every(l=>!l.other&&l.map.size===invariant.length);
 return {invariant,fullyInvariant};
}
function maxSimultaneousVisible(entries){
 let total=0;
 const byGroup=new Map();
 for(let i=0;i<entries.length;i++){
  const level=entries[i].level;
  if(!level){total++;continue;}
  const group=level.parent;
  if(!group){total++;continue;}
  let counts=byGroup.get(group);
  if(!counts){counts=new Map();byGroup.set(group,counts);}
  counts.set(level,(counts.get(level)||0)+1);
 }
 for(const counts of byGroup.values()){
  let best=0;
  for(const c of counts.values())if(c>best)best=c;
  total+=best;
 }
 return total;
}
function geometryKey(geometry){
 if(!geometry?.attributes.position||Object.keys(geometry.morphAttributes).length||geometry.drawRange.start!==0||geometry.drawRange.count<(geometry.index?.count??geometry.attributes.position.count))return null;
 const attrs=geometry.attributes,names=Object.keys(attrs),indexed=!!geometry.index;
 const cached=geometryLayoutCache.get(geometry);
 if(cached&&cached.indexed===indexed&&cached.count===names.length)return cached.key;
 const key=JSON.stringify([indexed,names.sort().map(name=>{const a=attrs[name];return [name,a.itemSize,a.normalized,(a.isInterleavedBufferAttribute?a.data.array:a.array).constructor.name];})]);
 geometryLayoutCache.set(geometry,{indexed,count:names.length,key});
 return key;
}

/** Merge draw submission, preserving geometry, authored transforms and each LOD.
 * Spatial cells and per-object frustum culling avoid one map-wide visible batch.
 * Only immutable scenery is accepted. Aircraft/course animation stays separate.
 */
const yieldToBrowser=()=>globalThis.scheduler?.yield?.()||new Promise(resolve=>setTimeout(resolve,0));
export async function batchStaticSceneryAsync(roots,parent,{budgetMs=8,now=()=>performance.now(),yieldTask=yieldToBrowser,shouldContinue=()=>true,...options}={}){
 const steps=sceneryBatchSteps(roots,parent,options);let start=now();
 try{while(true){
  if(!shouldContinue())throw new DOMException('Scene changed during scenery preparation','AbortError');
  const step=steps.next();if(step.done)return step.value;
  if(now()-start>=budgetMs){await yieldTask();start=now();}
 }}finally{steps.return();}
}

export function batchStaticScenery(roots,parent,options={}){
 const steps=sceneryBatchSteps(roots,parent,options);let step;
 while(!(step=steps.next()).done){}
 return step.value;
}

function* sceneryBatchSteps(roots,parent,{cellSize=512,staticCellSize=768,minMeshes=3,maxVertices=260000,instancing=false,multiDraw=true,mergeStatic=false}={}){
 const allocated=new Set(),ownedGeometries=new Set(),pending=[];let committed=false;
 try{
 const groups=new Map(),handledMeshes=new WeakSet(),fullyInvariantTrackers=[],center=new Vector3(),inverse=new Matrix4(),localMatrix=new Matrix4(),instanceMatrix=new Matrix4(),whiteColor=new Color(1,1,1),tempColor=new Color();
 parent.updateWorldMatrix(true,false);inverse.copy(parent.matrixWorld).invert();
 const walk=function*(object,level=null,forceVisible=false){
  if(object.userData.excludedSceneryMarker||handledMeshes.has(object)||(!object.visible&&!forceVisible))return;
  if(object.userData.visualLod){
   if(mergeStatic){
    const extracted=extractInvariantLODMeshes(object);
    if(extracted){
     const tracker=extracted.fullyInvariant?{lodGroup:object,expected:extracted.invariant.length,committed:0}:null;
     if(tracker)fullyInvariantTrackers.push(tracker);
     for(const {primary,matKey,geomKey,duplicates} of extracted.invariant){
      handledMeshes.add(primary);
      for(const dup of duplicates)handledMeshes.add(dup);
      if(!primary.geometry.boundingBox)primary.geometry.computeBoundingBox();
      primary.geometry.boundingBox.getCenter(center).applyMatrix4(primary.matrixWorld);
      const cx=center.x,cz=center.z;
      const key=['cell',Math.floor(cx/cellSize),Math.floor(cz/cellSize),matKey,geomKey,primary.castShadow,primary.receiveShadow].join('|');
      let bucket=groups.get(key);if(!bucket){bucket=[];groups.set(key,bucket);}
      bucket.push({object:primary,level:null,duplicateMeshes:duplicates,lodTracker:tracker,worldX:cx,worldZ:cz});
     }
     yield;
     if(extracted.fullyInvariant)return;
    }
   }
   for(const child of object.children)yield* walk(child,child,true);
   return;
  }
  if(object.isMesh&&!object.children.length&&!object.isInstancedMesh&&!object.isBatchedMesh&&!object.isSkinnedMesh&&!Array.isArray(object.material)){
   const material=sceneryMaterialKey(object.material),geometry=geometryKey(object.geometry);
   if(material&&geometry&&object.matrixWorld.determinant()>0){
    if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();object.geometry.boundingBox.getCenter(center).applyMatrix4(object.matrixWorld);
    const key=['cell',Math.floor(center.x/cellSize),Math.floor(center.z/cellSize),material,geometry,object.castShadow,object.receiveShadow].join('|');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push({object,level,worldX:center.x,worldZ:center.z});
   }
  }else if(instancing&&object.isInstancedMesh&&!(object instanceof SceneryInstances)&&!object.children.length&&!object.morphTexture&&!Array.isArray(object.material)&&object.count>0){
   const material=sceneryMaterialKey(object.material),geometry=geometryKey(object.geometry);
   if(material&&geometry&&object.matrixWorld.determinant()>0){
    const expanded=[];let valid=true;
    for(let k=0;k<object.count;k++){
     object.getMatrixAt(k,instanceMatrix);
     const worldMatrix=new Matrix4().multiplyMatrices(object.matrixWorld,instanceMatrix);
     if(worldMatrix.determinant()<=0){valid=false;break;}
     let instanceColor=null;
     if(object.instanceColor){instanceColor=new Color();object.getColorAt(k,instanceColor);}
     expanded.push({object,level,worldMatrix,instanceColor,fromInstancedMesh:true});
     if((k&63)===63)yield;
    }
    if(valid){
     if(!object.boundingBox)object.computeBoundingBox();object.boundingBox.getCenter(center).applyMatrix4(object.matrixWorld);
     const key=['cell',Math.floor(center.x/cellSize),Math.floor(center.z/cellSize),material,geometry,object.castShadow,object.receiveShadow].join('|');
     let bucket=groups.get(key);if(!bucket){bucket=[];groups.set(key,bucket);}
     for(const item of expanded)bucket.push(item);
    }
   }
  }
  yield;
  for(const child of object.children)yield* walk(child,level);
 };
 for(const root of roots){root.updateWorldMatrix(true,true);yield* walk(root);}
 const container=new Group();container.name='Spatial scenery batches';let meshes=0,batches=0;
 const collapsedGroups=new Set();
 const commitInvariantEntry=entry=>{
  if(entry.duplicateMeshes){
   for(const dup of entry.duplicateMeshes){dup.visible=false;sources.add(dup);}
  }
  const tracker=entry.lodTracker;
  if(tracker&&++tracker.committed===tracker.expected){
   collapsedGroups.add(tracker.lodGroup);
   tracker.lodGroup.visible=false;
   for(const child of tracker.lodGroup.children)child.visible=false;
  }
 };
 const bind=(entries,batch,isStaticMesh=false)=>{
  if(isStaticMesh){
   for(const entry of entries){
    entry.object.visible=false;sources.add(entry.object);
    commitInvariantEntry(entry);
   }
   container.add(batch);batches++;meshes+=entries.length;
   return;
  }
  let active=0;
  for(const [id,entry] of entries.entries()){
   const {object,level}=entry;
   const visible=level?level.visible:true;batch.setVisibleAt(id,visible);if(visible)active++;
   if(level){const bindings=lodBindings.get(level)||[];bindings.push({batch,id});lodBindings.set(level,bindings);}
   object.visible=false;sources.add(object);
   commitInvariantEntry(entry);
  }
  activeCounts.set(batch,active);batch.visible=active>0;container.add(batch);batches++;meshes+=entries.length;
 };
 const stage=(entries,batch,isStaticMesh=false)=>pending.push({entries,batch,isStaticMesh});
 const buildMergedStatic=function*(staticEntries){
  if(staticEntries.length<minMeshes)return false;
  const totalVerts=staticEntries.reduce((n,e)=>n+e.object.geometry.attributes.position.count,0);
  if(totalVerts>maxVertices&&staticEntries.length>minMeshes){
   const mid=Math.floor(staticEntries.length/2);
   const a=yield* buildMergedStatic(staticEntries.slice(0,mid));
   const b=yield* buildMergedStatic(staticEntries.slice(mid));
   return a&&b;
  }
  const parts=[];
  try{
   for(let i=0;i<staticEntries.length;i++){
    const obj=staticEntries[i].object,part=obj.geometry.clone();
    if(Object.values(part.attributes).some(a=>a.isInterleavedBufferAttribute))deinterleaveGeometry(part);
    part.applyMatrix4(localMatrix.multiplyMatrices(inverse,obj.matrixWorld));
    parts.push(part);
    if((i&31)===31)yield;
   }
   const merged=mergeGeometries(parts,false);
   if(!merged)return false;
   merged.computeBoundingBox();merged.computeBoundingSphere();
   ownedGeometries.add(merged);
   const source=staticEntries[0].object;
   const mesh=new Mesh(merged,source.material);
   mesh.name='Merged static scenery '+pending.length;
   mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;
   allocated.add(mesh);
   stage(staticEntries,mesh,true);
   yield;
   return true;
  }finally{
   for(const part of parts)part.dispose();
  }
 };
 const build=function*(entries){
  if(entries.length<minMeshes)return;
  if(instancing){
   const repeated=new Map();
   for(const entry of entries){const description=instanceDescription(entry.object.geometry);if(!repeated.has(description.key))repeated.set(description.key,[]);repeated.get(description.key).push({...entry,description});yield;}
   const remaining=[];
   for(const group of repeated.values()){
    // Several LODs of one placement are mutually exclusive, not repeated draws.
    const placements=[];for(const entry of group){const world=entry.worldMatrix||entry.object.matrixWorld;if(!placements.some(m=>m.equals(world)))placements.push(world);if(placements.length>=minMeshes)break;}
    if(placements.length<minMeshes){for(const entry of group)if(!entry.fromInstancedMesh)remaining.push(entry);continue;}
    const source=group[0].object,strip=!!group[0].description.tint,geometry=strip?source.geometry.clone():source.geometry;
    if(strip){geometry.deleteAttribute('color');ownedGeometries.add(geometry);}
    const batch=new SceneryInstances(geometry,source.material,group.length);batch.name='Scenery instances '+pending.length;batch.castShadow=source.castShadow;batch.receiveShadow=source.receiveShadow;
    allocated.add(batch);
    for(const [id,{object,description,worldMatrix,instanceColor}] of group.entries()){
     batch.setMatrixAt(id,localMatrix.multiplyMatrices(inverse,worldMatrix||object.matrixWorld));
     const tint=source.material.vertexColors&&description.tint;
     let color=whiteColor;
     if(instanceColor&&tint)color=tempColor.copy(instanceColor).multiply(tint);
     else if(instanceColor)color=instanceColor;
     else if(tint)color=tint;
     batch.setColorAt(id,color);
     yield;
    }
    batch.instanceMatrix.needsUpdate=true;batch.instanceColor.needsUpdate=true;batch.computeBoundingBox();batch.computeBoundingSphere();stage(group,batch);yield;
   }
   entries=remaining;if(entries.length<minMeshes)return;
  }
  if(mergeStatic){
   const staticEntries=[],lodEntries=[];
   for(const entry of entries){if(entry.level)lodEntries.push(entry);else staticEntries.push(entry);}
   if(staticEntries.length>=minMeshes){
    const subCells=new Map(),smallStatic=[];
    for(const entry of staticEntries){
     const sk=`${Math.floor((entry.worldX||0)/staticCellSize)}:${Math.floor((entry.worldZ||0)/staticCellSize)}`;
     let cell=subCells.get(sk);if(!cell){cell=[];subCells.set(sk,cell);}
     cell.push(entry);
    }
    for(const cell of subCells.values()){
     if(cell.length>=minMeshes){
      const mergedOk=yield* buildMergedStatic(cell);
      if(!mergedOk)for(const e of cell)lodEntries.push(e);
     }else{
      for(const e of cell)smallStatic.push(e);
     }
    }
    if(smallStatic.length>=minMeshes){
     const mergedOk=yield* buildMergedStatic(smallStatic);
     if(!mergedOk)for(const e of smallStatic)lodEntries.push(e);
    }else{
     for(const e of smallStatic)lodEntries.push(e);
    }
   }else{
    for(const e of staticEntries)lodEntries.push(e);
   }
   entries=lodEntries;
   if(entries.length<minMeshes)return;
  }
  // Instancing is core in WebGL2. Heterogeneous BatchedMesh still requires the
  // optional multi-draw path on r180 WebGL; leave those source meshes intact.
  if(!multiDraw||maxSimultaneousVisible(entries)<minMeshes)return;
  const geometries=[...new Set(entries.map(e=>e.object.geometry))],vertices=geometries.reduce((n,g)=>n+g.attributes.position.count,0),indices=geometries.reduce((n,g)=>n+(g.index?.count||0),0);
  if(vertices>maxVertices&&entries.length>minMeshes){const mid=Math.floor(entries.length/2);yield* build(entries.slice(0,mid));yield* build(entries.slice(mid));return;}
  const batch=new BatchedMesh(entries.length,vertices,indices||vertices*2,entries[0].object.material);
  allocated.add(batch);
  batch.name='Scenery batch '+pending.length;batch.perObjectFrustumCulled=true;batch.sortObjects=false;
  batch.castShadow=entries[0].object.castShadow;batch.receiveShadow=entries[0].object.receiveShadow;
  const geometryIds=new Map();
  for(const geometry of geometries){geometryIds.set(geometry,batch.addGeometry(geometry));yield;}
  for(const {object} of entries){
   const id=batch.addInstance(geometryIds.get(object.geometry));batch.setMatrixAt(id,localMatrix.multiplyMatrices(inverse,object.matrixWorld));yield;
  }
  batch.computeBoundingBox();batch.computeBoundingSphere();
  stage(entries,batch);yield;
 };
 for(const entries of groups.values())yield* build(entries);
 // Publish atomically. While yielding, the old scene stays intact and canceling
 // cannot leave invisible source meshes or stale LOD bindings behind.
 for(const {entries,batch,isStaticMesh} of pending)bind(entries,batch,isStaticMesh);
 for(const tracker of fullyInvariantTrackers){
  if(collapsedGroups.has(tracker.lodGroup))continue;
  collapsedGroups.add(tracker.lodGroup);
  for(let i=0;i<tracker.lodGroup.children.length;i++)tracker.lodGroup.children[i].visible=(i===0);
 }
 if(collapsedGroups.size){
  for(const root of roots){
   if(root.userData.staticVisualLods?.length){
    root.userData.staticVisualLods=root.userData.staticVisualLods.filter(lod=>!collapsedGroups.has(lod));
   }
  }
  for(const group of collapsedGroups)delete group.userData.visualLod;
 }
 if(batches){parent.add(container);container.updateWorldMatrix(true,true);container.traverse(object=>{object.matrixAutoUpdate=false;object.matrixWorldAutoUpdate=false;});container.userData.staticVisualLods=[];}
 committed=true;
 return {container,meshes,batches};
 }finally{if(!committed)releaseResources([...allocated,...ownedGeometries]);}
}
