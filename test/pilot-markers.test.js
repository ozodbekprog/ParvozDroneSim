import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera} from 'three';
import {projectPilotMarker} from '../src/pilot-markers.js';
test('pilot marker follows perspective, clips behind/offscreen pilots and fades with distance',()=>{
 const camera=new PerspectiveCamera(90,16/9,.1,400);camera.updateMatrixWorld();
 const center=projectPilotMarker([0,0,-10],camera,1920,1080);
 assert.equal(center.x,960);assert.ok(center.y<540);assert.ok(center.y>500);
 const right=projectPilotMarker([3,0,-10],camera,1920,1080);assert.ok(right.x>center.x);
 assert.equal(projectPilotMarker([0,0,10],camera,1920,1080),null);
 assert.equal(projectPilotMarker([100,0,-10],camera,1920,1080),null);
 assert.equal(projectPilotMarker([0,0,-300],camera,1920,1080),null);
 assert.ok(projectPilotMarker([0,0,-150],camera,1920,1080).opacity<center.opacity);
});
