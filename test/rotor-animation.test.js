import test from'node:test';import assert from'node:assert/strict';import{Group,Quaternion,Vector3}from'three';import{advanceRotor}from'../src/rotor-animation.js';
test('normalized upside-down source pivots spin about the physical body up axis',()=>{
 for(const sourceRoll of [0,Math.PI])for(const pose of [[0,0,0],[.3,-.5,.7]]){
  const body=new Group(),source=new Group(),rotor=new Group();body.add(source);source.add(rotor);body.rotation.set(...pose);source.rotation.z=sourceRoll;
  const before=rotor.getWorldQuaternion(new Quaternion()),up=new Vector3(0,1,0).applyQuaternion(body.getWorldQuaternion(new Quaternion()));
  const expected=new Quaternion().setFromAxisAngle(up,.2).multiply(before);advanceRotor(rotor,body,.2);
  assert.ok(rotor.getWorldQuaternion(new Quaternion()).angleTo(expected)<1e-7);
 }
});
