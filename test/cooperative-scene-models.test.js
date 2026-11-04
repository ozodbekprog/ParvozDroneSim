import test from 'node:test';
import assert from 'node:assert/strict';
import { addVisualModelsCooperative } from '../src/cooperative-scene-models.js';

test('cooperative model instantiation yields between slices, bounds concurrency, and seeds distinct GLB URLs first', async () => {
  const items = [
    ...Array.from({ length: 20 }, (_, i) => ({ id: `a-${i}`, modelLods: [{ model: '/a.glb', modelNode: `n${i}` }] })),
    { id: 'b-0', modelLods: [{ model: '/b.glb', modelNode: 'n0' }] },
    ...Array.from({ length: 19 }, (_, i) => ({ id: `a-tail-${i}`, modelLods: [{ model: '/a.glb', modelNode: `t${i}` }] })),
  ];
  let clock = 0, active = 0, maxActive = 0, yields = 0, resultsSeen = 0, firstBatchURLs = [];
  const results = await addVisualModelsCooperative(items, async item => {
    active++; maxActive = Math.max(maxActive, active);
    if (resultsSeen < 8) firstBatchURLs.push(item.modelLods[0].model);
    resultsSeen++;
    await Promise.resolve();
    clock += 2;
    active--;
    return item.id;
  }, {
    batchSize: 8,
    budgetMs: 8,
    now: () => clock,
    yieldTask: async () => { yields++; },
  });
  assert.equal(results.length, 40);
  assert.ok(maxActive <= 8, `expected <=8 concurrent instantiations, got ${maxActive}`);
  assert.ok(firstBatchURLs.includes('/a.glb') && firstBatchURLs.includes('/b.glb'), 'both distinct GLBs start in the initial batch');
  assert.ok(yields >= 3, `expected cooperative yields across 40 items, got ${yields}`);
});

test('canceling stops remaining chunk clones immediately instead of instantiating the rest of the map', async () => {
  const items = Array.from({ length: 100 }, (_, i) => ({ id: i, model: '/map.glb' }));
  let instantiated = 0, alive = true;
  await assert.rejects(addVisualModelsCooperative(items, async item => {
    instantiated++;
    if (instantiated === 16) alive = false;
    return item.id;
  }, { batchSize: 8, budgetMs: 0, shouldContinue: () => alive, yieldTask: async () => {} }), { name: 'AbortError' });
  assert.equal(instantiated, 16);
});
