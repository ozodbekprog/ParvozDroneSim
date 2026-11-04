import test from 'node:test';import assert from 'node:assert/strict';import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Matrix4} from 'three';
import {batchStaticScenery,setBatchLODVisible,sceneryMaterialKey} from '../src/scenery-batches.js';
import {updateVisualLODs} from '../src/visual-lod.js';
import {PerspectiveCamera} from 'three';

test('static batches preserve geometry and world transforms while keeping spatial culling',()=>{
 const scene=new Group(),root=new Group(),material=new MeshStandardMaterial({roughness:.8});scene.add(root);root.position.set(5,2,-4);
 const objects=[];for(let i=0;i<6;i++){const mesh=new Mesh(new BoxGeometry(1,2,1),material.clone());mesh.position.set(i<3?i:i+100,0,0);root.add(mesh);objects.push(mesh);}
 root.updateWorldMatrix(true,true);const expected=objects.map(o=>o.matrixWorld.clone());
 const result=batchStaticScenery([root],scene,{cellSize:64});assert.equal(result.meshes,6);assert.equal(result.batches,2);
 let index=0;for(const batch of result.container.children){assert.equal(batch.perObjectFrustumCulled,true);for(let i=0;i<batch.instanceCount;i++){const matrix=new Matrix4();batch.getMatrixAt(i,matrix);assert.deepEqual(matrix.elements,expected[index++].elements);}}
 assert.ok(objects.every(o=>!o.visible));
});
test('material state and transparency are preserved instead of merging incompatible surfaces',()=>{
 const a=new MeshStandardMaterial({roughness:.8}),b=a.clone();assert.equal(sceneryMaterialKey(a),sceneryMaterialKey(b));
 b.roughness=.2;assert.notEqual(sceneryMaterialKey(a),sceneryMaterialKey(b));
 b.transparent=true;assert.equal(sceneryMaterialKey(b),null);
 b.transparent=false;b.onBeforeCompile=()=>{};assert.equal(sceneryMaterialKey(b),null);
});
test('mesh parents stay visible so their unbatched children are preserved',()=>{
 const scene=new Group(),material=new MeshStandardMaterial(),parents=[];
 for(let i=0;i<3;i++){const parent=new Mesh(new BoxGeometry(),material);parent.add(new Mesh(new BoxGeometry(),new MeshStandardMaterial({transparent:true})));parents.push(parent);scene.add(parent);}
 const result=batchStaticScenery(parents,scene);assert.equal(result.meshes,0);assert.ok(parents.every(parent=>parent.visible&&parent.children[0].visible));
});
test('Low must not merge source materials whose normal maps will differ after switching quality',()=>{
 const a=new MeshStandardMaterial(),b=a.clone();
 a.userData.parvozSourceMaterial='original-a';b.userData.parvozSourceMaterial='original-b';
 assert.notEqual(sceneryMaterialKey(a),sceneryMaterialKey(b));
});
test('inactive LOD geometry is batched but toggles with its owning level',()=>{
 const scene=new Group(),root=new Group(),material=new MeshStandardMaterial();root.userData.visualLod={};scene.add(root);
 for(let i=0;i<2;i++){const level=new Group();level.visible=i===0;root.add(level);for(let j=0;j<3;j++)level.add(new Mesh(new BoxGeometry(),material));}
 const result=batchStaticScenery([root],scene);assert.equal(result.meshes,6);const batch=result.container.children[0];
 assert.deepEqual(Array.from({length:6},(_,i)=>batch.getVisibleAt(i)),[true,true,true,false,false,false]);
 setBatchLODVisible(root.children[0],false);setBatchLODVisible(root.children[1],true);
 assert.deepEqual(Array.from({length:6},(_,i)=>batch.getVisibleAt(i)),[false,false,false,true,true,true]);
 setBatchLODVisible(root.children[1],false);assert.equal(batch.visible,false,'inactive batches cannot submit shaders or uniforms');
 setBatchLODVisible(root.children[1],false);assert.equal(batch.visible,false,'repeated updates do not corrupt the active count');
 setBatchLODVisible(root.children[0],true);assert.equal(batch.visible,true,'a returning LOD reactivates its batch');
});
test('an LOD level which is itself a mesh never reappears on top of its batch',()=>{
 const scene=new Group(),material=new MeshStandardMaterial(),levels=[];
 for(let i=0;i<3;i++){const root=new Group();root.userData.visualLod={distances:[0,10],minimumLow:1,active:-1};scene.add(root);
  for(let j=0;j<2;j++){const level=new Mesh(new BoxGeometry(),material);level.visible=j===0;root.add(level);levels.push(level);}}
 const result=batchStaticScenery([...scene.children],scene);assert.equal(result.meshes,6);
 const camera=new PerspectiveCamera();updateVisualLODs(scene,camera,{low:true});assert.ok(levels.every(level=>!level.visible));
 const batch=result.container.children[0];assert.equal(Array.from({length:6},(_,i)=>batch.getVisibleAt(i)).filter(Boolean).length,3);
});
test('mergeStatic collapses identical-geometry LOD chunks into single static meshes and skips 1-tile LOD batches',()=>{
 const scene=new Group(),root=new Group(),horizonMat=new MeshStandardMaterial({roughness:.9});
 scene.add(root);root.userData.staticVisualLods=[];
 const horizonLods=[];
 for(let i=0;i<4;i++){
  const lod=new Group();lod.userData.visualLod={distances:[0,16,22],minimumLow:1,active:0};
  lod.position.set(i*10,0,0);
  const geom=new BoxGeometry(2+i*0.5,1,2);
  for(let l=0;l<3;l++){
   const level=new Group();level.visible=l===0;
   level.add(new Mesh(geom,horizonMat.clone()));
   lod.add(level);
  }
  root.add(lod);root.userData.staticVisualLods.push(lod);horizonLods.push(lod);
 }
 // Also add a single terrain tile with 3 mutually-exclusive LODs of unique material
 const uniqueTileMat=new MeshStandardMaterial({roughness:.45});
 uniqueTileMat.userData.parvozSourceMaterial='tile-0-0';
 const tileLod=new Group();tileLod.userData.visualLod={distances:[0,16,22],minimumLow:1,active:0};
 for(let l=0;l<3;l++){
  const level=new Group();level.visible=l===0;
  level.add(new Mesh(new BoxGeometry(4,1,4,l===0?4:1,1,1),uniqueTileMat));
  tileLod.add(level);
 }
 root.add(tileLod);root.userData.staticVisualLods.push(tileLod);
 const result=batchStaticScenery([root],scene,{instancing:true,multiDraw:true,mergeStatic:true,cellSize:2048});
 assert.equal(result.batches,1,'4 identical-LOD chunks merge into 1 static Mesh while 1-tile LOD stays unbatched');
 assert.equal(result.meshes,4);
 assert.equal(result.container.children[0].isMesh,true);
 assert.equal(result.container.children[0].isBatchedMesh,undefined);
 assert.equal(root.userData.staticVisualLods.length,1,'collapsed identical-LOD chunks are removed from per-frame LOD updates');
 assert.equal(root.userData.staticVisualLods[0],tileLod);
 assert.equal(tileLod.children[0].children[0].visible,true,'unbatched 1-tile LOD remains visible');
});
test('mergeStatic handles canceling cTrans child offsets, multi-mesh chunks, and 768m static sub-cells',()=>{
 const scene=new Group(),root=new Group(),horizonMat=new MeshStandardMaterial({roughness:.85}),treeMat=new MeshStandardMaterial({roughness:.7});
 scene.add(root);root.userData.staticVisualLods=[];
 const sharedTreeGeom=new BoxGeometry(1,4,1);
 for(let q=0;q<2;q++){
  for(let i=0;i<3;i++){
   const chunkX=q*900+i*20;
   const lod=new Group();lod.userData.visualLod={distances:[0,16,22],minimumLow:1,active:0};
   lod.position.set(chunkX,0,0);
   const uniquePatchGeom=new BoxGeometry(3+i*.25+q*.1,1,3);
   for(let l=0;l<3;l++){
    const level=new Group();level.visible=l===0;
    const patch=new Mesh(uniquePatchGeom,horizonMat);
    patch.position.set(-chunkX,0,0); // local cTrans offset shared across LOD0/1/2
    const patchWrap=new Group();patchWrap.position.set(chunkX,0,0);patchWrap.add(patch);
    const tree=new Mesh(sharedTreeGeom,treeMat);
    level.add(patchWrap,tree);
    lod.add(level);
   }
   root.add(lod);root.userData.staticVisualLods.push(lod);
  }
 }
 const result=batchStaticScenery([root],scene,{instancing:true,multiDraw:true,mergeStatic:true,cellSize:2048,staticCellSize:768});
 // 6 trees share 1 SceneryInstances across the 2048m cell; 6 unique patches split into 2 static 768m sub-cell Meshes
 assert.equal(result.batches,3);
 assert.equal(result.meshes,12);
 assert.equal(root.userData.staticVisualLods.length,0,'all 6 fully-invariant chunks collapsed out of per-frame LOD updates');
});
