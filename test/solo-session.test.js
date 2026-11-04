import test from 'node:test';
import assert from 'node:assert/strict';
import { SoloSession } from '../src/solo-session.js';
import { createDroneState, defaultBuild, FIXED_DT } from '../shared/physics.js';
import { checkpointSpawn } from '../shared/flight-session.js';
import { getSpawn } from '../shared/content.js';

const idle = { throttle: 0, roll: 0, pitch: 0, yaw: 0 };
const tickMs = FIXED_DT * 1000;

function session(options = {}) {
  const flight = new SoloSession({
    map: 'minus-two-demo', track: 'minus-two-demo-stock-practice', mode: 'training',
    user: { id: 'solo-test', username: 'Pilot', build: defaultBuild() },
    now: 0, ...options
  });
  flight.update(0, idle, 'angle', 3000);
  return flight;
}

function flyThroughGate(flight, index) {
  const gate = flight.track.gates[index];
  const normal = [Math.sin(gate.yaw), 0, Math.cos(gate.yaw)];
  flight.item.state = createDroneState(gate.position.map((value, axis) => value - normal[axis] * 0.1), gate.yaw);
  flight.item.state.velocity = normal.map(value => value * 12);
  flight.update(FIXED_DT, idle, 'angle', flight.clock + tickMs);
}

test('checkpoint feedback fires once during a course and never on reset',()=>{
  for(const mode of ['race','time']){
    const passed=[],flight=session({mode,onCheckpoint:index=>passed.push(index)});
    flyThroughGate(flight,0);assert.deepEqual(passed,[0]);
    flight.update(FIXED_DT,idle,'angle',flight.clock+tickMs);assert.deepEqual(passed,[0]);
    flight.reset();assert.deepEqual(passed,[0]);
  }
});
test('Free Flight has no course gates or invisible route obstacles',()=>{
 const free=session(),race=session({mode:'race'});
 assert.deepEqual(free.track.gates,[]);assert.deepEqual(free.track.objects,[]);assert.equal(free.track.collisionFile,undefined);
 assert.equal(free.room.sceneCourse,false);assert.ok(race.track.gates.length>0);
 assert.ok(free.obstacles.length<=race.obstacles.length);
 const lesson=session({tutorial:{steps:[{objective:'manual'}]}});assert.ok(lesson.track.gates.length>0);assert.equal(lesson.room.sceneCourse,true);
});

test('lesson gate progress controls highlights and survives reset at the last passed gate', () => {
  const tutorial = { steps: [
    { objective: 'manual', duration: 0 },
    { objective: 'gate', target: 0, duration: 0 },
    { objective: 'gate', target: 1, duration: 0 },
    { objective: 'land', duration: 2 }
  ] };
  const flight = session({ tutorial });
  flight.advanceManual();
  flyThroughGate(flight, 0);
  assert.equal(flight.stepIndex, 2);
  assert.equal(flight.item.gate, 1);
  const elapsed = flight.elapsed;
  flight.reset();
  assert.deepEqual(flight.state.position, checkpointSpawn(flight.track, 1).position);
  assert.equal(flight.stepIndex, 2);
  assert.equal(flight.elapsed, elapsed);
  assert.equal(flight.state.battery, 1);

  flight.state.crashed = true;
  flight.update(FIXED_DT, idle, 'angle', flight.clock + tickMs);
  assert.deepEqual(flight.state.position, checkpointSpawn(flight.track, 1).position);
  assert.equal(flight.stepIndex, 2);

  flyThroughGate(flight, 1);
  assert.equal(flight.stepIndex, 3);
  flight.reset();
  assert.deepEqual(flight.state.position, checkpointSpawn(flight.track, 2).position);
  flight.restart(8000);
  assert.equal(flight.stepIndex, 0);
  assert.equal(flight.item.gate, 0);
  assert.deepEqual(flight.state.position, getSpawn(flight.track).position);
});

test('a crash interrupts a lesson hold so recovery requires the whole duration', () => {
  const tutorial = { steps: [{ objective: 'altitude', target: 1, duration: 0.05 }] };
  const flight = session({ tutorial });
  const spawn=getSpawn(flight.track),hold=spawn.position.map((v,a)=>a===1?v+1.5:v);
  flight.item.state = createDroneState(hold,spawn.yaw);
  flight.update(FIXED_DT * 2, idle, 'angle', 3034);
  assert.equal(flight.stepIndex, 0);
  assert.ok(flight.stepTime > 0);
  flight.state.crashed = true;
  flight.update(FIXED_DT, idle, 'angle', 3050);
  assert.equal(flight.stepTime, 0);
  flight.item.state=createDroneState(hold,spawn.yaw);
  flight.update(FIXED_DT * 2, idle, 'angle', 3084);
  assert.equal(flight.stepIndex, 0);
  flight.update(FIXED_DT, idle, 'angle', 3100);
  assert.equal(flight.stepIndex, 1);
  assert.equal(flight.room.status, 'ended');
  assert.equal(flight.item.finishMs, Math.round(flight.elapsed));
});

test('an exhausted battery discards commands from the crashed frame before respawning', () => {
  const flight = session();
  flight.state.battery = 0.000001;
  flight.update(0.1, { ...idle, throttle: 1 }, 'angle', 3100);
  assert.deepEqual(flight.state.position, getSpawn(flight.track).position);
  assert.deepEqual(flight.state.motors, [0, 0, 0, 0]);
  assert.deepEqual(flight.state.velocity, [0, 0, 0]);
  assert.equal(flight.state.battery, 1);
  assert.equal(flight.elapsed, tickMs);
  assert.equal(flight.room.status, 'running');
});

test('a hover lesson restarts its continuous hold after a speed or mode violation',()=>{
 const spawn=getSpawn({spawn:{position:[-88.4,1.71,.71],yaw:0}});
 const tutorial={steps:[{objective:'reach',position:spawn.position,radius:2,maxSpeed:.8,flightMode:'angle',target:0,duration:3/60}]};
 const flight=session({map:'hangar-c03-demo',track:'hangar-c03-demo-first-flight',tutorial});
 const place=()=>{flight.item.state=createDroneState(spawn.position,spawn.yaw);};
 place();flight.update(FIXED_DT,idle,'angle',3017);assert.ok(flight.stepTime>0);
 flight.state.velocity=[2,0,0];flight.update(FIXED_DT,idle,'angle',3034);assert.equal(flight.stepTime,0);
 place();flight.update(FIXED_DT,idle,'angle',3051);assert.ok(flight.stepTime>0);
 flight.update(FIXED_DT,idle,'acro',3068);assert.equal(flight.stepTime,0);
 place();flight.update(FIXED_DT*2,idle,'angle',3102);assert.equal(flight.stepIndex,0);
 flight.update(FIXED_DT,idle,'angle',3119);assert.equal(flight.room.status,'ended');
});

test('manual freestyle reset breaks unfinished tricks and combos while retaining points', () => {
  const flight = session({ mode: 'freestyle' });
  flight.item.score = 350;
  flight.item.combo = 5;
  flight.item.lastTrick = 'FULL ROTATION';
  Object.assign(flight.item.freestyle, { spin: 6, diveArmed: true, comboUntil: 6000 });
  flight.reset();
  assert.equal(flight.item.score, 350);
  assert.equal(flight.item.combo, 0);
  assert.equal(flight.item.lastTrick, '');
  assert.equal(flight.item.freestyle.spin, 0);
  assert.equal(flight.item.freestyle.diveArmed, false);
  assert.equal(flight.item.freestyle.comboUntil, 0);
});

test('freestyle expires even when the final simulation tick crashes', () => {
  const flight = session({ mode: 'freestyle' });
  flight.elapsed = 180000 - tickMs;
  flight.item.score = 120;
  flight.state.crashed = true;
  flight.update(FIXED_DT, idle, 'angle', 183000);
  assert.equal(flight.room.status, 'ended');
  assert.equal(flight.item.score, 120);
  const finalState = structuredClone(flight.state);
  flight.update(1, { ...idle, throttle: 1 }, 'angle', 184000);
  assert.deepEqual(flight.state, finalState);
});

test('pausing countdown and flight freezes poses, progress and elapsed simulation time', () => {
  const flight = new SoloSession({ map: 'minus-two-demo', track: 'minus-two-demo-stock-practice', mode: 'time',
    user: { id: 'solo-test', username: 'Pilot', build: defaultBuild() }, now: 0 });
  flight.update(0, idle, 'angle', 1000);
  const initialState = structuredClone(flight.state);
  flight.pause();
  flight.update(10, { ...idle, throttle: 1 }, 'angle', 11000);
  assert.deepEqual(flight.state, initialState);
  flight.resume(11000);
  assert.equal(flight.room.countdown, 13000);
  flight.update(FIXED_DT, idle, 'angle', 12999);
  assert.equal(flight.room.status, 'countdown');
  flight.update(FIXED_DT, idle, 'angle', 13000);
  assert.equal(flight.room.status, 'running');
  assert.equal(flight.elapsed, 0);
  flight.update(FIXED_DT, idle, 'angle', 13017);
  const runningState = structuredClone(flight.state), elapsed = flight.elapsed;
  flight.pause();
  flight.update(10, { ...idle, throttle: 1 }, 'angle', 23017);
  assert.deepEqual(flight.state, runningState);
  assert.equal(flight.elapsed, elapsed);
  flight.resume(23017);
  flight.update(FIXED_DT, idle, 'angle', 23034);
  assert.equal(flight.elapsed, elapsed + tickMs);
});
