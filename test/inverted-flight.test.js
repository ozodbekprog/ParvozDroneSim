import test from 'node:test';
import assert from 'node:assert/strict';
import {createDroneState, defaultBuild, resolveBuild, DRONES, rotate, resolveEnvironmentCollision} from '../shared/physics.js';
import {simulateCommand, replayPending} from '../shared/flight-session.js';
import {readFileSync} from 'node:fs';
import {MAPS,GAMEPLAY_OBSTACLES,getSpawn} from '../shared/content.js';

const plane={wind:[0,0,0],gravity:1,floorY:0};
const authored={...plane,model:'floor.glb',floorY:-10};
const floor={type:'mesh',vertices:[-50,0,-50,50,0,50,50,0,-50,-50,0,-50,-50,0,50,50,0,50]};
function run(spec, rotation, input, map=plane, obstacles=[],ticks=30) {
  const state=createDroneState([0,.5,0]);state.rotation=rotation.slice();
  const tick=input=>simulateCommand(state,{input,flightMode:'acro'},spec,map,null,obstacles);
  for(let n=0;n<120;n++)tick({throttle:0});
  const start=structuredClone(state);
  for(let n=0;n<ticks;n++)tick(input);
  return {state,start};
}

for(const surface of ['plane','mesh'])test(`inverted ${surface} contact preserves signed motor torque for pitch and roll at 50/80 percent for every drone`,()=>{
  for(const id of Object.keys(DRONES))for(const throttle of [.5,.8])for(const axis of ['pitch','roll']){
    const spec=resolveBuild(defaultBuild(id)),index=axis==='pitch'?0:2;
    const args=surface==='plane'?[plane,[]]:[authored,[floor]];
    for(const sign of [-1,1]){
      const {state}=run(spec,[1,0,0,0],{throttle,[axis]:sign},...args,1);
      const t=state.motorThrust;
      const torque=axis==='pitch'?-t[0]-t[1]+t[2]+t[3]:t[0]-t[1]-t[2]+t[3];
      assert.ok(torque*sign>.01,`${surface}/${id}/${throttle}/${axis}/${sign}: stick must reach motor differential even if contact prevents tipping`);
      assert.equal(state.crashed,false);assert.ok(Math.abs(Math.hypot(...state.rotation)-1)<1e-9);
    }
  }
});

test('inverted neutral Acro does not auto-level or produce upward thrust',()=>{
  const spec=resolveBuild(defaultBuild());
  const {state}=run(spec,[1,0,0,0],{throttle:.8});
  assert.ok(rotate(state.rotation,[0,1,0])[1]<-.999);
  assert.ok(Math.hypot(...state.angularVelocity)<.001);
  assert.ok(state.position[1]<.5);
  assert.ok(Math.max(...state.motors)-Math.min(...state.motors)<.001);
});

test('floor contact response does not depend on duplicate colliders',()=>{
  const spec={...resolveBuild(),collision:{spheres:[{position:[0,0,0],radius:.1}]}},results=[];
  for(const count of [1,12]){
    const state=createDroneState([0,.099,0]);state.angularVelocity=[1,2,3];
    resolveEnvironmentCollision(state,authored,null,Array(count).fill(floor),spec);
    results.push(state.angularVelocity);
  }
  assert.deepEqual(results[0],results[1]);
  assert.deepEqual(results[0],[1,2,3],'without inward motion or support load, there is no friction impulse');
});

test('prediction replays inverted contact commands exactly',()=>{
  const spec=resolveBuild(),state=createDroneState([0,.1,0]);state.rotation=[1,0,0,0];
  const commands=Array.from({length:40},(_,seq)=>({seq,input:{throttle:.8,roll:seq<20?1:-1},flightMode:'acro'}));
  const expected=structuredClone(state);
  for(const cmd of commands)simulateCommand(expected,cmd,spec,authored,null,[floor]);
  for(const cmd of commands.slice(0,15))simulateCommand(state,cmd,spec,authored,null,[floor]);
  assert.deepEqual(replayPending(state,commands.slice(15),spec,authored,null,[floor]),expected);
});

test('fallen craft responds on all three actual imported maps without a reset',()=>{
  for(const map of Object.values(MAPS)){
    const obstacles=[...GAMEPLAY_OBSTACLES[map.id],...JSON.parse(readFileSync('public'+map.collisionFile))];
    for(const id of Object.keys(DRONES))for(const axis of ['pitch','roll']){
      const spec=resolveBuild(defaultBuild(id)),state=createDroneState(getSpawn(map.tracks[0]).position);
      state.rotation=[1,0,0,0];
      const tick=input=>simulateCommand(state,{input,flightMode:'acro'},spec,map,null,obstacles);
      for(let n=0;n<120;n++)tick({throttle:0});
      tick({throttle:.8,[axis]:1});
      const t=state.motorThrust,torque=axis==='pitch'?-t[0]-t[1]+t[2]+t[3]:t[0]-t[1]-t[2]+t[3];
      assert.ok(torque>.01,`${map.id}/${id}/${axis}: motor torque follows input`);
      for(let n=0;n<30;n++)tick({throttle:.8,[axis]:1});
      assert.ok(state.position.every(Number.isFinite));
      assert.equal(state.crashed,false);
    }
  }
});

test('sideways contact clears a stale launch assist and keeps opposing stick directions distinct',()=>{
  const spec=resolveBuild(),states=[];
  for(const sign of [-1,1]){
    const state=createDroneState([0,.18,0]);state.rotation=[0,0,Math.SQRT1_2,Math.SQRT1_2];state.takeoffSupportY=.18;
    simulateCommand(state,{input:{throttle:.8,roll:sign},flightMode:'acro'},spec,plane,null,[]);
    assert.equal(state.takeoffSupportY,null);
    for(let n=0;n<8;n++)simulateCommand(state,{input:{throttle:.8,roll:sign},flightMode:'acro'},spec,plane,null,[]);
    states.push(state);
  }
  assert.ok(states[0].angularVelocity[2]<0&&states[1].angularVelocity[2]>0);
});
