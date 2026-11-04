import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial, Matrix4, BatchedMesh } from 'three';
import { batchStaticScenery, batchStaticSceneryAsync, isBatchedScenerySource, setBatchLODVisible } from '../src/scenery-batches.js';

function fixture(count = 12) {
  const scene = new Group(), root = new Group(), material = new MeshStandardMaterial(), geometry = new BoxGeometry();
  scene.add(root); root.userData.visualLod = {};
  const objects = [];
  for (let level = 0; level < 2; level++) {
    const group = new Group(); group.visible = level === 0; root.add(group);
    for (let i = 0; i < count; i++) { const object = new Mesh(geometry, material); object.position.set(i, level, 0); group.add(object); objects.push(object); }
  }
  return { scene, root, objects };
}
function snapshot(result) {
  return result.container.children.map(batch => ({
    instanced: !!batch.isInstancedMesh, positions: [...batch.geometry.attributes.position.array], indices: [...batch.geometry.index.array],
    matrices: Array.from({ length: batch.capacity ?? batch.instanceCount }, (_, i) => { const m = new Matrix4(); batch.getMatrixAt(i, m); return m.elements; }),
    visible: Array.from({ length: batch.capacity ?? batch.instanceCount }, (_, i) => batch.getVisibleAt(i)),
  }));
}

for (const instancing of [false, true]) test(`sliced scenery assembly yields before publication and preserves geometry/transforms/LOD (instancing=${instancing})`, async () => {
  const expected = fixture(), actual = fixture(), options = { instancing };
  const baseline = batchStaticScenery([expected.root], expected.scene, options);
  let during;
  const input = new Promise(resolve => setTimeout(() => { during = { published: actual.scene.children.length > 1, hidden: actual.objects.some(o => !o.visible) }; resolve(); }, 0));
  const result = await batchStaticSceneryAsync([actual.root], actual.scene, { ...options, budgetMs: 0 });
  assert.deepEqual(during, { published: false, hidden: false }, 'input must run while the original scene is still intact');
  await input;
  assert.equal(result.meshes, baseline.meshes);
  assert.deepEqual(snapshot(result), snapshot(baseline));
  setBatchLODVisible(actual.root.children[0], false); setBatchLODVisible(actual.root.children[1], true);
  setBatchLODVisible(expected.root.children[0], false); setBatchLODVisible(expected.root.children[1], true);
  assert.deepEqual(snapshot(result), snapshot(baseline));
});

test('canceling after batch allocation releases new buffers without hiding sources or publishing a stale scene', async () => {
  const { scene, root, objects } = fixture(120);
  let checks = 0, disposed = 0;
  const original = BatchedMesh.prototype.dispose;
  BatchedMesh.prototype.dispose = function () { disposed++; return original.call(this); };
  try {
    await assert.rejects(batchStaticSceneryAsync([root], scene, { budgetMs: 0, shouldContinue: () => ++checks < 260, yieldTask: () => Promise.resolve() }), { name: 'AbortError' });
    assert.equal(scene.children.length, 1);
    assert.ok(objects.every(o => o.visible && !isBatchedScenerySource(o)));
    assert.ok(disposed > 0, 'allocated batches need cleanup');
  } finally { BatchedMesh.prototype.dispose = original; }
});
