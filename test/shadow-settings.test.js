import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, DirectionalLight, RenderTarget } from 'three';
import { setSunShadowSize } from '../src/shadow-settings.js';

test('effect toggles at the same shadow size preserve the allocated target', () => {
  const scene = new Scene(), sun = new DirectionalLight(); scene.add(sun);
  sun.shadow.mapSize.setScalar(1024); sun.shadow.map = new RenderTarget(1024, 1024);
  let disposed = false; sun.shadow.map.addEventListener('dispose', () => { disposed = true; });
  assert.equal(setSunShadowSize(scene, sun, 1024), sun);
  assert.equal(disposed, false);
});
test('shadow quality changes replace allocated bindings and preserve light and shadow parameters', () => {
  const scene = new Scene(), sun = new DirectionalLight('#ffd8af', 3.4); scene.add(sun);
  sun.position.set(40, 58, -35); sun.target.position.set(2, 1, 4); sun.castShadow = true;
  sun.shadow.bias = -0.00012; sun.shadow.normalBias = 0.035; sun.shadow.autoUpdate = false;
  sun.shadow.mapSize.setScalar(2048); sun.shadow.map = new RenderTarget(2048, 2048);
  let disposals = 0; sun.shadow.map.addEventListener('dispose', () => { disposals++; });
  const next = setSunShadowSize(scene, sun, 1024);
  assert.notEqual(next, sun); assert.notEqual(next.uuid, sun.uuid);
  assert.equal(disposals, 1); assert.equal(next.shadow.map, null);
  assert.equal(next.shadow.mapSize.x, 1024); assert.equal(next.shadow.mapSize.y, 1024);
  assert.equal(next.shadow.needsUpdate, true); assert.equal(next.shadow.autoUpdate, false);
  assert(next.position.equals(sun.position)); assert(next.target.position.equals(sun.target.position));
  assert(next.color.equals(sun.color)); assert.equal(next.intensity, sun.intensity);
  assert.equal(next.castShadow, true); assert.equal(next.shadow.bias, sun.shadow.bias);
  assert.equal(next.shadow.normalBias, sun.shadow.normalBias);
  assert(scene.children.includes(next)); assert(!scene.children.includes(sun));
  assert(scene.children.includes(next.target));
  next.target.position.set(100,0,80);scene.updateMatrixWorld(true);
  assert.equal(next.target.matrixWorld.elements[12],100);
});
test('initial shadow setup changes size before allocation without replacing the light', () => {
  const scene = new Scene(), sun = new DirectionalLight(); scene.add(sun);
  assert.equal(setSunShadowSize(scene, sun, 2048), sun);
  assert.equal(sun.shadow.mapSize.x, 2048); assert.equal(sun.shadow.needsUpdate, true);
});
