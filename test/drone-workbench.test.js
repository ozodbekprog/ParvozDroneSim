import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Group, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { readGeometry } from '../tools/inspect-drone-runtime.js';
import { resolveBuild, defaultBuild } from '../shared/physics.js';
import { PreviewRequest, previewSphere, visibleModelBounds, inspectionBuild } from '../src/drone-preview.js';
import { updateVisualLODs } from '../src/visual-lod.js';
import { applyDroneColors } from '../src/model-materials.js';
import { flightAttitude } from '../src/flight-attitude.js';
import { chaseCameraShot, CHASE_DISTANCE,flightCameraFov } from '../src/chase-camera.js';
import { workbenchParts } from '../src/workbench-parts.js';
import { DRONES, PARTS } from '../shared/catalog.js';

test('modular Workbench offers real visual alternatives and retains saved legacy selections',()=>{
  const build=defaultBuild();
  for(const category of Object.keys(PARTS)) {
    const supported=workbenchParts(build,DRONES.kestrel,category,PARTS[category]);
    if(category==='antenna'){assert.deepEqual(supported.map(p=>p.id),['fixed']);continue;}
    assert.equal(supported.length,2);assert.ok(supported.every(part=>part.model));
    const legacy=PARTS[category].find(part=>!part.model);
    assert.ok(workbenchParts({...build,[category]:legacy.id},DRONES.kestrel,category,PARTS[category]).includes(legacy));
  }
});

test('an authored drone without a frame mount cannot offer unrelated frame models',()=>{
  const build={...defaultBuild(),drone:'luma-5'};
  const offered=workbenchParts(build,DRONES['luma-5'],'frame',PARTS.frame);
  assert.deepEqual(offered.map(part=>part.id),[DRONES['luma-5'].stockParts.frame]);
});

test('preview replacement commits only the latest loaded build; old results are discarded',async()=>{
  const request=new PreviewRequest(),commits=[],discarded=[];let finish;
  const old=request.run(()=>new Promise(resolve=>finish=resolve),value=>commits.push(value),value=>discarded.push(value));
  await request.run(async()=> 'new',value=>commits.push(value),value=>discarded.push(value));finish('old');await old;
  assert.deepEqual(commits,['new']);assert.deepEqual(discarded,['old']);
  const late=request.run(()=>new Promise(resolve=>finish=resolve),value=>commits.push(value),value=>discarded.push(value));request.cancel();finish('away');await late;
  assert.deepEqual(commits,['new']);assert.deepEqual(discarded,['old','away']);
  let reject;
  const obsolete=request.run(()=>new Promise((resolve,no)=>reject=no),value=>commits.push(value),value=>discarded.push(value));
  request.cancel();reject(new Error('obsolete download failed'));assert.equal(await obsolete,false);
});
test('preview fits only the visible installed parts, excluding hidden far-away LOD geometry',()=>{
  const group=new Group(),main=new Mesh(new BoxGeometry(.4,.1,.3),new MeshBasicMaterial()),hidden=main.clone();hidden.position.x=100;hidden.visible=false;group.add(main,hidden);
  assert.ok(previewSphere(group).radius<.3);main.geometry.dispose();main.material.dispose();
});
test('attitude remains yaw-independent, handles inverted flight and malformed telemetry',()=>{
  assert.deepEqual(flightAttitude([0,Math.SQRT1_2,0,Math.SQRT1_2]),{pitch:0,roll:0});
  assert.ok(Math.abs(flightAttitude([0,0,Math.sin(Math.PI/8),Math.cos(Math.PI/8)]).roll-45)<1e-9);
  assert.ok(Math.abs(flightAttitude([-Math.sin(Math.PI/8),0,0,Math.cos(Math.PI/8)]).pitch-45)<1e-9);
  assert.equal(Math.abs(flightAttitude([0,0,1,0]).roll),180);
  assert.deepEqual(flightAttitude([NaN,0,0,1]),{pitch:0,roll:0});
});
test('close chase camera maintains height through upside-down and vertical attitudes',()=>{
  assert.equal(flightCameraFov('chase',125),72);assert.equal(flightCameraFov('fpv',125),125);
  for(const rotation of [[0,0,0,1],[0,0,1,0],[Math.SQRT1_2,0,0,Math.SQRT1_2]]){
    const shot=chaseCameraShot({position:[0,3,0],rotation});assert.ok(shot.position.y>3);
    assert.ok(Math.abs(Math.hypot(shot.position.x,shot.position.z)-CHASE_DISTANCE)<1e-9);
    assert.ok(shot.position.distanceTo(new Vector3(0,3,0))<2);
  }
});
test('real Kestrel GLBs install every category, retain upright mounts, change props and colors',async()=>{
  const previous=globalThis.document;
  const gradient={addColorStop(){}};
  const context=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient},{get:(obj,key)=>obj[key]||(()=>{})});
  globalThis.document={createElement:()=>({getContext:()=>context})};
  const {createDrone,updateDroneParts,disposeObject}=await import('../public/content/recipes.js');
  if(previous===undefined)delete globalThis.document;else globalThis.document=previous;
  const gltfs=new Map();
  const loads=[];
  const load=async(url,node)=>{
    loads.push(url);
    if(!gltfs.has(url))gltfs.set(url,readGeometry('public'+url));
    const gltf=await gltfs.get(url);let source=gltf.scene;
    if(node){const matches=[];for(const s of gltf.scenes)s.traverse(n=>{if(n.name===node)matches.push(n);});assert.equal(matches.length,1,node);source=matches[0];}
    const copy=clone(source);copy.traverse(n=>{if(n.material)n.material=n.material.clone();});return copy;
  };
  for(const propellers of ['triblade','efficient']){
    const spec=resolveBuild({...defaultBuild(),propellers,color:'#4ec7d5',led:'#ffcc00'}),mesh=createDrone(spec,{load});await mesh.assetsReady;
    updateVisualLODs(mesh,{getWorldPosition:v=>v.set(0,0,1),zoom:1},{preview:true});mesh.updateMatrixWorld(true);
    const sphere=previewSphere(mesh);assert.ok(sphere.radius>.15 && sphere.radius<.24,'real-world drone size');
    for(const category of ['frame','motors','propellers','camera','battery']){
      const defaults=[];mesh.traverse(n=>{if(spec.partBindings[category].includes(n.name))defaults.push(n);});assert.ok(defaults.every(n=>!n.visible),category);
      let installed=0;mesh.traverseVisible(n=>{if(n.userData.category===category)installed++;});assert.equal(installed,['motors','propellers'].includes(category)?4:1,category);
    }
    const camera=mesh.getObjectByName('Mount_camera').getWorldPosition(new Vector3()),battery=mesh.getObjectByName('Mount_battery').getWorldPosition(new Vector3());
    const bell=visibleModelBounds(mesh.getObjectByName(spec.mounts.motors[0])).getCenter(new Vector3());
    const blade=visibleModelBounds(mesh.getObjectByName(spec.mounts.propellers[0])).getCenter(new Vector3());
    assert.ok(blade.y>bell.y,'propellers must sit above motor bells');
    for(const[i,name]of spec.motorBindings.entries()){
      const point=mesh.getObjectByName(name).getWorldPosition(new Vector3());
      assert.equal(Math.sign(point.x),[1,-1,-1,1][i]);assert.equal(Math.sign(point.z),[1,1,-1,-1][i]);
    }
    assert.ok(camera.z>0 && battery.y<0,'camera faces forward and underslung battery sits below the frame');
    let colored=0;mesh.traverseVisible(n=>{if(spec.colorBindings.body.includes(n.name)){assert.equal(n.material.color.getHexString(),'4ec7d5');assert.ok(n.material.name.startsWith('Kestrel_body_'),'paint needs a neutral albedo, not a multiply against the original green finish');colored++;}});assert.ok(colored>=2,'paint must affect the structural frame as well as tiny accents');
    applyDroneColors(mesh,{...spec,color:'#fc623d'});mesh.traverseVisible(n=>{if(spec.colorBindings.body.includes(n.name))assert.equal(n.material.color.getHexString(),'fc623d');});
    assert.ok(mesh.getObjectByName('Template_Part_propellers_'+(propellers==='triblade'?'SCOUT':'HUNTER')));
    const frame=mesh.userData.droneModel,oldBattery=frame.userData.droneParts.get('battery').roots[0],before=loads.length;
    const replacement=resolveBuild({...defaultBuild(),propellers:propellers==='triblade'?'efficient':'triblade'});
    await updateDroneParts(mesh,replacement,{load});
    assert.equal(mesh.userData.droneModel,frame,'changing a propeller preserves the complete frame');
    assert.equal(frame.userData.droneParts.get('battery').roots[0],oldBattery,'other installed parts are not re-created');
    assert.ok(loads.slice(before).every(url=>replacement.visualParts.find(p=>p.category==='propellers').modelLods.some(level=>level.model===url)),'only propeller geometry is requested');
    const close=inspectionBuild(spec);assert.equal(close.modelLods,undefined);assert.ok(close.visualParts.every(part=>!part.modelLods));
    disposeObject(mesh);
  }
});
