import test from 'node:test';import assert from 'node:assert/strict';import {Vector3,Quaternion,Euler,PerspectiveCamera} from 'three';
import {rigidCameraShot,nextCameraMode,normalizeCameraMode} from '../src/rigid-camera.js';

test('rigid camera keeps the aircraft exactly centered through yaw, pitch, roll and flips',()=>{
 for(const angles of [[0,0,0],[.7,1.5,.9],[Math.PI,.2,0],[1.57,2.4,2.8]]){
  const rotation=new Quaternion().setFromEuler(new Euler(...angles));
  const state={position:[123,7,-45],rotation:rotation.toArray()},shot=rigidCameraShot(state);
  const relative=shot.position.clone().sub(shot.target).applyQuaternion(rotation.clone().invert());
  assert.ok(relative.distanceTo(new Vector3(0,.38,-1.2))<1e-10);
  const camera=new PerspectiveCamera(72,16/9,.02,1500);camera.position.copy(shot.position);camera.up.copy(shot.up);camera.lookAt(shot.target);camera.updateMatrixWorld();
  const projected=new Vector3(...state.position).project(camera);
  assert.ok(Math.abs(projected.x)<1e-10&&Math.abs(projected.y)<1e-10,'aircraft must stay in the center, including when inverted');
 }
});
test('body-fixed camera has no history and keeps existing saved FPV/dynamic modes',()=>{
 const state={position:[0,2,0],rotation:[0,0,0,1]};
 assert.deepEqual(rigidCameraShot(state),rigidCameraShot({...state,velocity:[100,0,-50],time:999}));
 assert.equal(normalizeCameraMode('chase'),'chase');assert.equal(normalizeCameraMode('bad'),'fpv');
 assert.equal(nextCameraMode('fpv'),'chase');assert.equal(nextCameraMode('chase'),'chase-rigid');assert.equal(nextCameraMode('chase-rigid'),'fpv');
});
