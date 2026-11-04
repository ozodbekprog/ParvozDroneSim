import test from 'node:test';
import assert from 'node:assert/strict';
import {deduplicateGlbImages, verifyGlbImageDedup} from '../tools/glb-image-dedup.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CompressedTexture, RGBA_S3TC_DXT5_Format} from 'three';

function glb(json, binary) {
  const text = Buffer.from(JSON.stringify(json)), length = Math.ceil(text.length / 4) * 4;
  const out = Buffer.alloc(28 + length + binary.length);
  out.write('glTF'); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(length, 12); out.writeUInt32LE(0x4e4f534a, 16); out.fill(32, 20, 20 + length); text.copy(out, 20);
  out.writeUInt32LE(binary.length, 20 + length); out.writeUInt32LE(0x004e4942, 24 + length); binary.copy(out, 28 + length);
  return out;
}
function fixture() {
  const image = Buffer.from('identical-image-payload'), duplicateStart = 24;
  const bin = Buffer.alloc(76); image.copy(bin); image.copy(bin, duplicateStart); bin.fill(73, 48, 60); bin.fill(89, 60);
  const json = {asset: {version: '2.0'}, scenes: [{nodes: [0]}], nodes: [{name: 'Authored', mesh: 0, translation: [1, 2, 3]}],
    meshes: [{primitives: [{attributes: {POSITION: 0}, material: 0}]}], accessors: [{bufferView: 2, componentType: 5126, count: 1, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 1]}],
    materials: [{pbrMetallicRoughness: {baseColorTexture: {index: 0}}, normalTexture: {index: 1}}],
    textures: [{source: 0, sampler: 0}, {source: 1, sampler: 1}], samplers: [{wrapS: 10497}, {wrapS: 33071}],
    images: [{bufferView: 0, mimeType: 'image/png', name: 'First'}, {bufferView: 1, mimeType: 'image/png', name: 'Second'}],
    bufferViews: [{buffer: 0, byteLength: image.length}, {buffer: 0, byteOffset: duplicateStart, byteLength: image.length},
      {buffer: 0, byteOffset: 48, byteLength: 12}, {buffer: 1, byteLength: 96, extensions: {EXT_meshopt_compression: {buffer: 0, byteOffset: 60, byteLength: 16, byteStride: 12, count: 8, mode: 'ATTRIBUTES'}}}],
    buffers: [{byteLength: bin.length}, {byteLength: 96, extensions: {EXT_meshopt_compression: {fallback: true}}}]};
  return {json, bin};
}
const read = bytes => JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString().trim());

test('delivery shares identical image views and preserves raw/meshopt streams, samplers, names and nodes', () => {
  const {json, bin} = fixture(), input = glb(json, bin), original = Buffer.from(input);
  const result = deduplicateGlbImages(input), output = read(result.bytes);
  assert.deepEqual(input, original, 'canonical input remains untouched');
  assert.equal(result.report.sharedImageViews, 1);
  assert.equal(result.report.removedBinaryBytes, 20, 'retain the three-byte tail, remove only aligned duplicate bytes');
  assert.deepEqual(output.images.map(image => image.bufferView), [0, 0]);
  assert.equal(output.bufferViews[2].byteOffset, 28);
  assert.equal(output.bufferViews[3].extensions.EXT_meshopt_compression.byteOffset, 40);
  assert.deepEqual(output.samplers, json.samplers); assert.deepEqual(output.nodes, json.nodes);
  assert.deepEqual(output.images.map(image => image.name), ['First', 'Second']);
  assert.equal(verifyGlbImageDedup(input, result.bytes), true);
  const second = deduplicateGlbImages(result.bytes);
  assert.equal(second.report.sharedImageViews, 0); assert.deepEqual(second.bytes, result.bytes);
});

test('a unique image returns the identical source buffer without reserialization', () => {
  const {json, bin} = fixture(); bin[24] ^= 1;
  const input = glb(json, bin), result = deduplicateGlbImages(input);
  assert.equal(result.bytes, input); assert.equal(result.report.removedBinaryBytes, 0);
});

test('identical bytes with different declared MIME types are not merged', () => {
  const {json, bin} = fixture(); json.images[1].mimeType = 'image/ktx2';
  const input = glb(json, bin); assert.equal(deduplicateGlbImages(input).bytes, input);
});

test('unknown buffer-relative extensions and overlapping stored ranges fail closed', () => {
  const first = fixture(); first.json.extensions = {UNRECOGNIZED: {buffer: 0, byteOffset: 48, byteLength: 12}};
  assert.throws(() => deduplicateGlbImages(glb(first.json, first.bin)), /Unsupported buffer-relative/);
  const second = fixture(); second.json.bufferViews.push({buffer: 0, byteOffset: 28, byteLength: 8});
  assert.throws(() => deduplicateGlbImages(glb(second.json, second.bin)), /overlaps another/);
});

test('verification rejects changed geometry and changed material semantics', () => {
  const {json, bin} = fixture(), input = glb(json, bin);
  const changed = structuredClone(json); changed.materials[0].normalTexture.index = 0;
  assert.throws(() => verifyGlbImageDedup(input, glb(changed, bin)), /semantics changed/);
  const corrupt = Buffer.from(bin); corrupt[48] ^= 1;
  assert.throws(() => verifyGlbImageDedup(input, glb(json, corrupt)), /bytes changed/);
});

test('truncated GLBs and invalid view ranges are rejected', () => {
  assert.throws(() => deduplicateGlbImages(Buffer.alloc(28)), /complete GLB/);
  const {json, bin} = fixture(); json.bufferViews[1].byteLength = 1000;
  assert.throws(() => deduplicateGlbImages(glb(json, bin)), /Invalid GLB buffer range/);
});

test('the shipped GLTFLoader decodes shared images once while preserving sampler differences', async () => {
  const {json, bin} = fixture();
  json.images.forEach(image => image.mimeType = 'image/ktx2');
  json.extensionsRequired = ['KHR_texture_basisu']; json.extensionsUsed = ['KHR_texture_basisu'];
  json.textures = [0, 1].map(source => ({sampler: 0, extensions: {KHR_texture_basisu: {source}}}));
  json.materials = [0, 1].map(index => ({pbrMetallicRoughness: {baseColorTexture: {index}}}));
  json.meshes = [0, 1].map(material => ({primitives: [{attributes: {POSITION: 0}, material}]}));
  json.nodes = [0, 1].map(mesh => ({mesh})); json.scenes = [{nodes: [0, 1]}];
  const input = glb(json, bin), output = deduplicateGlbImages(input).bytes, previousSelf = globalThis.self;
  globalThis.self = globalThis;
  try {
    const parse = async bytes => {
      let decodes = 0;
      const loader = new GLTFLoader().setKTX2Loader({load(_url, yes) {
        decodes++;
        queueMicrotask(() => yes(new CompressedTexture([{data: new Uint8Array(16), width: 4, height: 4}], 4, 4, RGBA_S3TC_DXT5_Format)));
      }});
      const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'http://localhost/');
      return {decodes, maps: gltf.scene.children.map(object => object.material.map)};
    };
    const before = await parse(input), after = await parse(output);
    assert.equal(before.decodes, 2); assert.equal(after.decodes, 1);
    assert.equal(after.maps[0], after.maps[1], 'identical image and sampler reuse the configured GPU texture');
    json.textures[1].sampler = 1;
    const different = await parse(deduplicateGlbImages(glb(json, bin)).bytes);
    assert.notEqual(different.maps[0], different.maps[1], 'different samplers retain different configured textures');
    assert.notEqual(different.maps[0].wrapS, different.maps[1].wrapS);
  } finally { if (previousSelf === undefined) delete globalThis.self; else globalThis.self = previousSelf; }
});
