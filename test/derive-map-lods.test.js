import test from 'node:test';import assert from 'node:assert/strict';import {Document,Accessor} from '@gltf-transform/core';
import {deriveMapLODs,fullDetailFingerprint,thinFoliageCards} from '../tools/derive-map-lods.js';
test('foliage thinning retains complete textured cards and nested distance sets',()=>{
 const positions=[],indices=[];for(let i=0;i<100;i++){const v=i*4;positions.push(i,0,0,i+1,0,0,i,1,0,i+1,1,0);indices.push(v,v+1,v+2,v+2,v+1,v+3);}
 const input=new Uint32Array(indices),p=new Float32Array(positions),near=thinFoliageCards(input,p,.3),far=thinFoliageCards(input,p,.07);
 assert.ok(near.length<input.length*.6);assert.ok(far.length<near.length);
 const nearCards=new Set();for(let i=0;i<near.length;i+=6){assert.deepEqual([...near.slice(i,i+6)],indices.slice(Math.floor(near[i]/4)*6,Math.floor(near[i]/4)*6+6));nearCards.add(Math.floor(near[i]/4));}
 for(let i=0;i<far.length;i+=6)assert.ok(nearCards.has(Math.floor(far[i]/4)));
 assert.deepEqual([...thinFoliageCards(input,p,.3)],[...near]);
});
test('full-detail verification accepts cyclic triangle rotation but rejects reversed winding',()=>{
 const d=new Document(),buffer=d.createBuffer(),position=d.createAccessor().setBuffer(buffer).setType(Accessor.Type.VEC3).setArray(new Float32Array([0,0,0,1,0,0,0,1,0])),indices=d.createAccessor().setBuffer(buffer).setType(Accessor.Type.SCALAR).setArray(new Uint16Array([0,1,2]));
 d.createScene().addChild(d.createNode('Chunk_0_LOD0').setMesh(d.createMesh().addPrimitive(d.createPrimitive().setAttribute('POSITION',position).setIndices(indices))));
 const initial=fullDetailFingerprint(d);indices.setArray(new Uint16Array([1,2,0]));assert.equal(fullDetailFingerprint(d),initial);
 indices.setArray(new Uint16Array([0,2,1]));assert.notEqual(fullDetailFingerprint(d),initial);
});
test('derived map LODs reduce dense geometry while full detail and source UVs remain unchanged',async()=>{
 const d=new Document(),buffer=d.createBuffer(),positions=[],indices=[],uv=[];
 for(let y=0;y<=30;y++)for(let x=0;x<=30;x++){positions.push(x,0,y);uv.push(x/30,y/30);}
 for(let y=0;y<30;y++)for(let x=0;x<30;x++){const a=y*31+x;indices.push(a,a+31,a+1,a+1,a+31,a+32);}
 const pos=d.createAccessor().setBuffer(buffer).setType(Accessor.Type.VEC3).setArray(new Float32Array(positions));
 const tex=d.createAccessor().setBuffer(buffer).setType(Accessor.Type.VEC2).setArray(new Float32Array(uv));
 const idx=d.createAccessor().setBuffer(buffer).setType(Accessor.Type.SCALAR).setArray(new Uint16Array(indices));
 const mesh=d.createMesh('Terrain').addPrimitive(d.createPrimitive().setAttribute('POSITION',pos).setAttribute('TEXCOORD_0',tex).setIndices(idx));
 const scene=d.createScene();for(let level=0;level<3;level++)scene.addChild(d.createNode('Chunk_0_LOD'+level).setMesh(mesh));
 const hash=fullDetailFingerprint(d),report=await deriveMapLODs(d);
 assert.equal(fullDetailFingerprint(d),hash);assert.equal(pos.getArray().length,positions.length);
 assert.ok(report.levels[1].after<report.levels[1].before);assert.ok(report.levels[2].after<report.levels[2].before);
 const reduced=scene.listChildren()[1].getMesh().listPrimitives()[0],positionArray=reduced.getAttribute('POSITION').getArray(),texArray=reduced.getAttribute('TEXCOORD_0').getArray();
 for(let i=0;i<positionArray.length/3;i++){assert.ok(Math.abs(texArray[i*2]-positionArray[i*3]/30)<1e-6);assert.ok(Math.abs(texArray[i*2+1]-positionArray[i*3+2]/30)<1e-6);}
 assert.equal(report.textureBytesUnchanged,true);
});
