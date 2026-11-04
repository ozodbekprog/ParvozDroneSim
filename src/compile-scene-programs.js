import {isBatchedScenerySource,shaderMaterialKey} from './scenery-batches.js';
import {Frustum,Matrix4} from 'three';
const pending=new WeakMap();
const compiledByRenderer=new WeakMap();
const yieldToBrowser=()=>globalThis.scheduler?.yield?.()||new Promise(resolve=>setTimeout(resolve,0));

function isolateVariant(parent,ancestors,target,lightAncestors,toggled){
 for(const child of parent.children){
  if(!child.visible)continue;
  if(child===target){
   toggled.push({node:child,visible:true,frustumCulled:child.frustumCulled});
   child.frustumCulled=false;
   if(child.children.length)isolateVariant(child,ancestors,target,lightAncestors,toggled);
  }else if(ancestors.has(child)||lightAncestors.has(child)){
   isolateVariant(child,ancestors,target,lightAncestors,toggled);
  }else{
   toggled.push({node:child,visible:true,frustumCulled:child.frustumCulled});
   child.visible=false;
  }
 }
}

/** Compile visible render-object variants in the actual scene-pass target.
 * Match r180's shadow/layout/matrix-binding distinctions. Only structurally
 * equivalent ordinary meshes can share a representative; hidden scenery stays
 * cold. No whole-map upload or inactive-LOD preparation is required. */
export function compileScenePrograms(scene,camera,compile,{now=()=>performance.now(),budgetMs=8,yieldTask=yieldToBrowser,isCurrent=()=>!scene.userData.disposed,cacheKey='',renderer=null}={}){
 if(pending.has(scene))return pending.get(scene);
 const task=(async()=>{
  const representatives=new Map(),lightAncestors=new Set(),lights=[];
  scene.updateMatrixWorld();camera.updateWorldMatrix(true,false);
  const frustum=new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera.coordinateSystem);
  scene.traverseVisible(object=>{
   if(object.isLight){lights.push(`${object.type}:${object.castShadow?1:0}`);for(let p=object;p&&p!==scene;p=p.parent)lightAncestors.add(p);return;}
   if(!object.isMesh||!object.geometry||!object.material||isBatchedScenerySource(object)||object.userData.collider||object.userData.excludedSceneryMarker||/^COLLIDER[_-]/i.test(object.name))return;
   if(object.frustumCulled&&!frustum.intersectsObject(object))return;
   const materials=Array.isArray(object.material)?object.material:[object.material];
   const geometry=object.geometry;
   const layout=Object.entries(geometry.attributes).sort().map(([name,a])=>[name,a.itemSize,a.normalized,(a.isInterleavedBufferAttribute?a.data.array:a.array).constructor.name,a.data?.stride||0,a.offset||0]);
   const bindings=object.isBatchedMesh?[object._matricesTexture.uuid,object._colorsTexture?.uuid]:object.isInstancedMesh||object.count>1?object.uuid:null;
   const key=JSON.stringify([object.isBatchedMesh===true,object.isInstancedMesh===true,object.isSkinnedMesh===true,bindings,object.receiveShadow,!!geometry.index,layout,object.skeleton?.bones.length,Object.entries(geometry.morphAttributes).sort().map(([n,a])=>[n,a.map(attribute=>attribute.id)]),materials.map(m=>shaderMaterialKey(m)||m.uuid)]);
   const cost=object.geometry.attributes.position?.count||Infinity,previous=representatives.get(key);
   if(!previous||cost<previous.cost)representatives.set(key,{object,cost});
  });
  let compiledSet=null;
  if(cacheKey&&representatives.size){
   const fullCacheKey=`${cacheKey}|env:${scene.environment?1:0}|lights:${lights.sort().join(',')}`;
   const owner=renderer||scene;
   let byScene=compiledByRenderer.get(owner);if(!byScene){byScene=new WeakMap();compiledByRenderer.set(owner,byScene);}
   let byTarget=byScene.get(scene);if(!byTarget){byTarget=new Map();byScene.set(scene,byTarget);}
   compiledSet=byTarget.get(fullCacheKey);if(!compiledSet){compiledSet=new Set();byTarget.set(fullCacheKey,compiledSet);}
  }
  const entries=representatives.size
   ? [...representatives.entries()].filter(([key])=>!compiledSet?.has(key)).map(([key,{object}])=>({key,object}))
   : [{key:'',object:null}];
  if(!entries.length)return 0;
  let sliceStart=now(),compiled=0;
  const compilations=[];
  try{for(let index=0;index<entries.length;index++){
   if(!isCurrent())break;
   const {key,object}=entries[index];
   // Shader building inside compileAsync is synchronous. Hide unrelated top-level
   // subtrees in O(depth) instead of walking thousands of inactive LOD nodes,
   // and restore the live scene before any asynchronous wait.
   const ancestors=new Set(),toggled=[];
   for(let p=object;p&&p!==scene;p=p.parent)ancestors.add(p);
   let compilation;
   try{
    isolateVariant(scene,ancestors,object,lightAncestors,toggled);
    compilation=compile();
   }finally{
    for(let i=toggled.length-1;i>=0;i--){const s=toggled[i];s.node.visible=s.visible;s.node.frustumCulled=s.frustumCulled;}
   }
   const job=Promise.resolve(compilation);
   if(compiledSet)job.then(()=>{compiledSet.add(key);},()=>{});
   else job.catch(()=>{});
   compilations.push(job);if(object)compiled++;
   if(index+1<entries.length&&now()-sliceStart>=budgetMs){await yieldTask();sliceStart=now();}
  }}finally{await Promise.all(compilations);}
  return compiled;
 })();pending.set(scene,task);task.finally(()=>pending.delete(scene)).catch(()=>{});return task;
}
