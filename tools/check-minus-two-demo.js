import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {collisionCandidates,sphereContacts,prepareCollisions} from '../shared/collision.js';
import {createDroneState,stepDrone,resolveEnvironmentCollision,resolveBuild,gateCrossed,FIXED_DT} from '../shared/physics.js';
import {resetAtCheckpoint} from '../shared/flight-session.js';
import {profile,recoveryFolder,mapFolder} from './content-import-profile.js';
import {GAMEPLAY_OBSTACLES} from '../shared/catalog.js';
import {SoloSession} from '../src/solo-session.js';
import {importedGatePassage} from './import-gate-passages.js';
const folder=mapFolder,read=p=>JSON.parse(readFileSync(p,'utf8'));
const map=read(folder+'map.json'),race=read('content/races/'+profile.course.id+'/race.json'),colliders=read(folder+'collision.json'),spec=resolveBuild(),hoverHeight=profile.probe.position[1];
const nativeCourse=profile.course.id.startsWith(profile.id+'-liftoff-');
const obstacles=[...colliders,...race.colliders||[]];prepareCollisions(obstacles);
// Ground-contact fixes and visual metadata are intentional changes. Preserve the
// flight controller and compare Kestrel's actual flight settings independently.
for(const [file,hash] of Object.entries(read(recoveryFolder+'preserved-hashes.json'))){if(file==='shared/flight-controller.js')assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,'Preserved controller changed');}
const baseline=read('data/menu-qa/before-polish/kestrel/drone.json'),kestrel=read('content/drones/kestrel/drone.json');
for(const key of ['id','class','mass','arm','thrustToWeight','motorTau','drag','angularDrag','batterySeconds'])assert.deepEqual(kestrel[key],baseline[key],'Kestrel flight setting changed: '+key);
const gateNormal=gate=>gate.axes?.normal||[Math.sin(gate.yaw),0,Math.cos(gate.yaw)];
const hits=point=>collisionCandidates(obstacles,point,.3).flatMap(o=>sphereContacts(point,.3,o));
assert.equal(hits([race.spawn.position[0],hoverHeight,race.spawn.position[2]]).length,0,'Blocked launch area');
const passages=new Map();
for(const gate of race.gates){
  if(nativeCourse){
    const point=importedGatePassage(gate,obstacles,spec);assert.ok(point,'No clear aircraft passage '+JSON.stringify(gate.position));passages.set(gate,point);continue;
  }
  for(const t of [-1,-.5,0,.5,1]){
    const point=gate.position.map((v,i)=>v+gateNormal(gate)[i]*t);
    assert.equal(hits(point).length,0,'Blocked gate approach '+JSON.stringify(gate.position));
  }
  const before=gate.position.map((v,i)=>v-gateNormal(gate)[i]);
  const after=gate.position.map((v,i)=>v+gateNormal(gate)[i]);
  assert.equal(gateCrossed(before,after,gate),true,'Gate direction cannot be completed');
}
let state=createDroneState(race.spawn.position,race.spawn.yaw);
for(let n=0;n<600;n++){
  const voltage=1-(1-state.battery)*.16,hover=Math.pow(1/(spec.thrustToWeight*voltage*voltage),1/1.85);
  const throttle=Math.max(0,Math.min(1,hover+(hoverHeight-state.position[1])*.09-state.velocity[1]*.07));
  stepDrone(state,{throttle,roll:0,pitch:0,yaw:0},spec,FIXED_DT,'angle',map.wind,map.gravity,undefined,map.floorY||0);
  resolveEnvironmentCollision(state,map,race,obstacles,spec);
}
assert.ok(Math.abs(state.position[1]-hoverHeight)<.1,'Hover did not settle');assert.equal(state.health,1);
// A zero-throttle drop can legitimately damage the drone on an authored raised
// floor. Test a controlled descent instead of relying on the global floor clamp.
for(let n=0;n<1200&&!state.grounded;n++){
  const voltage=1-(1-state.battery)*.16,hover=Math.pow(1/(spec.thrustToWeight*voltage*voltage),1/1.85);
  const throttle=Math.max(0,Math.min(1,hover+(-.5-state.velocity[1])*.08));
  stepDrone(state,{throttle,roll:0,pitch:0,yaw:0},spec,FIXED_DT,'angle',map.wind,map.gravity,undefined,map.floorY||0);resolveEnvironmentCollision(state,map,race,obstacles,spec);
}
assert.equal(state.grounded,true,'Landing did not contact the recovered floor');assert.equal(state.health,1);
const item={gate:4,lap:1,resetId:0,state};resetAtCheckpoint(item,{mode:'race',track:race});
assert.equal(item.resetId,1);assert.ok(item.state.position.every(Number.isFinite));assert.equal(hits(item.state.position).length,0,'Checkpoint restart is obstructed');
// Exercise actual mission state transitions using controlled approaches to each
// clear gate. This is a deterministic content check, not a full manual flight.
GAMEPLAY_OBSTACLES[profile.id]=colliders;
const user={id:'import-check',username:'Import check',build:{drone:'kestrel'}};
const session=(track,mode,extra={})=>{const s=new SoloSession({map:map.id,track,mode,user,...extra,now:0});s.update(0,{},'angle',3000);return s;};
function flyGate(s,gate){
  const normal=gateNormal(gate);
  const point=passages.get(gate)||importedGatePassage(gate,obstacles,s.spec)||gate.position;
  s.item.state=createDroneState(point.map((v,i)=>v-normal[i]*.04),gate.yaw);
  s.item.state.velocity=normal.map(v=>v*12);
  s.update(FIXED_DT,{throttle:Math.pow(1/s.spec.thrustToWeight,1/1.85),roll:0,pitch:0,yaw:0},'angle',s.clock+FIXED_DT*1000);
}
const mission=read('content/challenges/'+profile.challenge.id+'/challenge.json');
const timed=session(race.id,'career',{challenge:mission});
for(let lap=0;lap<race.laps;lap++)for(const [index,gate] of race.gates.entries()){flyGate(timed,gate);assert.equal(timed.item.state.health,1,'Gate approach damaged drone '+index);}
assert.equal(timed.room.status,'ended','Mission cannot finish');assert.ok(timed.item.finishMs<mission.target*1000);
timed.restart(10000);assert.equal(timed.item.finishMs,null);assert.equal(timed.item.gate,0);
const tutorial=read('content/tutorials/'+profile.tutorial.id+'/tutorial.json'),lesson=session(profile.course.practiceId,'training',{tutorial});
const lessonHeight=tutorial.steps[0].position?.[1]??hoverHeight;
for(let n=0;n<1800&&lesson.stepIndex===0;n++){
  const voltage=1-(1-lesson.state.battery)*.16,hover=Math.pow(1/(lesson.spec.thrustToWeight*voltage*voltage),1/1.85);
  lesson.update(FIXED_DT,{throttle:Math.max(0,Math.min(1,hover+(lessonHeight-lesson.state.position[1])*.09-lesson.state.velocity[1]*.07)),roll:0,pitch:0,yaw:0},'angle',lesson.clock+FIXED_DT*1000);
}
assert.equal(lesson.stepIndex,1,'Tutorial takeoff objective cannot complete');
for(const gate of lesson.track.gates)flyGate(lesson,gate);
assert.equal(tutorial.steps[lesson.stepIndex].objective,'land','Tutorial gates cannot complete');
lesson.item.state=createDroneState(race.spawn.position,race.spawn.yaw);
for(let n=0;n<600&&lesson.room.status==='running';n++)lesson.update(FIXED_DT,{throttle:0,roll:0,pitch:0,yaw:0},'angle',lesson.clock+FIXED_DT*1000);
assert.equal(lesson.room.status,'ended','Tutorial landing cannot complete');
const report={map:map.id,spawn:true,gates:race.gates.length,gateDirections:true,hoverHeight,landing:true,checkpointReset:true,tutorialCompletion:true,timedMissionCompletion:true,missionRestart:true,preservedKestrelAndFlightParameters:true};
writeFileSync(recoveryFolder+'content-flight-check.json',JSON.stringify(report,null,2));console.log(report);
