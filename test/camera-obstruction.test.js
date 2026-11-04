import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3} from 'three';
import {constrainCamera,fpvCameraOffset,cameraNearRadius} from '../src/camera-obstruction.js';

test('wide FPV reserves every near-plane corner when approaching a wall',()=>{
  const camera={near:.02,fov:130,aspect:16/9,zoom:1},radius=cameraNearRadius(camera);
  assert.ok(radius>.08);
  const actual=constrainCamera([0,0,1],[0,0,-1],[{position:[0,0,0],size:[5,5,.01]}],radius);
  assert.ok(actual.z>=radius);
});

test('chase and inspection stay before thin walls from either side with a near-plane margin',()=>{
  const mesh={type:'mesh',vertices:[-5,-5,0,5,-5,0,5,5,0,-5,-5,0,5,5,0,-5,5,0]};
  const box={position:[0,0,0],size:[10,10,.02]};
  for(const wall of [mesh,box])for(const side of [-1,1]){
    const actual=constrainCamera([0,0,side],[1,0,-side],[wall],.06);
    assert.ok(actual.z*side>=.06 && actual.z*side<.09);
    assert.ok(actual.x>0 && actual.x<.5);
  }
  assert.deepEqual(constrainCamera([0,0,1],[1,0,2],[mesh]).toArray(),[1,0,2]);
});

test('FPV origin follows the visible authored camera socket through nested model transforms',()=>{
  const root=new Group(),model=new Group(),socket=new Group();
  root.visible=false;
  root.position.set(50,2,-70);root.rotation.y=.7;
  model.position.set(0,-.055,0);model.scale.setScalar(.5);root.add(model);
  socket.name='mount_camera';socket.position.set(.01,.13,.16);model.add(socket);
  const hidden=socket.clone();hidden.position.set(99,99,99);hidden.visible=false;root.add(hidden);
  const actual=fpvCameraOffset(root,{mounts:{camera:['mount_camera']}});
  assert.ok(actual.distanceTo(new Vector3(.005,.01,.08))<1e-10);
});
