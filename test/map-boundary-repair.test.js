import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sameBox} from '../tools/import-source-hierarchy.js';

for(const id of ['hangar-c03-demo','liftoff-arena-demo','minus-two-demo','liftoff-pine-valley-demo','liftoff-the-green-demo'])test(`${id}: retired source boundary walls cannot collide with flight or camera`,()=>{
  const base='content/maps/'+id+'/',report=JSON.parse(readFileSync(base+'boundary-repair.json')),colliders=JSON.parse(readFileSync(base+'collision.json'));
  assert.equal(colliders.length,report.after);assert.equal(report.before-report.after,report.removed.length);
  for(const retired of report.removed)assert.equal(colliders.some(c=>sameBox(c,retired.shape)),false,retired.path);
});
