import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BufferGeometry, BufferAttribute } from 'three';
import { normalizePackedVertexAttributes, normalizePackedVertexAttributesAsync } from '../src/packed-vertex-attributes.js';

function scene() {
  const root = new Group();
  for (let n = 0; n < 24; n++) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Int16Array([-32768, n, 32767, 100, -100, n]), 3, true));
    geometry.setAttribute('uv', new BufferAttribute(new Uint8Array([0, 255, 128, 64]), 2, true));
    root.add(new Mesh(geometry), new Mesh(geometry));
  }
  return root;
}

test('sliced conversion allows an input task before completion and exactly preserves synchronous geometry', async () => {
  const expected = scene(), actual = scene();
  const count = normalizePackedVertexAttributes([expected]);
  let inputHandled = false, completed = false;
  const input = new Promise(resolve => setTimeout(() => { inputHandled = true; assert.equal(completed, false); resolve(); }, 0));
  const converted = await normalizePackedVertexAttributesAsync([actual], { budgetMs: 0 });
  completed = true;
  await input;
  assert.equal(inputHandled, true);
  assert.equal(converted, count);
  for (let i = 0; i < actual.children.length; i++) {
    const a = actual.children[i].geometry, b = expected.children[i].geometry;
    for (const name of ['position', 'uv']) assert.deepEqual(a.attributes[name].array, b.attributes[name].array);
    if (i % 2 === 1) assert.equal(a, actual.children[i - 1].geometry, 'shared geometry remains shared');
    a.computeBoundingBox(); b.computeBoundingBox();
    assert.deepEqual(a.boundingBox, b.boundingBox);
  }
  assert.equal(await normalizePackedVertexAttributesAsync([actual]), 0);
});

test('already-compatible geometry finishes without a yield or replacement', async () => {
  const root = new Group(), geometry = new BufferGeometry(), positions = new BufferAttribute(new Float32Array([1, 2, 3]), 3);
  geometry.setAttribute('position', positions);
  root.add(new Mesh(geometry));
  let yields = 0;
  assert.equal(await normalizePackedVertexAttributesAsync([root], { budgetMs: 0, yieldTask: () => { yields++; } }), 0);
  assert.equal(yields, 0);
  assert.equal(geometry.attributes.position, positions);
});
