import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Scene,PerspectiveCamera,Vector3,Quaternion,Euler} from 'three';
import {GAMEPLAY_OBSTACLES} from '../shared/content.js';
import {createDroneState,resolveBuild} from '../shared/physics.js';
import {chaseCameraShot,CHASE_DISTANCE,CHASE_HEIGHT} from '../src/chase-camera.js';

const savedDocument=globalThis.document;
const gradient={addColorStop(){}};
const context=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient},{get:(value,key)=>value[key]||(()=>{})});
globalThis.document={createElement:()=>({getContext:()=>context})};
const {World}=await import('../src/world.js');
if(savedDocument===undefined)delete globalThis.document;else globalThis.document=savedDocument;

function cameraWorld(mode,walls=[]){
  const state=createDroneState([0,2,.2]),mesh=new Group();
  const item={state,mesh,spec:resolveBuild(),snapshots:[],visualPosition:new Vector3(),visualRotation:new Quaternion()};
  const world=Object.assign(Object.create(World.prototype),{
    thumbnail:true,scene:new Scene(),camera:new PerspectiveCamera(72,16/9,.02,100),
    renderer:{info:{reset(){}}},graphics:{quality:'low',lodDistanceScale:1},
    drones:new Map([['pilot',item]]),activeDroneId:'pilot',cameraMode:mode,
    map:{id:'camera-regression'},track:{colliders:walls},courseActive:true,
    lastTime:0,updateHomeLight(){},fpvTilt:0
  });
  return {world,state,item};
}

test('rendered rigid chase keeps its near plane in front of map and checkpoint walls',()=>{
  const wall={position:[0,2,0],size:[10,10,.01]};
  for(const scope of ['environment','course']){
    const {world}=cameraWorld('chase-rigid',scope==='course'?[wall]:[]);
    GAMEPLAY_OBSTACLES[world.map.id]=scope==='environment'?[wall]:[];
    try{
      world.render(1000/60,{prepareOnly:true});
      assert.ok(world.camera.position.z>.04,`${scope}: the camera must stop before the wall`);
    }finally{delete GAMEPLAY_OBSTACLES[world.map.id];}
  }
});

test('near-vertical pitch jitter cannot collapse or reverse the dynamic chase orbit',()=>{
  const memory={},origin=new Vector3(0,2,0);let previous;
  for(let i=0;i<180;i++){
    const rotation=new Quaternion().setFromEuler(new Euler(Math.PI/2+(i%2?-.003:.003),0,0)).toArray();
    const shot=chaseCameraShot({position:origin.toArray(),rotation},memory,1/60);
    const horizontal=shot.position.clone().sub(origin);horizontal.y=0;
    assert.ok(Math.abs(horizontal.length()-CHASE_DISTANCE)<1e-6,'follow distance remains constant');
    if(previous)assert.ok(shot.position.distanceTo(previous)<.03,'sub-degree attitude noise must not swing the orbit');
    previous=shot.position;
  }
});

for(const mode of ['chase','chase-rigid'])test(`the real render path holds ${mode} heading while a crashed drone tumbles`,()=>{
  const {world,state}=cameraWorld(mode);
  world.render(1000/60,{prepareOnly:true});
  const position=world.camera.position.clone(),direction=world.camera.getWorldDirection(new Vector3());
  state.crashed=true;
  for(let i=1;i<=90;i++){
    state.rotation=new Quaternion().setFromEuler(new Euler(i*.27,i*.47,i*.39)).toArray();
    world.render((i+1)*1000/60,{prepareOnly:true});
    assert.ok(world.camera.position.distanceTo(position)<1e-6,'crash tumble cannot move the follow orbit');
    assert.ok(world.camera.getWorldDirection(new Vector3()).angleTo(direction)<1e-6,'crash tumble cannot spin the view');
  }
  state.position[0]+=3;
  world.render(92*1000/60,{prepareOnly:true});
  assert.ok(Math.abs(world.camera.position.x-position.x-3)<1e-6,'the camera continues following crash translation');
  assert.ok(Math.abs(world.camera.position.y-state.position[1]-CHASE_HEIGHT)<1e-6);
});
