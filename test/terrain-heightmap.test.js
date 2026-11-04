import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainShape,terrainPatch,terrainInstancePose} from '../tools/terrain-heightmap.js';
const data=()=>({m_Heightmap:{m_Resolution:3,m_Scale:{m_X:2,m_Y:100,m_Z:3},m_Heights:[0,0,0,16383,16383,16383,32767,32767,32767],m_Holes:''}});
test('terrain retains every authored height, reflects X and uses upward triangles',()=>{
 const d=data(),p=terrainPatch(d,0,0);
 assert.equal(p.indices.length,24);assert.deepEqual([...p.positions.slice(-3)],[-4,100,6]);
 assert.ok(Math.abs(p.positions[10]-16383/32767*100)<.00001);
 const [a,b,c]=[...p.indices.slice(0,3)].map(i=>[...p.positions.slice(i*3,i*3+3)]);
 const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
 assert.ok(ab[2]*ac[0]-ab[0]*ac[2]>0);
 assert.equal(p.uvs[1],1);assert.equal(p.uvs.at(-1),0);
 assert.ok([...p.normals].every(Number.isFinite));
});
test('adjacent terrain patches share exact source edges and instance transforms use normalized coordinates',()=>{
 const d=data(),a=terrainPatch(d,0,0,1),b=terrainPatch(d,1,0,1);
 assert.deepEqual([...a.positions.slice(3,6)],[...b.positions.slice(0,3)]);
 const p=terrainInstancePose({m_Position:{m_X:.5,m_Y:.25,m_Z:.5},m_WidthScale:2,m_HeightScale:3,m_Rotation:Math.PI},d);
 assert.deepEqual(p.position,{m_X:2,m_Y:25,m_Z:3});assert.deepEqual(p.scale,{m_X:2,m_Y:3,m_Z:2});assert.ok(Math.abs(p.rotation.m_Y-1)<1e-10);
});
test('incomplete height grids and undecoded holes cannot silently produce a flat substitute',()=>{
 const d=data();d.m_Heightmap.m_Heights.pop();assert.throws(()=>terrainShape(d),/height grid/);
 const h=data();h.m_Heightmap.m_Holes='AQ==';assert.throws(()=>terrainShape(h),/holes/);
});
