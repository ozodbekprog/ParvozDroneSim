import test from 'node:test';
import assert from 'node:assert/strict';
import {createDroneState,defaultBuild,resolveBuild,resolveEnvironmentCollision,rotate} from '../shared/physics.js';
import {simulateCommand} from '../shared/flight-session.js';
import {DEFAULT_FLIGHT_CONTROLLER} from '../shared/flight-controller.js';
import {readFileSync} from 'node:fs';
import {MAPS,GAMEPLAY_OBSTACLES,getSpawn} from '../shared/content.js';
import {DRONES} from '../shared/catalog.js';

const spec={...resolveBuild(defaultBuild()),groundClearance:.1,collision:{spheres:[{position:[0,0,0],radius:.1}]}};
const map={wind:[0,0,0],gravity:1,model:'authored.glb',floorY:-10};
const command={input:{throttle:.4},flightMode:'acro'};

test('overlapping mesh triangles resolve a floor penetration only once',()=>{
  const vertices=Array.from({length:100},()=>[-10,0,-10,10,0,10,10,0,-10]).flat();
  const state=createDroneState([0,.05,0]);state.velocity=[0,-3,0];
  resolveEnvironmentCollision(state,map,null,[{type:'mesh',vertices}],spec);
  assert.ok(Math.abs(state.position[1]-.1)<1e-6,'duplicate triangles must not catapult the craft');
  assert.ok(state.grounded);
});

for(const type of ['box','mesh'])test(`fast flight stops at a thin ${type} wall instead of crossing it`,()=>{
  const wall=type==='box'?{position:[0,2,0],size:[.05,5,20]}:
    {type:'mesh',vertices:[0,-1,-10,0,5,10,0,5,-10,0,-1,-10,0,-1,10,0,5,10]};
  for(const direction of [-1,1]){
    const state=createDroneState([-direction,2,0]);state.velocity=[direction*120,0,0];
    simulateCommand(state,command,spec,map,null,[wall],DEFAULT_FLIGHT_CONTROLLER);
    assert.ok(state.position[0]*direction<-.09,'the craft remains on its approaching side');
    assert.ok(state.velocity[0]*direction<=0,'impact removes inward velocity');
    assert.ok(state.health<1,'the impact is recorded');
  }
});

test('fast downward flight lands on an authored floor above the fallback plane',()=>{
  const state=createDroneState([0,1,0]);state.velocity=[0,-120,0];
  const floor={type:'mesh',vertices:[-10,0,-10,10,0,10,10,0,-10,-10,0,-10,-10,0,10,10,0,10]};
  simulateCommand(state,command,spec,map,null,[floor],DEFAULT_FLIGHT_CONTROLLER);
  assert.ok(state.position[1]>=.0999,'authored floor catches the whole swept motion');
  assert.ok(state.velocity[1]>=0);
});

test('every stock drone takes off at 50 percent on every actual imported map',()=>{
  for(const location of Object.values(MAPS)){
    const obstacles=[...GAMEPLAY_OBSTACLES[location.id],...JSON.parse(readFileSync('public'+location.collisionFile))];
    const spawn=getSpawn(location.tracks[0]);
    for(const id of Object.keys(DRONES)){
      const build=resolveBuild(defaultBuild(id)),state=createDroneState(spawn.position,spawn.yaw);
      const tick=throttle=>simulateCommand(state,{input:{throttle},flightMode:'acro'},build,location,null,obstacles,DEFAULT_FLIGHT_CONTROLLER);
      for(let n=0;n<180;n++)tick(0);
      const floor=state.position[1];for(let n=0;n<60;n++)tick(.5);
      assert.ok(state.position[1]>floor+1,`${location.id}/${id} lifts after settling on the authored floor`);
      assert.equal(state.crashed,false);
    }
  }
});

test('full Acro input during takeoff is not replaced by automatic leveling',()=>{
  const build=resolveBuild(defaultBuild()),location={wind:[0,0,0],gravity:1};
  for(const axis of ['pitch','roll']){
    const state=createDroneState([0,.18,0]);
    const tick=input=>simulateCommand(state,{input,flightMode:'acro'},build,location,null,[],DEFAULT_FLIGHT_CONTROLLER);
    for(let n=0;n<60;n++)tick({throttle:0});
    for(let n=0;n<18;n++)tick({throttle:.5,[axis]:1});
    assert.ok(Math.abs(state.rotation[3])<.999,`${axis}: Acro must permit intentional tilt`);
    for(const sphere of build.collision.spheres)assert.ok(state.position[1]+rotate(state.rotation,sphere.position)[1]-sphere.radius>=-1e-6,'body cannot pass through the floor');
    assert.equal(state.takeoffSupportY,null);
  }
});
