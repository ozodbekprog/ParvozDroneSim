import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {bakeTerrainPatch} from '../tools/terrain-textures.js';

test('terrain baking respects painted layer weights in linear color and retains PBR channels',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'parvoz-terrain-'));
 try{
  await mkdir(join(folder,'terrain'));
  const image=async(file,color)=>{await sharp(Buffer.from(color),{raw:{width:1,height:1,channels:4}}).png().toFile(join(folder,file));return {file};};
  const red=await image('red.png',[255,0,0,255]),blue=await image('blue.png',[0,0,255,255]),paint=await image('paint.png',[128,127,0,0]);
  const layer=diffuse=>({diffuse,data:{m_TileSize:{m_X:2,m_Y:2},m_TileOffset:{m_X:0,m_Y:0},m_Metallic:.25,m_Smoothness:.6}});
  const options={folder,layers:[layer(red),layer(blue)],alpha:[paint],data:{m_Heightmap:{m_Resolution:3,m_Scale:{m_X:1,m_Y:1,m_Z:1}}},patch:{x0:0,z0:0,x1:2,z1:2},size:2,prefix:'blend'};
  const files=await bakeTerrainPatch(options),read=async slot=>[...(await sharp(join(folder,files[slot])).raw().toBuffer()).subarray(0,4)];
  assert.deepEqual(await read('_MainTex'),[188,0,187,255]);
  assert.deepEqual(await read('_BumpMap'),[128,128,255,255]);
  assert.deepEqual(await read('_MetallicRoughnessMap'),[255,102,64,255]);
  const empty=await image('empty.png',[0,0,0,0]);
  await assert.rejects(bakeTerrainPatch({...options,alpha:[empty]}),/Unpainted terrain/);
 }finally{await rm(folder,{recursive:true,force:true});}
});
