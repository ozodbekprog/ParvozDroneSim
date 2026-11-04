import * as THREE from 'three';
import {PMREMGenerator} from 'three/webgpu';
import {prepareReflection} from '../src/prepare-reflection.js';
import {skyReflectionProbe} from '../src/sky-reflection-probe.js';
import {World} from '../src/world.js';
import {GRAPHICS_PRESETS} from '../src/graphics-settings.js';
import {applyCustomContent} from '../shared/custom-content.js';
import {MAPS} from '../shared/content.js';
import {DRONES,resolveBuild,defaultBuild,createDroneState} from '../shared/physics.js';
import {createDrone,disposeObject} from '../public/content/recipes.js';
import {inspectionBuild} from '../src/drone-preview.js';
import {modelLoadMetrics,modelCacheStats} from '../src/asset-loader.js';
import {modelDecoder} from '../src/model-decoder.js';
import {sceneResourceInventory} from './scene-resource-inventory.js';
import {graphicsHardware} from '../src/automatic-graphics.js';
import {installCaptureControls} from './qa-capture.js';
import {installYawProbe} from './qa-lod-yaw.js';
import {timingInvalidReasons,summarizeIdlePacing} from '../src/timing-conditions.js';
const $=id=>document.getElementById(id),status=$('status'),result=$('result');
const catalog=await fetch('/api/catalog').then(r=>r.json());
const query=new URLSearchParams(location.search),candidate=query.get('candidate');
if(candidate){
 if(!/^\/content\/assets\/(?:qa|maps\/[a-z0-9-]+)\/[a-z0-9-]+-[a-f0-9]{16}\.glb$/.test(candidate))throw new Error('Invalid local QA candidate');
 const definition=catalog.customContent.maps.find(m=>m.id===query.get('map'));
 if(!definition)throw new Error('Unknown candidate map');
 if(candidate.startsWith('/content/assets/maps/')&&!candidate.startsWith(`/content/assets/maps/${definition.id}/`))throw new Error('Candidate belongs to a different map');
 const previous=definition.model;
 const replace=value=>{if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(key==='model'&&item===previous)value[key]=candidate;else if(typeof item==='object')replace(item);}};
 replace(definition);
}
applyCustomContent(catalog.customContent);
// Retain a reproducible original-material comparison in this local tool only.
if(query.has('bakedTerrain'))delete MAPS[query.get('map')]?.terrainSplat;
for(const map of Object.values(MAPS))$('map').add(new Option(map.name,map.id));
for(const drone of Object.values(DRONES))$('drone').add(new Option(drone.name,drone.id));
$('map').value=new URLSearchParams(location.search).get('map')||'liftoff-pine-valley-demo';$('drone').value='kestrel';
function fillTracks(){const map=MAPS[$('map').value];$('track').replaceChildren();for(const track of map.tracks)$('track').add(new Option(track.name,track.id));if(map.tracks.some(t=>t.id===query.get('track')))$('track').value=query.get('track');}
$('map').onchange=fillTracks;fillTracks();
for(const quality of ['medium','high'])$('quality').add(new Option(quality,quality));
const world=new World($('view'),false,{forceWebGL:!query.has('webgpu')});await world.ready;
// Local developer probe only; never imported by the shipped client.
export {world};
world.sceneryBatchOptions={cellSize:[64,256,512].includes(Number(query.get('cell')))?Number(query.get('cell')):512,...(query.has('instances')?{instancing:true}:query.has('legacyBatches')?{instancing:false}:{}),...(query.has('noMultiDraw')?{multiDraw:false}:{})};
const hardware=await graphicsHardware(world.renderer);
let map,track,spec,state,capture=null,lastFrame=0,busy=false,paused=false,activeConditions=null;
const frameConditions=()=>({hidden:document.hidden,focused:document.hasFocus(),width:world.renderer.domElement.width,height:world.renderer.domElement.height,adaptiveResolution:!!world.graphics.adaptiveResolution,quality:world.graphics.quality,backend:world.renderer.backend.isWebGLBackend?'WebGL2':'WebGPU'});
const recordConditions=(issues,expected)=>{for(const reason of timingInvalidReasons(frameConditions(),expected))issues.add(reason);};
document.addEventListener('visibilitychange',()=>{if(document.hidden){activeConditions?.add('Tab became hidden');capture?.invalidReasons.add('Tab became hidden');}});
window.addEventListener('blur',()=>{activeConditions?.add('Document lost focus');capture?.invalidReasons.add('Document lost focus');});
function measuredFrame(){
 if(document.hidden||!document.hasFocus())return Promise.reject(Error('Timing stopped: keep this QA tab visible and focused'));
 return new Promise((yes,no)=>{
  let frame;const cleanup=()=>{document.removeEventListener('visibilitychange',changed);window.removeEventListener('blur',lost);cancelAnimationFrame(frame);};
  const lost=()=>{cleanup();no(Error('Timing stopped: QA document lost focus'));};
  const changed=()=>{if(document.hidden)lost();};
  document.addEventListener('visibilitychange',changed);window.addEventListener('blur',lost);
  frame=requestAnimationFrame(()=>{cleanup();if(document.hidden||!document.hasFocus())no(Error('Timing stopped: QA document lost focus'));else yes();});
 });
}
async function timingReference(){
 status.textContent='Checking idle frame pacing';const samples=[];let last;
 for(let i=0;i<13;i++){await measuredFrame();const now=performance.now();if(last!==undefined)samples.push(now-last);last=now;if(samples.length>=8&&!summarizeIdlePacing(samples).valid)break;}
 const pacing=summarizeIdlePacing(samples);phases.push({name:'Idle frame pacing',...pacing});
 if(!pacing.valid)throw Error('Timing stopped: idle callbacks are throttled or overloaded');return pacing;
}
// QA-only timing wrapper: distinguish renderer submission from camera/LOD work.
let rendererMs=0;
let projectMs=0,submitMs=0,projectDepth=0;
const compileSlices=[];
const renderSlices=[];
let surfaceMs=0;
const updateSurfaces=world.updateSurfaces.bind(world);
world.updateSurfaces=async(...args)=>{const start=performance.now();try{return await updateSurfaces(...args);}finally{surfaceMs+=performance.now()-start;}};
const compileAsync=world.renderer.compileAsync.bind(world.renderer);
world.renderer.compileAsync=(...args)=>{const start=performance.now();try{return compileAsync(...args);}finally{compileSlices.push({start,ms:performance.now()-start});}};
const renderScene=world.renderer.render.bind(world.renderer);
world.renderer.render=(...args)=>{const start=performance.now(),target=world.renderer.getRenderTarget()?.texture?.name;try{return renderScene(...args);}finally{const ms=performance.now()-start;rendererMs+=ms;if(ms>5){renderSlices.push({start,ms,target,object:args[0]?.name||args[0]?.type});if(renderSlices.length>512)renderSlices.shift();}}};
const project=world.renderer._projectObject.bind(world.renderer),submit=world.renderer._renderObjects.bind(world.renderer);
world.renderer._projectObject=(...args)=>{const outer=projectDepth++===0,start=outer?performance.now():0;try{return project(...args);}finally{if(--projectDepth===0)projectMs+=performance.now()-start;}};
world.renderer._renderObjects=(...args)=>{const start=performance.now();try{return submit(...args);}finally{submitMs+=performance.now()-start;}};
const phases=[];
installCaptureControls(world,{scenario:()=>({map,track}),quality:()=>world.graphics.quality,hardware,pause:()=>{paused=true;$('pause-render').textContent='Resume rendering';}});
installYawProbe(world,{scenario:()=>({map,track}),hardware,pause:()=>{paused=true;$('pause-render').textContent='Resume rendering';}});
async function phase(name,task){
 status.textContent=name;console.info('QA phase begin',name);await new Promise(requestAnimationFrame);
 const t=performance.now(),before={rendererMs,projectMs,submitMs,surfaceMs},issues=new Set(),expected={quality:world.graphics.quality,backend:frameConditions().backend};recordConditions(issues,expected);activeConditions=issues;
 let value;try{value=await task();}finally{recordConditions(issues,expected);activeConditions=null;}
 const slices=compileSlices.filter(row=>row.start>=t),renders=renderSlices.filter(row=>row.start>=t).sort((a,b)=>b.ms-a.ms);
 const row={name,ms:performance.now()-t,valid:issues.size===0,invalidReasons:[...issues],renderMs:rendererMs-before.rendererMs,projectMs:projectMs-before.projectMs,submitMs:submitMs-before.submitMs,surfaceMs:surfaceMs-before.surfaceMs,compileCalls:slices.length,maxCompileSliceMs:Math.max(0,...slices.map(row=>row.ms)),maxRenderSliceMs:renders[0]?.ms||0,slowRenders:renders.slice(0,3),draws:world.renderer.info.render.drawCalls??world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles};
 phases.push(row);console.info('QA phase complete',JSON.stringify(row));return value;
}
function settings(){world.setGraphics({...GRAPHICS_PRESETS[$('quality').value],quality:$('quality').value,resolution:1,fixedResolution:[1280,720],adaptiveResolution:false});}
function report(){result.textContent=JSON.stringify({threeRevision:THREE.REVISION,phases,hardware,quality:world.graphics.quality,surface:{normalMaps:world.graphics.normalMaps,textureSize:world.graphics.textureSize},batches:world.sceneryBatchStats,resources:sceneResourceInventory(world.scene),batchResources:sceneResourceInventory(world.scene.getObjectByName('Spatial scenery batches')),cache:modelCacheStats(),decoder:modelDecoder.stats(),texturePreparation:world.texturePreparation,models:modelLoadMetrics(),backend:world.renderer.backend.isWebGLBackend?'WebGL2':'WebGPU',framebuffer:[world.renderer.domElement.width,world.renderer.domElement.height]},null,2);}
function action(id,task){$(id).onclick=async()=>{if(busy)return;busy=true;paused=false;try{await task();status.textContent='Ready';report();}catch(error){phases.push({name:$(id).textContent+' stopped',valid:false,invalidReasons:[error.message]});status.textContent=error.message;report();console.error(error);}finally{busy=false;}};}
const lifecycleButton=document.createElement('button');lifecycleButton.id='lifecycle';lifecycleButton.textContent='Warm menu lifecycle';document.querySelector('nav').append(lifecycleButton);
const reflectionCompare=document.createElement('button');reflectionCompare.id='reflection-compare';reflectionCompare.textContent='Compare reflection pixels';document.querySelector('nav').append(reflectionCompare);
action('reflection-compare',async()=>{
 if(!world.map)throw new Error('Load a map or menu first.');
 const scene=world.scene,previous=scene.environment,hidden=[...world.drones.values()].map(item=>[item.mesh,item.mesh.visible]);
 const probe=skyReflectionProbe(world.skyDome,world.map.ground),capture=probe?.scene||scene;
 const position=probe?.position||new THREE.Vector3(...world.track.spawn.position);position.y=probe?0:Math.max(1.5,position.y);
 const options={size:128,far:probe?.far||world.camera.far,position},targets=[],generators=[];
 try{
  scene.environment=null;for(const [mesh] of hidden)mesh.visible=false;
  for(const legacy of [true,false]){
   const generator=new PMREMGenerator(world.renderer);generators.push(generator);
   const target=await phase(legacy?'Legacy reflection capture':'Progressive reflection capture',()=>legacy?generator.fromSceneAsync(capture,0,.1,options.far,options):prepareReflection(generator,world.renderer,capture,options));
   targets.push(target);
  }
  const pixels=[];
  for(const target of targets)pixels.push(await world.renderer.readRenderTargetPixelsAsync(target,0,0,target.width,target.height));
  if(pixels[0].length!==pixels[1].length)throw new Error('Reflection pixel formats differ.');
  let different=0,maxError=0,squares=0;
  for(let i=0;i<pixels[0].length;i++){
   if(pixels[0][i]!==pixels[1][i])different++;
   const a=pixels[0] instanceof Uint16Array?THREE.DataUtils.fromHalfFloat(pixels[0][i]):pixels[0][i],b=pixels[1] instanceof Uint16Array?THREE.DataUtils.fromHalfFloat(pixels[1][i]):pixels[1][i];
   const error=Math.abs(a-b);maxError=Math.max(maxError,error);squares+=error*error;
  }
  phases.push({name:'Reflection pixel comparison',samples:pixels[0].length,different,maxError,rmse:Math.sqrt(squares/pixels[0].length)});
 }finally{scene.environment=previous;for(const [mesh,visible] of hidden)mesh.visible=visible;for(const target of targets)target.dispose();for(const generator of generators)generator.dispose();probe?.dispose();}
});
action('lifecycle',async()=>{
 phases.length=0;
 if(!map)map=MAPS[$('map').value];spec=resolveBuild(defaultBuild($('drone').value));settings();
 world.activeDroneId=null;world.inspectionCamera=null;world.removeMissing([]);
 const identities=[];
 const home=async()=>{await world.setMenuScene(true,{mapId:map.id,kind:'home',course:false});if(!world.drones.has('home-drone')){const mesh=createDrone(inspectionBuild(spec));await mesh.assetsReady;world.installHomeDrone(mesh,spec,'probe');}await world.prepareGraphics();};
 await phase('Initial home',home);
 for(let i=0;i<3;i++){
  const scene=world.scene.uuid,hero=world.drones.get('home-drone')?.mesh.uuid;
  await phase(`Warm Hangar ${i+1}`,async()=>{await world.prepareHangarPreview('selection',map.id);if(!world.drones.has('preview')){const mesh=createDrone(inspectionBuild(spec));await mesh.assetsReady;world.installDronePreview(mesh,spec,createDroneState([0,0,0],0));}await world.compileGraphics();world.render(performance.now());});
  await phase(`Return home ${i+1}`,async()=>{world.leaveHangarPreview();await home();});
  await phase(`Settings and back ${i+1}`,async()=>{await world.setMenuScene(true,{mapId:map.id,kind:'menu',course:false});world.render(performance.now());await world.setMenuScene(true,{mapId:map.id,kind:'home',course:false});world.render(performance.now());});
  identities.push({cycle:i+1,sceneRetained:scene===world.scene.uuid,homeDroneRetained:hero===world.drones.get('home-drone')?.mesh.uuid});
 }
 phases.push({name:'Object retention',identities});
});
const costButton=document.createElement('button');costButton.id='frame-cost';costButton.textContent='Frame CPU breakdown';document.querySelector('nav').append(costButton);
action('frame-cost',async()=>{
 const rows=[],renderer=world.renderer,renderObject=renderer.renderObject,draw=renderer.backend.draw;
 renderer.renderObject=function(object,...args){const t=performance.now();try{return renderObject.call(this,object,...args);}finally{rows.push({name:object.name,type:object.type,material:object.material?.name,ms:performance.now()-t});}};
 let drawMs=0;renderer.backend.draw=function(...args){const t=performance.now();try{return draw.apply(this,args);}finally{drawMs+=performance.now()-t;}};
 try{await phase('Three warm frames',async()=>{for(let i=0;i<3;i++){world.render(performance.now());await new Promise(resolve=>setTimeout(resolve,20));}});}
 finally{renderer.renderObject=renderObject;renderer.backend.draw=draw;}
 phases.push({name:'CPU draw detail',drawMs,top:rows.sort((a,b)=>b.ms-a.ms).slice(0,16)});
});
const transitionCost=document.createElement('button');transitionCost.id='transition-cost';transitionCost.textContent='Transition CPU breakdown';document.querySelector('nav').append(transitionCost);
const groundProbe=document.createElement('button');groundProbe.id='ground-probe';groundProbe.textContent='Ground material probe';document.querySelector('nav').append(groundProbe);
const terrainNormals=document.createElement('button');terrainNormals.id='terrain-normals';terrainNormals.textContent='Terrain normals with Low lighting';document.querySelector('nav').append(terrainNormals);
const repetitionProbe=document.createElement('button');repetitionProbe.id='batch-repetition';repetitionProbe.textContent='Visible batch repetition';document.querySelector('nav').append(repetitionProbe);
const movingCost=document.createElement('button');movingCost.id='moving-cost';movingCost.textContent='Moving instance CPU breakdown';document.querySelector('nav').append(movingCost);
const fixedTour=document.createElement('button');fixedTour.id='fixed-tour';fixedTour.textContent='Fixed course comparison';document.querySelector('nav').append(fixedTour);
action('fixed-tour',async()=>{
 const pacing=await timingReference();
 const points=[track.spawn.position,...track.gates.map(g=>g.position),track.spawn.position],previous=world.inspectionCamera,active=world.activeDroneId,previousFov=world.camera.fov,passes=[];world.activeDroneId=null;world.camera.fov=72;world.camera.updateProjectionMatrix();
 try{for(let pass=0;pass<2;pass++){
  const samples=[],issues=new Set(),expected={quality:world.graphics.quality,backend:frameConditions().backend};activeConditions=issues;recordConditions(issues,expected);status.textContent='Fixed course pass '+(pass+1);
  for(let n=0;n<90;n++){
   const t=n/90*(points.length-1),i=Math.floor(t),f=t%1;
   world.inspectionCamera={position:points[i].map((v,a)=>v+(points[i+1][a]-v)*f+(a===1?2:0)),target:points[i+1]};
   const start=performance.now();world.render(start);const cpu=performance.now()-start;recordConditions(issues,expected);await measuredFrame();recordConditions(issues,expected);
   samples.push({cpuMs:cpu,frameMs:performance.now()-start,draws:world.renderer.info.render.drawCalls??world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles});
  }
  passes.push({pass:pass+1,valid:issues.size===0,invalidReasons:[...issues],cpuMs:summary(samples.map(s=>s.cpuMs)),frameMs:summary(samples.map(s=>s.frameMs)),samples});
 }}finally{world.inspectionCamera=previous;world.activeDroneId=active;world.camera.fov=previousFov;world.camera.updateProjectionMatrix();activeConditions=null;}
 phases.push({name:'Fixed course comparison',framesPerPass:90,fovDegrees:72,idleReference:pacing,passes});
});
action('moving-cost',async()=>{
 const rows=[],renderer=world.renderer,renderObject=renderer.renderObject,updateAttribute=renderer.backend.updateAttribute,objects=[];let cullingMs=0,uploadMs=0;
 world.scene.traverse(o=>{if(!o.isInstancedMesh)return;const original=o.onBeforeRender;objects.push([o,original]);o.onBeforeRender=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{cullingMs+=performance.now()-start;}};});
 renderer.renderObject=function(object,...args){const start=performance.now();try{return renderObject.call(this,object,...args);}finally{rows.push({name:object.name,material:object.material?.name,ms:performance.now()-start});}};
 renderer.backend.updateAttribute=function(...args){const start=performance.now();try{return updateAttribute.apply(this,args);}finally{uploadMs+=performance.now()-start;}};
 const previous=world.inspectionCamera,active=world.activeDroneId,position=world.camera.position.toArray(),direction=new THREE.Vector3();world.camera.getWorldDirection(direction);world.activeDroneId=null;
 try{await phase('Moving instance CPU',async()=>{for(let i=0;i<20;i++){world.inspectionCamera={position:position.map((v,a)=>v+(a===0?i*.1:0)),target:position.map((v,a)=>v+direction.getComponent(a)*20+(a===0?i*.1:0))};world.render(performance.now());await new Promise(requestAnimationFrame);}});}
 finally{renderer.renderObject=renderObject;renderer.backend.updateAttribute=updateAttribute;for(const [o,original] of objects)o.onBeforeRender=original;world.inspectionCamera=previous;world.activeDroneId=active;}
 const totals=new Map();for(const row of rows){const key=row.name+'|'+row.material;const total=totals.get(key)||{...row,ms:0};total.ms+=row.ms;totals.set(key,total);}
 phases.push({name:'Moving instance detail',frames:20,cullingMs,uploadMs,top:[...totals.values()].sort((a,b)=>b.ms-a.ms).slice(0,16)});
});
action('batch-repetition',async()=>{
 const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(world.camera.projectionMatrix,world.camera.matrixWorldInverse),world.camera.coordinateSystem),matrix=new THREE.Matrix4(),sphere=new THREE.Sphere(),rows=[];
 world.scene.traverseVisible(batch=>{
  if(!batch.isBatchedMesh)return;
  const geometries=new Map();let visible=0;
  for(let id=0;id<batch.instanceCount;id++)if(batch.getVisibleAt(id)){
   const geometry=batch.getGeometryIdAt(id);batch.getBoundingSphereAt(geometry,sphere);batch.getMatrixAt(id,matrix);sphere.applyMatrix4(matrix).applyMatrix4(batch.matrixWorld);
   if(batch.perObjectFrustumCulled&&!frustum.intersectsSphere(sphere))continue;
   visible++;geometries.set(geometry,(geometries.get(geometry)||0)+1);
  }
  if(visible)rows.push({material:batch.material.name,visible,unique:geometries.size,instancesSaved:visible-geometries.size});
 });
 phases.push({name:'Visible batch repetition',objects:rows.length,draws:rows.reduce((n,r)=>n+r.visible,0),instancedDraws:rows.reduce((n,r)=>n+r.unique,0),top:rows.sort((a,b)=>b.instancesSaved-a.instancesSaved).slice(0,12)});
});
action('terrain-normals',async()=>{
 world.setGraphics({...GRAPHICS_PRESETS.low,quality:'custom',normalMaps:true,textureSize:512,fixedResolution:[1280,720],adaptiveResolution:false,resolution:1});
 await phase('Native normal shader preparation',()=>world.prepareGraphics());
});
action('ground-probe',async()=>{
 const ray=new THREE.Raycaster(),objects=[],samples=[];
 world.scene.traverseVisible(o=>{if(o.isMesh&&/terrain|ground|horizon|distance baked/i.test(o.material?.name||''))objects.push(o);});
 for(const [x,y] of [[.3,.8],[.7,.85],[.85,.65]]){
  ray.setFromCamera(new THREE.Vector2(x*2-1,1-y*2),world.camera);
  samples.push({screen:[x,y],hits:ray.intersectObjects(objects,false).slice(0,3).map(hit=>({name:hit.object.name,material:hit.object.material.name,point:hit.point.toArray(),uv:hit.uv?.toArray(),color:hit.object.material.color.toArray(),texture:hit.object.material.map?.name,size:[hit.object.material.map?.image?.width,hit.object.material.map?.image?.height]}))});
 }
 phases.push({name:'Actual ground material',samples});
});
action('transition-cost',async()=>{
 const rows=[],renderer=world.renderer,renderObject=renderer.renderObject,createPipeline=renderer.backend.createRenderPipeline;
 let pipelineMs=0,pipelines=0;
 renderer.backend.createRenderPipeline=function(...args){const t=performance.now();try{return createPipeline.apply(this,args);}finally{pipelineMs+=performance.now()-t;pipelines++;}};
 renderer.renderObject=function(object,...args){const t=performance.now();try{return renderObject.call(this,object,...args);}finally{rows.push({name:object.name,material:object.material?.name,ms:performance.now()-t});}};
 try{await phase('Menu and home cost',async()=>{await world.setMenuScene(true,{mapId:map.id,kind:'menu',course:false});world.render(performance.now());await world.setMenuScene(true,{mapId:map.id,kind:'home',course:false});world.render(performance.now());});}
 finally{renderer.renderObject=renderObject;renderer.backend.createRenderPipeline=createPipeline;}
 phases.push({name:'Transition detail',pipelineMs,pipelines,objects:rows.length,objectMs:rows.reduce((n,r)=>n+r.ms,0),top:rows.sort((a,b)=>b.ms-a.ms).slice(0,12)});
});
action('load',async()=>{
 phases.length=0;map=MAPS[$('map').value];track=map.tracks.find(t=>t.id===$('track').value)||map.tracks[0];spec=resolveBuild(defaultBuild($('drone').value));settings();
 await phase('Map download, parse, assembly and collisions',()=>world.load(map.id,track.id,{course:true}));
 state=createDroneState(track.spawn.position,track.spawn.yaw);state.position[1]+=2;
 await phase('Aircraft download, parse and assembly',()=>world.upsertDrone('probe',spec,state,true).mesh.assetsReady);
 await phase('Surface and reflection preparation',()=>world.updateSurfaces());
 await phase('Initial visible texture uploads',()=>world.prepareTextures());
 await phase('Geometry shader compilation',()=>world.compileGraphics());
 const renderer=world.renderer,createPipeline=renderer.backend.createRenderPipeline,renderObject=renderer.renderObject,rows=[];
 let pipelineMs=0,pipelines=0;
 renderer.backend.createRenderPipeline=function(...args){const t=performance.now();try{return createPipeline.apply(this,args);}finally{pipelineMs+=performance.now()-t;pipelines++;}};
 renderer.renderObject=function(object,...args){const t=performance.now();try{return renderObject.call(this,object,...args);}finally{rows.push({name:object.name,material:object.material?.name,ms:performance.now()-t});}};
 try{await phase('First rendered frame and post effects',()=>world.render(performance.now()));}
 finally{renderer.backend.createRenderPipeline=createPipeline;renderer.renderObject=renderObject;}
 phases.push({name:'First frame pipeline detail',pipelines,pipelineMs,objects:rows.length,top:rows.sort((a,b)=>b.ms-a.ms).slice(0,12)});
});
action('hangar',async()=>{
 if(!map)map=MAPS[$('map').value];spec=resolveBuild(defaultBuild($('drone').value));settings();
 await phase('Hangar environment',()=>world.prepareHangarPreview('selection',map.id));
 await phase('Inspection aircraft assembly',async()=>{const mesh=createDrone(inspectionBuild(spec));await mesh.assetsReady;world.installDronePreview(mesh,spec,createDroneState([0,0,0],0));});
 await phase('Hangar compile and upload',()=>world.prepareGraphics());
});
action('reopen',async()=>{
 world.removeMissing([]);
 await phase('Reopened inspection aircraft',async()=>{const mesh=createDrone(inspectionBuild(spec));await mesh.assetsReady;world.installDronePreview(mesh,spec,createDroneState([0,0,0],0));});
 await phase('Reopened graphics',()=>world.prepareGraphics());
});
const summary=values=>{const sorted=[...values].sort((a,b)=>a-b);return {median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],p99:sorted[Math.floor(sorted.length*.99)],max:sorted.at(-1)};};
for(const mode of ['fpv','chase','rigid','tour'])$(mode).onclick=async()=>{
 if(busy||!track)return;busy=true;let pacing;try{pacing=await timingReference();}catch(error){status.textContent=error.message;report();return;}finally{busy=false;}
 paused=false;world.hangarPreview=false;world.menuScene=null;world.inspectionCamera=null;world.presentation='flight';world.setCameraMode(mode==='rigid'?'chase-rigid':mode==='tour'?'fpv':mode);world.rebuildPost();
 world.activeDroneId='probe';const own=world.drones.get('probe');if(own)own.own=true;
 capture={mode,start:performance.now(),idleReference:pacing,invalidReasons:new Set(),expected:{quality:world.graphics.quality,backend:frameConditions().backend},frames:[],cpu:[],renderer:[],project:[],submit:[],draws:[],triangles:[]};recordConditions(capture.invalidReasons,capture.expected);status.textContent='Measuring '+mode;
};
$('capture').onclick=()=>{document.querySelectorAll('nav,output,.hangar-stage').forEach(e=>e.hidden=true);document.documentElement.style.overflow='hidden';};
$('pause-render').onclick=()=>{paused=!paused;$('pause-render').textContent=paused?'Resume rendering':'Pause rendering';};
window.addEventListener('keydown',event=>{if(event.code==='Escape'){document.querySelectorAll('nav,output,.hangar-stage').forEach(e=>e.hidden=false);document.documentElement.style.overflow='';}});
world.startAnimation(now=>{
 if(busy||paused){lastFrame=now;return;}
 const start=performance.now();
 if(capture?.mode==='tour'){
  const points=[track.spawn.position,...track.gates.map(g=>g.position),track.spawn.position],t=(now-capture.start)/2500,i=Math.floor(t)%(points.length-1),f=t%1;
  world.inspectionCamera={position:points[i].map((v,a)=>v+(points[i+1][a]-v)*f+(a===1?2:0)),target:points[i+1]};world.activeDroneId=null;
 }
 rendererMs=0;projectMs=0;submitMs=0;world.render(now);
 if(capture){
  recordConditions(capture.invalidReasons,capture.expected);
  if(now-capture.start>3000&&lastFrame){capture.frames.push(now-lastFrame);capture.cpu.push(performance.now()-start);capture.renderer.push(rendererMs);capture.project.push(projectMs);capture.submit.push(submitMs);capture.draws.push(world.renderer.info.render.drawCalls??world.renderer.info.render.calls);capture.triangles.push(world.renderer.info.render.triangles);}
  if(now-capture.start>15000){
   const valid=capture.invalidReasons.size===0&&capture.frames.length>0;
   result.textContent=JSON.stringify({threeRevision:THREE.REVISION,valid,invalidReasons:[...capture.invalidReasons],idleReference:capture.idleReference,map:map.id,mode:capture.mode,hardware,quality:world.graphics.quality,samples:capture.frames.length,frameMs:summary(capture.frames),cpuMs:summary(capture.cpu),rendererMs:summary(capture.renderer),projectMs:summary(capture.project),submitMs:summary(capture.submit),draws:summary(capture.draws),triangles:summary(capture.triangles),backend:world.renderer.backend.isWebGLBackend?'WebGL2':'WebGPU',framebuffer:[world.renderer.domElement.width,world.renderer.domElement.height],adaptiveResolution:!!world.graphics.adaptiveResolution},null,2);capture=null;status.textContent=valid?'Sample complete':'INVALID timing sample: see conditions';
  }
 }
 lastFrame=now;
});
document.querySelectorAll('nav button').forEach(button=>button.disabled=false);status.textContent='Choose a scenario';
