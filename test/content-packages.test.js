import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,writeFileSync,copyFileSync,readFileSync,rmSync,utimesSync,statSync } from 'node:fs';
import { join,resolve,dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectGlb } from '../tools/glb-content.js';
import { syncContent,writeSources } from '../tools/content-packages.js';
import { rotorTelemetry,ROTOR_LAYOUT } from '../shared/rotors.js';
import { createDroneState,resolveBuild,stepDrone } from '../shared/physics.js';
import {decodeCollisionBinary} from '../shared/collision-binary.js';

function fixtureGlb(compressed = false, normalized = false) {
  const raw=Buffer.from(normalized?new Int16Array([0,0,0,32767,0,0,0,32767,0]).buffer:new Float32Array([0,0,0,2,0,0,0,2,0]).buffer);
  const binary=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4)]);
  const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0,1,2]}],nodes:[{name:'COLLIDER_floor',mesh:0},{name:'SPAWN',translation:[1,2,-4]},{name:'GATE_001',translation:[1,3,5],extras:{width:7,height:4}}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[2,2,0]}],bufferViews:[{buffer:0,byteLength:binary.length}],buffers:[{byteLength:binary.length}]};
  if (compressed) json.bufferViews[0].extensions={EXT_meshopt_compression:{buffer:0,byteOffset:0,byteLength:binary.length,byteStride:12,count:3,mode:'ATTRIBUTES'}};
  if(normalized)Object.assign(json.accessors[0],{componentType:5122,normalized:true,max:[32767,32767,0]});
  let text=Buffer.from(JSON.stringify(json));text=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]);
  const output=Buffer.alloc(12+8+text.length+8+binary.length);output.write('glTF');output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);output.writeUInt32LE(text.length,12);output.writeUInt32LE(0x4e4f534a,16);text.copy(output,20);const offset=20+text.length;output.writeUInt32LE(binary.length,offset);output.writeUInt32LE(0x004e4942,offset+4);binary.copy(output,offset+8);return output;
}

test('prepared delivery survives host-cache rebuild without rewriting immutable bytes',()=>{
 const root=mkdtempSync(join(tmpdir(),'parvoz-collision-delivery-'));
 try{
  for(const folder of ['public/content','content/maps/example','content/races','content/drones/kestrel','content/parts','content/challenges','content/tutorials'])mkdirSync(join(root,folder),{recursive:true});
  writeFileSync(join(root,'public/content/catalog.json'),JSON.stringify({version:2,maps:[],drones:[],parts:[],challenges:[],tutorials:[]}));
  writeFileSync(join(root,'content/drones/kestrel/drone.json'),JSON.stringify({id:'kestrel',mass:.68,arm:.115,thrustToWeight:5.6,motorTau:.035,drag:[.034,.045,.021],angularDrag:.11,batterySeconds:360}));
  for(const category of ['frame','motors','propellers','battery','camera'])writeFileSync(join(root,'content/parts',category+'.json'),JSON.stringify({id:category,category}));
  writeFileSync(join(root,'content/maps/example/map.json'),JSON.stringify({id:'example',collisionFile:'collision.json',colliders:[{position:[0,-1,0],size:[20,1,20]}]}));
  const first=syncContent(root),url=first.catalog.maps[0].preparedCollisionFile,file=join(root,'public',url.slice(1)),bytes=readFileSync(file);
  utimesSync(file,new Date(1000000000000),new Date(1000000000000));const modified=statSync(file).mtimeMs;
  writeFileSync(join(root,'public/content/import-cache/files.json'),'{}');assert.equal(syncContent(root).catalog.maps[0].preparedCollisionFile,url);assert.equal(statSync(file).mtimeMs,modified);assert.deepEqual(readFileSync(file),bytes);
  writeFileSync(file,Buffer.alloc(bytes.length));writeFileSync(join(root,'public/content/import-cache/files.json'),'{}');assert.throws(()=>syncContent(root),/differs from its content hash/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('folder GLB markers, transformed collision, hashing and races round trip',()=>{
  const bytes=fixtureGlb(),analysis=inspectGlb(bytes,{scale:2,position:[10,0,0]});
  assert.deepEqual(analysis.spawn.position,[12,4,-8]);assert.equal(analysis.gates[0].width,7);assert.deepEqual(analysis.colliders[0].vertices.slice(0,3),[10,0,0]);
  const temporary=mkdtempSync(join(tmpdir(),'liftoff-content-'));
  try {
    mkdirSync(join(temporary,'public/content'),{recursive:true});copyFileSync(resolve('public/content/catalog.json'),join(temporary,'public/content/catalog.json'));
    const published=JSON.parse(readFileSync(resolve('public/content/catalog.json'))),urls=new Set();
    const collect=value=>{if(typeof value==='string'&&value.startsWith('/content/assets/'))urls.add(value);else if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')Object.values(value).forEach(collect);};collect(published);
    for(const url of urls){const target=join(temporary,'public',url.slice(1));mkdirSync(dirname(target),{recursive:true});copyFileSync(resolve('public',url.slice(1)),target);}
    syncContent(temporary);mkdirSync(join(temporary,'content/maps/my-arena'));writeFileSync(join(temporary,'content/maps/my-arena/model.glb'),bytes);
    const first=syncContent(temporary),map=first.catalog.maps.find(m=>m.id==='my-arena');
    assert.match(map.model,/^\/content\/assets\/maps\/my-arena\/model-[a-f0-9]{16}\.glb$/);assert.equal(map.tracks[0].gates.length,1);assert.equal(map.tracks[0].gates[0].width,7);assert.deepEqual(map.tracks[0].spawn.position,[1,2,-4]);
    assert.equal(first.catalog.assets.find(asset=>asset.url===map.model).bytes,bytes.length);
    assert.equal(map.colliders.length,0);assert.equal(JSON.parse(readFileSync(join(temporary,'public',map.collisionFile.slice(1))))[0].vertices.length,9);
    assert.equal(decodeCollisionBinary(readFileSync(join(temporary,'public',map.preparedCollisionFile.slice(1)))).colliders[0].vertices.length,9);
    assert.equal(syncContent(temporary).catalog.revision,first.catalog.revision);
    writeSources(temporary,first.catalog);const restored=syncContent(temporary).catalog.maps.find(m=>m.id==='my-arena');assert.equal(restored.model,map.model);assert.equal(restored.collisionFile,map.collisionFile);assert.equal(restored.preparedCollisionFile,map.preparedCollisionFile);assert.equal(restored.tracks[0].gates[0].width,7);
    const packageFolder=join(temporary,'content/maps/my-arena'),definition=JSON.parse(readFileSync(join(packageFolder,'map.json')));
    const proxy=[{position:[0,-.5,0],size:[80,1,80]}];
    writeFileSync(join(packageFolder,'collision.json'),JSON.stringify(proxy));
    writeFileSync(join(packageFolder,'map.json'),JSON.stringify({...definition,collisionFile:'collision.json',colliders:proxy}));
    const sidecar=syncContent(temporary).catalog.maps.find(m=>m.id==='my-arena');
    assert.deepEqual(sidecar.colliders,[],'sidecar is not also installed as inline collision');
    assert.deepEqual(JSON.parse(readFileSync(join(temporary,'public',sidecar.collisionFile.slice(1)))),proxy);
    // Exercise the real publish/restore path with repeated embedded images.
    // The canonical file stays editable; the generated URL hashes the actual
    // compacted bytes and round-trips back to that canonical source.
    const source=fixtureGlb(),jsonLength=source.readUInt32LE(12),document=JSON.parse(source.subarray(20,20+jsonLength).toString().trim());
    const raw=source.subarray(28+jsonLength),image=Buffer.alloc(512,43);
    document.images=[0,1].map(i=>({bufferView:document.bufferViews.length+i,mimeType:'image/png'}));
    document.bufferViews.push(...[0,1].map(i=>({buffer:0,byteOffset:raw.length+i*image.length,byteLength:image.length})));
    const binary=Buffer.concat([raw,image,image]);document.buffers[0].byteLength=binary.length;
    const text=Buffer.from(JSON.stringify(document)),padded=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]),header=Buffer.alloc(20);
    header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
    const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length);binHeader.writeUInt32LE(0x004e4942,4);
    const canonical=Buffer.concat([header,padded,binHeader,binary]),sourcePath=join(packageFolder,'model.glb');writeFileSync(sourcePath,canonical);
    const optimized=syncContent(temporary),optimizedMap=optimized.catalog.maps.find(m=>m.id==='my-arena');
    assert.ok(optimized.catalog.assets.find(asset=>asset.url===optimizedMap.model).bytes<canonical.length);
    assert.deepEqual(readFileSync(sourcePath),canonical);
    assert.equal(syncContent(temporary).catalog.revision,optimized.catalog.revision,'incremental delivery is stable');
    writeSources(temporary,optimized.catalog);
    assert.equal(JSON.parse(readFileSync(join(packageFolder,'map.json'))).model,'model.glb');
  }finally {assert.ok(temporary.startsWith(resolve(tmpdir())+'\\')||temporary.startsWith(resolve(tmpdir())+'/'));rmSync(temporary,{recursive:true,force:true});}
});

test('compressed collision bytes are never interpreted as raw vertices; sidecars skip geometry decoding',()=>{
  const fallback=inspectGlb(fixtureGlb(true));
  assert.match(fallback.warnings[0],/Compressed/);
  assert.equal(fallback.colliders[0].vertices,undefined);
  const sidecar=inspectGlb(fixtureGlb(true),{}, {skipCollision:true});
  assert.deepEqual(sidecar.colliders,[]);assert.deepEqual(sidecar.warnings,[]);
  assert.equal(sidecar.gates[0].width,7);assert.deepEqual(sidecar.bounds.max,[2,2,0]);
});
test('quantized GLB bounds normalize accessor integers before node transforms',()=>{
  const result=inspectGlb(fixtureGlb(false,true),{scale:2,position:[3,0,0]},{skipCollision:true});
  assert.deepEqual(result.bounds,{min:[3,0,0],max:[5,2,0]});
});
test('audio and visible propeller telemetry use each simulated rotor, including angle correction',()=>{
  const spec=resolveBuild(),state=createDroneState([0,5,0]);state.rotation=[0,0,Math.sin(.18),Math.cos(.18)];
  for(let n=0;n<10;n++)stepDrone(state,{throttle:.4,roll:0,pitch:0,yaw:0},spec,1/60,'angle');
  const rotors=rotorTelemetry(state,spec);assert.ok(Math.max(...rotors.map(r=>r.rpm))-Math.min(...rotors.map(r=>r.rpm))>50);
  for(const rotor of rotors){assert.equal(rotor.bladeHz,state.motorRpm[rotor.index]*3/60);assert.equal(rotor.direction,ROTOR_LAYOUT[rotor.index].direction);}
  assert.equal(rotors.filter(r=>r.direction===1).length,2);assert.equal(rotorTelemetry().reduce((sum,r)=>sum+r.rpm,0),0);
});
