import test from'node:test';import assert from'node:assert/strict';import{existsSync}from'node:fs';import{NodeIO}from'@gltf-transform/core';
const source='data/liftoff-drone-recovery/track-assets/mesh-1cfa32d694bbf96c.glb',key=p=>p.map(v=>Math.round(v*1e5)).join(',');
test('Luma atlas UVs retain the original mesh coordinates instead of a second V inversion',{skip:!existsSync(source)},async()=>{
 const io=new NodeIO(),original=await io.read(source),expected=new Map();
 for(const mesh of original.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
  const p=primitive.getAttribute('POSITION'),uv=primitive.getAttribute('TEXCOORD_0'),x=[],y=[];
  if(!uv)continue;
  for(let i=0;i<p.getCount();i++){p.getElement(i,x);uv.getElement(i,y);const k=key(x);if(!expected.has(k))expected.set(k,[]);expected.get(k).push([...y]);}
 }
 const actual=await io.read('content/drones/luma-5/model.glb'),node=actual.getRoot().listNodes().find(n=>n.getName()==='Frame_Luma5Frame01_0');
 let checked=0;
 for(const primitive of node.getMesh().listPrimitives()){
  const p=primitive.getAttribute('POSITION'),uv=primitive.getAttribute('TEXCOORD_0'),x=[],y=[];
  for(let i=0;i<p.getCount();i++){p.getElement(i,x);uv.getElement(i,y);const e=expected.get(key(x));if(!e)continue;checked++;assert.ok(e.some(v=>Math.abs(v[0]-y[0])<1e-4&&Math.abs(v[1]-y[1])<1e-4),'authored atlas correspondence');}
 }
 assert.ok(checked>1000,'must compare actual authored vertices');
});
test('Luma battery follows the native child SnapPoint rather than stale serialized rotation',async()=>{
 const d=await new NodeIO().read('content/drones/luma-5/model.glb');
 const mount=d.getRoot().listNodes().find(n=>n.getName()==='mount_battery'),m=mount.getWorldMatrix();
 assert.ok(Math.abs(m[12])<1e-6);assert.ok(Math.abs(m[13]-.043367903)<1e-6);assert.ok(Math.abs(m[14]+.016500005)<1e-6);
 for(const i of [0,5,10])assert.ok(Math.abs(m[i]-1)<1e-6,'native root orientation');
 const battery=d.getRoot().listNodes().find(n=>n.getName()==='Battery_TattuRline6SBattery01_0');assert.ok(battery?.getMesh());
});
