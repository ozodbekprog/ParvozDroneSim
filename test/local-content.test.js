import test from 'node:test';
import assert from 'node:assert/strict';
import { SoloSession } from '../src/solo-session.js';
import { defaultBuild } from '../shared/physics.js';
import { DEFAULT_FLIGHT_CONTROLLER } from '../shared/flight-controller.js';
import { validateCatalog } from '../shared/catalog-schema.js';
import catalog from '../public/content/catalog.json' with {type:'json'};
import { sphereContacts } from '../shared/collision.js';

test('solo spawns synchronously, freezes on pause, and resets without restarting time',()=>{
  const s=new SoloSession({map:'minus-two-demo',track:'minus-two-demo-stock-practice',mode:'race',user:{id:'pilot',username:'Pilot',build:defaultBuild()},profile:DEFAULT_FLIGHT_CONTROLLER,now:0});
  assert(s.state.position.every(Number.isFinite)); s.update(0,{},'acro',3000);
  for(let n=0;n<30;n++)s.update(1/60,{throttle:.6},'acro',3000+(n+1)*1000/60);
  assert(s.elapsed>490); const elapsed=s.elapsed; const state=structuredClone(s.state);
  s.pause(); s.update(1,{throttle:1},'acro',9000); assert.deepEqual(s.state,state); assert.equal(s.elapsed,elapsed);
  s.resume(10000); s.item.gate=2; s.reset(); assert.equal(s.item.gate,2); assert.equal(s.elapsed,elapsed);
  s.restart(11000); assert.equal(s.elapsed,0); assert.equal(s.item.gate,0);
});
test('the entire built-in catalog validates and rejects unsafe paths',()=>{
  assert.deepEqual(validateCatalog(catalog).maps.map(m=>m.id).sort(),['hangar-c03-demo','liftoff-arena-demo','liftoff-pine-valley-demo','liftoff-the-green-demo','minus-two-demo']);
  const bad=structuredClone(catalog);bad.maps[0].model='/content/assets/../../secret.glb';assert.throws(()=>validateCatalog(bad));
});
test('rounded contacts avoid false square corner hits and support mesh surfaces',()=>{
  assert.equal(sphereContacts([1.15,1.15,0],.2,{position:[0,0,0],size:[2,2,2]}).length,0);
  const hits=sphereContacts([0,.1,0],.2,{type:'mesh',vertices:[-2,0,-2,0,0,2,2,0,-2]});
  assert.equal(hits.length,1); assert(Math.abs(hits[0].depth-.1)<1e-6);assert(hits[0].normal[1]>.99);
});
