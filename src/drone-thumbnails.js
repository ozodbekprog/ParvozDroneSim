import * as THREE from 'three';
import { resolveBuild } from '../shared/physics.js';
import { DRONES } from '../shared/catalog.js';
import { createDrone, disposeObject } from '../public/content/recipes.js';

const thumbnails = new Map();
const CANCELLED = Symbol('cancelled');
let current = null;
let queue = Promise.resolve();

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  return value;
}

function cacheKey(entry, revision) {
  const {drone,frame,motors,propellers,battery,camera,antenna,color,led,actionCamera}=entry.build;
  return JSON.stringify([revision || '', stableValue({drone,frame,motors,propellers,battery,camera,antenna,color,led,actionCamera})]);
}

function showThumbnail(image, source) {
  if (!image.isConnected) return;
  if (image.getAttribute('src') !== source) image.src = source;
  image.hidden = false;
  image.dataset.previewReady = 'true';
}

function textureTasks(mesh) {
  const tasks = new Set();
  mesh.traverseVisible(object => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture && value.assetsReady) tasks.add(value.assetsReady);
    }
  });
  return [...tasks];
}

function visibleBounds(mesh) {
  const bounds = new THREE.Box3();
  mesh.updateMatrixWorld(true);
  mesh.traverseVisible(object => {
    if (!object.geometry) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    if (object.geometry.boundingBox) bounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  return bounds;
}

async function renderThumbnail(renderer, scene, camera, request, entry) {
  const spec=resolveBuild(entry.build);
  const thumbnailModel=item=>{const model=item.modelLods?.[item.lowLod??1]?.model;return model?{...item,model,modelLods:undefined}:item;};
  const mesh = createDrone({...thumbnailModel(spec),visualParts:spec.visualParts.map(thumbnailModel)});
  scene.add(mesh);
  const assets = Promise.resolve(mesh.assetsReady);
  // A custom model can finish loading after cancellation. Its children must
  // release their shared asset references even when this renderer is gone.
  assets.then(() => { if (request.cancelled) disposeObject(mesh); }, () => { if (request.cancelled) disposeObject(mesh); });
  try {
    const ready = assets.then(() => request.cancelled ? undefined : Promise.all(textureTasks(mesh)));
    const result = await Promise.race([ready, request.interrupted]);
    if (result === CANCELLED || request.cancelled) return null;
    const bounds = visibleBounds(mesh);
    if (bounds.isEmpty()) return null;
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) return null;
    const vertical = THREE.MathUtils.degToRad(camera.fov) / 2;
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    const distance = sphere.radius / Math.sin(Math.min(vertical, horizontal)) * 1.12;
    camera.position.copy(sphere.center).add(new THREE.Vector3(1.15, 0.9, 1.4).normalize().multiplyScalar(distance));
    camera.near = Math.max(0.001, distance / 1000);
    camera.far = distance + sphere.radius * 8;
    camera.lookAt(sphere.center);
    camera.updateProjectionMatrix();
    if (renderer.getContext().isContextLost()) return null;
    renderer.render(scene, camera);
    const canvas = renderer.domElement;
    if (typeof canvas.toBlob === 'function' && typeof URL.createObjectURL === 'function') {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return null;
      const objectUrl = URL.createObjectURL(blob);
      if (request.cancelled) { URL.revokeObjectURL?.(objectUrl); return null; }
      return objectUrl;
    }
    return canvas.toDataURL('image/png');
  } finally {
    scene.remove(mesh);
    disposeObject(mesh);
  }
}

async function generate(request) {
  if (request.cancelled) return;
  let renderer;
  const scene = new THREE.Scene();
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(256, 144, false);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene.add(new THREE.HemisphereLight('#d3efff', '#293246', 2.4));
    const key = new THREE.DirectionalLight('#fff1d8', 3);
    key.position.set(3, 4, 5);
    const rim = new THREE.DirectionalLight('#91cfff', 1.5);
    rim.position.set(-3, 2, -4);
    scene.add(key, rim);
    const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.01, 100);
    for (const task of request.tasks) {
      if (request.cancelled) break;
      // Give the main scene and menu a frame between thumbnail uploads.
      const frame = await Promise.race([new Promise(resolve => requestAnimationFrame(resolve)), request.interrupted]);
      if (frame === CANCELLED || request.cancelled) break;
      let source = thumbnails.get(task.key);
      if (!source) {
        try { source = await renderThumbnail(renderer, scene, camera, request, task.entry); }
        catch { /* The card's existing silhouette remains if an asset fails. */ }
        if (source && !request.cancelled) {
          thumbnails.set(task.key, source);
          if (thumbnails.size > 64) {
            const oldest = thumbnails.keys().next().value;
            const evicted = thumbnails.get(oldest);
            thumbnails.delete(oldest);
            if (typeof evicted === 'string' && evicted.startsWith('blob:')) URL.revokeObjectURL?.(evicted);
          }
        } else if (typeof source === 'string' && source.startsWith('blob:')) {
          URL.revokeObjectURL?.(source);
        }
      }
      if (!request.cancelled && source) {
        for (const image of task.images) if (image.dataset.dronePreview === task.entry.id) showThumbnail(image, source);
      }
    }
  } catch { /* WebGL thumbnails are optional; the main preview still works. */ }
  finally {
    disposeObject(scene);
    renderer?.dispose();
    renderer?.forceContextLoss();
    if (current === request) current = null;
  }
}

/** Stop image writes immediately and release the generation's WebGL context. */
export function cancelDroneThumbnails() {
  if (!current) return;
  current.cancelled = true;
  current.interrupt(CANCELLED);
  current = null;
}

/** Images use data-drone-preview="<fleet entry.id>" and may start hidden. */
export function restoreDroneThumbnails(elements, entries, revision) {
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  for (const image of elements) {
    const entry = byId.get(image.dataset.dronePreview);
    if (!entry) continue;
    const source = thumbnails.get(cacheKey(entry, revision)) || DRONES[entry.baseDrone]?.thumbnail;
    if (source) showThumbnail(image, source);
  }
}

export function populateDroneThumbnails(elements, entries, revision) {
  cancelDroneThumbnails();
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const tasks = new Map();
  for (const image of elements) {
    const entry = byId.get(image.dataset.dronePreview);
    if (!entry || !image.isConnected) continue;
    const stock=DRONES[entry.baseDrone]?.thumbnail;
    if(stock){showThumbnail(image,stock);if(entry.kind==='original')continue;}
    const key = cacheKey(entry, revision);
    const source = thumbnails.get(key);
    if (source) { showThumbnail(image, source); continue; }
    // Different copies of the same build share a render, while every card
    // keeps its own fleet identity for selection and asynchronous writes.
    const identity = `${key}:${entry.id}`;
    const task = tasks.get(identity) || { key, entry, images: [] };
    task.images.push(image);
    tasks.set(identity, task);
  }
  if (!tasks.size) return Promise.resolve();
  const request = { cancelled: false, tasks: [...tasks.values()] };
  request.interrupted = new Promise(resolve => { request.interrupt = resolve; });
  current = request;
  // Cancellation resolves outstanding waits so a rerender can immediately
  // start the next batch; only one thumbnail renderer exists at a time.
  queue = queue.then(() => generate(request));
  return queue;
}
