import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Group, Mesh, BoxGeometry, MeshStandardMaterial, DoubleSide } from 'three';
import { flightTargets, projectFlightTarget } from '../src/flight-navigation.js';
import { applyMaterials } from '../src/model-materials.js';
import { createDroneState, resolveBuild, defaultBuild, stepDrone } from '../shared/physics.js';
import { validateCatalog } from '../shared/catalog-schema.js';
import { SoloSession } from '../src/solo-session.js';
import { getTrack, getSpawn } from '../shared/content.js';
import catalog from '../public/content/catalog.json' with {type:'json'};

test('guidance shows two upcoming gates, wraps between laps and stops at the final gate', () => {
  const track = { laps:2, gates: [0,1,2].map(z=>({position:[0,3,z*10]})) };
  assert.equal(flightTargets(track,{gate:2,lap:1},'race').length,2);
  assert.deepEqual(flightTargets(track,{gate:2,lap:1},'race')[1].position,track.gates[0].position);
  assert.equal(flightTargets(track,{gate:2,lap:2},'career').length,1);
  assert.equal(flightTargets(track,{},'freestyle').length,0);
  assert.equal(flightTargets(track,{},'training',{objective:'manual'}).length,2);
  assert.equal(flightTargets(track,{},'training',{objective:'gate',target:1}).length,2);
  assert.deepEqual(flightTargets(track,{},'training',{objective:'reach',position:[2,3,4],radius:1})[0].position,[2,3,4]);
});

test('guidance uses the camera projection and clamps targets behind the pilot to a screen edge', () => {
  const camera = new PerspectiveCamera(100,16/9,.02,700);
  const ahead = projectFlightTarget({position:[0,0,-20]},camera,1280,720);
  assert.equal(ahead.visible,true); assert.equal(ahead.x,640); assert.equal(ahead.y,360);
  for(const position of [[50,0,-1],[0,0,20],[0,0,0]]) {
    const marker = projectFlightTarget({position},camera,1280,720);
    assert.equal(marker.visible,false);
    assert.ok(Number.isFinite(marker.x) && Number.isFinite(marker.y));
    assert.ok(marker.x>=50 && marker.x<=1230 && marker.y>=50 && marker.y<=670);
  }
});

test('material slot overrides preserve other imported materials and support masked double-sided surfaces', async () => {
  const root=new Group(), original=new MeshStandardMaterial({color:'#112233'}), untouched=new MeshStandardMaterial({color:'#445566'});
  original.name='Paint'; untouched.name='Carbon';
  const mesh=new Mesh(new BoxGeometry(),[original,untouched]); mesh.name='Shell'; root.add(mesh);
  await applyMaterials(root,[{mesh:'Shell',material:'Paint',baseColor:'#abcdef',roughness:.7,emissiveColor:'#221100',emissiveIntensity:2,alphaMode:'MASK',alphaCutoff:.4,doubleSided:true}]);
  assert.equal(mesh.material[0].color.getHexString(),'abcdef'); assert.equal(mesh.material[1],untouched);
  assert.equal(mesh.material[0].transparent,false); assert.equal(mesh.material[0].alphaTest,.4); assert.equal(mesh.material[0].side,DoubleSide);
  mesh.geometry.dispose(); mesh.material[0].dispose(); original.dispose(); untouched.dispose();
});

test('additional battery inertia changes response instead of being cancelled by controller gains', () => {
  const light=resolveBuild(defaultBuild()), heavy=resolveBuild({...defaultBuild(),battery:'endurance'});
  const a=createDroneState([0,10,0]), b=createDroneState([0,10,0]);
  for(let tick=0;tick<4;tick++) {
    stepDrone(a,{throttle:.42,roll:.25},light);
    stepDrone(b,{throttle:.42,roll:.25},heavy);
  }
  assert.ok(heavy.inertia[2]>light.inertia[2]);
  assert.ok(b.angularVelocity[2]<a.angularVelocity[2]);
});

test('rotor airflow forces oppose relative velocity, and wind moves a craft without fuselage drag', () => {
  const spec=resolveBuild(defaultBuild()); spec.drag=[0,0,0];
  const a=createDroneState([0,10,0]), b=structuredClone(a); a.velocity=[12,0,0]; b.velocity=[12,0,0];
  stepDrone(a,{throttle:.42},spec);stepDrone(b,{throttle:.42},{...spec,rotorDrag:[0,0,0]});
  assert.ok(a.velocity[0]<b.velocity[0]);
  const windy=createDroneState([0,10,0]); stepDrone(windy,{throttle:.42},spec,1/60,'acro',[5,0,0]);
  assert.ok(windy.velocity[0]>0);
});

test('content includes a distinct career course and validates tutorial targets and material paths', () => {
  const copy=structuredClone(catalog), mission=copy.challenges.find(item=>item.id==='hangar-c03-demo-timed');
  assert.equal(mission.track,'hangar-c03-demo-liftoff-01');assert.notEqual(mission.track,copy.maps.find(m=>m.id===mission.map).tracks[0].id);assert.equal(validateCatalog(copy),copy);
  copy.drones[0].materials=[{mesh:'*',roughnessTexture:'/content/assets/rough.png'}];validateCatalog(copy);
  copy.drones[0].materials[0].roughnessTexture='../private.png';assert.throws(()=>validateCatalog(copy),/roughnessTexture/);
});

test('reach lessons unlock the next instruction only after the target hold completes', () => {
  const spec=defaultBuild(), user={id:123,username:'Test pilot',build:spec};
  const lesson={steps:[{objective:'reach',position:[...getSpawn(getTrack('minus-two-demo','minus-two-demo-stock-practice')).position],radius:4,target:0,duration:2/60,text:'Hold'},{objective:'manual',target:0,duration:0,text:'Continue'}]};
  const session=new SoloSession({map:'minus-two-demo',track:'minus-two-demo-stock-practice',mode:'training',user,tutorial:lesson,now:0});
  session.update(0,{},'acro',3000);
  session.update(1/60,{},'acro',3017); assert.equal(session.stepIndex,0);
  session.update(1/60,{},'acro',3034); assert.equal(session.stepIndex,1);
  session.advanceManual(); assert.equal(session.room.status,'ended');
});
