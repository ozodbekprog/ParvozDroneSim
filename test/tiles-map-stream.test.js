import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,PerspectiveCamera,Mesh,BoxGeometry,MeshBasicMaterial,Texture,Vector3} from 'three';
import {TilesMapStream,createLocalTileset} from '../tools/tiles-map-stream.js';

const bounds={min:[-2,-2,-2],max:[2,2,2]};
const manifest={version:2,experiment:true,packages:[{kind:'coarse',cell:'coarse',bounds},{kind:'near',cell:'cell',model:'cell.gltf',bounds,objectIndices:[0]}]};
async function frames(fn){
 const oldRAF=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame,oldWindow=globalThis.window;
 globalThis.window={location:{href:'http://localhost/'}};
 globalThis.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),1);globalThis.cancelAnimationFrame=clearTimeout;
 try{await fn();}finally{await new Promise(resolve=>setTimeout(resolve,20));if(oldRAF)globalThis.requestAnimationFrame=oldRAF;else delete globalThis.requestAnimationFrame;if(oldCancel)globalThis.cancelAnimationFrame=oldCancel;else delete globalThis.cancelAnimationFrame;if(oldWindow)globalThis.window=oldWindow;else delete globalThis.window;}
}
function camera(){const c=new PerspectiveCamera(80,16/9,.1,100);c.position.set(0,1,8);c.lookAt(0,0,0);c.updateMatrixWorld();return c;}

test('local Cartesian box mapping is explicit and preserves the complete coverage volume',()=>{
 const set=createLocalTileset(manifest,'http://localhost/data/manifest.json');
 assert.deepEqual(set.root.boundingVolume.box,[0,0,0,2,0,0,0,2,0,0,0,2]);
 assert.equal(set.root.children[0].content.uri,'http://localhost/data/cell.gltf');
 assert.equal(set.root.children[0].extras.parvozCell,'cell');
 assert.throws(()=>createLocalTileset({...manifest,packages:[]},'http://localhost/'),/coverage/);
});

test('actual library traversal installs owned tiles without disposing another texture consumer',()=>frames(async()=>{
 let releases=0,activated=0,textureDisposals=0;const shared=new Texture();shared.addEventListener('dispose',()=>textureDisposals++);
 const geometry=new BoxGeometry(),material=new MeshBasicMaterial({map:shared}),group=new Group(),mesh=new Mesh(geometry,material);mesh.position.set(1,2,3);group.add(mesh);
 const loader={readVerified:async()=>new ArrayBuffer(0),load:async()=>({group,bytes:1024,dispose:()=>{releases++;group.removeFromParent();geometry.dispose();material.dispose();}})};
 const stream=new TilesMapStream(manifest,'http://localhost/data/manifest.json',{loader,camera:camera(),activate:()=>activated++});
 try{
  await stream.idle();stream.update();
  assert.equal(stream.stats().ready,1);assert.ok(activated>0);assert.equal(stream.stats().estimatedGeometryBytes,1024);
  stream.group.updateMatrixWorld(true);assert.ok(mesh.getWorldPosition(new Vector3()).distanceTo(new Vector3(1,2,3))<1e-10);
 }finally{stream.dispose();}
 assert.equal(releases,1);assert.equal(textureDisposals,0);assert.equal(stream.stats().estimatedGeometryBytes,0);
 shared.dispose();
}));

test('late decode after library disposal is released and cannot reactivate detail',()=>frames(async()=>{
 let finish,started,disposed=0,visible=0;const waiting=new Promise(resolve=>{started=resolve;});
 const loader={readVerified:async()=>new ArrayBuffer(0),load:async()=>{started();return new Promise(resolve=>{finish=()=>resolve({group:new Group(),bytes:1024,dispose:()=>disposed++});});}};
 const stream=new TilesMapStream(manifest,'http://localhost/data/manifest.json',{loader,camera:camera(),activate:()=>visible++});
 const settling=stream.idle();
 await Promise.race([waiting,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Decode did not start')),3000);timer.unref();})]);
 stream.dispose();finish();
 // idle observes a disposed traversal; only wait for the already-started decode.
 await Promise.all([...stream.pending]);await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(disposed,1);assert.equal(visible,0);assert.equal(stream.stats().ready,0);
 await settling;
}));

test('oversized detail fails admission while caller-owned coarse coverage remains available',()=>frames(async()=>{
 let disposed=0,visible=0;
 const loader={readVerified:async()=>new ArrayBuffer(0),load:async()=>({group:new Group(),bytes:10000,dispose:()=>disposed++})};
 const stream=new TilesMapStream(manifest,'http://localhost/data/manifest.json',{loader,camera:camera(),maxBytes:100,activate:()=>visible++});
 try{await stream.idle();assert.equal(visible,0);assert.equal(stream.stats().ready,0);assert.equal(disposed,1);assert.match(stream.stats().errors[0].message,/budget/);}
 finally{stream.dispose();}
}));

test('a visible working set larger than the tile cap cannot churn the resident cache',()=>frames(async()=>{
 let loads=0,releases=0;
 const many={...manifest,packages:[manifest.packages[0],...Array.from({length:21},(_,i)=>({...manifest.packages[1],cell:'cell-'+i,model:'cell-'+i+'.gltf'}))]};
 const loader={readVerified:async()=>new ArrayBuffer(0),load:async()=>{loads++;return {group:new Group(),bytes:100,dispose:()=>releases++};}};
 const stream=new TilesMapStream(many,'http://localhost/data/manifest.json',{loader,camera:camera(),maxEntries:2});
 try{for(let i=0;i<5;i++)await stream.idle();assert.equal(stream.stats().ready,2);assert.equal(loads,2);assert.equal(releases,0);}
 finally{stream.dispose();}
 assert.equal(releases,2);
}));
