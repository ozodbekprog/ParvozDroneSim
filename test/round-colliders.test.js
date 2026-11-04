import test from 'node:test';
import assert from 'node:assert/strict';
import {sphereContacts,sweepSphere,collisionCandidates} from '../shared/collision.js';
import {validateColliders} from '../shared/catalog-schema.js';
const capsule={type:'capsule',position:[0,2,0],size:[2,4,2],radius:1,halfLength:1,axis:1};
test('round tree collision has no invisible box corners but retains the trunk and rounded ends',()=>{
  assert.equal(sphereContacts([.9,3.9,.9],.05,capsule).length,0);
  assert.equal(sweepSphere([.9,3.9,-2],[.9,3.9,2],.05,capsule),null);
  assert.ok(sphereContacts([.9,2,0],.2,capsule)[0].depth>.29);
  assert.ok(sweepSphere([-3,2,0],[3,2,0],.1,capsule));
  const hit=sweepSphere([0,6,0],[0,2,0],.1,capsule);assert.ok(Math.abs(hit.time-.475)<1e-9);
});
test('round collision sweeps are continuous through fast motion and transformed capsules',()=>{
  const rotated={...capsule,rotation:[0,0,Math.PI/2]};
  assert.equal(sphereContacts([1.9,2.9,.9],.05,rotated).length,0);
  const hit=sweepSphere([-100,2,0],[100,2,0],.1,rotated);
  assert.ok(Math.abs(hit.time-.4895)<1e-9);assert.ok(hit.normal[0]<-.99);
  assert.equal(collisionCandidates([rotated],[2,2,0],.2).length,1);
  const sphere={...capsule,halfLength:0,size:[2,2,2]};
  assert.ok(Math.abs(sweepSphere([-10,2,0],[10,2,0],.1,sphere).time-.445)<1e-9);
  assert.equal(sweepSphere([-3,3.11,0],[3,3.11,0],.1,sphere),null);
});
test('round collider dimensions and direction are validated',()=>{
  validateColliders([capsule]);
  assert.throws(()=>validateColliders([{...capsule,radius:-1}]));
  assert.throws(()=>validateColliders([{...capsule,axis:3}]));
  assert.throws(()=>validateColliders([{...capsule,size:[.1,.1,.1]}]));
});
