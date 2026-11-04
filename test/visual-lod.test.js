import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Mesh, MeshBasicMaterial, Group, PerspectiveCamera } from 'three';
import { selectLODIndex, loadVisualLOD, updateVisualLODs, findPartMounts } from '../src/visual-lod.js';
import { validateCatalog } from '../shared/catalog-schema.js';
import source from '../public/content/catalog.json' with { type:'json' };

test('LOD preserves a minimum Low detail level and uses hysteresis on return',()=>{
  assert.equal(selectLODIndex([0,12,40],0,1),1);
  assert.equal(selectLODIndex([0,12,40],41,0,1),1);
  assert.equal(selectLODIndex([0,12,40],46,0,1),2);
  assert.equal(selectLODIndex([0,12,40],38,0,2),2);
  assert.equal(selectLODIndex([0,12,40],34,0,2),1);
});
test('large static chunks keep native detail beside the floor instead of measuring from canopy centre',async()=>{
  const group=await loadVisualLOD({modelLods:[{model:'near',distance:0},{model:'far',distance:20}],lowLod:1},async()=>new Mesh(new BoxGeometry(32,80,32),new MeshBasicMaterial()),()=>{});
  group.position.y=40;const camera=new PerspectiveCamera();camera.position.set(0,1,0);
  updateVisualLODs(group,camera);assert.equal(group.children[0].visible,true);
  updateVisualLODs(group,camera,{low:true});assert.equal(group.children[1].visible,true,'Low keeps its intentional minimum');
  camera.position.x=100;updateVisualLODs(group,camera);assert.equal(group.children[1].visible,true);
});
test('LOD load is atomic, frees successful levels after failure, and preserves legacy loading',async()=>{
  const discarded=[]; const good=new Group();
  await assert.rejects(loadVisualLOD({modelLods:[{model:'ok'},{model:'bad'}]},url=>url==='ok'?Promise.resolve(good):Promise.reject(new Error('missing')),model=>discarded.push(model)),/missing/);
  assert.deepEqual(discarded,[good]);
  assert.equal(await loadVisualLOD({model:'legacy'},async()=>good,()=>{}),good);
});
test('preview shows full detail and mount bindings survive all loaded levels',async()=>{
  const root=await loadVisualLOD({modelLods:[{model:'near',distance:0},{model:'far',distance:20}],lowLod:1},async()=>{const group=new Group(),mount=new Group();mount.name='camera_mount';group.add(mount);return group;},()=>{});
  const camera=new PerspectiveCamera();camera.position.z=2;
  updateVisualLODs(root,camera,{low:true});assert.equal(root.children[1].visible,true);
  updateVisualLODs(root,camera,{low:true,preview:true});assert.equal(root.children[0].visible,true);
  assert.equal(findPartMounts(root,{mounts:{camera:['camera_mount']}},'camera').length,2);
  assert.throws(()=>findPartMounts(root,{mounts:{camera:['missing']}},'camera'),/Missing/);
  root.children[1].children[0].name='wrong_mount';
  assert.throws(()=>findPartMounts(root,{mounts:{camera:['camera_mount']}},'camera'),/Missing/);
});
test('catalog rejects LOD ordering and incomplete rotor mounts',()=>{
  const catalog=structuredClone(source),drone=catalog.drones.find(d=>d.id==='kestrel');
  drone.model='/content/assets/drone.glb';drone.modelLods=[{model:drone.model,distance:0},{model:'/content/assets/far.glb',distance:20}];drone.lowLod=1;
  assert.equal(validateCatalog(catalog),catalog);
  drone.modelLods[1].distance=0;assert.throws(()=>validateCatalog(catalog),/distances/);drone.modelLods[1].distance=20;
  drone.mounts={motors:['only_one']};assert.throws(()=>validateCatalog(catalog),/mount count/);
});

test('Kestrel interchangeable nodes share one delivery URL per LOD',()=>{
  const drone=source.drones.find(d=>d.id==='kestrel'),parts=source.parts.filter(p=>p.model&&p.compatibleDrones?.includes('kestrel'));
  assert.equal(parts.length,10);
  for(const part of parts){assert.equal(part.model,drone.model);assert.deepEqual(part.modelLods,drone.modelLods);assert.match(part.modelNode,/^Template_Part_/);}
  assert.equal(new Set(parts.flatMap(p=>p.modelLods.map(l=>l.model))).size,3);
});

test('every other drone loads its own asset rather than inheriting Kestrel LODs',async()=>{
  for(const drone of source.drones.filter(d=>d.id!=='kestrel')){
    if(!drone.model){assert.equal(drone.modelLods,undefined,'legacy procedural drones must retain their own loading path');assert.equal(drone.mounts,undefined);continue;}
    const urls=[];await loadVisualLOD(drone,async url=>{urls.push(url);return new Group();},()=>{});
    assert.ok(urls.every(url=>url.startsWith('/content/assets/drones/'+drone.id+'/')),drone.id+' must load its own authored package');
    for(const lod of drone.modelLods||[])assert.ok(!lod.model.includes('/kestrel/'),'LODs must belong to '+drone.id);
    for(const name of Object.values(drone.mounts||{}).flat())assert.ok(!name.startsWith('Template_'),'attachment names must belong to '+drone.id);
  }
});

test('spatial map LOD can select different named nodes from one shared GLB',async()=>{
  const calls=[];
  const group=await loadVisualLOD({modelLods:[{model:'site.glb',modelNode:'near',distance:0},{model:'site.glb',modelNode:'far',distance:72}],lowLod:1},async(url,name)=>{calls.push([url,name]);const result=new Group();result.name=name;return result;},()=>{});
  assert.deepEqual(calls,[['site.glb','near'],['site.glb','far']]);assert.deepEqual(group.children.map(o=>o.name),['near','far']);
});

test('graphics distance multiplier changes LOD thresholds without changing transforms',async()=>{
  const group=await loadVisualLOD({modelLods:[{model:'near',distance:0},{model:'far',distance:20}]},async()=>new Group(),()=>{});
  const camera=new PerspectiveCamera();camera.position.z=30;
  updateVisualLODs(group,camera,{distanceScale:1});assert.equal(group.children[1].visible,true);
  updateVisualLODs(group,camera,{distanceScale:2});assert.equal(group.children[0].visible,true);
  assert.deepEqual(group.position.toArray(),[0,0,0]);
});

test('maximum detail distance does not downgrade a visible object when the pilot looks aside',async()=>{
  const group=await loadVisualLOD({modelLods:[{model:'near',distance:0},{model:'far',distance:20}]},async()=>new Mesh(new BoxGeometry(8,8,8),new MeshBasicMaterial()),()=>{});
  const camera=new PerspectiveCamera(105,16/9,.1,1000);camera.position.set(0,0,60);
  for(const yaw of [0,.25,-.25,.6,0]){
    camera.rotation.y=yaw;camera.updateMatrixWorld(true);
    updateVisualLODs(group,camera,{distanceScale:4});
    assert.equal(group.children[0].visible,true);
    assert.equal(group.children[1].visible,false);
  }
});

test('stadium-sized chunks retain native detail while still large in the view on High',async()=>{
  // Arena uses 16/22 m cutovers even for ~125 m grandstand chunks.
  const root=await loadVisualLOD({modelLods:[{model:'near',distance:0},{model:'mid',distance:16},{model:'far',distance:22}],lowLod:1},async()=>new Mesh(new BoxGeometry(112,37,125),new MeshBasicMaterial()),()=>{});
  const camera=new PerspectiveCamera(105,16/9,.02,1500);camera.position.set(0,0,112.5);
  updateVisualLODs(root,camera,{distanceScale:1.5});
  assert.equal(root.userData.visualLod.active,0,'50 m from a 125 m grandstand must not select the atlas');
  camera.position.z=500;updateVisualLODs(root,camera,{distanceScale:1.5});
  assert.equal(root.userData.visualLod.active,2,'distant scenery must still downgrade');
  camera.position.z=65;updateVisualLODs(root,camera,{low:true,distanceScale:.75});
  assert.equal(root.userData.visualLod.active,2,'the Low geometry budget remains independent');
});

test('LOD footprint follows world scale while small aircraft keep authored distances',async()=>{
  const make=()=>loadVisualLOD({modelLods:[{model:'near',distance:0},{model:'far',distance:20}]},async()=>new Mesh(new BoxGeometry(1,1,1),new MeshBasicMaterial()),()=>{});
  const camera=new PerspectiveCamera();camera.position.z=40;
  const drone=await make();updateVisualLODs(drone,camera);assert.equal(drone.userData.visualLod.active,1);
  const landmark=await make();landmark.scale.setScalar(100);camera.position.z=100;
  updateVisualLODs(landmark,camera,{distanceScale:1.5});assert.equal(landmark.userData.visualLod.active,0);
});
