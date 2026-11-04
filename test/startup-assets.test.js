import test from 'node:test';import assert from 'node:assert/strict';
import {startupAssetURLs} from '../src/startup-assets.js';
test('startup loads the current workshop and close aircraft without collision payloads, flight LODs or courses',()=>{
  const map={model:'/content/assets/map.glb',collisionFile:'/content/assets/map.json',preparedCollisionFile:'/content/assets/map.pcol',garage:{model:'/content/assets/table.glb'},tracks:[{model:'/content/assets/course.glb'}]};
  const spec={model:'/content/assets/drone.glb',modelLods:[{model:'/content/assets/close.glb'},{model:'/content/assets/flight-low.glb'}],visualParts:[]};
  const urls=startupAssetURLs(map,spec,[{thumbnail:'/content/assets/icon.png'},{thumbnail:'/content/assets/icon.png'}]);
  assert.deepEqual(new Set(urls),new Set(['/content/assets/map.glb','/content/assets/table.glb','/content/assets/close.glb','/content/assets/icon.png']));
});
