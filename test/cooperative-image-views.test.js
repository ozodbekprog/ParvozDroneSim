import test from 'node:test';
import assert from 'node:assert/strict';
import { Texture, CompressedTexture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { cooperativeImageViews } from '../src/cooperative-image-views.js';
import { directEmbeddedKtx2 } from '../src/embedded-ktx2.js';

function texturedScene(count = 12, configure = () => {}) {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), bin = Buffer.alloc(36 + count * 16);
  Buffer.from(positions.buffer).copy(bin);
  const views = [{ buffer: 0, byteOffset: 0, byteLength: 36 }], images = [], textures = [], materials = [], meshes = [];
  for (let i = 0; i < count; i++) {
    bin.fill(i + 1, 36 + i * 16, 36 + (i + 1) * 16);
    views.push({ buffer: 0, byteOffset: 36 + i * 16, byteLength: 16 });
    images.push({ bufferView: i + 1, mimeType: 'image/ktx2' });
    textures.push({ extensions: { KHR_texture_basisu: { source: i } } });
    materials.push({ pbrMetallicRoughness: { baseColorTexture: { index: i } } });
    meshes.push({ primitives: [{ attributes: { POSITION: 0 }, material: i }] });
  }
  const json = { asset: { version: '2.0' }, extensionsUsed: ['KHR_texture_basisu'], extensionsRequired: ['KHR_texture_basisu'], buffers: [{ byteLength: bin.length }], bufferViews: views, images, textures, materials, meshes, accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }], nodes: meshes.map((_, mesh) => ({ mesh })), scenes: [{ nodes: meshes.map((_, i) => i) }], scene: 0 };
  configure(json);
  const text = Buffer.from(JSON.stringify(json)), size = (text.length + 3) & ~3, glb = Buffer.alloc(28 + size + bin.length);
  glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8); glb.writeUInt32LE(size, 12); glb.writeUInt32LE(0x4e4f534a, 16); glb.fill(32, 20, 20 + size); text.copy(glb, 20); glb.writeUInt32LE(bin.length, 20 + size); glb.writeUInt32LE(0x004e4942, 24 + size); bin.copy(glb, 28 + size);
  return glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.length);
}

test('real GLTF embedded-image pipeline yields between Blob URLs while preserving image and geometry bytes', async () => {
  const self = globalThis.self, create = URL.createObjectURL;
  globalThis.self = globalThis;
  let clock = 0, created = 0, inputAt = null, input;
  URL.createObjectURL = function (blob) { if (created === 0) input = new Promise(resolve => setTimeout(() => { inputAt = created; resolve(); }, 0)); created++; clock += 5; return create.call(this, blob); };
  const textureLoader = { load(uri, onLoad, _progress, onError) { fetch(uri).then(r => r.arrayBuffer()).then(bytes => { const t = new Texture(); t.userData.bytes = [...new Uint8Array(bytes)]; onLoad(t); }).catch(onError); } };
  try {
    const loader = new GLTFLoader().setKTX2Loader(textureLoader).register(parser => cooperativeImageViews(parser, { budgetMs: 8, now: () => clock }));
    const result = await loader.parseAsync(texturedScene(), '');
    assert.ok(inputAt > 0 && inputAt < 12, `input ran after ${inputAt} of 12 Blob URLs`);
    await input;
    result.scene.children.forEach((mesh, i) => { assert.deepEqual(mesh.material.map.userData.bytes, Array(16).fill(i + 1)); assert.deepEqual([...mesh.geometry.attributes.position.array], [0, 0, 0, 1, 0, 0, 0, 1, 0]); });
  } finally { URL.createObjectURL = create; if (self === undefined) delete globalThis.self; else globalThis.self = self; }
});

test('direct embedded KTX2 decoding makes no Blob URLs, yields, and does not detach GLB geometry', async () => {
  const create = URL.createObjectURL;
  let created = 0, decoded = 0, clock = 0, inputAt;
  URL.createObjectURL = function (blob) { created++; return create.call(this, blob); };
  const input = new Promise(resolve => setTimeout(() => { inputAt = decoded; resolve(); }, 0));
  const ktx2 = {
    load() { assert.fail('embedded KTX2 should not fetch a URL'); },
    parse(buffer, onLoad) {
      const transferred = structuredClone(buffer, { transfer: [buffer] });
      const texture = new Texture(); texture.userData.bytes = [...new Uint8Array(transferred)];
      decoded++; clock += 5; onLoad(texture);
    },
  };
  const glb = texturedScene(), byteLength = glb.byteLength;
  try {
    const loader = new GLTFLoader().setKTX2Loader(ktx2).register(parser => cooperativeImageViews(parser, { budgetMs: 8, now: () => clock }));
    const result = await loader.parseAsync(glb, '');
    await input;
    assert.equal(created, 0);
    assert.equal(decoded, 12);
    assert.ok(inputAt > 0 && inputAt < decoded, `input ran after ${inputAt} of ${decoded} decodes`);
    assert.equal(glb.byteLength, byteLength, 'the worker may transfer the copied image view, never the GLB');
    result.scene.children.forEach((mesh, i) => {
      assert.deepEqual(mesh.material.map.userData.bytes, Array(16).fill(i + 1));
      assert.deepEqual([...mesh.geometry.attributes.position.array], [0, 0, 0, 1, 0, 0, 0, 1, 0]);
    });
  } finally { URL.createObjectURL = create; }
});

test('direct and Blob paths preserve shared-image clones, samplers, transforms, names and metadata', async () => {
  const savedSelf = globalThis.self, create = URL.createObjectURL;
  globalThis.self = globalThis;
  let created = 0, parsed = 0;
  URL.createObjectURL = function (blob) { created++; return create.call(this, blob); };
  const texture = buffer => {
    const result = new CompressedTexture([{ data: new Uint8Array(buffer), width: 4, height: 4 }], 4, 4);
    result.userData.decoder = 'fixture'; return result;
  };
  const ktx2 = {
    load(uri, onLoad, _progress, onError) { fetch(uri).then(response => response.arrayBuffer()).then(bytes => onLoad(texture(bytes))).catch(onError); },
    parse(bytes, onLoad) { parsed++; onLoad(texture(bytes)); },
  };
  const glb = texturedScene(3, json => {
    json.images[0].extras = { provenance: 'fixture' }; json.images[0].name = 'shared image';
    json.textures[2].extensions.KHR_texture_basisu.source = 0;
    json.samplers = [{ magFilter: 9728, minFilter: 9984, wrapS: 33071, wrapT: 33648 }, { magFilter: 9729, minFilter: 9729, wrapS: 10497, wrapT: 33071 }];
    json.textures[0].sampler = 0; json.textures[2].sampler = 1; json.textures[2].name = 'different sampler';
    json.extensionsUsed.push('KHR_texture_transform');
    json.materials[2].pbrMetallicRoughness.baseColorTexture.extensions = { KHR_texture_transform: { offset: [0.25, 0.5], scale: [2, 3], rotation: 0.2 } };
  });
  const snapshot = result => result.scene.children.map(mesh => {
    const t = mesh.material.map;
    return { name: t.name, flipY: t.flipY, min: t.minFilter, mag: t.magFilter, s: t.wrapS, t: t.wrapT, mips: t.generateMipmaps, format: t.format, colorSpace: t.colorSpace, channel: t.channel, offset: t.offset.toArray(), repeat: t.repeat.toArray(), rotation: t.rotation, userData: t.userData, bytes: [...t.mipmaps[0].data] };
  });
  try {
    const load = directKtx2 => new GLTFLoader().setKTX2Loader(ktx2).register(parser => cooperativeImageViews(parser, { directKtx2 })).parseAsync(glb.slice(0), '');
    const baseline = await load(false);
    assert.equal(created, 2, 'legacy source cache should load the two referenced images once each');
    const direct = await load(true);
    assert.equal(created, 2, 'direct path should add no object URLs');
    assert.equal(parsed, 2);
    assert.deepEqual(snapshot(direct), snapshot(baseline));
    const [first, , third] = direct.scene.children.map(mesh => mesh.material.map);
    assert.notEqual(first, third, 'sampler/transform variants need separate texture objects');
    assert.equal(first.source, third.source, 'variants must still share the decoded source');
  } finally { URL.createObjectURL = create; if (savedSelf === undefined) delete globalThis.self; else globalThis.self = savedSelf; }
});

test('external images and non-KTX2 decoders keep GLTFLoader handling', async () => {
  const calls = [], ktx2 = { parse() { assert.fail('not a direct embedded KTX2 source'); } };
  const parser = { json: { images: [{ uri: 'external.ktx2' }, { bufferView: 0, mimeType: 'image/png' }] }, options: { ktx2Loader: ktx2 }, loadImageSource(index, loader) { calls.push([index, loader]); return Promise.resolve(index); } };
  directEmbeddedKtx2(parser);
  const bitmap = { isImageBitmapLoader: true, parse() { assert.fail('PNG must not be sent to KTX2 parse'); } };
  assert.equal(await parser.loadImageSource(0, ktx2), 0);
  assert.equal(await parser.loadImageSource(1, bitmap), 1);
  assert.deepEqual(calls, [[0, ktx2], [1, bitmap]]);
});

test('a failed direct decode rejects without stranding later cooperative work or creating URLs', async () => {
  const fault = new Error('invalid KTX2 payload'), callbacks = [];
  const ktx2 = { parse(buffer, onLoad, onError) { callbacks.push(buffer); if (callbacks.length === 1) onError(fault); else onLoad(new Texture()); } };
  const parser = { json: { images: [{ bufferView: 0 }, { bufferView: 1 }], bufferViews: [{}, {}] }, options: { ktx2Loader: ktx2 }, sourceCache: {}, loadImageSource() { assert.fail('no fallback for corrupt embedded KTX2'); }, loadBufferView: index => Promise.resolve(new Uint8Array([index]).buffer) };
  const plugin = cooperativeImageViews(parser);
  parser.getDependency = (_type, index) => plugin.loadBufferView(index);
  await assert.rejects(parser.loadImageSource(0, ktx2), error => error === fault);
  assert.ok(await parser.loadImageSource(1, ktx2));
  assert.equal(callbacks.length, 2);
  ktx2.parse = () => { throw fault; };
  parser.sourceCache = {};
  await assert.rejects(parser.loadImageSource(0, ktx2), error => error === fault);
});
