import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

test('developer GLB import can inspect authoring markers without replacing official content', () => {
  const folder=mkdtempSync(join(tmpdir(),'flight-import-')), file=join(folder,'model.glb');
  try {
    const binary=Buffer.from(new Float32Array([0,0,0,2,0,0,0,2,0]).buffer);
    const data={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0,1]}],nodes:[{mesh:0,name:'COLLIDER_floor'},{name:'GATE_001',translation:[0,3,10]}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[2,2,0]}],bufferViews:[{buffer:0,byteLength:binary.length}],buffers:[{byteLength:binary.length}]};
    let json=Buffer.from(JSON.stringify(data));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
    const bytes=Buffer.alloc(28+json.length+binary.length);bytes.write('glTF');bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(json.length,12);bytes.writeUInt32LE(0x4e4f534a,16);json.copy(bytes,20);bytes.writeUInt32LE(binary.length,20+json.length);bytes.writeUInt32LE(0x004e4942,24+json.length);binary.copy(bytes,28+json.length);writeFileSync(file,bytes);
    const before=readFileSync(resolve('content/maps/hangar-c03-demo/map.json'),'utf8');
    const result=spawnSync(process.execPath,['tools/import-content.js','--type','map','--id','hangar-c03-demo','--file',file,'--dry-run','true'],{encoding:'utf8',windowsHide:true});
    assert.equal(result.status,0,result.error?.message || result.stderr);
    const report=JSON.parse(result.stdout);assert.equal(report.gates,1);assert.equal(report.collisionShapes,1);
    assert.equal(readFileSync(resolve('content/maps/hangar-c03-demo/map.json'),'utf8'),before);
  } finally { rmSync(folder,{recursive:true,force:true}); }
});
