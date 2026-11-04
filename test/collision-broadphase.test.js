import test from 'node:test';
import assert from 'node:assert/strict';
import {collisionCandidates,iterateNearbyColliders,prepareCollisions,sphereContacts} from '../shared/collision.js';
import {createDroneState,resolveEnvironmentCollision} from '../shared/physics.js';

test('oriented edges, giant ground and mesh bounds remain collision candidates',()=>{
  const rotated={position:[0,0,0],size:[30,2,2],rotation:[0,Math.PI/4,0]};
  const ground={position:[0,-3,0],size:[2000,2,2000]};
  const mesh={type:'mesh',vertices:[-800,6,-800,800,6,-800,0,6,800]};
  const obstacles=[rotated,ground,mesh];prepareCollisions(obstacles);
  for(const [center,radius,target] of [[[10.6,2,-10.6],1.1,rotated],[[700,-1.8,700],.3,ground],[[0,6.1,0],.2,mesh]]) {
    assert.ok(sphereContacts(center,radius,target).length>0);
    assert.ok(collisionCandidates(obstacles,center,radius).includes(target));
  }
  assert.deepEqual(collisionCandidates(obstacles,[0,0,0],1000),obstacles);
});

test('grid candidates preserve original order, deduplicate cells and match full narrowphase contacts',()=>{
  const obstacles=Array.from({length:400},(_,i)=>({position:[(i%20)*18-170,Math.floor(i/100)*5,Math.floor(i/20)*18-170],size:[3+i%7,3,9],rotation:[0,(i%9)*.31,0]}));
  obstacles.splice(40,0,{position:[0,-3,0],size:[1500,2,1500]});prepareCollisions(obstacles);
  for(let i=0;i<80;i++) {
    const center=[Math.sin(i*1.7)*160,(i%5)*3,Math.cos(i*.7)*160],radius=.8+i%3;
    const nearby=collisionCandidates(obstacles,center,radius);
    assert.equal(new Set(nearby).size,nearby.length);
    assert.deepEqual(nearby.map(o=>obstacles.indexOf(o)),nearby.map(o=>obstacles.indexOf(o)).sort((a,b)=>a-b));
    const full=obstacles.filter(o=>sphereContacts(center,radius,o).length);
    assert.deepEqual(nearby.filter(o=>sphereContacts(center,radius,o).length),full);
    assert.ok(nearby.length<30,'distant grid boxes should not enter narrowphase');
  }
});

test('deep positional correction requeries later colliders without changing resolution order',()=>{
  const obstacles=[{position:[0,0,0],size:[100,100,100]},{position:[52,0,0],size:[1,2,2]},{position:[-50,0,0],size:[1,2,2]}];
  const initial=[49.5,0,0];
  assert.deepEqual(collisionCandidates(obstacles,initial,1),[obstacles[0]]);
  function resolve(indexed) {
    const position=[...initial],visited=[];
    for(const obstacle of indexed?iterateNearbyColliders(obstacles,()=>position,1):obstacles) {
      visited.push(obstacle);
      for(const contact of sphereContacts(position,1,obstacle))for(let axis=0;axis<3;axis++)position[axis]+=contact.normal[axis]*contact.depth;
    }
    return {position,visited};
  }
  const full=resolve(false),indexed=resolve(true);assert.deepEqual(indexed.position,full.position);
  assert.deepEqual(indexed.visited,[obstacles[0],obstacles[1]]);
});

test('physics query encloses offset rotor spheres and accepts a fresh static array',()=>{
  const rotorObstacle={position:[3,10,0],size:[.2,2,2],rotation:[0,.2,0]};
  const spec={collision:{spheres:[{position:[0,0,0],radius:.1},{position:[3,0,0],radius:.25}]}};
  const state=createDroneState([0,10,0]);state.velocity=[5,0,0];
  resolveEnvironmentCollision(state,{theme:'custom'},null,[rotorObstacle],spec);
  assert.notDeepEqual(state.position,[0,10,0]);
  const previous=[{position:[100,0,0],size:[1,1,1]}];prepareCollisions(previous);
  const current=[...previous,{position:[0,0,0],size:[1,1,1]}];
  assert.equal(collisionCandidates(previous,[0,0,0],1).length,0);
  assert.deepEqual(collisionCandidates(current,[0,0,0],1),[current[1]]);
});
