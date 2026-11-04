import test from 'node:test';
import assert from 'node:assert/strict';
import {createRaceOpponents,advanceRaceOpponent,racePilotCommand} from '../shared/race-ai.js';
import {DRONES,PARTS,defaultBuild,resolveBuild,createDroneState,FIXED_DT} from '../shared/physics.js';
import {isPartCompatible} from '../shared/part-compatibility.js';
const map={gravity:1,wind:[0,0,0],floorY:0,model:'test'},track={laps:1,spawn:{position:[0,1,0],yaw:0},gates:[{position:[0,2,20],yaw:0,width:6,height:4}]};
const build=defaultBuild(),spec=resolveBuild(build);
function rng(seed){return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}

test('saturated race acceleration still points along a diagonal route',()=>{
  const state=createDroneState([0,2,0]),command=racePilotCommand(state,[20,2,50],spec,map);
  const x=-Math.tan(command.input.roll*Math.PI/3),z=Math.tan(command.input.pitch*Math.PI/3);
  assert.ok(Math.abs(x/z-20/50)<1e-8,'independent axis clamps must not turn a diagonal route into a 45 degree acceleration');
});

test('race roster varies aircraft and compatible hardware without copying player tuning',()=>{
  const models=new Set(),parts=new Set(),antennas=new Set();
  const random=rng(42);
  for(let seed=1;seed<=30;seed++){
    const items=createRaceOpponents({build,controller:{rates:999}},spec,map,track,[],3,{random});
    assert.equal(new Set(items.map(item=>item.build.drone)).size,3);
    for(const item of items){
      const drone=DRONES[item.build.drone];models.add(drone.id);
      if(['armattan-chameleon','dquad-addiction'].includes(drone.id))antennas.add(item.build.antenna);
      for(const category of Object.keys(PARTS)){
        const part=PARTS[category].find(p=>p.id===item.build[category]);
        assert.ok(isPartCompatible(drone,category,part));parts.add(part.id);
      }
      assert.equal(item.controller,undefined);assert.equal(item.build.actionCamera,false);
      assert.equal(item.pilot.spec.id,drone.id);
    }
  }
  assert.equal(models.size,Object.keys(DRONES).length);assert.ok(parts.size>20);
  assert.equal(antennas.size,4,'AI samples all compatible original antenna models');
});

test('each randomized opponent uses its own hardware physics and completes an open gate',()=>{
  const items=createRaceOpponents({build},spec,map,track,[],3,{random:rng(4)});
  for(let tick=0;tick<6000&&items.some(item=>item.finishMs===null);tick++)for(const item of items)advanceRaceOpponent(item,spec,map,track,[],tick*FIXED_DT*1000);
  for(const item of items){assert.ok(item.finishMs>0,item.build.drone);assert.equal(item.pilot.recoveries,0);assert.equal(item.pilot.spec.id,item.build.drone);}
});

test('physical racers carry speed through aligned gates instead of stopping at each approach',async()=>{
  const course={...track,gates:[20,60,100].map(z=>({...track.gates[0],position:[0,2,z]}))};
  const [item]=createRaceOpponents({build},spec,map,course,[],1,{builds:[build]});item.pilot.skill=1;
  await item.pilot.navigation.prepare(item.state.position);
  let maximum=0;const crossings=[];
  for(let tick=0;tick<3000&&item.finishMs===null;tick++){
    const gate=item.gate;advanceRaceOpponent(item,spec,map,course,[],tick*FIXED_DT*1000);
    const speed=Math.hypot(...item.state.velocity);maximum=Math.max(maximum,speed);
    if(gate!==item.gate)crossings.push(speed);
  }
  assert.ok(item.finishMs>0&&item.finishMs<25000,`100m race: ${item.finishMs}ms`);
  assert.ok(maximum>9);assert.ok(crossings.slice(0,-1).every(speed=>speed>3),'carry speed through intermediate gates; braking is allowed at the finish');
  assert.equal(item.pilot.recoveries,0);
});
