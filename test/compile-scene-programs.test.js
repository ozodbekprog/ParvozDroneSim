import test from 'node:test';import assert from 'node:assert/strict';
import {Scene,Group,Mesh,BatchedMesh,InstancedMesh,BoxGeometry,PlaneGeometry,MeshStandardMaterial,PerspectiveCamera,DirectionalLight,PointLight,InterleavedBuffer,InterleavedBufferAttribute,BufferGeometry,Float32BufferAttribute,Texture} from 'three';
import {compileScenePrograms} from '../src/compile-scene-programs.js';

test('an empty mesh selection still prepares background output in the actual render target',async()=>{
 const scene=new Scene(),camera=new PerspectiveCamera(),marker=new Mesh(new PlaneGeometry(),new MeshStandardMaterial());marker.userData.collider=true;scene.add(marker);
 let calls=0;
 assert.equal(await compileScenePrograms(scene,camera,()=>{calls++;assert.equal(marker.visible,false);}),0);
 assert.equal(calls,1);assert.equal(marker.visible,true);
});

test('yielding shader preparation submits independent GPU work without serial waits',async()=>{
 const scene=new Scene(),camera=new PerspectiveCamera();camera.position.z=5;
 for(let i=0;i<2;i++){const mesh=new Mesh(new PlaneGeometry(),new MeshStandardMaterial({color:i+1}));mesh.frustumCulled=false;scene.add(mesh);}
 const finishes=[];
 const task=compileScenePrograms(scene,camera,()=>new Promise(resolve=>finishes.push(resolve)),{now:()=>0});
 assert.equal(finishes.length,2,'GPU compilation for one variant must not hold the next submission');
 finishes.forEach(finish=>finish());await task;
});

test('cold shader preparation yields between variants with the live scene restored',async()=>{
 const scene=new Scene(),camera=new PerspectiveCamera();camera.position.z=5;
 for(let i=0;i<6;i++){const mesh=new Mesh(new PlaneGeometry(),new MeshStandardMaterial({color:i+1}));mesh.frustumCulled=false;scene.add(mesh);}
 let clock=0,calls=0,yields=0;
 const count=await compileScenePrograms(scene,camera,()=>{calls++;assert.equal(scene.children.filter(o=>o.visible).length,1);clock+=12;return Promise.resolve();},{now:()=>clock,budgetMs:8,yieldTask:async()=>{yields++;assert.ok(scene.children.every(o=>o.visible));assert.ok(scene.children.every(o=>!o.frustumCulled));}});
 assert.equal(count,6);assert.equal(calls,6);assert.equal(yields,5,'each costly variant must allow input and painting before the next');
});

test('a scene replaced during a preparation yield does not compile more stale variants',async()=>{
 const scene=new Scene(),camera=new PerspectiveCamera();camera.position.z=5;
 for(let i=0;i<3;i++){const mesh=new Mesh(new PlaneGeometry(),new MeshStandardMaterial({color:i+1}));mesh.frustumCulled=false;scene.add(mesh);}
 let current=true,calls=0,clock=0,yields=0;
 await compileScenePrograms(scene,camera,()=>{calls++;clock+=12;},{now:()=>clock,budgetMs:8,yieldTask:async()=>{yields++;current=false;},isCurrent:()=>current});
 assert.equal(yields,1);assert.equal(calls,1);assert.ok(scene.children.every(o=>o.visible));
});
test('precompilation chooses the smallest visible source without warming distant or inactive levels',async()=>{
 const scene=new Scene(),material=new MeshStandardMaterial(),near=new Mesh(new BoxGeometry(),material),far=new Mesh(new PlaneGeometry(),material),lod=new Group();
 scene.add(near,lod);lod.add(far);const hidden=far.clone(),distant=far.clone();hidden.visible=false;distant.position.x=100;scene.add(hidden,distant);scene.updateMatrixWorld();const camera=new PerspectiveCamera();camera.position.z=5;
 const states=[near,far,lod].map(o=>[o.visible,o.frustumCulled]);
 assert.equal(await compileScenePrograms(scene,camera,async()=>{assert.equal(near.visible,false);assert.equal(lod.visible,true);assert.equal(far.visible,true);assert.equal(far.frustumCulled,false);assert.equal(hidden.visible,false);assert.equal(distant.visible,false);}),1);
 assert.deepEqual([near,far,lod].map(o=>[o.visible,o.frustumCulled]),states);assert.equal(far.parent,lod);
});
test('failed or overlapping preparation restores the live scene and never compiles collider markers',async()=>{
 const scene=new Scene(),mesh=new Mesh(new PlaneGeometry(),new MeshStandardMaterial()),collider=mesh.clone();collider.userData.collider=true;collider.visible=false;scene.add(mesh,collider);
 const camera=new PerspectiveCamera();camera.position.z=5;scene.updateMatrixWorld();
 let reject,started=0;const gate=new Promise((_,no)=>reject=no),compile=()=>{started++;assert.equal(collider.visible,false);return gate;};
 const a=compileScenePrograms(scene,camera,compile),b=compileScenePrograms(scene,camera,compile);assert.equal(a,b);assert.equal(started,1);reject(new Error('compiler failed'));
 await assert.rejects(a,/compiler failed/);assert.equal(mesh.visible,true);assert.equal(mesh.frustumCulled,true);assert.equal(collider.visible,false);
});
test('asynchronous shader completion never hides the live frame or overwrites a newer visibility change',async()=>{
 const scene=new Scene(),material=new MeshStandardMaterial(),large=new Mesh(new BoxGeometry(),material),small=new Mesh(new PlaneGeometry(),material);
 scene.add(large,small);const camera=new PerspectiveCamera();camera.position.z=5;let finish;
 const task=compileScenePrograms(scene,camera,()=>new Promise(resolve=>{finish=resolve;}));
 assert.equal(large.visible,true,'the game can render while the GPU compiler is pending');
 assert.equal(small.frustumCulled,true);
 small.visible=false;finish();await task;
 assert.equal(small.visible,false,'completion must not restore an obsolete LOD visibility snapshot');
});
test('preparation retains indexed, shadow-receiving and interleaved vertex-layout variants',async()=>{
 const scene=new Scene(),material=new MeshStandardMaterial(),camera=new PerspectiveCamera();camera.position.z=5;
 const indexed=new Mesh(new PlaneGeometry(),material),plain=new Mesh(indexed.geometry.toNonIndexed(),material),receiver=indexed.clone();receiver.receiveShadow=true;
 const interleaved=stride=>{const g=new BufferGeometry(),data=new InterleavedBuffer(new Float32Array(stride*3),stride);g.setAttribute('position',new InterleavedBufferAttribute(data,3,0));g.setAttribute('normal',new Float32BufferAttribute(new Float32Array(9),3));g.setAttribute('uv',new Float32BufferAttribute(new Float32Array(6),2));return new Mesh(g,material);};
 const a=interleaved(4),b=interleaved(5);for(const m of [indexed,plain,receiver,a,b]){m.frustumCulled=false;scene.add(m);}
 assert.equal(await compileScenePrograms(scene,camera,async()=>{}),5,'these have different r180 render-object pipeline keys');
});
test('each visible batch and instanced object warms its own matrix binding variant',async()=>{
 const scene=new Scene(),material=new MeshStandardMaterial(),geometry=new PlaneGeometry(),camera=new PerspectiveCamera();camera.position.z=5;
 for(let i=0;i<2;i++){
  const batch=new BatchedMesh(1,4,6,material);batch.addInstance(batch.addGeometry(geometry));batch.frustumCulled=false;scene.add(batch);
  const instances=new InstancedMesh(geometry,material,1);instances.frustumCulled=false;scene.add(instances);
 }
 const hidden=scene.children[0].clone();hidden.visible=false;scene.add(hidden);
 assert.equal(await compileScenePrograms(scene,camera,async()=>{}),4,'batch matrices and instance UUIDs are part of the renderer key');
 assert.equal(hidden.visible,false,'inactive batches must remain cold');
});

test('cacheKey skips already-warmed scene variants while keeping lights visible and compiling newly added aircraft',async()=>{
 const scene=new Scene(),camera=new PerspectiveCamera();camera.position.z=5;
 const lightGroup=new Group(),sun=new DirectionalLight('#ffffff',2);lightGroup.add(sun);scene.add(lightGroup);
 const environment=new Group(),envMesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial({color:0x445566}));envMesh.frustumCulled=false;environment.add(envMesh);scene.add(environment);
 let calls=0;
 const first=await compileScenePrograms(scene,camera,()=>{calls++;assert.equal(sun.visible,true);assert.equal(lightGroup.visible,true);},{cacheKey:'direct:1'});
 assert.equal(first,1);assert.equal(calls,1);
 assert.equal(await compileScenePrograms(scene,camera,()=>{calls++;},{cacheKey:'direct:1'}),0,'re-entering Hangar on the same scene must not recompile environment variants');
 assert.equal(calls,1);
 const drone=new Mesh(new PlaneGeometry(),new MeshStandardMaterial({color:0xffaa00}));drone.frustumCulled=false;scene.add(drone);
 const added=await compileScenePrograms(scene,camera,()=>{calls++;assert.equal(environment.visible,false,'whole environment subtree is hidden in O(1)');assert.equal(drone.visible,true);},{cacheKey:'direct:1'});
 assert.equal(added,1);assert.equal(calls,2);assert.equal(environment.visible,true);
 scene.add(new PointLight('#d9edff',0,2,1));
 assert.equal(await compileScenePrograms(scene,camera,()=>{calls++;},{cacheKey:'direct:1'}),2,'changing scene light topology invalidates cached shader variants');
 assert.equal(calls,4);
});

test('terrain tiles with distinct texture UUIDs but identical sampler state share one shader compilation',async()=>{
 const scene=new Scene(),camera=new PerspectiveCamera();camera.position.z=5;
 for(let i=0;i<12;i++){
  const tex=new Texture(),mat=new MeshStandardMaterial({map:tex,roughness:0.85});
  mat.userData.parvozSourceMaterial='tile-'+i;
  const mesh=new Mesh(new PlaneGeometry(),mat);mesh.frustumCulled=false;scene.add(mesh);
 }
 let calls=0;
 assert.equal(await compileScenePrograms(scene,camera,()=>{calls++;}),1);
 assert.equal(calls,1);
});
