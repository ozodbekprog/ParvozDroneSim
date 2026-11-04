import test from 'node:test';
import assert from 'node:assert/strict';
import {archivedIronworks} from './helpers/ironworks-archive.js';
import {Document,Accessor} from '@gltf-transform/core';
import {instance} from '@gltf-transform/functions';
import {sphereContacts,collisionCandidates} from '../shared/collision.js';
import {restoreStaticModelRoots} from '../tools/static-model-roots.js';
const read=p=>JSON.parse(archivedIronworks(p));

test('Ironworks is a complete 300 x 240 m site with distributed areas and shared spatial LOD',()=>{
  const map=read('content/archived-maps/ironworks-v2/map.json');
  assert.deepEqual(map.siteSizeMetres,[300,240]);assert.ok(map.zones.length>=7);
  assert.equal(map.bounds.max[0]-map.bounds.min[0],300);assert.equal(map.bounds.max[2]-map.bounds.min[2],240);
  assert.ok(map.objects.length>=20);
  for(const object of map.objects){assert.equal(object.model,map.model);assert.equal(object.lowLod,1);assert.equal(object.modelLods.length,3);assert.equal(new Set(object.modelLods.map(l=>l.modelNode)).size,3);}
});
test('full-site route has clear foundry and depot portals and spans the industrial site',()=>{
  const race=read('content/archived-maps/ironworks-v2/.archive-content/races/ironworks-v2-site-run/race.json'),collision=read('content/archived-maps/ironworks-v2/collision.json');
  assert.ok(race.routeLengthMetres>=900);assert.ok(race.gates.length>=25);
  let prior=race.spawn.position;
  for(const [index,gate] of race.gates.entries()){
    const steps=Math.ceil(Math.hypot(...gate.position.map((v,a)=>v-prior[a]))*4);
    for(let n=0;n<=steps;n++){
      const p=gate.position.map((v,a)=>prior[a]+(v-prior[a])*n/steps);
      const contacts=collisionCandidates(collision,p,.32).filter(o=>sphereContacts(p,.32,o).length);
      assert.deepEqual(contacts.map(o=>o.name),[],`segment ${index}, sample ${n}, position ${p}`);
    }
    prior=gate.position;
  }
});
test('GPU instance batches stay inside their named spatial selector with world transforms preserved',async()=>{
  const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(),name='SiteChunk_00_LOD1';
  const parent=doc.createNode(name).setTranslation([0,2,0]);scene.addChild(parent);doc.getRoot().setDefaultScene(scene);
  const position=doc.createAccessor().setType(Accessor.Type.VEC3).setArray(new Float32Array([0,0,0,1,0,0,0,1,0])).setBuffer(buffer);
  const mesh=doc.createMesh(name+' wall').addPrimitive(doc.createPrimitive().setAttribute('POSITION',position));
  const points=[[-4,0,0],[0,0,0],[4,0,0]];
  for(const p of points)parent.addChild(doc.createNode().setMesh(mesh).setTranslation(p));
  await doc.transform(instance({min:2}));restoreStaticModelRoots(doc,[name]);
  const selected=doc.getRoot().listNodes().filter(n=>n.getName()===name);assert.equal(selected.length,1);
  const batches=selected[0].listChildren().filter(n=>n.getExtension('EXT_mesh_gpu_instancing'));assert.equal(batches.length,1);
  const translations=batches[0].getExtension('EXT_mesh_gpu_instancing').getAttribute('TRANSLATION');
  assert.deepEqual(Array.from(translations.getArray()),[-4,2,0,0,2,0,4,2,0]);
  assert.ok(!scene.listChildren().includes(batches[0]));
});
