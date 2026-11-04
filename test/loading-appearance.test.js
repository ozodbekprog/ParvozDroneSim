import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { AssetProgress, flightAssetURLs } from '../src/asset-progress.js';
import { applyDroneColors } from '../src/model-materials.js';
import { validateCatalog } from '../shared/catalog-schema.js';
import source from '../public/content/catalog.json' with { type:'json' };

test('flight preparation loads selected wiring and omits a disabled camera accessory',()=>{
  const build={model:'/content/assets/base.glb',batteryId:'stock',visualDetails:{model:'/content/assets/wires.glb',frameNode:'frame',batteryNodes:{stock:'battery'}},accessories:{actionCamera:{model:'/content/assets/action.glb'}}};
  assert.deepEqual(flightAssetURLs({},[build]),['/content/assets/base.glb','/content/assets/wires.glb']);
  assert.ok(flightAssetURLs({},[{...build,actionCamera:true}]).includes('/content/assets/action.glb'));
});

test('loading totals deduplicate parts and exclude map thumbnails',()=>{
  const urls=flightAssetURLs({model:'/content/assets/map.glb',thumbnail:'/content/assets/thumb.jpg',objects:[{model:'/content/assets/object.glb'}]},[{model:'/content/assets/drone.glb',visualParts:[{model:'/content/assets/prop.glb'},{model:'/content/assets/prop.glb'}]}]);
  assert.equal(urls.length,4);assert.ok(!urls.some(url=>url.includes('thumb')));
  const progress=new AssetProgress(urls,urls.map(url=>({url,bytes:100})));
  progress.update(urls[0],70);progress.update(urls[1],20);assert.equal(progress.value().loaded,90);assert.equal(progress.value().total,400);
  progress.update(urls[0],50);assert.equal(progress.value().loaded,90);
  for(const url of urls)progress.update(url,100,100,true);assert.equal(progress.value().loaded,400);assert.equal(progress.value().done,true);
});

test('imported aircraft colors affect only the declared body and LED meshes',()=>{
  const root=new Group(),geometry=new BoxGeometry();
  for(const name of ['body','lamp','carbon']){const mesh=new Mesh(geometry,new MeshStandardMaterial({color:'#112233'}));mesh.name=name;root.add(mesh);}
  applyDroneColors(root,{color:'#ff0000',led:'#00ff00',colorBindings:{body:['body'],led:['lamp']}});
  assert.equal(root.getObjectByName('body').material.color.getHexString(),'ff0000');assert.equal(root.getObjectByName('lamp').material.emissive.getHexString(),'00ff00');assert.equal(root.getObjectByName('carbon').material.color.getHexString(),'112233');
  geometry.dispose();root.children.forEach(mesh=>mesh.material.dispose());
});

test('content validation accepts size index and refuses invalid color bindings',()=>{
  const catalog=structuredClone(source);catalog.assets=[{url:'/content/assets/model.glb',bytes:50000000}];catalog.drones[0].colorBindings={body:['frame'],led:['lamp']};assert.equal(validateCatalog(catalog),catalog);
  catalog.drones[0].colorBindings.body=[42];assert.throws(()=>validateCatalog(catalog),/color mesh/);
});
