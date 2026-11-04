import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3} from 'three';
import {gateFrameBoxes,gateCollisionBoxes,trackGateCollisionBoxes,GATE_CLASSES} from '../shared/gates.js';
import {sphereContacts} from '../shared/collision.js';
import {createDroneState,resolveEnvironmentCollision,gateCrossed} from '../shared/physics.js';
import {validateCatalog} from '../shared/catalog-schema.js';

const gate = (extra={}) => ({position:[10,8,20],yaw:.63,width:5,height:4,gateClass:'precision-5',support:{type:'ground',baseY:0},...extra});
const world = (g,p) => [g.position[0]+p[0]*Math.cos(g.yaw)+p[2]*Math.sin(g.yaw),g.position[1]+p[1],g.position[2]-p[0]*Math.sin(g.yaw)+p[2]*Math.cos(g.yaw)];
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('embedded checkpoints keep variable openings without phantom default colliders',()=>{
  for(const frameSource of ['map','track']){
    const g=gate({frameSource,width:2.077894,height:1.319445});
    assert.deepEqual(gateCollisionBoxes(g),[]);
    assert.equal(gateCrossed(world(g,[0,0,-1]),world(g,[0,0,1]),g),true);
    assert.equal(gateCrossed(world(g,[1.1,0,-1]),world(g,[1.1,0,1]),g),false);
  }
});

test('a horizontal authored checkpoint crosses its actual plane and respects both opening edges',()=>{
  const g=gate({position:[0,8,0],frameSource:'track',width:3,height:2,axes:{normal:[0,1,0],right:[1,0,0],up:[0,0,1]}});
  assert.equal(gateCrossed([0,7,0],[0,9,0],g),true);
  assert.equal(gateCrossed([1.6,7,0],[1.6,9,0],g),false);
  assert.equal(gateCrossed([0,7,1.1],[0,9,1.1],g),false);
  assert.equal(gateCrossed([0,9,0],[0,7,0],g),false);
});

test('all gate classes preserve a genuinely clear opening and thin frames',()=>{
  for (const gateClass of Object.keys(GATE_CLASSES)) {
    const g=gate({gateClass});const boxes=gateCollisionBoxes(g);
    assert.ok(gateFrameBoxes(g).filter(b=>b.kind==='frame').every(b=>b.size[2]>=.1&&b.size[2]<=.18));
    for (const x of [-2.35,0,2.35]) for (const y of [-1.85,0,1.85]) {
      assert.equal(boxes.flatMap(b=>sphereContacts(world(g,[x,y,0]),.1,b)).length,0);
    }
    assert.ok(boxes.flatMap(b=>sphereContacts(world(g,[2.51,0,0]),.1,b)).length>0);
    assert.ok(gateCrossed(world(g,[0,0,-1]),world(g,[0,0,1]),g));
  }
});

test('ground and roof feet land on explicit world surfaces; suspended posts end at their anchor',()=>{
  for (const support of [{type:'ground',baseY:0},{type:'roof',baseY:5},{type:'suspended',baseY:14}]) {
    const g=gate({support});const pieces=gateFrameBoxes(g);
    assert.equal(pieces.filter(p=>p.kind==='support').length,2);
    for (const p of pieces.filter(p=>p.kind==='base')) {
      near(g.position[1]+p.position[1]+(support.type==='suspended'?1:-1)*p.size[1]/2,support.baseY);
      assert.ok(Math.abs(p.position[0])-p.size[0]/2>=g.width/2-1e-8);
    }
  }
  assert.equal(gateFrameBoxes(gate({support:{type:'none',baseY:0}})).length,3);
});

test('rendered boxes and rotated collision boxes have identical centres and dimensions',async()=>{
  const previousDocument=globalThis.document;
  const gradient={addColorStop(){}};
  const context=new Proxy({},{get:(_,key)=>key==='createRadialGradient'||key==='createLinearGradient'?()=>gradient:()=>{},set:()=>true});
  let createGate;
  try {
    globalThis.document={createElement:()=>({getContext:()=>context})};
    ({createGate}=await import('../public/content/recipes.js'));
  } finally {
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
  }
  const g=gate({support:{type:'suspended',baseY:16},frameThickness:.18});
  const {group}=createGate(g,'#ff8800');group.updateMatrixWorld(true);
  const boxes=gateCollisionBoxes(g);assert.equal(group.children.length,boxes.length);
  group.children.forEach((mesh,i)=>{
    const centre=mesh.getWorldPosition(new Vector3()).toArray();centre.forEach((v,j)=>near(v,boxes[i].position[j]));
    const dimensions=mesh.geometry.parameters;[dimensions.width,dimensions.height,dimensions.depth].forEach((v,j)=>near(v,boxes[i].size[j]));
  });
  for(const mesh of group.children)mesh.geometry.dispose();
  for(const m of new Set(group.children.map(mesh=>mesh.material)))m.dispose();
});

test('compound rotor contact hits a yawed gate while its centre is still clear',()=>{
  const g=gate();const position=world(g,[2.2,0,-.1]);const state=createDroneState(position,g.yaw);
  state.rotation=[0,Math.sin(g.yaw/2),0,Math.cos(g.yaw/2)];state.velocity=[Math.sin(g.yaw)*5,0,Math.cos(g.yaw)*5];
  const spec={arm:.3,collision:{spheres:[{position:[0,0,0],radius:.1},{position:[.3,0,0],radius:.12}]}};
  assert.equal(gateCollisionBoxes(g).flatMap(b=>sphereContacts(position,.1,b)).length,0);
  resolveEnvironmentCollision(state,{theme:'custom'},{gates:[g]},[],spec);
  assert.notDeepEqual(state.position,position);assert.ok(Math.hypot(...state.velocity)<5);
  const clear=createDroneState(world(g,[0,0,0]));const before=[...clear.position];
  resolveEnvironmentCollision(clear,{theme:'custom'},{gates:[g]},[],spec);assert.deepEqual(clear.position,before);
});

test('catalog validates gate classes, thin frame settings and physically meaningful support anchors',()=>{
  const source=JSON.parse(readFileSync(new URL('../public/content/catalog.json',import.meta.url)));
  const verify=g=>{const c=structuredClone(source);c.maps[0].tracks[0].gates.push(g);return validateCatalog(c);};
  assert.doesNotThrow(()=>verify(gate()));
  assert.doesNotThrow(()=>verify(gate({support:{type:'roof',baseY:6}})));
  assert.doesNotThrow(()=>verify(gate({support:{type:'suspended',baseY:14}})));
  assert.throws(()=>verify(gate({gateClass:'unknown'})),/gate class/);
  assert.throws(()=>verify(gate({frameThickness:.6})),/frame thickness/);
  assert.throws(()=>verify(gate({support:{type:'roof',baseY:7}})),/below opening/);
  assert.throws(()=>verify(gate({support:{type:'suspended',baseY:9}})),/above frame/);
});

test('trackGateCollisionBoxes caches flattened gate colliders and invalidates when gate geometry changes',()=>{
  const g1=gate({position:[0,4,0]}),g2=gate({position:[30,4,40],yaw:1.1});
  const track={gates:[g1,g2]};
  const first=trackGateCollisionBoxes(track);
  assert.equal(first.length,gateCollisionBoxes(g1).length+gateCollisionBoxes(g2).length);
  assert.equal(trackGateCollisionBoxes(track),first);
  g2.yaw=0.25;
  const updated=trackGateCollisionBoxes(track);
  assert.notEqual(updated,first);
  assert.equal(trackGateCollisionBoxes(track),updated);
});
