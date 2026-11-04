import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,DataTexture,SRGBColorSpace,NoColorSpace,RepeatWrapping} from 'three';
import {installNativeTerrain} from '../src/native-terrain.js';
import {materialTextures,materialResources} from '../src/material-resources.js';
import {applySurfaceSettings} from '../src/surface-settings.js';
import {batchStaticScenery,sceneryMaterialKey} from '../src/scenery-batches.js';
import {estimateTextureMemory} from '../src/performance-report.js';
import {flightAssetURLs} from '../src/asset-progress.js';
import {validateCatalog} from '../shared/catalog-schema.js';
const read=file=>JSON.parse(readFileSync(file,'utf8'));
const catalog=read('public/content/catalog.json'),map=catalog.maps.find(m=>m.id==='liftoff-pine-valley-demo'),config=map.terrainSplat;
const fakeLoad=()=>new DataTexture(new Uint8Array(16),2,2);
function scene(){const root=new Group();for(let i=0;i<6;i++){const m=new MeshStandardMaterial();m.name=config.materialPrefix+i;const o=new Mesh(new BoxGeometry(),m);o.position.x=i;root.add(o);}const other=new Mesh(new BoxGeometry(),new MeshStandardMaterial());other.material.name='Bark';root.add(other);return root;}
test('native Pine layers retain the source masks, metre tiling, offsets and preflight delivery',()=>{
 const source=read('content/maps/liftoff-pine-valley-demo/native-terrain/source-layers.json');
 const original=Object.values(source).map(row=>row.data);
 assert.equal(config.layers.length,5);assert.deepEqual(config.size,[1500,1500]);assert.deepEqual(config.worldScale,[-1,1]);
 for(const layer of config.layers){const native=original.find(n=>n.m_Name===layer.name);assert.ok(native);assert.deepEqual(layer.tile,[native.m_TileSize.x,native.m_TileSize.y]);assert.deepEqual(layer.offset,[native.m_TileOffset.x,native.m_TileOffset.y]);assert.equal(layer.normalScale,native.m_NormalScale);}
 const urls=flightAssetURLs(map,[],[],map.tracks[0]);
 for(const url of [...config.alpha,...config.layers.flatMap(l=>[l.diffuse,l.normal])]){assert.ok(urls.includes(url));assert.ok(catalog.assets.some(a=>a.url===url&&a.bytes>0));}
 validateCatalog(catalog);const invalid=structuredClone(catalog);invalid.maps.find(m=>m.id===map.id).terrainSplat.layers[0].tile[0]=0;
 assert.throws(()=>validateCatalog(invalid),/terrain layer/);
});
test('shared native terrain preserves other surfaces and batches patches without merging unrelated node graphs',async()=>{
 const root=scene(),other=root.children.at(-1).material,retired=root.children[0].material;let disposed=0;retired.addEventListener('dispose',()=>disposed++);
 const result=await installNativeTerrain(root,config,{load:fakeLoad});assert.equal(result.meshes,6);assert.equal(disposed,1);assert.equal(root.children.at(-1).material,other);
 assert.ok(root.children.slice(0,6).every(o=>o.material===result.material));
 assert.equal(sceneryMaterialKey(result.material.clone()),null);
 const batches=batchStaticScenery([root],root);assert.equal(batches.meshes,6);assert.equal(batches.batches,1);
 assert.equal(batches.container.children[0].material,result.material);
});
test('node textures are counted, retained for quality changes and owned for scene cleanup',async()=>{
 const root=scene(),{material,textures}=await installNativeTerrain(root,config,{load:fakeLoad});
 assert.equal(materialTextures(material).size,12);assert.equal(estimateTextureMemory(root).textures,12);
 for(const [i,t] of textures.entries()){assert.equal(t.colorSpace,i<2||i%2===1?NoColorSpace:SRGBColorSpace);if(i>=2)assert.equal(t.wrapS,RepeatWrapping);}
 applySurfaceSettings(root,{normalMaps:false,textureSize:256});assert.equal(material.normalNode,null);
 applySurfaceSettings(root,{normalMaps:true,textureSize:0});assert.ok(material.normalNode);
 assert.equal(materialResources(material).unscaled.size,2);
 let disposed=0;for(const t of materialTextures(material))t.addEventListener('dispose',()=>disposed++);
 for(const t of materialTextures(material))t.dispose();assert.equal(disposed,12);
});
test('canceled or failed terrain preparation releases textures without installing partial materials',async()=>{
 const root=scene();root.userData.disposed=true;let disposed=0;
 const load=()=>{const t=fakeLoad();t.addEventListener('dispose',()=>disposed++);return t;};
 assert.equal(await installNativeTerrain(root,config,{load}),null);assert.equal(disposed,12);assert.ok(root.children[0].material.isMeshStandardMaterial);
 const failed=scene();disposed=0;
 await assert.rejects(installNativeTerrain(failed,config,{load:()=>{const t=load();t.assetsReady=Promise.reject(Error('missing mask'));return t;}}),/missing mask/);
 assert.equal(disposed,12);assert.ok(failed.children[0].material.isMeshStandardMaterial);
});
