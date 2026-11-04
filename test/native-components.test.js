import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../public/content/catalog.json' with {type:'json'};
import {DRONES,PARTS,defaultBuild,resolveBuild,createDroneState,stepDrone,FIXED_DT} from '../shared/physics.js';
import {nativeBatteryState} from '../shared/component-physics.js';
import {validateCatalog} from '../shared/catalog-schema.js';
import {readGeometry} from '../tools/inspect-drone-runtime.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {Vector3,Matrix4} from 'three';
import {visibleModelBounds} from '../src/drone-preview.js';
import {updateVisualLODs} from '../src/visual-lod.js';
const native=['luma-5','armattan-chameleon','armattan-gecko','dquad-addiction'];
const find=(category,source)=>PARTS[category].find(part=>part.sourcePartId===source);
test('all native stock assemblies retain imported mass and render their existing stock geometry',()=>{
  assert.equal(DRONES.swift,undefined);assert.equal(DRONES.atlas,undefined);assert.equal(DRONES.viper,undefined);
  for(const id of native){
    const spec=resolveBuild(defaultBuild(id));
    assert.ok(Math.abs(spec.mass-DRONES[id].mass)<1e-12,id);
    assert.deepEqual(spec.visualParts.map(p=>p.category),id==='armattan-gecko'?[]:['antenna'],id);
    assert.ok(spec.nativePower.energyWh>0 && spec.maxRpm>1000 && spec.inertia.every(x=>x>0),id);
    const rise=createDroneState([0,10,0]);for(let i=0;i<60;i++)stepDrone(rise,{throttle:.8},spec,FIXED_DT);
    assert.ok(rise.position[1]>12,`${id} must fly`);
  }
  assert.equal(resolveBuild(defaultBuild()).nativePower,undefined);
});

test('all original antenna alternatives replace stock geometry atomically at native sockets on every LOD',async()=>{
 const previous=globalThis.document,gradient={addColorStop(){}};
 const context=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient},{get:(o,k)=>o[k]||(()=>{})});
 globalThis.document={createElement:()=>({getContext:()=>context})};
 const {createDrone,updateDroneParts,disposeObject}=await import('../public/content/recipes.js');
 if(previous===undefined)delete globalThis.document;else globalThis.document=previous;
 const gltfs=new Map(),load=async(url,node)=>{
  if(!gltfs.has(url))gltfs.set(url,readGeometry('public'+url));
  const gltf=await gltfs.get(url),copy=clone(node?gltf.scene.getObjectByName(node):gltf.scene);
  copy.traverse(n=>{if(n.material)n.material=n.material.clone();});return copy;
 };
 for(const id of native){
  const build=defaultBuild(id),mesh=createDrone(resolveBuild(build),{load});await mesh.assetsReady;
  const parts=PARTS.antenna.filter(p=>p.model&&p.compatibleDrones.includes(id));
  for(const part of [...parts,...parts.slice().reverse()]){
   const spec=resolveBuild({...build,antenna:part.id});await updateDroneParts(mesh,spec,{load});mesh.updateMatrixWorld(true);
   const model=mesh.userData.droneModel,installed=model.userData.droneParts.get('antenna');
   assert.equal(installed.roots.length,model.children.length);
   for(const root of installed.roots){
    const expected=new Matrix4().multiplyMatrices(root.parent.matrixWorld,new Matrix4().fromArray(spec.customization.slots.antenna[0].matrix));
    assert.ok(root.matrixWorld.elements.every((n,i)=>Math.abs(n-expected.elements[i])<1e-7));
    assert.equal(root.visible,true);assert.equal(root.children.length,1);
   }
   assert.ok(installed.defaults.length>=model.children.length);
   assert.ok(installed.defaults.every(n=>n.visible===false));
   updateVisualLODs(mesh,{getWorldPosition:v=>v.set(0,0,1),zoom:1},{low:true});
   const size=visibleModelBounds(mesh).getSize(new Vector3());assert.ok(size.x<.6&&size.y<.3&&size.z<.6,`${id}/${part.id}: ${size.toArray()}`);
  }
  disposeObject(mesh);
 }
});
test('native hardware changes total mass, inertia, loaded RPM, response and available battery energy',()=>{
  const build=defaultBuild('armattan-gecko'),stock=resolveBuild(build);
  const battery=find('battery','HyperionBattery2S01'),batterySpec=resolveBuild({...build,battery:battery.id});
  assert.ok(Math.abs(batterySpec.mass-stock.mass-(battery.sourceSpecs.weight-find('battery','AmpAgeBattery01').sourceSpecs.weight))<1e-12);
  assert.ok(batterySpec.nativePower.energyWh<stock.nativePower.energyWh);
  assert.ok(batterySpec.maxRpm<stock.maxRpm && batterySpec.thrustToWeight<stock.thrustToWeight);
  assert.notDeepEqual(batterySpec.inertia,stock.inertia);
  const motorSpec=resolveBuild({...build,motors:find('motors','Bushmaster1507motor2800KV01').id});
  assert.ok(motorSpec.maxRpm<stock.maxRpm);assert.notEqual(motorSpec.motorTau,stock.motorTau);
  const propSpec=resolveBuild({...build,propellers:find('propellers','HQProp2Bullnose3045Propeller01').id});
  assert.equal(propSpec.propellerBlades,2);assert.notDeepEqual(propSpec.inertia,stock.inertia);assert.notEqual(propSpec.maxRpm,stock.maxRpm);
  const cameraBuild=defaultBuild('luma-5'),cameraStock=resolveBuild(cameraBuild);
  const camera=find('camera','CameraRotorRiot01'),cameraSpec=resolveBuild({...cameraBuild,camera:camera.id});
  assert.ok(Math.abs(cameraSpec.mass-cameraStock.mass-(camera.sourceSpecs.weight-find('camera','CameraFibonacci01').sourceSpecs.weight))<1e-12);
  assert.notDeepEqual(cameraSpec.inertia,cameraStock.inertia);
  const painted=resolveBuild({...build,color:'#aabbcc',led:'#001122'});
  for(const field of ['mass','thrustToWeight','motorTau','maxRpm','inertia','nativePower'])assert.deepEqual(painted[field],stock[field]);
  assert.equal(resolveBuild({...defaultBuild(),motors:build.motors}).motorsId,'balanced','a micro motor cannot alter Kestrel physics');
});
test('loaded native batteries sag, spend energy with actual rotor load and remain deterministic on both clients',()=>{
  const spec=resolveBuild(defaultBuild('dquad-addiction')),idle=createDroneState([0,40,0]),loaded=structuredClone(idle);
  loaded.motors=[1,1,1,1];const a=nativeBatteryState(idle,spec),b=nativeBatteryState(loaded,spec);
  assert.ok(b.voltage<a.voltage && b.rpm<a.rpm && b.watts>a.watts);
  loaded.battery=.15;assert.ok(nativeBatteryState(loaded,spec).rpm<b.rpm);
  const client=createDroneState([0,40,0]),server=structuredClone(client);
  for(let i=0;i<120;i++){const input={throttle:.45,roll:Math.sin(i/20)*.03,pitch:.02};stepDrone(client,input,spec);stepDrone(server,input,spec);}
  assert.deepEqual(client,server);assert.ok(client.battery<1 && client.battery>0);assert.ok(client.motorRpm.every(Number.isFinite));
});
test('native catalog rejects nonphysical electrical data and unsafe mount matrices',()=>{
  for(const corrupt of [c=>c.parts.find(p=>p.category==='battery'&&p.sourceSpecs).sourceSpecs.numberOfCells=0,c=>c.parts.find(p=>p.mountMatrixByDrone).mountMatrixByDrone['armattan-gecko'][15]=0,c=>c.drones.find(d=>d.sourcePhysics).stockParts.motors='missing']){
    const bad=structuredClone(catalog);corrupt(bad);assert.throws(()=>validateCatalog(bad));
  }
});
test('actual native replacement geometry keeps motors, CW/CCW propellers, camera and batteries mounted on every airframe at Low',async()=>{
  const previous=globalThis.document,gradient={addColorStop(){}};
  const context=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient},{get:(o,k)=>o[k]||(()=>{})});
  globalThis.document={createElement:()=>({getContext:()=>context})};
  const {createDrone,disposeObject}=await import('../public/content/recipes.js');
  if(previous===undefined)delete globalThis.document;else globalThis.document=previous;
  const gltfs=new Map();
  const load=async(url,node)=>{
    if(!gltfs.has(url))gltfs.set(url,readGeometry('public'+url));
    const gltf=await gltfs.get(url),source=node?gltf.scene.getObjectByName(node):gltf.scene;assert.ok(source,node);
    const copy=clone(source);copy.traverse(n=>{if(n.material)n.material=n.material.clone();});return copy;
  };
  for(const id of native){
    const build=defaultBuild(id);
    for(const category of ['motors','propellers','battery','camera']){
      const alt=PARTS[category].find(p=>p.sourceSpecs && p.id!==build[category] && p.compatibleDrones.includes(id));assert.ok(alt,`${id} ${category}`);build[category]=alt.id;
    }
    const spec=resolveBuild(build),mesh=createDrone(spec,{load});await mesh.assetsReady;
    const model=mesh.userData.droneModel;
    model.updateWorldMatrix(true,true);
    for(const level of model.children)for(const category of ['camera','battery']){
      const mount=level.getObjectByName(spec.mounts[category][0]);
      const expected=level.matrixWorld.clone().multiply(new Matrix4().fromArray(spec.customization.slots[category][0].matrix));
      assert.ok(mount.matrixWorld.elements.every((n,i)=>Math.abs(n-expected.elements[i])<1e-7),`${id}/${category} uses native slot instead of stale imported offsets`);
    }
    updateVisualLODs(mesh,{getWorldPosition:v=>v.set(0,0,1),zoom:1},{low:true});mesh.updateMatrixWorld(true);
    if(id==='armattan-gecko'){
      let importedAntennas=0;mesh.traverse(node=>{if(spec.customization.hiddenNodes.includes(node.name)){importedAntennas++;assert.equal(node.visible,false);}});
      assert.ok(importedAntennas>=3,'the forced blank antenna applies to every loaded LOD');
    }
    const bounds=visibleModelBounds(mesh),size=bounds.getSize(new Vector3());assert.ok(size.x<.6 && size.y<.25 && size.z<.6,`${id} stray geometry ${size.toArray()}`);
    const motors=[],props=[];
    mesh.traverseVisible(n=>{if(n.userData.category==='motors')motors.push(n);if(n.userData.category==='propellers')props.push(n);});
    assert.equal(motors.length,4);assert.equal(props.length,4);
    for(let i=0;i<4;i++){
      const m=visibleModelBounds(motors[i]),p=visibleModelBounds(props[i]);
      assert.ok(p.getCenter(new Vector3()).y>m.getCenter(new Vector3()).y,`${id} propeller above motor`);
      assert.ok(p.getCenter(new Vector3()).distanceTo(m.getCenter(new Vector3()))<.05,`${id} propeller seated`);
    }
    const replacement=spec.visualParts.find(p=>p.category==='propellers');assert.notEqual(replacement.modelNodeByRotor[0],replacement.modelNodeByRotor[1]);
    disposeObject(mesh);
  }
});
