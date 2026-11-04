import test from 'node:test';
import assert from 'node:assert/strict';
import {archivedIronworks} from './helpers/ironworks-archive.js';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {sphereContacts} from '../shared/collision.js';
import {gateFrameBoxes} from '../shared/gates.js';
import {SoloSession} from '../src/solo-session.js';
import {GAMEPLAY_OBSTACLES} from '../shared/content.js';
import {createDroneState,defaultBuild,FIXED_DT} from '../shared/physics.js';
const read=p=>JSON.parse(archivedIronworks(p));
const archived='content/archived-maps/ironworks-v2/';
const race=read(archived+'.archive-content/races/ironworks-v2-loading-run/race.json');
const collision=read(archived+'collision.json');

test('Ironworks route and both loading portals have a continuous clear flight corridor',()=>{
  let previous=race.spawn.position;
  for(const [i,gate] of race.gates.entries()){
    for(let step=0;step<=100;step++){
      const p=gate.position.map((v,a)=>previous[a]+(v-previous[a])*step/100);
      assert.deepEqual(collision.flatMap(o=>sphereContacts(p,.32,o).map(()=>o.name)),[],`segment ${i}, sample ${step}`);
    }
    previous=gate.position;
  }
  for(const z of [-6,-12]){
    assert.equal(collision.flatMap(o=>sphereContacts([0,1.1,z],.32,o)).length,0,'portal centre clear');
    assert.ok(collision.flatMap(o=>sphereContacts([2,1.1,z],.1,o)).length>0,'portal masonry blocks flight');
  }
});

test('authored race arch bounds match collision envelope and keep signal material',async()=>{
  await MeshoptDecoder.ready;
  const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).readBinary(archivedIronworks(archived+'gate.glb'));
  assert.ok(doc.getRoot().listMaterials().some(m=>m.getName()==='Ironworks_gate_signal'));
  const mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];
  for(const node of doc.getRoot().listNodes())if(node.getMesh())for(const prim of node.getMesh().listPrimitives()){
    const attr=prim.getAttribute('POSITION'),p=[],m=node.getWorldMatrix();
    for(let i=0;i<attr.getCount();i++){
      attr.getElement(i,p);
      for(let a=0;a<3;a++){const v=m[a]*p[0]+m[4+a]*p[1]+m[8+a]*p[2]+m[12+a];mins[a]=Math.min(mins[a],v);maxs[a]=Math.max(maxs[a],v);}
    }
  }
  const boxes=gateFrameBoxes(race.gates[0]);
  for(let a=0;a<3;a++){
    const lo=Math.min(...boxes.map(b=>b.position[a]-b.size[a]/2)),hi=Math.max(...boxes.map(b=>b.position[a]+b.size[a]/2));
    assert.ok(Math.abs(mins[a]-lo)<.001,`axis ${a} min`);assert.ok(Math.abs(maxs[a]-hi)<.001,`axis ${a} max`);
  }
});

test('archived Ironworks preserves both courses and their missions for one-folder restoration',()=>{
 const map=read(archived+'map.json');assert.equal(map.tracks.length,2);
 for(const mission of map.bundledChallenges){assert.equal(mission.map,map.id);assert.ok(map.tracks.some(track=>track.id===mission.track));}
 const track=map.tracks.find(t=>t.id===race.id);assert.deepEqual(track.gates,race.gates);assert.deepEqual(track.spawn,race.spawn);
 assert.ok(map.garage.localOnly);assert.equal(map.garage.model,'archive-assets/liftoff-workbench.glb');
});
