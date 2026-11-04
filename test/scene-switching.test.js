import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MAPS,getTrack} from '../shared/content.js';
import {menuPresentation} from '../src/menu-presentation.js';
import {assetDelivery} from '../src/asset-delivery.js';
import {GAMEPLAY_OBSTACLES} from '../shared/content.js';
import {prepareMapCollisions,releaseMapCollisions} from '../src/map-collisions.js';
const previous=globalThis.document,gradient={addColorStop(){}};
const context=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient},{get:(v,k)=>v[k]||(()=>{})});
globalThis.document={createElement:()=>({getContext:()=>context})};
const {World}=await import('../src/world.js');
if(previous===undefined)delete globalThis.document;else globalThis.document=previous;
function fixture(){
 const w=Object.create(World.prototype),jobs=[];
 Object.assign(w,{scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),drones:new Map(),map:MAPS['hangar-c03-demo'],track:getTrack('hangar-c03-demo'),graphics:{quality:'low'},mapReady:Promise.resolve(),hangarPreview:false,workbench:null,rebuildPost(){},setFov(){},loadGarageModel:async()=>{}});
 w.load=function(mapId,trackId,{presentation}={}){this.scene.userData.disposed=true;this.scene=new THREE.Scene();this.map=MAPS[mapId];this.track=getTrack(mapId,trackId);this.presentation=presentation;let yes,no;this.mapReady=new Promise((a,b)=>{yes=a;no=b;});jobs.push({yes,no,scene:this.scene});return this.mapReady;};
 return{w,jobs};
}

test('cold menus use the poster while a previously loaded flight environment remains reusable',async()=>{
 const {w,jobs}=fixture();
 assert.equal(menuPresentation(w,'minus-two-demo'),'poster');assert.equal(jobs.length,0);
 w.map=MAPS['minus-two-demo'];w.track=getTrack('minus-two-demo');w.environmentReady=true;
 assert.equal(menuPresentation(w,w.map.id),'retained');
 await w.setMenuScene(true,{mapId:w.map.id,trackId:w.track.id,kind:'home',course:false});
 assert.equal(jobs.length,0);assert.equal(w.menuScene.kind,'home');
 w.scene.userData.disposed=true;assert.equal(menuPresentation(w,w.map.id),'poster');
});
test('one inspected aircraft survives a menu-map swap without releasing its parsed resources',async()=>{
 const {w,jobs}=fixture(),mesh=new THREE.Group();let releases=0;mesh.releaseAsset=()=>{releases++;delete mesh.releaseAsset;};
 const preview={mesh,state:{position:[0,0,0]}};w.scene.add(mesh);w.drones.set('preview',preview);
 const pending=w.setMenuScene(true,{mapId:'minus-two-demo'});jobs[0].yes();await pending;
 assert.equal(releases,0);assert.equal(w.drones.get('preview'),preview);assert.equal(mesh.parent,w.scene);
 assert.equal(mesh.visible,false);assert.equal(preview.needsPlacement,true);
 w.removeMissing([]);assert.equal(releases,1);
});

test('hidden cached inspection keeps finite tabletop placement on every reopening',()=>{
 const {w}=fixture();w.workbenchAnchor=[3,2,7];
 const mesh=new THREE.Group();mesh.add(new THREE.Mesh(new THREE.BoxGeometry(.6,.4,.4),new THREE.MeshBasicMaterial()));
 const hiddenPart=new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshBasicMaterial());hiddenPart.position.y=-100;hiddenPart.visible=false;mesh.add(hiddenPart);
 for(let reopen=0;reopen<3;reopen++){
  mesh.visible=false;const state={position:[0,0,0],rotation:[0,0,0,1]};
  w.installDronePreview(mesh,{},state);
  assert.ok(state.position.every(Number.isFinite));assert.equal(mesh.visible,true);
  assert.ok(Math.abs(state.position[1]-2.2)<1e-6);assert.equal(state.position[0],3);assert.equal(state.position[2],7);
 }
 const empty=new THREE.Group();empty.visible=false;const state={position:[0,0,0],rotation:[0,0,0,1]};w.installDronePreview(empty,{},state);assert.deepEqual(state.position,[3,2,7]);
});

test('map background stays intact until the replacement is loaded',async()=>{
 const{w,jobs}=fixture(),old=w.scene;
 const p=w.setMenuScene(true,{mapId:'minus-two-demo'});
 assert.equal(w.scene,old);assert.notEqual(old.userData.disposed,true);
 jobs[0].yes();await p;assert.equal(w.map.id,'minus-two-demo');assert.notEqual(w.scene,old);
});
test('cancel/retry keeps a renderable map and sun together until the replacement commits',async()=>{
 const {w,jobs}=fixture(),map=w.map,scene=w.scene,priorDocument=globalThis.document;
 const sun=w.sunVisual=new THREE.Object3D();w.sunDirection=new THREE.Vector3(0,1,0);
 w.shafts={position:{value:new THREE.Vector2()},aspect:{value:1},tint:{value:new THREE.Color()},strength:{value:0}};
 let frames=0;Object.assign(w,{thumbnail:true,lastTime:0,container:{clientWidth:1280,clientHeight:720},renderer:{info:{reset(){}},domElement:{width:1280,height:720},render(){frames++;}},updateHomeLight(){},environmentReady:true});
 w.invalidateEnvironment();assert.equal(w.map,map);assert.equal(w.scene,scene);assert.equal(w.sunVisual,sun);assert.equal(w.environmentReady,false);
 const pending=w.setMenuScene(true,{mapId:'minus-two-demo'});
 assert.equal(jobs.length,1,'invalidated environment must actually prepare a replacement');
 globalThis.document={querySelector:()=>null};
 try{assert.doesNotThrow(()=>w.render(16));assert.equal(frames,1);assert.equal(w.map,map);assert.equal(w.sunVisual,sun);}
 finally{if(priorDocument===undefined)delete globalThis.document;else globalThis.document=priorDocument;}
 jobs[0].yes();await pending;assert.notEqual(w.scene,scene);assert.equal(w.map.id,'minus-two-demo');assert.equal(scene.userData.disposed,true);
});
test('rapid map selection followed by garage cannot revive an older scene',async()=>{
 const{w,jobs}=fixture();
 const first=w.setMenuScene(true,{mapId:'minus-two-demo'});
 const second=w.setMenuScene(true,{mapId:'hangar-c03-demo'});
 const garage=w.prepareHangarPreview('selection','minus-two-demo');
 jobs[2].yes();await garage;const active=w.scene;
 jobs[1].yes();jobs[0].yes();await Promise.all([first,second]);
 assert.equal(w.scene,active);assert.equal(w.map.id,'minus-two-demo');assert.equal(w.workbench,'minus-two-demo');
 assert.equal(jobs[0].scene.userData.disposed,true);assert.equal(jobs[1].scene.userData.disposed,true);
});
test('failed map load keeps the last scene and a retry can succeed',async()=>{
 const{w,jobs}=fixture(),old=w.scene;
 const failed=w.setMenuScene(true,{mapId:'minus-two-demo'});jobs[0].no(new Error('Offline'));await assert.rejects(failed,/Offline/);
 assert.equal(w.scene,old);assert.equal(w.map.id,'hangar-c03-demo');
 const retry=w.setMenuScene(true,{mapId:'minus-two-demo'});jobs[1].yes();await retry;assert.equal(w.map.id,'minus-two-demo');
});

test('menu and Hangar map changes retire physics only after a successful scene replacement',async()=>{
 const {w,jobs}=fixture(),ids=['hangar-c03-demo','minus-two-demo'];
 const previous=new Map(ids.map(id=>[id,GAMEPLAY_OBSTACLES[id]]));
 const options={load:async()=>[{position:[123,0,0],size:[1,1,1]}]};
 try{
  for(let cycle=0;cycle<20;cycle++){
   const old=w.map,next=ids.find(id=>id!==old.id);
   await prepareMapCollisions(old,'flight',options);const active=GAMEPLAY_OBSTACLES[old.id];
   assert.notEqual(active,old.colliders);
   const pending=cycle%2?w.prepareHangarPreview('selection',next):w.setMenuScene(true,{mapId:next});
   assert.equal(GAMEPLAY_OBSTACLES[old.id],active,'pending replacement still needs the active map');
   jobs.at(-1).yes();await pending;
   assert.equal(w.map.id,next,`cycle ${cycle} must install the selected scene`);
   assert.equal(GAMEPLAY_OBSTACLES[old.id],old.colliders,`cycle ${cycle}: retired map must release its decoded tree`);
  }
  const activeMap=w.map;await prepareMapCollisions(activeMap,'flight',options);
  const active=GAMEPLAY_OBSTACLES[activeMap.id],next=ids.find(id=>id!==activeMap.id);
  const failed=w.setMenuScene(true,{mapId:next});jobs.at(-1).no(Error('Offline'));
  await assert.rejects(failed,/Offline/);assert.equal(GAMEPLAY_OBSTACLES[activeMap.id],active);
  w.prepareHangarPreview('selection','map-without-garage');
  assert.equal(GAMEPLAY_OBSTACLES[activeMap.id],activeMap.colliders,'neutral workshop also retires the map');
 }finally{for(const id of ids){releaseMapCollisions(MAPS[id]);GAMEPLAY_OBSTACLES[id]=previous.get(id);}}
});
test('workbench layout changes reuse the same environment load',async()=>{
 const{w,jobs}=fixture();const first=w.prepareHangarPreview('selection','minus-two-demo'),second=w.prepareHangarPreview('workbench','minus-two-demo');
 assert.equal(jobs.length,1);jobs[0].yes();await Promise.all([first,second]);assert.equal(w.hangarLayout,'workbench');
});

test('leaving a still-loading Hangar cannot replace the current menu with its late scene',async()=>{
 const {w,jobs}=fixture(),original=w.scene;
 const pending=w.prepareHangarPreview('selection','minus-two-demo');
 w.leaveHangarPreview();jobs[0].yes();await pending;
 assert.equal(w.scene,original);assert.notEqual(w.workbench,'minus-two-demo');assert.equal(w.hangarPreview,false);
 assert.equal(jobs[0].scene.userData.disposed,true);
});

test('leaving a Hangar waiting on a menu transition cannot restart its preview',async()=>{
 const {w,jobs}=fixture();
 const menu=w.setMenuScene(true,{mapId:'minus-two-demo'});
 const preview=w.prepareHangarPreview('selection','minus-two-demo');
 w.leaveHangarPreview();jobs[0].yes();await menu;
 await Promise.race([preview,new Promise((_yes,no)=>setTimeout(()=>no(Error('stale preview restarted')),100))]);
 assert.equal(jobs.length,1);assert.equal(w.hangarPreview,false);
});

test('a map without a garage never inherits the previously selected map',async()=>{
 const{w,jobs}=fixture();
 const pending=w.prepareHangarPreview('selection','minus-two-demo');
 jobs[0].yes();await pending;const prior=w.scene;
 w.prepareHangarPreview('workbench','map-without-garage');
 assert.equal(w.map,null);assert.equal(w.workbench,true);assert.equal(w.workbenchAnchor,null);
 assert.notEqual(w.scene,prior);assert.equal(prior.userData.disposed,true);
 const neutral=w.scene;w.prepareHangarPreview('selection','map-without-garage');assert.equal(w.scene,neutral);
});

test('pending or failed garage loads retain the last menu camera and presentation',async()=>{
 const{w,jobs}=fixture();w.presentation='menu';w.camera.fov=70;w.menuScene={flightFov:70,kind:'home'};
 w.setFov=function(fov){this.camera.fov=fov;};const old=w.menuScene;
 const pending=w.prepareHangarPreview('selection','minus-two-demo');
 assert.equal(w.menuScene,old);assert.equal(w.camera.fov,70);assert.equal(w.presentation,'menu');
 jobs[0].no(new Error('Offline'));await assert.rejects(pending,/Offline/);assert.equal(w.menuScene,old);assert.equal(w.camera.fov,70);
 const retry=w.prepareHangarPreview('selection','minus-two-demo');jobs[1].yes();await retry;assert.equal(w.camera.fov,55);assert.equal(w.menuScene,null);assert.equal(w.presentation,'preview');
});

function warmFixture(){
 const {w,jobs}=fixture();w.map=MAPS['minus-two-demo'];w.track=getTrack(w.map.id);w.environmentReady=true;w.courseActive=false;w.presentation='menu';
 w.courseGroup=new THREE.Group();w.scene.add(w.courseGroup);w.prepareMapCollisions=async()=>{};return {w,jobs};
}

test('first flight from a retained Hangar waits for map collisions before becoming ready',async()=>{
 const {prepareCollisionPayload}=await import('../shared/collision-preparation.js'),priorWorker=globalThis.Worker;
 globalThis.Worker=class {terminate(){}postMessage(bytes){queueMicrotask(()=>this.onmessage({data:{ok:true,...prepareCollisionPayload(bytes).payload}}));}};
 const {w}=warmFixture(),map=w.map,prior=GAMEPLAY_OBSTACLES[map.id],get=assetDelivery.get;
 w.prepareMapCollisions=World.prototype.prepareMapCollisions;
 let complete,calls=0,ready=false;
 assetDelivery.get=()=>{calls++;return new Promise(resolve=>{complete=resolve;});};
 try{
  const loading=World.prototype.load.call(w,map.id,w.track.id,{course:false}).then(()=>{ready=true;});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls,1,'a retained visual scene has no prepared physics yet');
  assert.equal(ready,false,'flight must wait for collision preparation');
  complete({bytes:new TextEncoder().encode(JSON.stringify([{position:[0,0,0],size:[1,1,1]}])).buffer});
  await loading;assert.equal(ready,true);assert.equal(GAMEPLAY_OBSTACLES[map.id].length,map.colliders.length+1);
 }finally{assetDelivery.get=get;GAMEPLAY_OBSTACLES[map.id]=prior;if(priorWorker)globalThis.Worker=priorWorker;else delete globalThis.Worker;}
});
test('leaving Hangar retains both prepared presentation aircraft across repeated menus',async()=>{
 const {w}=warmFixture(),hero=new THREE.Group(),preview=new THREE.Group();let released=0;
 hero.releaseAsset=preview.releaseAsset=()=>{released++;};
 w.scene.add(hero,preview);w.drones.set('home-drone',{mesh:hero,key:'saved'});w.drones.set('preview',{mesh:preview});
 for(let i=0;i<3;i++){
  w.hangarPreview=true;w.leaveHangarPreview();
  await w.setMenuScene(true,{mapId:w.map.id,kind:'home'});
  assert.equal(w.drones.get('home-drone')?.mesh,hero);assert.equal(w.drones.get('preview')?.mesh,preview);
  assert.equal(preview.visible,false);assert.equal(released,0);
 }
});
test('home, secondary menus and free-flight route choices retain the same loaded environment',async()=>{
 const {w,jobs}=warmFixture(),scene=w.scene,first=w.map.tracks[0],second=w.map.tracks[1];
 await w.setMenuScene(true,{mapId:w.map.id,trackId:first.id,kind:'home',course:false});
 await w.setMenuScene(true,{mapId:w.map.id,trackId:second.id,kind:'menu',course:false});
 assert.equal(w.scene,scene);assert.equal(w.track,second);assert.equal(jobs.length,0);assert.equal(scene.userData.disposed,undefined);
 await World.prototype.load.call(w,w.map.id,first.id,{course:false});assert.equal(w.scene,scene);assert.equal(w.track,first);assert.equal(w.presentation,'flight');
});
test('a warm garage and its return reuse the environment and hide only workshop/course presentation',async()=>{
 const {w,jobs}=warmFixture(),scene=w.scene;w.garageGroup=new THREE.Group();scene.add(w.garageGroup);
 await w.prepareHangarPreview('selection',w.map.id);assert.equal(w.hangarPreview,true);assert.equal(w.courseGroup.visible,false);
 await w.setMenuScene(true,{mapId:w.map.id,course:false});assert.equal(w.scene,scene);assert.equal(w.garageGroup.visible,false);assert.equal(w.hangarPreview,false);assert.equal(jobs.length,0);
});
test('returning from a pending warm garage prevents its late completion from reviving the workshop',async()=>{
 const {w}=warmFixture();let finish;w.loadGarageModel=()=>new Promise(resolve=>{finish=resolve;});
 const pending=w.prepareHangarPreview('selection',w.map.id);
 await w.setMenuScene(true,{mapId:w.map.id,course:false});const scene=w.scene;finish();await pending;
 assert.equal(w.scene,scene);assert.equal(w.hangarPreview,false);assert.equal(w.presentation,'menu');assert.equal(w.workbench,null);
});

test('opening a secondary menu during initial loading joins the existing map request',async()=>{
 const {w,jobs}=fixture();
 const commit=w.commitPresentationDraft.bind(w);w.commitPresentationDraft=draft=>{draft.environmentReady=true;commit(draft);};
 const home=w.setMenuScene(true,{mapId:'minus-two-demo',kind:'home',course:false});
 const menu=w.setMenuScene(true,{mapId:'minus-two-demo',kind:'menu',course:false});
 assert.equal(jobs.length,1,'navigation must not discard and restart the same map download');
 jobs[0].yes();await Promise.all([home,menu]);assert.equal(w.menuScene.kind,'menu');assert.equal(jobs.length,1);
});

test('menus do not adapt resolution from loading or preview frame times',()=>{
 const {w}=fixture();w.presentation='menu';w.graphics={adaptiveResolution:true,resolution:1};
 w.renderer={setPixelRatio(){throw Error('Menu timings must not lower resolution');}};
 w.adjustPerformance(20);assert.equal(w.adaptiveScale,undefined);
});

test('hiding the home aircraft keeps the same scene light topology',()=>{
 const {w}=fixture(),mesh=new THREE.Group();
 mesh.add(new THREE.Mesh(new THREE.BoxGeometry(.2,.1,.3),new THREE.MeshBasicMaterial()));
 w.installHomeDrone(mesh,{},'first');
 const lights=()=>{const result=[];w.scene.traverseVisible(o=>{if(o.isLight)result.push(o.uuid);});return result;};
 const initial=lights();assert.equal(initial.length,1);
 for(const visible of [false,true,false,true]){
  mesh.visible=visible;
  w.updateHomeLight();
  assert.deepEqual(lights(),initial,'menu visibility must not invalidate every lit material');
  assert.equal(w.homeLight.intensity,visible?1.4:0);
 }
 mesh.position.set(2,3,4);mesh.rotation.y=.7;w.updateHomeLight();
 assert.ok(w.homeLight.position.distanceTo(mesh.localToWorld(new THREE.Vector3(.4,.55,-.6)))<1e-8);
 const fill=w.homeLight;w.installHomeDrone(new THREE.Group(),{},'replacement');assert.equal(w.homeLight,fill);
 w.removeMissing([]);w.updateHomeLight();assert.equal(fill.intensity,0);assert.deepEqual(lights(),initial);
 w.scene=new THREE.Scene();w.updateHomeLight();assert.equal(w.homeLight,null);
});
test('Low precompiles into the same linear framebuffer used by r180 screen rendering',async()=>{
 const {w}=fixture(),framebuffer={},mrt={};let target=null,currentMRT=mrt,compiled;
 Object.assign(w,{ready:Promise.resolve(),render(){},renderer:{coordinateSystem:THREE.WebGLCoordinateSystem,
  getRenderTarget:()=>target,getMRT:()=>currentMRT,setRenderTarget:value=>{target=value;},setMRT:value=>{currentMRT=value;},
  _getFrameBufferTarget:()=>framebuffer,compileAsync:async()=>{compiled=target;}
 }});
 await w.compileGraphics();assert.equal(compiled,framebuffer,'canvas compilation bakes a different output transform');assert.equal(target,null);assert.equal(currentMRT,mrt);
 const passTarget={},passMRT={};w.scenePass={renderTarget:passTarget,getMRT:()=>passMRT};
 w.renderer._getFrameBufferTarget=()=>{throw Error('Scene pass already has its render target');};
 await w.compileGraphics();assert.equal(compiled,passTarget);assert.equal(target,null);assert.equal(currentMRT,mrt);
 w.renderer.compileAsync=async()=>{throw Error('failed GPU compile');};
 await assert.rejects(w.compileGraphics(),/failed GPU compile/);assert.equal(target,null);assert.equal(currentMRT,mrt);
});

test('returning from Hangar to outdoor menu scene cooperatively warms newly visible shaders',async()=>{
 const {w}=warmFixture();let warmed=0;
 Object.assign(w,{ready:Promise.resolve(),renderer:{compileAsync:async()=>{}},compileGraphics:async({blockRender}={})=>{assert.equal(blockRender,true);warmed++;}});
 await w.setMenuScene(true,{mapId:w.map.id,kind:'home',course:false});
 assert.equal(warmed,1,'outdoor menu camera shot warms shaders cooperatively before rendering');
});

test('compileGraphics blocks live render submission while async WebGPU pipelines are pending',async()=>{
 const {w}=fixture();let resolveCompile;
 Object.assign(w,{ready:Promise.resolve(),render:World.prototype.render,lastTime:0,thumbnail:true,container:{clientWidth:320,clientHeight:180},
  renderer:{coordinateSystem:THREE.WebGLCoordinateSystem,info:{reset(){}},domElement:{width:320,height:180},
   getRenderTarget:()=>null,getMRT:()=>null,setRenderTarget(){},setMRT(){},_getFrameBufferTarget:()=>({}),
   compileAsync:()=>new Promise(resolve=>{resolveCompile=resolve;}),
   render(){throw Error('live render must not submit incomplete async WebGPU pipelines');}}});
 const pending=w.compileGraphics();
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(w.graphicsPreparing>0,'default compileGraphics guards live frames');
 assert.doesNotThrow(()=>w.render(16));
 resolveCompile();await pending;
 assert.equal(w.graphicsPreparing,0);
});
