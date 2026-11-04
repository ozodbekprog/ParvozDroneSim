import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,appendFileSync} from 'node:fs';
import {MAPS,GAMEPLAY_OBSTACLES} from '../shared/content.js';
import {defaultBuild,resolveBuild,createDroneState,gateCrossed,FIXED_DT} from '../shared/physics.js';
import {checkpointSpawn} from '../shared/flight-session.js';
import {createRaceOpponents,advanceRaceOpponent,racePilotCommand} from '../shared/race-ai.js';
import {RaceNavigation} from '../shared/race-ai-navigation.js';
import {SoloSession} from '../src/solo-session.js';

const build=defaultBuild(),spec=resolveBuild(build),idle={throttle:0,pitch:0,roll:0,yaw:0};
const colliders=new Map();
const load=url=>{if(!colliders.has(url))colliders.set(url,JSON.parse(readFileSync(new URL('../public'+url,import.meta.url))));return colliders.get(url);};
const obstaclesFor=(map,track)=>[...load(map.collisionFile),...load(track.collisionFile)];

test('navigation routes around solid geometry and respects a missing fallback floorY',()=>{
  const wall={position:[0,1.5,0],size:[5,3,.3]},nav=new RaceNavigation({}, {gates:[]},[wall],.3);
  const from=[0,1,-4],to=[0,1,4];assert.equal(nav.clear(from,to),false);
  const path=nav.path(from,to);assert.ok(path?.length>1);
  let previous=from;for(const next of path){assert.ok(next[1]>=.3);assert.ok(nav.clear(previous,next));previous=next;}
});
test('a climb around tall scenery keeps the starting altitude inside the search bounds',()=>{
  const wall={position:[0,14,0],size:[5,28,.3]},nav=new RaceNavigation({}, {gates:[]},[wall],.3),from=[0,1,-4],to=[0,26,4];
  assert.equal(nav.clear(from,to),false);const route=nav.path(from,to);assert.ok(route?.length);
  let previous=from;for(const next of route){assert.ok(nav.clear(previous,next));previous=next;}
  assert.deepEqual(route.at(-1),to);
});

test('prepared navigation rejoins after a checkpoint reset behind an angled native gate frame',async()=>{
  const map=MAPS['hangar-c03-demo'],track=map.tracks.find(t=>t.id==='hangar-c03-demo-liftoff-02'),obstacles=obstaclesFor(map,track);
  const [item]=createRaceOpponents({build},spec,map,track,obstacles,1,{builds:[build]}),nav=item.pilot.navigation;
  await nav.prepare(item.state.position);
  const from=checkpointSpawn(track,8).position,queries=nav.queries,route=nav.preparedRoute(from,8);
  assert.ok(route?.length>1,'a valid source reset must have a precomputed route back around the frame');
  let previous=from;for(const next of route){assert.ok(nav.clear(previous,next),'rejoin segments must reserve full aircraft clearance');previous=next;}
  assert.ok(gateCrossed(route.at(-2),route.at(-1),track.gates[8]),'the rejoin still crosses the authored finish portal');
  assert.ok(nav.queries-queries<30,'recovery must select cached waypoints without a race-time A* search');
});

test('pilot produces ordinary sticks without modifying rigid-body state',()=>{
  const state=createDroneState([0,2,0]),before=structuredClone(state),command=racePilotCommand(state,[7,3,-2],spec,{gravity:1});
  assert.deepEqual(state,before);assert.equal(command.flightMode,'angle');
  assert.ok(command.input.throttle>=0&&command.input.throttle<=1);
  for(const axis of ['pitch','roll','yaw'])assert.ok(Math.abs(command.input[axis])<=1);
});

test('only ordinary solo Race has three opponents; clocks, manual reset and restart remain independent',async()=>{
  const map=MAPS['minus-two-demo'],track=map.tracks.at(-1),prior=GAMEPLAY_OBSTACLES[map.id],priorTrack=track.colliders;
  GAMEPLAY_OBSTACLES[map.id]=load(map.collisionFile);track.colliders=load(track.collisionFile);
  try{
    const make=(mode,extra={})=>new SoloSession({map:map.id,track:track.id,mode,user:{id:'human',username:'Pilot',build},now:0,...extra});
    for(const mode of ['time','training','freestyle','career'])assert.equal(make(mode).opponents.length,0);
    assert.equal(make('race',{tutorial:{steps:[{objective:'manual'}]}}).opponents.length,0);
    const flight=make('race');assert.equal(flight.room.players.length,4);
    assert.ok(flight.opponents.every(p=>p.ai&&p.pilot.spec.id===p.build.drone));
    assert.equal(new Set(flight.opponents.map(p=>p.build.drone)).size,3);
    assert.equal(new Set(flight.room.players.map(p=>p.id)).size,4);
    let yielded=0;await flight.prepareOpponents(()=>{yielded++;});assert.equal(yielded,track.gates.length);
    flight.update(1,idle,'angle',2000);assert.equal(flight.elapsed,0);
    flight.update(0,idle,'angle',3000);flight.update(.1,idle,'angle',3100);
    const poses=flight.opponents.map(p=>structuredClone(p.state));flight.pause();flight.update(10,idle,'angle',13100);
    assert.deepEqual(flight.opponents.map(p=>p.state),poses);
    flight.resume(13100);const opponent=flight.opponents[0],reset=opponent.resetId;
    flight.reset();assert.equal(opponent.resetId,reset);
    opponent.gate=1;opponent.state.crashed=true;flight.update(FIXED_DT,idle,'angle',13117);
    assert.equal(opponent.resetId,reset+1);assert.equal(opponent.gate,1);
    assert.deepEqual(opponent.state.position,checkpointSpawn(flight.track,1).position);
    flight.restart(15000);assert.ok(flight.opponents.every(p=>p.gate===0&&p.lap===1&&p.finishMs===null));
  }finally{GAMEPLAY_OBSTACLES[map.id]=prior;track.colliders=priorTrack;}
});

test('opponents sharing the same flight do not collide with or push each other',()=>{
  const map={gravity:1,wind:[0,0,0],floorY:0,model:'test'},track={laps:1,spawn:{position:[0,1,0],yaw:0},gates:[{position:[0,2,20],yaw:0,width:4,height:3,support:{baseY:0}}]};
  const items=createRaceOpponents({build},spec,map,track,[],2,{builds:[build]});
  for(const item of items){item.pilot.delay=0;item.pilot.skill=1;}
  for(let tick=0;tick<120;tick++)for(const item of items)advanceRaceOpponent(item,spec,map,track,[],tick*FIXED_DT*1000);
  assert.deepEqual(items[0].state,items[1].state);
});

test('all three skill profiles finish the actual narrow course with distinct times',async()=>{
  const map=MAPS['minus-two-demo'],track=map.tracks.at(-1),obstacles=obstaclesFor(map,track);
  const items=createRaceOpponents({build},spec,map,track,obstacles,3,{builds:[build]});
  await items[0].pilot.navigation.prepare(items[0].state.position);
  for(let tick=0;tick<10000&&items.some(p=>p.finishMs===null);tick++)for(const item of items)advanceRaceOpponent(item,spec,map,track,obstacles,tick*FIXED_DT*1000);
  assert.ok(items.every(p=>p.finishMs>0&&p.pilot.recoveries===0));
  assert.equal(new Set(items.map(p=>p.finishMs)).size,3);
  assert.ok(items[2].finishMs<items[0].finishMs);
});

async function completeTrack(map,original,{laps=1,drone='kestrel',skill=1}={}) {
  const trace=message=>{if(process.env.RACE_AI_TRACE)appendFileSync(process.env.RACE_AI_TRACE,`${original.id}: ${message}\n`);};
  trace('start');
  const track={...original,laps},obstacles=obstaclesFor(map,track),build=defaultBuild(drone),spec=resolveBuild(build);
  const [item]=createRaceOpponents({build},spec,map,track,obstacles,1,{builds:[build]});item.pilot.skill=skill;
  const nav=item.pilot.navigation;let prepared=0;await nav.prepare(item.state.position,async()=>trace(`prepared gate ${prepared++}`));
  assert.ok([...nav.routes.values()].every(Boolean),`${track.id}: every gate has a collision-clear approach`);
  const preparedQueries=nav.queries;let crossings=0,maxStep=0;
  for(let tick=0;tick<120000&&item.finishMs===null;tick++) {
    const previous=[...item.state.position],gate=item.gate,lap=item.lap,reset=item.resetId;
    advanceRaceOpponent(item,spec,map,track,obstacles,tick*FIXED_DT*1000);
    if(laps===1)assert.equal(item.pilot.recoveries,0,`${track.id}: recovery at gate ${gate}, tick ${tick}; prior position ${previous}`);
    assert.equal(item.pilot.planFailed,false,`${track.id}: gate ${gate} has a prepared join`);
    if(reset===item.resetId){
      maxStep=Math.max(maxStep,Math.hypot(...item.state.position.map((v,i)=>v-previous[i])));
      if(gate!==item.gate||lap!==item.lap){assert.ok(gateCrossed(previous,item.state.position,track.gates[gate]),`${track.id}: progress requires an actual gate crossing`);crossings++;}
    }
    assert.ok(item.state.position.every(Number.isFinite));
  }
  assert.ok(item.finishMs>0,`${track.id}: completed physically`);
  assert.equal(crossings,track.gates.length*laps);
  assert.ok(maxStep<.35,`${track.id}: no interpolated motion or skipped physical steps (${maxStep})`);
  assert.ok(nav.queries-preparedQueries<track.gates.length*laps*12,`${track.id}: no A* searches during racing`);
  trace(`finished ${item.finishMs}ms`);return item;
}

for(const map of Object.values(MAPS))for(const track of map.tracks)test(`physical AI completes ${track.id} with actual map and race collision files`,{timeout:120000},async()=>{
  const item=await completeTrack(map,track);assert.equal(item.pilot.recoveries,0,'the baseline completes a lap without relying on checkpoint resets');
});

for(const [mapId,trackId] of [
  ['hangar-c03-demo','hangar-c03-demo-liftoff-02'],
  ['liftoff-arena-demo','liftoff-arena-demo-liftoff-02'],
  ['minus-two-demo','minus-two-demo-liftoff-01'],
  ['liftoff-pine-valley-demo','liftoff-pine-valley-demo-liftoff-05'],
  ['liftoff-the-green-demo','liftoff-the-green-demo-liftoff-06']
])test(`physical AI completes every authored lap of ${trackId}`,{timeout:120000},async()=>{
  const map=MAPS[mapId],track=map.tracks.find(t=>t.id===trackId);
  await completeTrack(map,track,{laps:track.laps});
});

for(const drone of ['armattan-gecko','luma-5'])test(`physical AI flies imported ${drone} through the narrow practice course`,async()=>{
  const map=MAPS['minus-two-demo'];await completeTrack(map,map.tracks.at(-1),{drone});
});
