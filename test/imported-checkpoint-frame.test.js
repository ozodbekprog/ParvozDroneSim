import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Euler,Quaternion,Vector3,Matrix3} from 'three';
import {sphereContacts} from '../shared/collision.js';
import fixture from './fixtures/imported-checkpoint-frame.json' with {type:'json'};

test('real imported gate frame collides at its source surface and leaves the displaced phantom surface clear',()=>{
  const collider=JSON.parse(readFileSync('content/races/'+fixture.race+'/race.json')).colliders[fixture.colliderIndex];
  const matrix=new Matrix3().set(...fixture.axes.flat()),center=new Vector3(...fixture.position);
  const sourcePoint=new Vector3(fixture.size[0]*.4,0,0).applyMatrix3(matrix).add(center);
  const oldRotation=new Quaternion().setFromEuler(new Euler(Math.PI/2,-2.3823912143707275,0));
  const phantomPoint=new Vector3(fixture.size[0]*.4,0,0).applyQuaternion(oldRotation).add(center);
  assert.ok(sphereContacts(sourcePoint.toArray(),.03,collider).length,'physical checkpoint beam must be solid where it is drawn');
  assert.equal(sphereContacts(phantomPoint.toArray(),.03,collider).length,0,'old misplaced beam must not remain as an invisible obstacle');
});

test('imported box corners agree with the original prefab world matrix',()=>{
  const collider=JSON.parse(readFileSync('content/races/'+fixture.race+'/race.json')).colliders[fixture.colliderIndex];
  const rotation=new Quaternion().setFromEuler(new Euler(...collider.rotation)),matrix=new Matrix3().set(...fixture.axes.flat());
  const points=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])points.push(new Vector3(x*collider.size[0]/2,y*collider.size[1]/2,z*collider.size[2]/2).applyQuaternion(rotation));
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
    const expected=new Vector3(x*fixture.size[0]/2,y*fixture.size[1]/2,z*fixture.size[2]/2).applyMatrix3(matrix);
    assert.ok(points.some(p=>p.distanceTo(expected)<.00002),'collider orientation must match the rendered source frame');
  }
});
