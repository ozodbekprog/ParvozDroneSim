import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {chaseCameraShot,CHASE_DISTANCE,CHASE_HEIGHT} from '../src/chase-camera.js';

test('dynamic chase smooths heading while carrying fast translation without camera lag',()=>{
  const memory={};let shot=chaseCameraShot({position:[0,3,0],rotation:[0,0,0,1]},memory,1/60);
  assert.deepEqual(shot.position.toArray(),[0,3+CHASE_HEIGHT,-CHASE_DISTANCE]);
  const turn={position:[0,3,1],rotation:[0,Math.SQRT1_2,0,Math.SQRT1_2]};
  shot=chaseCameraShot(turn,memory,1/60);
  assert.ok(shot.position.x<0&&shot.position.x>-.3,'90-degree heading change should not snap');
  for(let i=0;i<300;i++)shot=chaseCameraShot({position:[0,3,i],rotation:[0,0,0,1]},memory,1/60);
  assert.ok(Math.abs(shot.position.z-(299-CHASE_DISTANCE))<1e-6,'60m/s translation must not add a 6m smoothing lag');
  assert.ok(shot.position.distanceTo(new Vector3(0,3,299))<1.3);
});

test('chase reset and frame rate do not change the settled relative shot',()=>{
  const end=[];
  for(const hz of [30,60,144]){
    const memory={};chaseCameraShot({position:[0,0,0],rotation:[0,0,0,1]},memory,1/hz);
    let shot;for(let i=0;i<hz;i++)shot=chaseCameraShot({position:[50,20,30],rotation:[0,Math.SQRT1_2,0,Math.SQRT1_2]},memory,1/hz);
    end.push(shot.position);
  }
  assert.ok(end[0].distanceTo(end[2])<1e-9);
});
