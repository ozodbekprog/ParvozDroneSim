import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,GAMEPLAY_OBSTACLES,getTrackObstacles} from '../shared/content.js';
import {flightAssetURLs} from '../src/asset-progress.js';
test('preflight downloads props only for the selected track',()=>{
  const first={objects:[{model:'/content/assets/races/first.glb'}],collisionFile:'/content/assets/races/first.json'},second={objects:[{model:'/content/assets/races/second.glb'}],collisionFile:'/content/assets/races/second.json'};
  const urls=flightAssetURLs({model:'/content/assets/maps/map.glb',tracks:[first,second]},[],[],first);
  assert.deepEqual(urls,['/content/assets/maps/map.glb','/content/assets/races/first.glb','/content/assets/races/first.json']);
});
test('free flight downloads environment and aircraft but no route or garage props',()=>{
  const track={objects:[{model:'/content/assets/races/route.glb'}],collisionFile:'/content/assets/races/route.json'};
  const map={model:'/content/assets/maps/map.glb',objects:[{model:'/content/assets/maps/building.glb'}],garage:{model:'/content/assets/workshop.glb'},tracks:[track]};
  assert.deepEqual(flightAssetURLs(map,[{model:'/content/assets/drone.glb'}],[],track,{course:false}),[
    '/content/assets/maps/map.glb','/content/assets/maps/building.glb','/content/assets/drone.glb'
  ]);
});
test('track scenery collision is shared by physics and refreshed after map collision loads',()=>{
  const map=MAPS['hangar-c03-demo'],original=GAMEPLAY_OBSTACLES['hangar-c03-demo'],track=map.tracks[0],saved=track.colliders;
  const prop={position:[0,1,0],size:[1,2,1]};
  try{
    track.colliders=[prop];let result=getTrackObstacles('hangar-c03-demo',track.id);
    assert.equal(result.at(-1),prop);assert.equal(getTrackObstacles('hangar-c03-demo',track.id),result);assert.equal(original.includes(prop),false);
    GAMEPLAY_OBSTACLES['hangar-c03-demo']=[{position:[10,0,0],size:[1,1,1]}];let next=getTrackObstacles('hangar-c03-demo',track.id);
    assert.notEqual(next,result);assert.equal(next.length,2);assert.equal(next.at(-1),prop);
    track.colliders=[{position:[2,1,0],size:[1,2,1]}];const hydrated=getTrackObstacles('hangar-c03-demo',track.id);
    assert.notEqual(hydrated,next);assert.deepEqual(hydrated.at(-1).position,[2,1,0]);
  }finally{GAMEPLAY_OBSTACLES['hangar-c03-demo']=original;if(saved)track.colliders=saved;else delete track.colliders;}
});
