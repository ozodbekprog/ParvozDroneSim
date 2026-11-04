import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DRONES,PARTS,defaultBuild,resolveBuild} from '../shared/physics.js';
import {cleanBuild} from '../shared/drone-fleet.js';
import {workbenchParts} from '../src/workbench-parts.js';
import {isPartCompatible,canUseActionCamera} from '../shared/part-compatibility.js';
import {Group,Matrix4} from 'three';
import {applyDroneConfiguration,clearDroneConfiguration,applyNativeSlotTransforms} from '../src/drone-configuration.js';
import {nativeSlotTransform} from '../tools/native-slot-transform.js';

test('native slot transforms compose parent and child SnapPoint, mirror Unity X and ignore stale serialized offsets',()=>{
 const records=[{id:'root',type:'GameObject',data:{m_Name:'Frame'}},{id:'slot',type:'GameObject',data:{m_Name:'AntennaSlot'}},{id:'snap',type:'GameObject',data:{m_Name:'SnapPoint'}}];
 const transform=(id,go,parent,x,y,z,children=[])=>({id,type:'Transform',data:{m_GameObject:{m_PathID:go},m_Father:{m_PathID:parent},m_LocalPosition:{m_X:x,m_Y:y,m_Z:z},m_LocalRotation:{m_W:1,m_X:0,m_Y:0,m_Z:0},m_LocalScale:{m_X:1,m_Y:1,m_Z:1},m_Children:children.map(m_PathID=>({m_PathID}))}});
 records.push(transform('t0','root','0',100,0,0),transform('t1','slot','t0',.1,.2,.3,['t2']),transform('t2','snap','t1',.01,.02,.03));
 const position=nativeSlotTransform(records,'root','slot').slice(12,15);
 for(const [i,n] of [-.11,.22,.33].entries())assert.ok(Math.abs(position[i]-n)<1e-8);
 records.find(r=>r.id==='t1').data.m_Children=[];
 assert.ok(Math.abs(nativeSlotTransform(records,'root','slot')[12]+.1)<1e-8);
});

test('workbench and saved builds enforce native antenna slots, including Luma whitelist and Gecko blank',()=>{
 const expected={'luma-5':1,'armattan-chameleon':4,'dquad-addiction':4,'armattan-gecko':1,kestrel:1};
 for(const [id,count] of Object.entries(expected)){
  const drone=DRONES[id],build=defaultBuild(id),offered=workbenchParts(build,drone,'antenna',PARTS.antenna);
  assert.equal(offered.length,count,id);
  for(const part of PARTS.antenna){
   const next=cleanBuild({...build,antenna:part.id},id),resolved=resolveBuild({...build,antenna:part.id});
   const expected=isPartCompatible(drone,'antenna',part)?part.id:build.antenna;
   assert.equal(next.antenna,expected);assert.equal(resolved.antennaId,expected);
  }
 }
 const build=defaultBuild('dquad-addiction'),stock=resolveBuild(build),alt=PARTS.antenna.find(p=>p.sourcePartId==='AntennaPagodaCircular01'),changed=resolveBuild({...build,antenna:alt.id});
 assert.ok(Math.abs(changed.mass-stock.mass-(alt.sourceSpecs.weight-DRONES[build.drone].sourcePhysics.antenna.specifications.weight))<1e-10);
 assert.notDeepEqual(changed.inertia,stock.inertia);
});

test('native camera restrictions cannot be bypassed by a saved selection',()=>{
  for(const id of ['armattan-gecko','dquad-addiction']){
    const drone=DRONES[id],wrong=PARTS.camera.find(p=>p.sourcePartId==='CameraFibonacci01');
    const input={...defaultBuild(id),camera:wrong.id};
    assert.equal(resolveBuild(input).cameraId,drone.stockParts.camera);
    assert.equal(cleanBuild(input,id).camera,drone.stockParts.camera);
    assert.deepEqual(workbenchParts(input,drone,'camera',PARTS.camera).map(p=>p.sourcePartId),['CameraRedotSplitMini01']);
  }
  const chameleon=DRONES['armattan-chameleon'];
  assert.ok(workbenchParts(defaultBuild(chameleon.id),chameleon,'camera',PARTS.camera).every(p=>p.sourcePartId!=='CameraFibonacci01'));
});

test('Gecko forced blank slots suppress the imported antenna and optional action camera',()=>{
  const drone=DRONES['armattan-gecko'];
  assert.equal(canUseActionCamera(drone),false);
  assert.equal(resolveBuild({...defaultBuild(drone.id),actionCamera:true}).actionCamera,false);
  assert.notEqual(cleanBuild({actionCamera:true},drone.id).actionCamera,true);
  assert.ok(drone.customization.hiddenNodes.includes('Antenna_AntennaFatshark01_0'));
  // Native compatibility is retained as source evidence even when product policy disables it.
  assert.equal(isPartCompatible(DRONES['luma-5'],'actionCamera',DRONES['luma-5'].accessories.actionCamera),true);
});

test('separate action cameras are disabled on every aircraft, including old saved builds',()=>{
  for(const drone of Object.values(DRONES)){
    const input={...defaultBuild(drone.id),actionCamera:true};
    assert.equal(canUseActionCamera(drone),false,drone.id);
    assert.equal(resolveBuild(input).actionCamera,false,drone.id);
    assert.notEqual(cleanBuild(input,drone.id).actionCamera,true,drone.id);
  }
});

test('native rules preserve every stock build and bound propeller diameter',()=>{
  for(const drone of Object.values(DRONES).filter(d=>d.customization))for(const [category,id] of Object.entries(drone.stockParts)){
    assert.ok(isPartCompatible(drone,category,PARTS[category].find(p=>p.id===id)),drone.id+'/'+category);
  }
  const gecko=DRONES['armattan-gecko'];
  assert.equal(isPartCompatible(gecko,'propellers',{sourcePartId:'oversize',sourceSpecs:{diameter:5}}),false);
  const provenance=JSON.parse(readFileSync('content/shared-assets/liftoff-drone-parts/customization-source.json'));
  assert.equal(provenance.permissionConfirmed,false);
  assert.equal(Object.keys(provenance.frames).length,4);
});

test('conditional geometry restores the previous part before a replacement visibility mask',()=>{
  const model=new Group(),cover=new Group();cover.name='camera-cover';model.add(cover);
  const customization={hiddenNodes:[],visibility:[{when:{cameraId:'large'},hide:['camera-cover']}]};
  applyDroneConfiguration(model,{customization,cameraId:'large'});assert.equal(cover.visible,false);
  clearDroneConfiguration(model);applyDroneConfiguration(model,{customization,cameraId:'small'});assert.equal(cover.visible,true);
  clearDroneConfiguration(model);cover.visible=false;
  applyDroneConfiguration(model,{customization,cameraId:'large'});clearDroneConfiguration(model);assert.equal(cover.visible,false,'an already hidden replaced part stays hidden');
});

test('native socket corrections move existing geometry once and respect transformed parents',()=>{
 const model=new Group(),level=new Group(),holder=new Group(),stock=new Group(),mount=new Group();
 model.userData.visualLod={};model.add(level);level.add(holder);holder.add(stock,mount);
 model.position.set(4,5,6);level.rotation.y=.7;holder.position.set(.1,.2,.3);
 stock.name='camera-stock';stock.position.set(0,.03,.07);mount.name='mount-camera';mount.position.copy(stock.position);
 const matrix=new Matrix4().makeTranslation(0,.0337,.0564).toArray();
 const build={customization:{slots:{camera:[{matrix}]}},mounts:{camera:['mount-camera']},partBindings:{camera:['camera-stock']}};
 applyNativeSlotTransforms(model,build);model.updateWorldMatrix(true,true);
 const expected=level.matrixWorld.clone().multiply(new Matrix4().fromArray(matrix));
 for(const node of [mount,stock])assert.ok(node.matrixWorld.elements.every((n,i)=>Math.abs(n-expected.elements[i])<1e-9));
 const once=stock.matrixWorld.clone();applyNativeSlotTransforms(model,build);model.updateWorldMatrix(true,true);
 assert.deepEqual(stock.matrixWorld.elements,once.elements,'repeated hardware swaps must not accumulate socket offsets');
});
