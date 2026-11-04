import test from 'node:test';
import assert from 'node:assert/strict';
import {Object3D,PerspectiveCamera,Quaternion,Vector3} from 'three';
import * as attitude from '../src/flight-attitude.js';

const radians=degrees=>degrees*Math.PI/180;
const near=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} differs from ${expected}`);
const axis=(x,y,z,degrees)=>new Quaternion().setFromAxisAngle(new Vector3(x,y,z),radians(degrees));

// Mirrors World.render's +Z aircraft forward, body up and authored FPV tilt.
function fpvCamera({pitch=0,roll=0,yaw=0,tilt=0,fov=90,aspect=16/9}={}){
  const body=axis(0,1,0,yaw).multiply(axis(1,0,0,-pitch)).multiply(axis(0,0,1,roll));
  const forward=new Vector3(0,0,1).applyQuaternion(body),up=new Vector3(0,1,0).applyQuaternion(body);
  const camera=new PerspectiveCamera(fov,aspect,.02,1500);
  camera.up.copy(up);
  camera.lookAt(forward.multiplyScalar(Math.cos(radians(tilt))).addScaledVector(up,Math.sin(radians(tilt))));
  camera.updateMatrixWorld();
  return camera;
}

function worldHorizonPoint(camera,heading,width,height){
  const direction=new Vector3(Math.sin(radians(heading)),0,Math.cos(radians(heading)));
  const point=direction.multiplyScalar(10000).add(camera.position).project(camera);
  return {x:(point.x+1)*width/2,y:(1-point.y)*height/2};
}

test('horizon uses the rendered FPV tilt and perspective instead of body pitch pixels',()=>{
  const camera=fpvCamera({tilt:25});
  const line=attitude.projectFlightHorizon(camera,1280,720);
  assert.ok(line);
  near(line.y,360+Math.tan(radians(25))*360);
  near(line.y1,line.y2);
  assert.ok(line.y>500,'level body with tilted FPV must not put the world horizon at screen center');
  const wide=attitude.projectFlightHorizon(fpvCamera({tilt:25,fov:120}),1280,720);
  near(wide.y-360,(line.y-360)/Math.tan(radians(60)));
});

test('upright, pitched, rolled, yawed and inverted horizon agrees with independently projected world directions',()=>{
  for(const rotation of [
    {},{pitch:20},{pitch:-22},{roll:35},{roll:-70},{roll:90},{roll:180},
    {pitch:12,roll:43,yaw:60,tilt:25},{pitch:-13,roll:155,yaw:-110,tilt:20}
  ]){
    const camera=fpvCamera(rotation),line=attitude.projectFlightHorizon(camera,1280,720,{span:800});
    assert.ok(line,JSON.stringify(rotation));
    const length=Math.hypot(line.x2-line.x1,line.y2-line.y1);
    for(const heading of [-20,0,20,60,100,160,220,280]){
      const direction=new Vector3(Math.sin(radians(heading)),0,Math.cos(radians(heading)));
      if(direction.dot(camera.getWorldDirection(new Vector3()))<.1)continue;
      const p=worldHorizonPoint(camera,heading,1280,720);
      const distance=Math.abs((line.x2-line.x1)*(p.y-line.y1)-(line.y2-line.y1)*(p.x-line.x1))/length;
      near(distance,0,1e-6);
    }
  }
});

test('yaw changes heading without changing level horizon; inversion preserves the center horizon',()=>{
  for(const yaw of [0,30,110,180,-75]){
    const line=attitude.projectFlightHorizon(fpvCamera({yaw}),1280,720);
    near(line.y1,360);near(line.y2,360);
  }
  const line=attitude.projectFlightHorizon(fpvCamera({roll:180}),1280,720);
  near(line.y1,360);near(line.y2,360);
});

test('horizon clips to fixed rails and stays finite through vertical camera poses',()=>{
  const clip={left:350,top:100,right:930,bottom:620};
  for(const pitch of [-90,-89.999,-80,-40,0,40,80,89.999,90,100,180]){
    for(const roll of [0,45,90,179.999,180]){
      const line=attitude.projectFlightHorizon(fpvCamera({pitch,roll}),1280,720,{span:800,clip});
      if(!line)continue;
      for(const key of ['x1','y1','x2','y2','x','y','angle'])assert.ok(Number.isFinite(line[key]),`${pitch}/${roll}/${key}`);
      for(const suffix of ['1','2']){
        assert.ok(line['x'+suffix]>=clip.left-1e-7&&line['x'+suffix]<=clip.right+1e-7);
        assert.ok(line['y'+suffix]>=clip.top-1e-7&&line['y'+suffix]<=clip.bottom+1e-7);
      }
    }
  }
  assert.equal(attitude.projectFlightHorizon(fpvCamera({pitch:90}),1280,720),null);
  assert.equal(attitude.projectFlightHorizon(fpvCamera({pitch:-90}),1280,720),null);
  assert.equal(attitude.projectFlightHorizon(fpvCamera({pitch:80}),1280,720),null);
});

test('horizon uses live projection aspect, zoom and off-center view offsets',()=>{
  const camera=fpvCamera({pitch:12,roll:35,aspect:4/3}),width=1000,height=750;
  camera.zoom=1.2;
  camera.setViewOffset(1000,750,90,-35,1000,750);
  camera.updateProjectionMatrix();
  const line=attitude.projectFlightHorizon(camera,width,height,{span:1000});
  assert.ok(line);
  for(const heading of [-15,0,15]){
    const p=worldHorizonPoint(camera,heading,width,height);
    near((line.x2-line.x1)*(p.y-line.y1)-(line.y2-line.y1)*(p.x-line.x1),0,1e-5);
  }
});

test('direction projection ignores position and magnitude but rejects zero, behind and off-screen vectors',()=>{
  const camera=fpvCamera();
  assert.deepEqual(attitude.projectFlightDirection([0,0,1],camera,1280,720),{x:640,y:360});
  assert.deepEqual(attitude.projectFlightDirection([0,0,100],camera,1280,720),{x:640,y:360});
  const right=attitude.projectFlightDirection([-1,0,2],camera,1280,720);
  assert.ok(right.x>640);
  camera.position.set(500,20,-60);camera.updateMatrixWorld();
  assert.deepEqual(attitude.projectFlightDirection([0,0,1],camera,1280,720),{x:640,y:360});
  for(const direction of [[0,0,0],[0,0,-1],[1,0,1e-12],[100,0,1],[NaN,0,1]]){
    assert.equal(attitude.projectFlightDirection(direction,camera,1280,720),null);
  }
  const tilted=fpvCamera({tilt:25});
  near(attitude.projectFlightDirection([0,0,1],tilted,1280,720).y,360+Math.tan(radians(25))*360);
  camera.near=.5;camera.far=10;camera.updateProjectionMatrix();
  assert.deepEqual(attitude.projectFlightDirection([0,0,.01],camera,1280,720),{x:640,y:360},'a direction is not a near-clipped world point');
});

test('horizon uses camera world orientation when parented, without moving the camera',()=>{
  const camera=fpvCamera({tilt:15}),parent=new Object3D();
  parent.quaternion.copy(axis(0,0,1,30));parent.add(camera);parent.updateMatrixWorld(true);
  const before={position:camera.position.toArray(),quaternion:camera.quaternion.toArray()};
  const line=attitude.projectFlightHorizon(camera,1280,720);
  assert.ok(line);
  for(const heading of [-15,0,15]){
    const p=worldHorizonPoint(camera,heading,1280,720);
    near((line.x2-line.x1)*(p.y-line.y1)-(line.y2-line.y1)*(p.x-line.x1),0,1e-5);
  }
  assert.deepEqual({position:camera.position.toArray(),quaternion:camera.quaternion.toArray()},before);
});

test('invalid camera or viewport input hides geometry instead of producing NaN SVG attributes',()=>{
  const camera=fpvCamera();
  for(const [width,height] of [[0,720],[1280,0],[NaN,720],[1280,Infinity]]){
    assert.equal(attitude.projectFlightHorizon(camera,width,height),null);
    assert.equal(attitude.projectFlightDirection([0,0,1],camera,width,height),null);
  }
  assert.equal(attitude.projectFlightHorizon(null,1280,720),null);
  assert.equal(attitude.projectFlightDirection(null,camera,1280,720),null);
  camera.quaternion.set(NaN,0,0,1);
  assert.equal(attitude.projectFlightHorizon(camera,1280,720),null);
});
