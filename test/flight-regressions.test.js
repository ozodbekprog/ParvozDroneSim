import test from 'node:test';
import assert from 'node:assert/strict';
import { createDroneState, defaultBuild, resolveBuild, rotate, stepDrone, FIXED_DT } from '../shared/physics.js';
import { MAPS, GAMEPLAY_OBSTACLES, getSpawn } from '../shared/content.js';
import { checkpointSpawn, resetAtCheckpoint, simulateCommand, replayPending } from '../shared/flight-session.js';
import { DEFAULT_FLIGHT_CONTROLLER } from '../shared/flight-controller.js';
import { calibratedChannels, InputManager } from '../src/input.js';

test('grounded low throttle cannot tip through the floor or wind up a later takeoff',()=>{
  const spec={...resolveBuild(defaultBuild()),collision:{spheres:[-1,1].flatMap(x=>[-1,1].map(z=>({position:[x*.12,0,z*.12],radius:.03})))}};
  for(const axis of ['pitch','roll']){
    const state=createDroneState([0,.03,0]);
    for(let n=0;n<480;n++)stepDrone(state,{throttle:.15,[axis]:1},spec);
    assert.ok(Math.abs(state.rotation[3])>.999,'supported craft stays upright');
    for(let n=0;n<120;n++)stepDrone(state,{throttle:.6,pitch:0,roll:0,yaw:0},spec);
    assert.ok(state.position[1]>1,'neutral takeoff still works');
    assert.ok(Math.hypot(...state.angularVelocity)<.01,'no stored ground rate');
  }
});

test('zero-throttle sticks cannot spin a grounded drone', () => {
  for (const axis of ['pitch', 'roll', 'yaw']) {
    const state = createDroneState([0, 0.18, 0]);
    for (let n = 0; n < 120; n++) stepDrone(state, { throttle: 0 }, resolveBuild(defaultBuild()), FIXED_DT);
    const settled=state.rotation.slice();
    for (let n = 0; n < 120; n++) stepDrone(state, { throttle: 0, [axis]: 1 }, resolveBuild(defaultBuild()), FIXED_DT);
    assert.ok(Math.hypot(...state.angularVelocity)<1e-8);
    assert.ok(Math.abs(settled.reduce((sum,v,i)=>sum+v*state.rotation[i],0))>1-1e-8);
    assert.ok(state.motors.every(v=>v<1e-8));
  }
});

test('resting on an authored elevated floor retains ground motor limits',()=>{
  const spec={...resolveBuild(defaultBuild()),groundClearance:.055,collision:{spheres:[{position:[0,0,0],radius:.055}]}};
  const map={model:'authored.glb',wind:[0,0,0],gravity:1},floor={type:'box',position:[0,.2,0],size:[20,.2,20]};
  const state=createDroneState([0,.355,0]);
  for(let n=0;n<90;n++)simulateCommand(state,{input:{throttle:0,pitch:0,roll:0,yaw:0},flightMode:'acro'},spec,map,null,[floor],DEFAULT_FLIGHT_CONTROLLER);
  for(let n=0;n<480;n++)simulateCommand(state,{input:{throttle:0,pitch:1,roll:0,yaw:0},flightMode:'acro'},spec,map,null,[floor],DEFAULT_FLIGHT_CONTROLLER);
  assert.ok(state.grounded);assert.deepEqual(state.rotation,[0,0,0,1]);assert.ok(state.motors.every(speed=>speed<.0001));
  for(let n=0;n<120;n++)simulateCommand(state,{input:{throttle:.6,pitch:0,roll:0,yaw:0},flightMode:'acro'},spec,map,null,[floor],DEFAULT_FLIGHT_CONTROLLER);
  assert.ok(state.position[1]>1);assert.ok(Math.hypot(...state.angularVelocity)<.01);
});

test('authored floor support ends when the craft moves beyond its edge',()=>{
  const spec={...resolveBuild(defaultBuild()),groundClearance:.055,collision:{spheres:[{position:[0,0,0],radius:.055}]}};
  const map={model:'authored.glb',wind:[0,0,0],gravity:1},floor={type:'box',position:[0,.2,0],size:[1,.2,1]};
  const state=createDroneState([0,.355,0]);
  const command={input:{throttle:0},flightMode:'acro'};
  for(let n=0;n<30;n++)simulateCommand(state,command,spec,map,null,[floor],DEFAULT_FLIGHT_CONTROLLER);
  assert.ok(state.grounded);state.position[0]=2;
  simulateCommand(state,command,spec,map,null,[floor],DEFAULT_FLIGHT_CONTROLLER);
  assert.equal(state.grounded,false);
});

test('positive calibrated sticks mean nose down, bank right, and yaw right in FPV', () => {
  for (const axis of ['pitch', 'roll', 'yaw']) {
    const state = createDroneState([0, 10, 0]);
    for (let n = 0; n < 6; n++) stepDrone(state, { throttle: 0.4, [axis]: 0.5 }, resolveBuild(defaultBuild()), FIXED_DT);
    if (axis === 'pitch') assert.ok(rotate(state.rotation, [0, 0, 1])[1] < 0);
    if (axis === 'yaw') assert.ok(rotate(state.rotation, [0, 0, 1])[0] < 0);
    if (axis === 'roll') assert.ok(rotate(state.rotation, [0, 1, 0])[0] < 0);
  }
});

test('acknowledged input replay produces the same pose without blending motors or rates', () => {
  const map = MAPS['hangar-c03-demo'], track = map.tracks[0], spawn = getSpawn(track), spec = resolveBuild(defaultBuild());
  const predicted = createDroneState(spawn.position, spawn.yaw), authoritative = structuredClone(predicted);
  const commands = Array.from({ length: 12 }, (_, seq) => ({ seq: seq + 1, input: { throttle: 0.42, roll: seq > 5 ? 0.15 : 0, yaw: 0.2 }, flightMode: 'acro' }));
  for (const command of commands) simulateCommand(predicted, command, spec, map, track, GAMEPLAY_OBSTACLES['hangar-c03-demo'], DEFAULT_FLIGHT_CONTROLLER);
  for (const command of commands.slice(0, 8)) simulateCommand(authoritative, command, spec, map, track, GAMEPLAY_OBSTACLES['hangar-c03-demo'], DEFAULT_FLIGHT_CONTROLLER);
  const restored = replayPending(authoritative, commands.slice(8), spec, map, track, GAMEPLAY_OBSTACLES['hangar-c03-demo'], DEFAULT_FLIGHT_CONTROLLER);
  assert.deepEqual(restored, predicted);
});

test('race reset returns past the last gate and preserves lap and event time', () => {
  const track = MAPS['hangar-c03-demo'].tracks[0], room = { track, mode: 'race', started: 1200 };
  const item = { gate: 2, lap: 2, resetId: 0, commands: [{}] };
  resetAtCheckpoint(item, room);
  assert.deepEqual(item.state.position, checkpointSpawn(track, 2, 2).position);
  assert.equal(item.gate, 2); assert.equal(item.lap, 2); assert.equal(room.started, 1200);
  assert.equal(item.resetId, 1); assert.equal(item.commands.length, 0);
  assert.deepEqual(checkpointSpawn(track, 0, 1), getSpawn(track));
  assert.notDeepEqual(checkpointSpawn(track, 0, 2), getSpawn(track));
});

test('radio calibration is stable across Gamepad index changes and honors remap/invert', () => {
  const device = { id: 'RadioMaster Pocket', index: 3, axes: [0.8, -0.6, -1, 0.4] };
  const manager = { selected: device.id, devices: () => [device] };
  assert.equal(InputManager.prototype.selectedDevice.call(manager), device);
  const profile = { axis: { throttle: 2, roll: 3, pitch: 0, yaw: 1 }, invert: { throttle: false, roll: true, pitch: true, yaw: false }, min: {}, max: {}, center: {}, deadzone: 0, throttleMode: 'full' };
  assert.deepEqual(calibratedChannels(device.axes, profile), { throttle: 0, yaw: -0.6, pitch: -0.8, roll: -0.4 });
  manager.selected = 'Disconnected TX12';
  assert.equal(InputManager.prototype.selectedDevice.call(manager), null);
});
