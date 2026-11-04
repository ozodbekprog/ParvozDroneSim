import test from 'node:test';
import assert from 'node:assert/strict';
import {createDroneState,resolveBuild,resolveEnvironmentCollision,stepDrone,rotate} from '../shared/physics.js';
import {solveContactImpulses} from '../shared/rigid-body.js';
const map={floorY:-10,model:'fixture'},floor={position:[0,-.5,0],size:[20,1,20]};
const spec={...resolveBuild(),mass:1,inertia:[.1,.1,.1],collision:{spheres:[{position:[.2,0,0],radius:.1}]}};
const energy=s=>.5*spec.mass*s.velocity.reduce((sum,v)=>sum+v*v,0)+.5*s.angularVelocity.reduce((sum,v,i)=>sum+spec.inertia[i]*v*v,0);

test('an off-centre floor impact creates angular momentum and loses energy',()=>{
  const s=createDroneState([0,.099,0]);s.velocity=[0,-2,0];const before=energy(s);
  resolveEnvironmentCollision(s,map,null,[floor],spec);
  assert.ok(s.angularVelocity[2]>1,'upward impulse at +X must rotate about +Z');
  assert.ok(energy(s)<=before+1e-8,'passive impact cannot add kinetic energy');
});

test('rotation alone can drive a contact into the floor',()=>{
  const s=createDroneState([0,.099,0]);s.angularVelocity=[0,0,-4];const before=energy(s);
  resolveEnvironmentCollision(s,map,null,[floor],spec);
  assert.ok(s.velocity[1]>0,'rotating arm transfers an impulse to the centre of mass');
  assert.ok(s.angularVelocity[2]>-4);assert.ok(energy(s)<=before+1e-8);
});

test('a contact that is separating cannot pull the drone back to the floor',()=>{
  const s=createDroneState([0,.1,0]);s.velocity=[0,2,0];s.angularVelocity=[0,0,1];
  resolveEnvironmentCollision(s,map,null,[floor],spec);
  assert.deepEqual(s.velocity,[0,2,0]);assert.deepEqual(s.angularVelocity,[0,0,1]);
});

test('zero throttle does not freeze external angular momentum',()=>{
  const s=createDroneState([0,.2,0]);s.angularVelocity=[0,0,2];s.grounded=true;
  stepDrone(s,{throttle:0},spec,1/240,'acro',[0,0,0],1,undefined,-10);
  assert.ok(s.angularVelocity[2]>1,'motor stop is not a rigid-body brake');
});

test('inverted airborne positive throttle accelerates toward the ground',()=>{
  const a=createDroneState([0,100,0]),b=structuredClone(a);a.rotation=b.rotation=[1,0,0,0];
  for(let n=0;n<15;n++){stepDrone(a,{throttle:.8},spec);stepDrone(b,{throttle:0},spec);}
  assert.ok(a.velocity[1]<b.velocity[1]-1);assert.ok(rotate(a.rotation,[0,1,0])[1]<-.999);
});

test('a disabled aircraft falls and collides instead of freezing in midair',()=>{
  const s=createDroneState([0,2,0]);s.crashed=true;s.health=0;
  for(let n=0;n<60;n++)stepDrone(s,{throttle:1,roll:1},spec);
  assert.ok(s.position[1]<.3);assert.ok(s.motors.every(v=>v===0));assert.equal(s.crashed,true);
});

test('the same inverted motor torque can tip a narrow support but cannot tip a broad support',()=>{
  for(const sign of [-1,1]){
    const states=[];
    for(const width of [.02,.18]){
      const body={...resolveBuild(),collision:{spheres:[-1,1].flatMap(x=>[-1,1].map(z=>({position:[x*width,0,z*width],radius:.02})))}};
      const s=createDroneState([0,.02,0]);s.rotation=[1,0,0,0];
      for(let n=0;n<60;n++)stepDrone(s,{throttle:0},body);
      for(let n=0;n<18;n++)stepDrone(s,{throttle:.8,roll:sign},body);
      states.push(s);
    }
    assert.ok(Math.abs(states[0].rotation[1])>.15,'narrow support permits tipping');
    assert.ok(Math.abs(states[1].rotation[1])<.001,'broad support physically balances torque');
    assert.ok(Math.abs(states[1].angularVelocity[2])<.001,'no imposed rotation through the floor');
    assert.ok(Math.max(...states[1].motorThrust)-Math.min(...states[1].motorThrust)>1,'motors respond even when the body is constrained');
  }
});

test('normal impulse matches the analytic effective mass at an off-centre frictionless contact',()=>{
  const s=createDroneState();s.velocity=[0,-2,0];
  solveContactImpulses(s,{...spec,contactFriction:0,contactRestitution:0},[{r:[.2,0,0],normal:[0,1,0]}]);
  const impulse=2/(1/spec.mass+.2**2/spec.inertia[2]);
  assert.ok(Math.abs(s.velocity[1]-(-2+impulse/spec.mass))<1e-10);
  assert.ok(Math.abs(s.angularVelocity[2]-.2*impulse/spec.inertia[2])<1e-10);
});

test('Coulomb friction is bounded by the normal impulse and cannot slow an unloaded contact',()=>{
  const s=createDroneState();s.velocity=[10,-2,0];
  solveContactImpulses(s,{...spec,contactFriction:.5,contactRestitution:0},[{r:[0,0,0],normal:[0,1,0]}]);
  assert.deepEqual(s.velocity,[9,0,0]);
  const unloaded=createDroneState();unloaded.velocity=[10,0,0];
  solveContactImpulses(unloaded,spec,[{r:[0,0,0],normal:[0,1,0]}]);
  assert.deepEqual(unloaded.velocity,[10,0,0]);
});

test('passive contact impulses never add kinetic energy across deterministic rotations and impacts',()=>{
  for(let i=0;i<150;i++){
    const s=createDroneState();s.rotation=[0,Math.sin(i),0,Math.cos(i)];
    s.velocity=[Math.sin(i*7)*8,-Math.abs(Math.cos(i))*10,Math.cos(i*3)*4];
    s.angularVelocity=[Math.sin(i)*10,Math.cos(i*5)*3,Math.sin(i*4)*6];const before=energy(s);
    solveContactImpulses(s,spec,[-1,1].flatMap(x=>[-1,1].map(z=>({r:[x*.15,-.04,z*.12],normal:[0,1,0]}))));
    assert.ok(energy(s)<=before+1e-8,`impact ${i} added energy`);
  }
});

test('anisotropic contact response is invariant under rotating the entire fixture',()=>{
  const body={...spec,inertia:[.03,.07,.11],contactRestitution:0};
  const a=createDroneState();a.velocity=[2,-3,1];a.angularVelocity=[1,-2,3];
  const axis=[1,2,3],length=Math.hypot(...axis),angle=.8;
  const q=[...axis.map(v=>v/length*Math.sin(angle/2)),Math.cos(angle/2)];
  const b=structuredClone(a);b.rotation=q;b.velocity=rotate(q,a.velocity);
  const contacts=[{r:[.2,-.1,.15],normal:[0,1,0]}];
  solveContactImpulses(a,body,contacts);
  solveContactImpulses(b,body,contacts.map(c=>({r:rotate(q,c.r),normal:rotate(q,c.normal)})));
  const expected=rotate(q,a.velocity);
  for(let i=0;i<3;i++){
    assert.ok(Math.abs(b.velocity[i]-expected[i])<1e-9);
    assert.ok(Math.abs(b.angularVelocity[i]-a.angularVelocity[i])<1e-9);
  }
});
