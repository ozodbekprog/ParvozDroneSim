import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainDetailCells,terrainDetailMeshes,terrainHeight} from '../tools/terrain-details.js';
const data=()=>({m_Heightmap:{m_Resolution:2,m_Scale:{m_X:2,m_Y:2,m_Z:2},m_Heights:[0,32767,0,32767]},m_DetailDatabase:{m_DetailScatterMode:1,m_PatchCount:1,m_PatchSamples:2,m_Patches:[{m_LayerIndices:Buffer.from([0]).toString('base64'),m_Coverage:Buffer.from([0,2,1,0]).toString('base64')}],m_DetailPrototypes:[{m_RenderMode:2,m_UsePrototypeMesh:0,m_MinWidth:.2,m_MaxWidth:.4,m_MinHeight:.3,m_MaxHeight:.5}]}});
test('detail density retains authored empty cells, layer identity and exact instance counts',()=>{
 const d=data();assert.deepEqual(terrainDetailCells(d).map(({x,z,density,prototype})=>({x,z,density,prototype})),[{x:1,z:0,density:2,prototype:0},{x:0,z:1,density:1,prototype:0}]);
 assert.equal(terrainHeight(d,1,1),1);const meshes=terrainDetailMeshes(d);
 assert.equal(meshes.reduce((n,m)=>n+m.instances,0),3);assert.equal(meshes[0].indices.length,36);
 assert.deepEqual(meshes,terrainDetailMeshes(d));
 d.m_DetailDatabase.m_Patches[0].m_Coverage='';assert.throws(()=>terrainDetailCells(d),/coverage length/);
 d.m_DetailDatabase.m_DetailScatterMode=0;assert.throws(()=>terrainDetailCells(d),/coverage mode/);
});
