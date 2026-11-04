import {Frustum, Matrix4} from 'three';
import {isBatchedScenerySource} from './scenery-batches.js';
import {materialTextures} from './material-resources.js';

const initializedByRenderer = new WeakMap();

/** Shader compilation does not initialize textures. Warm only the initial
 * visible set, yielding between uploads; a single API upload is not preemptible.
 * The renderer retains responsibility for version checks and device recovery. */
export async function prepareSceneTextures(scene, camera, renderer, {
  now = () => performance.now(), budgetMs = 8,
  yieldTask = () => globalThis.scheduler?.yield?.() || new Promise(resolve => setTimeout(resolve, 0)),
  isCurrent = () => !scene.userData.disposed,
  warmAllScenery = false,
} = {}) {
  let uploaded = initializedByRenderer.get(renderer);
  if (!uploaded) { uploaded = new WeakMap(); initializedByRenderer.set(renderer, uploaded); }
  const textures = new Set(), start = now();
  const add = texture => {
    if (!texture?.isTexture || texture.isRenderTargetTexture || texture.isVideoTexture) return;
    if (uploaded.get(texture) === texture.version) return;
    textures.add(texture);
  };
  scene.updateMatrixWorld(); camera.updateWorldMatrix(true, false);
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), camera.coordinateSystem);
  add(scene.background); add(scene.environment);
  scene.traverseVisible(object => {
    if (!object.isMesh || !object.geometry || !object.material || isBatchedScenerySource(object) || object.userData.collider || /^COLLIDER[_-]/i.test(object.name)) return;
    const isStaticBatch = warmAllScenery && (object.isBatchedMesh || object.isInstancedMesh || object.name?.startsWith('Merged static scenery'));
    if (!isStaticBatch && object.frustumCulled && !frustum.intersectsObject(object)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material.visible) continue;
      for (const value of materialTextures(material)) add(value);
    }
  });
  let sliceStart = now(), initialized = 0, yields = 0, maxUploadMs = 0;
  for (const texture of textures) {
    if (!isCurrent()) break;
    const before = now(); renderer.initTexture(texture); uploaded.set(texture, texture.version); maxUploadMs = Math.max(maxUploadMs, now() - before); initialized++;
    if (initialized < textures.size && now() - sliceStart >= budgetMs) { await yieldTask(); yields++; sliceStart = now(); }
  }
  return {selected: textures.size, initialized, yields, maxUploadMs, ms: now() - start, canceled: !isCurrent()};
}
