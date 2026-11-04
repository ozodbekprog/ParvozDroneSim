import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_LIST } from '../shared/catalog.js';
import { createMenuCameraShot, sampleMenuCameraShot, previewCameraDistance, previewBoundsDistance } from '../src/menu-camera.js';

test('inspection framing fits the actual flat silhouette rather than empty sphere corners',()=>{
  const points=new Float32Array([-.14,.01,-.13,-.14,.01,.13,.14,.01,-.13,.14,.01,.13,0,.045,0,0,-.047,0]);
  const viewport={width:1280,height:503},stage={width:865,height:320},azimuth=.72,elevation=.4;
  const distance=previewBoundsDistance({points},[0,0,0],55,viewport,stage,azimuth,elevation);
  assert.ok(distance<previewCameraDistance(.4,55,viewport,stage)*.8,'visible aircraft should be appreciably larger');
  const back=[Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation)],right=[Math.cos(azimuth),0,-Math.sin(azimuth)],up=[-Math.sin(azimuth)*Math.sin(elevation),Math.cos(elevation),-Math.cos(azimuth)*Math.sin(elevation)];
  const dot=(v,a)=>v.reduce((s,x,i)=>s+x*a[i],0),tan=Math.tan(55*Math.PI/360);
  for(let i=0;i<points.length;i+=3){const p=[...points.slice(i,i+3)],depth=distance-dot(p,back);assert.ok(Math.abs(dot(p,right))/depth<tan*stage.width/viewport.height);assert.ok(Math.abs(dot(p,up))/depth<tan*stage.height/viewport.height);}
});

test('live menu cameras establish every catalog map without leaving its horizontal bounds', () => {
  for (const map of MAP_LIST) {
    const shot = createMenuCameraShot(map, map.tracks[0]);
    for (const seconds of [0, 8, 16, 24, 32]) {
      const sample = sampleMenuCameraShot(shot, seconds);
      assert.ok([...sample.position, ...sample.target].every(Number.isFinite), map.id);
      assert.ok(Math.hypot(...sample.position.map((value, index) => value - sample.target[index])) > 1, map.id);
      for (const index of [0, 2]) {
        assert.ok(sample.position[index] > map.bounds.min[index], map.id);
        assert.ok(sample.position[index] < map.bounds.max[index], map.id);
      }
    }
  }
});

test('reduced motion holds the actual 3D scene camera still', () => {
  const map = MAP_LIST[0];
  const shot = createMenuCameraShot(map, map.tracks[0]);
  assert.deepEqual(sampleMenuCameraShot(shot, 1, true), sampleMenuCameraShot(shot, 18, true));
  assert.notDeepEqual(sampleMenuCameraShot(shot, 1), sampleMenuCameraShot(shot, 18));
});

test('drone preview fitting protects propeller tips in wide and narrow panel layouts', () => {
  const viewport = { width: 1920, height: 1080 };
  const wide = previewCameraDistance(1.2, 55, viewport, { width: 1050, height: 760 });
  const narrow = previewCameraDistance(1.2, 55, viewport, { width: 350, height: 760 });
  assert.ok(Number.isFinite(wide) && wide >= 1.6);
  assert.ok(narrow > wide);
  assert.ok(previewCameraDistance(2.4, 55, viewport, { width: 1050, height: 760 }) > wide);
  const small=previewCameraDistance(.45,55,viewport,{width:1050,height:760});
  assert.ok(small>.45 && small<1.6,'real-scale FPV models must fill the preview');
});
