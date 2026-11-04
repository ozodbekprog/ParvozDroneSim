import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { cooperativeImageViews } from '../../src/cooperative-image-views.js';
import { normalizePackedVertexAttributesAsync } from '../../src/packed-vertex-attributes.js';

const asset = document.querySelector('#asset'), backend = document.querySelector('#backend');
const run = document.querySelector('#run'), status = document.querySelector('#status'), report = document.querySelector('#report');
const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
const hashJSON = value => hash(new TextEncoder().encode(JSON.stringify(value)));
const previous = [];

async function inventory(root) {
  const geometries = new Set(), textures = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  const geometryRows = [], textureRows = [];
  const attributeRow = async attribute => attribute ? [attribute.itemSize, attribute.normalized, attribute.offset || 0, attribute.data?.stride || 0, attribute.array.constructor.name, await hash(attribute.array)] : null;
  for (const geometry of geometries) {
    const attributes = [], morphs = [];
    for (const name of Object.keys(geometry.attributes).sort()) attributes.push([name, await attributeRow(geometry.attributes[name])]);
    for (const name of Object.keys(geometry.morphAttributes).sort()) morphs.push([name, await Promise.all(geometry.morphAttributes[name].map(attributeRow))]);
    geometryRows.push([attributes, await attributeRow(geometry.index), morphs, geometry.groups]);
  }
  let mipBytes = 0;
  for (const texture of textures) {
    const mips = [];
    for (const mip of texture.mipmaps) {
      if (!mip.data) throw Error('This check requires compressed/data texture mip payloads');
      mipBytes += mip.data.byteLength;
      mips.push([mip.width, mip.height, await hash(mip.data)]);
    }
    if (!mips.length) throw Error('Use an asset with embedded KTX2 mip payloads');
    textureRows.push([texture.name, texture.format, texture.type, texture.colorSpace, texture.flipY, texture.minFilter, texture.magFilter, texture.wrapS, texture.wrapT, texture.generateMipmaps, texture.channel, texture.offset.toArray(), texture.repeat.toArray(), texture.rotation, texture.userData, mips]);
  }
  return { geometries: geometries.size, textures: textures.size, mipBytes, geometryHash: await hashJSON(geometryRows), textureHash: await hashJSON(textureRows) };
}

function dispose(root) {
  const resources = new Set();
  root.traverse(object => {
    if (object.geometry) resources.add(object.geometry);
    if (object.isInstancedMesh) resources.add(object);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) {
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
  });
  for (const resource of resources) resource.dispose();
}

async function rendererFor(canvas, kind) {
  // A canvas keeps its context type after renderer.dispose(). A fresh surface
  // is required when switching WebGPU and WebGL in the same comparison page.
  const surface = canvas.cloneNode(false); canvas.replaceWith(surface);
  const options = { canvas: surface, antialias: false, preserveDrawingBuffer: true };
  const renderer = kind === 'webgl' ? new THREE.WebGLRenderer(options) : new (await import('three/webgpu')).WebGPURenderer({ ...options, forceWebGL: kind === 'webgl2' });
  if (renderer.init) await renderer.init();
  renderer.setPixelRatio(1); renderer.setSize(640, 360, false);
  return renderer;
}

async function render(gltf, renderer) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#252d36');
  scene.add(gltf.scene, new THREE.HemisphereLight(0xffffff, 0x555566, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.position.set(4, 6, 3); scene.add(sun);
  const bounds = new THREE.Box3().setFromObject(gltf.scene), center = bounds.getCenter(new THREE.Vector3());
  const radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 0.01);
  const camera = new THREE.PerspectiveCamera(45, 640 / 360, radius / 1000, radius * 100);
  camera.position.copy(center).add(new THREE.Vector3(1, 0.65, 1).normalize().multiplyScalar(radius * 2.9)); camera.lookAt(center);
  scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);
  await new Promise(resolve => requestAnimationFrame(resolve));
  renderer.render(scene, camera);
  // Reading pixels is outside the measured load interval. WebGPU uses a render
  // target because its canvas texture is not a portable CPU readback surface.
  let pixels;
  if (renderer.isWebGLRenderer) {
    pixels = new Uint8Array(640 * 360 * 4);
    const gl = renderer.getContext(); gl.readPixels(0, 0, 640, 360, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  } else {
    const target = new THREE.RenderTarget(640, 360, { type: THREE.UnsignedByteType });
    try { renderer.setRenderTarget(target); renderer.render(scene, camera); pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 640, 360); }
    finally { renderer.setRenderTarget(null); target.dispose(); }
  }
  let foregroundPixels = 0;
  for (let i = 4; i < pixels.length; i += 4) if (pixels[i] !== pixels[0] || pixels[i + 1] !== pixels[1] || pixels[i + 2] !== pixels[2]) foregroundPixels++;
  return { pixels, foregroundPixels, framebuffer: renderer.getDrawingBufferSize(new THREE.Vector2()).toArray(), contextLost: renderer.isWebGLRenderer ? renderer.getContext().isContextLost() : false };
}

async function compare() {
  run.disabled = true; report.textContent = ''; status.textContent = 'Loading and comparing…';
  for (const entry of previous.splice(0)) { dispose(entry.gltf.scene); entry.renderer.dispose(); }
  try {
    const response = await fetch(asset.value); if (!response.ok) throw Error(`Asset HTTP ${response.status}`);
    const bytes = await response.arrayBuffer(), sourceHash = await hash(bytes), results = [];
    for (const directKtx2 of [false, true]) {
      const renderer = await rendererFor(document.querySelector(directKtx2 ? '#direct' : '#baseline'), backend.value);
      const ktx2 = new KTX2Loader().setTranscoderPath('/runtime/basis/').setWorkerLimit(1).detectSupport(renderer);
      await ktx2.init();
      let imageBlobURLs = 0;
      const create = URL.createObjectURL;
      URL.createObjectURL = function (blob) { if (blob.type === 'image/ktx2') imageBlobURLs++; return create.call(this, blob); };
      let gltf, loadMs;
      try {
        const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder).register(parser => cooperativeImageViews(parser, { directKtx2 }));
        const start = performance.now();
        gltf = await loader.parseAsync(bytes.slice(0), new URL('.', new URL(asset.value, location.href)).href);
        await normalizePackedVertexAttributesAsync(gltf.scenes);
        loadMs = performance.now() - start;
      } catch (error) { renderer.dispose(); ktx2.dispose(); throw error; }
      finally { URL.createObjectURL = create; }
      previous.push({ renderer, gltf });
      let payload, rendered;
      try { payload = await inventory(gltf.scene); rendered = await render(gltf, renderer); }
      finally { ktx2.dispose(); }
      results.push({ path: directKtx2 ? 'direct' : 'Blob', backend: renderer.backend?.isWebGPUBackend ? 'WebGPU' : renderer.isWebGLRenderer ? 'WebGLRenderer' : 'WebGL2 fallback', loadMs: Math.round(loadMs), imageBlobURLs, ...payload, ...rendered });
      status.textContent = directKtx2 ? 'Checking equivalence…' : 'Control complete; checking direct decoder path…';
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    const [baseline, direct] = results;
    let differentPixels = 0, maxChannelDelta = 0;
    for (let i = 0; i < baseline.pixels.length; i += 4) {
      let changed = false;
      for (let channel = 0; channel < 4; channel++) { const delta = Math.abs(baseline.pixels[i + channel] - direct.pixels[i + channel]); if (delta) changed = true; maxChannelDelta = Math.max(maxChannelDelta, delta); }
      if (changed) differentPixels++;
    }
    const geometryEqual = baseline.geometryHash === direct.geometryHash, texturesEqual = baseline.textureHash === direct.textureHash;
    const passed = geometryEqual && texturesEqual && differentPixels === 0 && baseline.foregroundPixels > 100 && direct.foregroundPixels > 100 && baseline.imageBlobURLs > 0 && direct.imageBlobURLs === 0;
    status.textContent = passed ? 'PASS — identical geometry, texture settings/mips and rendered pixels; zero KTX2 Blob URLs.' : 'FAIL — inspect comparison details.';
    report.textContent = JSON.stringify({ passed, threeRevision: THREE.REVISION, asset: asset.value, sourceHash, width: 640, height: 360, geometryEqual, texturesEqual, differentPixels, maxChannelDelta, note: 'Control-first observations; no target-hardware FPS claim.', results: results.map(({ pixels, ...row }) => row) }, null, 2);
  } catch (error) { status.textContent = 'FAIL — ' + error.message; report.textContent = error.stack; console.error(error); }
  finally { run.disabled = false; }
}

try {
  // The normal Vite server intentionally exposes only hashed delivery assets;
  // read the checked-in catalog through its explicit development-only path.
  const response = await fetch('/public/content/catalog.json'); if (!response.ok) throw Error(`Catalog HTTP ${response.status}`);
  const catalog = await response.json();
  for (const [kind, entries] of [['Drone', catalog.drones], ['Map', catalog.maps]]) for (const entry of entries) {
    const models = entry.modelLods || [{ model: entry.model }];
    for (let i = 0; i < models.length; i++) {
      const option = new Option(`${kind}: ${entry.id}${models.length > 1 ? ` · LOD ${i}` : ''}`, models[i].model);
      asset.add(option);
      if (entry.id === 'luma-5' && i === 1) asset.value = option.value;
    }
  }
  status.textContent = 'Ready. Choose an asset and compare the loader paths.'; run.disabled = false;
} catch (error) { status.textContent = 'FAIL — ' + error.message; }
run.addEventListener('click', compare);
