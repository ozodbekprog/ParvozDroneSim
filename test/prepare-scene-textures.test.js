import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene, Mesh, PlaneGeometry, MeshStandardMaterial, PerspectiveCamera, Texture} from 'three';
import {prepareSceneTextures} from '../src/prepare-scene-textures.js';

function fixture() {
  const scene = new Scene(), camera = new PerspectiveCamera(70, 1, .1, 100); camera.position.z = 5; camera.updateProjectionMatrix();
  const a = new Texture(), b = new Texture(), mesh = new Mesh(new PlaneGeometry(), new MeshStandardMaterial({map: a, normalMap: b})); scene.add(mesh);
  return {scene, camera, mesh, a, b};
}

test('initial preparation shares visible textures and excludes hidden, offscreen and collider materials', async () => {
  const {scene, camera, mesh, a, b} = fixture(), seen = [];
  scene.add(mesh.clone());
  for (const mode of ['hidden', 'offscreen', 'collider']) {
    const other = new Mesh(new PlaneGeometry(), new MeshStandardMaterial({map: new Texture()}));
    if (mode === 'hidden') other.visible = false;
    if (mode === 'offscreen') other.position.x = 1000;
    if (mode === 'collider') other.userData.collider = true;
    scene.add(other);
  }
  const result = await prepareSceneTextures(scene, camera, {initTexture: texture => seen.push(texture)});
  assert.deepEqual(seen, [a, b]); assert.equal(result.initialized, 2); assert.equal(result.canceled, false);
});

test('uploads yield at the time boundary and a canceled replacement cannot warm stale textures', async () => {
  const {scene, camera, a} = fixture(); let time = 0, current = true, yields = 0; const seen = [];
  const result = await prepareSceneTextures(scene, camera, {initTexture(texture) { seen.push(texture); time += 9; }}, {
    now: () => time, isCurrent: () => current, yieldTask: async () => { yields++; current = false; },
  });
  assert.deepEqual(seen, [a]); assert.equal(yields, 1); assert.equal(result.canceled, true); assert.equal(result.maxUploadMs, 9);
});

test('generated render targets and videos are left to their renderer lifecycle', async () => {
  const {scene, camera, mesh} = fixture(); const target = new Texture(), video = new Texture();
  target.isRenderTargetTexture = true; video.isVideoTexture = true;
  mesh.material.map = target; mesh.material.normalMap = video; scene.environment = target;
  const result = await prepareSceneTextures(scene, camera, {initTexture() { throw Error('must not upload'); }});
  assert.equal(result.selected, 0);
});

test('already-uploaded textures are skipped on the same renderer until their version changes', async () => {
  const {scene, camera, a, b} = fixture(), seen = [];
  const renderer = {initTexture: texture => seen.push(texture)};
  assert.equal((await prepareSceneTextures(scene, camera, renderer)).initialized, 2);
  assert.equal((await prepareSceneTextures(scene, camera, renderer)).initialized, 0);
  a.needsUpdate = true;
  assert.equal((await prepareSceneTextures(scene, camera, renderer)).initialized, 1);
  assert.deepEqual(seen, [a, b, a]);
});
