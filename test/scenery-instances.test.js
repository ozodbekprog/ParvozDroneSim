import test from 'node:test';import assert from 'node:assert/strict';
import {Group,Mesh,InstancedMesh,PlaneGeometry,SphereGeometry,MeshStandardMaterial,Uint8BufferAttribute,PerspectiveCamera,Matrix4,Color,BufferGeometry,InterleavedBuffer,InterleavedBufferAttribute} from 'three';
import {instanceDescription} from '../src/scenery-instances.js';
import {batchStaticScenery,setBatchLODVisible} from '../src/scenery-batches.js';
function fixture(){const root=new Group(),material=new MeshStandardMaterial({vertexColors:true}),base=new PlaneGeometry(),objects=[];
 for(let i=0;i<6;i++){const geometry=new PlaneGeometry();for(const [key,a] of Object.entries(base.attributes))geometry.setAttribute(key,a);geometry.setIndex(base.index);const color=new Uint8BufferAttribute(Array.from({length:4},()=>[100+i*20,100+i*20,100+i*20,255]).flat(),4,true);geometry.setAttribute('color',color);const mesh=new Mesh(geometry,material);mesh.position.set(i<3?i:i+100,0,-5);root.add(mesh);objects.push(mesh);}return{root,objects};}

test('unrelated non-indexed interleaved geometry never shares an instance prototype',()=>{
 const first=new BufferGeometry(),second=new BufferGeometry();
 first.setAttribute('position',new InterleavedBufferAttribute(new InterleavedBuffer(new Float32Array([0,0,0,1,0,0,0,1,0]),3),3,0));
 second.setAttribute('position',new InterleavedBufferAttribute(new InterleavedBuffer(new Float32Array([0,0,0,10,0,0,0,10,0]),3),3,0));
 assert.equal(first.attributes.position.id,undefined);assert.equal(second.attributes.position.id,undefined);
 assert.notEqual(instanceDescription(first).key,instanceDescription(second).key);
});

test('without multi-draw repeated instances render while heterogeneous meshes remain ordinary and visible',()=>{
 const {root,objects}=fixture(),material=objects[0].material,unique=[];
 for(let i=0;i<3;i++){const object=new Mesh(new PlaneGeometry(1+i,1),material);object.position.set(i,0,-8);root.add(object);unique.push(object);}
 const result=batchStaticScenery([root],root,{instancing:true,multiDraw:false});
 assert.equal(result.batches,1);assert.ok(result.container.children.every(object=>object.isInstancedMesh));
 assert.equal(result.meshes,6);assert.ok(objects.every(object=>!object.visible));assert.ok(unique.every(object=>object.visible));
});
test('uniform source vertex colors become exact instance tints with unchanged geometry and transforms',()=>{
 const {root,objects}=fixture(),expected=objects.map(o=>o.position.clone());
 const result=batchStaticScenery([root],root,{instancing:true,cellSize:512});const batch=result.container.children.find(o=>o.isInstancedMesh);
 assert.ok(batch,'WebGPU needs a real instanced draw');assert.equal(batch.geometry.attributes.color,undefined);assert.equal(batch.material.vertexColors,true);
 for(let i=0;i<6;i++){const m=new Matrix4(),color=new Color();batch.getMatrixAt(i,m);assert.deepEqual(m.elements.slice(12,15),expected[i].toArray());batch.getColorAt(i,color);assert.ok(Math.abs(color.r-(100+i*20)/255)<1e-7);}
});
test('instance packing preserves per-object frustum culling and reuses uploads for an unchanged view',()=>{
 const {root}=fixture(),result=batchStaticScenery([root],root,{instancing:true}),batch=result.container.children.find(o=>o.isInstancedMesh),camera=new PerspectiveCamera(70,1,.1,1000);
 root.updateMatrixWorld();camera.updateMatrixWorld();const localMatrix=batch.matrix.clone();batch.onBeforeRender(null,root,camera);assert.equal(batch.count,3);const version=batch.instanceMatrix.version;
 assert.deepEqual(batch.matrix.elements,localMatrix.elements,'culling must not overwrite the batch object transform');
 batch.onBeforeRender(null,root,camera);assert.equal(batch.instanceMatrix.version,version);
 camera.position.x=100;camera.updateMatrixWorld();batch.onBeforeRender(null,root,camera);assert.equal(batch.count,2);
 assert.ok(batch.instanceMatrix.version>version);assert.ok(batch.instanceMatrix.array[12]>=100);
 camera.position.x=300;camera.updateMatrixWorld();batch.onBeforeRender(null,root,camera);assert.equal(batch.count,0);
 camera.position.x=0;camera.updateMatrixWorld();batch.onBeforeShadow(null,null,null,camera);assert.equal(batch.count,3);
 batch.onBeforeRender(null,root,camera);assert.equal(batch.count,3,'returning from a shadow/empty view restores visible source instances');
});
test('LOD changes hide and restore instanced leaves without reviving source meshes',()=>{
 const {root,objects}=fixture();root.userData.visualLod={};const a=new Group(),b=new Group();root.add(a,b);objects.forEach((o,i)=>(i<3?a:b).add(o));b.visible=false;
 const result=batchStaticScenery([root],root,{instancing:true}),batch=result.container.children.find(o=>o.isInstancedMesh);
 assert.deepEqual(Array.from({length:6},(_,i)=>batch.getVisibleAt(i)),[true,true,true,false,false,false]);
 setBatchLODVisible(a,false);setBatchLODVisible(b,true);assert.equal(batch.visible,true);assert.deepEqual(Array.from({length:6},(_,i)=>batch.getVisibleAt(i)),[false,false,false,true,true,true]);
 setBatchLODVisible(b,false);assert.equal(batch.visible,false);assert.ok(objects.every(o=>!o.visible));
});
test('nonuniform vertex painting and vertex alpha are never discarded for instancing',()=>{
 for(const variation of ['painting','alpha']){const {root,objects}=fixture();for(const o of objects){if(variation==='painting')o.geometry.attributes.color.setX(1,.01);else o.geometry.attributes.color.setW(0,.5);}
  const result=batchStaticScenery([root],root,{instancing:true});assert.ok(result.container.children.every(o=>!o.isInstancedMesh||o.geometry.hasAttribute('color')));
 }
});
test('mutually exclusive LODs at the same placement stay in multi-geometry batches',()=>{
 const {root,objects}=fixture();for(const o of objects)o.position.set(0,0,-5);
 const result=batchStaticScenery([root],root,{instancing:true});assert.ok(result.container.children.every(o=>!o.isInstancedMesh));
});
test('source colors ignored by the original material do not tint its instances',()=>{
 const {root,objects}=fixture();objects[0].material.vertexColors=false;
 const result=batchStaticScenery([root],root,{instancing:true}),batch=result.container.children.find(o=>o.isInstancedMesh);
 for(let i=0;i<6;i++){const color=new Color();batch.getColorAt(i,color);assert.deepEqual(color.toArray(),[1,1,1]);}
});
test('changing a source transform or tint invalidates its packed view',()=>{
 const {root}=fixture(),{container}=batchStaticScenery([root],root,{instancing:true}),batch=container.children.find(o=>o.isInstancedMesh),camera=new PerspectiveCamera(70,1,.1,1000);
 root.updateMatrixWorld();camera.updateMatrixWorld();batch.onBeforeRender(null,root,camera);
 batch.setMatrixAt(0,new Matrix4().makeTranslation(200,0,-5));batch.setColorAt(1,new Color(.1,.2,.3));batch.onBeforeRender(null,root,camera);
 assert.equal(batch.count,2);assert.equal(batch.instanceMatrix.array[12],1);assert.ok(Math.abs(batch.instanceColor.array[0]-.1)<1e-7);
});
test('per-chunk glTF InstancedMesh nodes merge across spatial chunks with LOD toggling and sub-pixel distance culling',()=>{
 const root=new Group(),material=new MeshStandardMaterial(),fernGeo=new SphereGeometry(.3,6,4),treeGeo=new SphereGeometry(6,6,4);
 const lodRoot=new Group();lodRoot.userData.visualLod={};const near=new Group(),far=new Group();far.visible=false;lodRoot.add(near,far);root.add(lodRoot);
 for(let chunk=0;chunk<3;chunk++){
  const ferns=new InstancedMesh(fernGeo,material,2);ferns.position.set(chunk*4,0,0);
  ferns.setMatrixAt(0,new Matrix4().makeTranslation(0,0,-20));ferns.setMatrixAt(1,new Matrix4().makeTranslation(0,0,-400));
  near.add(ferns);
  const trees=new InstancedMesh(treeGeo,material,2);trees.position.set(chunk*4,0,0);
  trees.setMatrixAt(0,new Matrix4().makeTranslation(0,0,-20));trees.setMatrixAt(1,new Matrix4().makeTranslation(0,0,-400));
  far.add(trees);
 }
 const result=batchStaticScenery([root],root,{instancing:true,cellSize:512});
 assert.equal(result.batches,2,'3 fern chunks and 3 tree chunks consolidate into 2 cell-wide SceneryInstances');
 const [fernBatch,treeBatch]=result.container.children;
 const camera=new PerspectiveCamera(70,1,.1,3000);root.updateMatrixWorld();camera.updateMatrixWorld();
 fernBatch.onBeforeRender(null,root,camera);
 assert.equal(fernBatch.count,3,'0.3m ferns at 20m render while 0.3m ferns at 400m are angular-size culled');
 setBatchLODVisible(near,false);setBatchLODVisible(far,true);
 assert.equal(fernBatch.visible,false);assert.equal(treeBatch.visible,true);
 treeBatch.onBeforeRender(null,root,camera);
 assert.equal(treeBatch.count,6,'6m trees remain visible at both 20m and 400m');
});
