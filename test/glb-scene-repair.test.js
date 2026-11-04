import test from 'node:test';
import assert from 'node:assert/strict';
import {readGlb,writeGlb,appendGlbImage,pruneGlbImages,stripMapProxyMaterials} from '../tools/glb-json-patch.js';
import {neutralMaterialKind,neutralizeMaterial} from '../tools/parvoz-material-policy.js';

test('branding image removal preserves compressed geometry and remaps retained texture references',()=>{
  const geometry=Buffer.from('compressed-geometry'),logo=Buffer.from('obsolete-brand-print'),keep=Buffer.from('physical-wall-texture');
  const bin=Buffer.concat([geometry,logo,keep]);
  const document={bin,json:{asset:{version:'2.0'},buffers:[{byteLength:bin.length},{byteLength:36}],bufferViews:[
    {buffer:1,byteOffset:0,byteLength:36,byteStride:12,extensions:{EXT_meshopt_compression:{buffer:0,byteOffset:0,byteLength:geometry.length,count:3,byteStride:12,mode:'ATTRIBUTES'}}},
    {buffer:0,byteOffset:geometry.length,byteLength:logo.length},{buffer:0,byteOffset:geometry.length+logo.length,byteLength:keep.length}
  ],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'}],images:[{bufferView:1,mimeType:'image/png'},{bufferView:2,mimeType:'image/png'}],textures:[{source:0},{extensions:{KHR_texture_basisu:{source:1}}}],materials:[{name:'AirflagLiftoffFinishDark01',pbrMetallicRoughness:{baseColorTexture:{index:0}},emissiveTexture:{index:0},normalTexture:{index:0}},{name:'Wall',pbrMetallicRoughness:{baseColorTexture:{index:1}}}]}};
  const cloth=Buffer.from('new-neutral-fabric'),index=appendGlbImage(document,cloth,{name:'Neutral'});
  neutralizeMaterial(document.json.materials[0],index);const report=pruneGlbImages(document),result=readGlb(writeGlb(document));
  assert.equal(report.removedImages,1);assert.equal(result.bin.includes(logo),false);
  const view=result.json.bufferViews[result.json.accessors[0].bufferView],ext=view.extensions.EXT_meshopt_compression;
  assert.deepEqual(result.bin.subarray(ext.byteOffset,ext.byteOffset+ext.byteLength),geometry);
  const texture=result.json.textures[result.json.materials[1].pbrMetallicRoughness.baseColorTexture.index],image=result.json.images[texture.extensions.KHR_texture_basisu.source],imageView=result.json.bufferViews[image.bufferView];
  assert.deepEqual(result.bin.subarray(imageView.byteOffset,imageView.byteOffset+imageView.byteLength),keep);
  assert.equal(result.json.materials[0].emissiveTexture,undefined);assert.equal(result.json.materials[0].normalTexture,undefined);
});

test('a shared source texture survives when a different physical material still uses it',()=>{
  const data=Buffer.from('shared-image'),document={bin:data,json:{asset:{version:'2.0'},buffers:[{byteLength:data.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:data.length}],images:[{bufferView:0}],textures:[{source:0}],materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}}}]}};
  assert.equal(pruneGlbImages(document).removedImages,0);assert.deepEqual(document.bin,data);
});

test('shadow proxy removal keeps textured physical scenery and rebuilds only affected far cells',()=>{
  const json={materials:[{name:'Default-Material'},{name:'ContainerShippingBlue01'},{name:'Ironworks distance baked color'}],meshes:[{primitives:[{material:0}]},{primitives:[{material:1}]},{primitives:[{material:2}]}],nodes:[
    {name:'cell_LOD0',children:[3,4]},{name:'cell_LOD1',children:[5,6]},{name:'cell_LOD2',children:[7]},
    {name:'proxy',mesh:0},{name:'container',mesh:1},{name:'low proxy',mesh:0},{name:'low container',mesh:1,translation:[2,3,4]},{name:'baked distance',mesh:2},
    {name:'unaffected_LOD0',children:[11]},{name:'unaffected_LOD1',children:[12]},{name:'unaffected_LOD2',children:[13]},
    {mesh:1},{mesh:1},{mesh:2}
  ]};
  const definitions=['cell','unaffected'].map(id=>({modelLods:[0,1,2].map(i=>({modelNode:id+'_LOD'+i}))}));
  const originalFar=structuredClone(json.nodes[10]);
  const report=stripMapProxyMaterials(json,['Default-Material'],definitions);
  assert.equal(report.repairedDistanceCells,1);assert.equal(json.nodes[3].mesh,undefined);assert.equal(json.nodes[5].mesh,undefined);
  const far=json.nodes[2].children.map(i=>json.nodes[i]);assert.equal(far.filter(n=>n.mesh!==undefined).length,1);
  const container=far.find(n=>n.mesh!==undefined);assert.equal(container.mesh,1);assert.deepEqual(container.translation,[2,3,4]);
  assert.deepEqual(json.nodes[10],originalFar);
});

test('branding policy leaves terrain, physical container textures and unrelated print materials intact',()=>{
  for(const name of ['LiftoffArenaHorizonDisplacement01','ContainerShippingBlue01','FloorArrows01','Ground','TornPosters01'])assert.equal(neutralMaterialKind(name),null);
  assert.equal(neutralMaterialKind('AirgateLiftoffWhite01'),'cloth');assert.equal(neutralMaterialKind('StadiumScreenLiftoff01'),'display');
  // The source name is misleading: its albedo visibly prints LIFTOFF twice.
  assert.equal(neutralMaterialKind('InflatableArchBrandless01'),'cloth');
});

test('neutral artwork replacement retains a source cutout and tint alpha instead of making transparent panels opaque',()=>{
  const material={name:'AirflagLiftoffFinishWhite01',alphaMode:'MASK',alphaCutoff:.7,pbrMetallicRoughness:{baseColorFactor:[1,1,1,.6]},doubleSided:true};
  neutralizeMaterial(material,9);assert.equal(material.alphaMode,'MASK');assert.equal(material.alphaCutoff,.7);assert.equal(material.pbrMetallicRoughness.baseColorFactor[3],.6);assert.equal(material.doubleSided,true);
});
