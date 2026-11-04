import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewOrbit, orbitPreviewCamera, zoomPreviewCamera, samplePreviewOrbit, focusPreviewPart, advancePreviewOrbit } from '../src/preview-orbit.js';

const center = [3, 1.72, 7];
const viewport = { width: 1920, height: 1080 };
const stage = { width: 1050, height: 760 };
const sample = (orbit, diameter = 1.2, area = stage) => samplePreviewOrbit(orbit, center, diameter, 55, viewport, area);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('stationary inspection fits dense geometry only once until the model or layout changes',()=>{
  const orbit=createPreviewOrbit();let reads=0;
  const bounds={get points(){reads++;return new Float32Array([2,1,6,4,2,8]);}};
  const run=()=>samplePreviewOrbit(orbit,center,1.2,55,viewport,stage,bounds);
  run();const first=reads;assert.ok(first>0);
  for(let frame=0;frame<120;frame++)run();
  assert.equal(reads,first);
  orbit.fitKey=null;run();assert.ok(reads>first);
});

test('part inspection takes a smooth short path and manual gestures cancel the motion', () => {
  const orbit = createPreviewOrbit();
  orbit.azimuth=2.64;
  const initial = { ...orbit };
  focusPreviewPart(orbit, 'battery');
  assert.equal(orbit.azimuth, initial.azimuth);
  advancePreviewOrbit(orbit, .325);
  assert.ok(orbit.elevation > initial.elevation && orbit.elevation < .8);
  // Crossing the -pi/pi boundary must not spin almost a full turn.
  const delta = Math.atan2(Math.sin(orbit.azimuth - initial.azimuth), Math.cos(orbit.azimuth - initial.azimuth));
  assert.ok(Math.abs(delta) < 1);
  advancePreviewOrbit(orbit, .325);
  close(orbit.azimuth, -2.75); close(orbit.elevation, .8);
  assert.equal(orbit.transition, null);
  focusPreviewPart(orbit, 'camera'); advancePreviewOrbit(orbit, .1);
  orbitPreviewCamera(orbit, 20, 0); const manual = sample(orbit);
  advancePreviewOrbit(orbit, 1); assert.deepEqual(sample(orbit), manual);
  focusPreviewPart(orbit, 'propellers', true);
  close(orbit.elevation, 1.05); assert.equal(orbit.transition, null);
});

test('drag orbits the camera in two axes around an unchanged drone target', () => {
  const orbit = createPreviewOrbit();
  const before = sample(orbit);
  orbitPreviewCamera(orbit, 80, -20);
  const after = sample(orbit);
  assert.notDeepEqual(after.position, before.position);
  assert.notEqual(after.position[1], before.position[1]);
  assert.deepEqual(after.target, center);
  close(Math.hypot(...after.position.map((value, index) => value - center[index])), before.distance);
});

test('replacing a drone or component preserves the camera position and zoom chosen by the player', () => {
  const orbit = createPreviewOrbit();
  sample(orbit);
  orbitPreviewCamera(orbit, -150, 40);
  zoomPreviewCamera(orbit, -140);
  const chosen = sample(orbit);
  for (const replacementDiameter of [1.3, 0.9, 1.6, 1.2]) {
    assert.deepEqual(sample(orbit, replacementDiameter), chosen);
  }
});

test('panel layout fitting retains azimuth, elevation and zoom while keeping the model centered', () => {
  const orbit = createPreviewOrbit();
  sample(orbit);
  orbitPreviewCamera(orbit, 100, 25);
  zoomPreviewCamera(orbit, 100);
  const chosen = { azimuth: orbit.azimuth, elevation: orbit.elevation, zoom: orbit.zoom };
  const selection = sample(orbit);
  const workbench = sample(orbit, 1.2, { width: 500, height: 760 });
  assert.ok(workbench.distance > selection.distance);
  assert.deepEqual(workbench.target, center);
  for (const key of Object.keys(chosen)) assert.equal(orbit[key], chosen[key]);
  assert.deepEqual(sample(orbit), selection);
});

test('vertical orbit and wheel zoom remain finite at their limits', () => {
  const orbit = createPreviewOrbit();
  sample(orbit);
  orbitPreviewCamera(orbit, 1e6, -1e6);
  assert.equal(orbit.elevation, 0.08);
  zoomPreviewCamera(orbit, -1e6);
  assert.equal(orbit.zoom, 0.18);
  orbitPreviewCamera(orbit, -1e6, 1e6);
  assert.equal(orbit.elevation, 1.35);
  zoomPreviewCamera(orbit, 1e6);
  zoomPreviewCamera(orbit, 1e6);
  assert.equal(orbit.zoom, 2);
  const before = sample(orbit);
  orbitPreviewCamera(orbit, NaN, Infinity);
  zoomPreviewCamera(orbit, Infinity);
  assert.deepEqual(sample(orbit), before);
  assert.ok([...before.position, before.distance].every(Number.isFinite));
});
test('inspection zoom reaches the aircraft and cannot leave a small map',()=>{
 const orbit=createPreviewOrbit(),limits={minDistance:.2,maxDistance:2.2,mapBounds:{min:[2,0,6],max:[4,3,8]}};
 for(const delta of [-1e6,1e6,1e6]){
   zoomPreviewCamera(orbit,delta);
   const shot=samplePreviewOrbit(orbit,center,.4,55,viewport,stage,undefined,limits);
   assert.ok(shot.distance>=.2&&shot.distance<=2.2);
   for(let a=0;a<3;a++)assert.ok(shot.position[a]>=limits.mapBounds.min[a]&&shot.position[a]<=limits.mapBounds.max[a]);
 }
 zoomPreviewCamera(orbit,-1e6);assert.ok(samplePreviewOrbit(orbit,center,.4,55,viewport,stage,undefined,limits).distance<.3);
});
