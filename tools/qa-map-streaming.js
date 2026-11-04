import * as THREE from 'three';
import {WebGPURenderer} from 'three/webgpu';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {StreamChunkLoader} from '../src/stream-chunk-loader.js';
import {SpatialMapStream} from '../src/spatial-map-stream.js';
import {TilesMapStream} from './tiles-map-stream.js';
import {applySurfaceSettings,rendererTextureAnisotropy} from '../src/surface-settings.js';
import {GRAPHICS_PRESETS} from '../src/graphics-settings.js';
import {applyCustomContent} from '../shared/custom-content.js';
import {MAPS} from '../shared/content.js';
import {repairTextureBindings} from '../src/texture-bindings.js';

const libraryScheduler=new URLSearchParams(location.search).get('scheduler')==='tiles';
const $=id=>document.getElementById(id),manifestURL=new URL('/data/browser-readiness-20261025/minus-two-streaming/delivery-manifest.json',location.href).href;
const catalog=await fetch('/api/catalog').then(r=>r.json());applyCustomContent(catalog.customContent);const map=MAPS['minus-two-demo'],track=map.tracks[0];
const renderer=new WebGPURenderer({forceWebGL:true,antialias:false,powerPreference:'high-performance'});await renderer.init();
repairTextureBindings(renderer);
renderer.setPixelRatio(1);renderer.setSize(1280,720);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=GRAPHICS_PRESETS.low.exposure;$('view').append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(map.sky);scene.fog=new THREE.FogExp2(map.fog,Math.max(map.fogDensity||0,.009));
scene.add(new THREE.HemisphereLight('#d5e8ff',map.ground,map.ambientIntensity||1.45));
const sun=new THREE.DirectionalLight(map.sun,map.sunIntensity||3.4);sun.position.fromArray(map.sunPosition||[68,95,45]);scene.add(sun);
const camera=new THREE.PerspectiveCamera(95,16/9,.1,240),root=new THREE.Group();scene.add(root);
let loader,stream,coarse,manifest,generation=0,tour=false,farOnly=false,lastUpdate=0,routeStart=0,previousPosition=null,busy=false,lastReport=0,lastReleasePool=null,cycleStop=false;
const frames=[],longTasks=[],cycleReports=[];let timing={},hidden=false;
const observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({start:e.startTime,ms:e.duration}))));observer.observe({type:'longtask'});
document.addEventListener('visibilitychange',()=>{if(document.hidden)hidden=true;});
const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
function spawn(){tour=false;previousPosition=null;camera.position.fromArray(map.menuCamera.position);camera.lookAt(new THREE.Vector3().fromArray(map.menuCamera.target));}
spawn();
function attach(result){applySurfaceSettings(result.group,{...GRAPHICS_PRESETS.low,quality:'low'},rendererTextureAnisotropy(renderer));root.add(result.group);}
function schedule(){
 if(libraryScheduler){
  stream=new TilesMapStream(manifest,manifestURL,{loader,camera,activate:(result,pkg)=>{applySurfaceSettings(result.group,{...GRAPHICS_PRESETS.low,quality:'low'},rendererTextureAnisotropy(renderer));for(const i of pkg.objectIndices)if(coarse.objects.has(i))coarse.objects.get(i).visible=false;},deactivate:(_result,pkg)=>{for(const i of pkg.objectIndices)if(coarse?.objects.has(i))coarse.objects.get(i).visible=true;}});
  root.add(stream.group);stream.update();return;
 }
 stream=new SpatialMapStream(manifest.packages,{load:(pkg,options)=>loader.load(pkg,options),activate:(result,pkg)=>{attach(result);for(const i of pkg.objectIndices)if(coarse.objects.has(i))coarse.objects.get(i).visible=false;},deactivate:(result,pkg)=>{for(const i of pkg.objectIndices)if(coarse?.objects.has(i))coarse.objects.get(i).visible=true;result.group.removeFromParent();}});
 stream.update(camera.position.toArray());
}
function report(){
 const info=renderer.info;
 return {prototype:true,scheduler:libraryScheduler?'3d-tiles-renderer@0.5.3':'grid',physicsIncluded:false,backend:'WebGL2',framebuffer:[renderer.domElement.width,renderer.domElement.height],hidden,quality:'low',adaptiveResolution:false,timing,
  detail:stream?.stats()||null,textures:loader?.stats()||null,render:{drawCalls:info.render.drawCalls??info.render.calls,triangles:info.render.triangles,memory:{...info.memory}},
  heapBytes:performance.memory?.usedJSHeapSize??null,lastReleasePool,longTasks:longTasks.slice(-12),frameCount:frames.length,cycles:cycleReports};
}
async function stop(){
 generation++;tour=false;stream?.dispose();stream=null;coarse?.dispose();coarse=null;loader?.dispose();lastReleasePool=loader?.stats()||lastReleasePool;loader=null;
 root.clear();await paint();$('status').textContent='All map resources released';$('report').textContent=JSON.stringify(report(),null,2);
}
async function start(){
 const clearing=stop(),current=generation;await clearing;if(current!==generation)return;
 const began=performance.now();frames.length=0;longTasks.length=0;hidden=document.hidden;farOnly=false;timing={};spawn();
 $('status').textContent='Loading complete distant coverage';
 manifest=await fetch(manifestURL).then(r=>{if(!r.ok)throw Error('Generate the streaming experiment first');return r.json();});if(current!==generation)return;
 const ktxLoader=new KTX2Loader().setTranscoderPath('/runtime/basis/').setWorkerLimit(2).detectSupport(renderer);
 const owner=new StreamChunkLoader(manifest,manifestURL,{ktxLoader});loader=owner;
 try{
  const distant=await owner.load(manifest.packages.find(pkg=>pkg.kind==='coarse'));
  if(current!==generation){distant.dispose();owner.dispose();return;}
  coarse=distant;attach(coarse);timing.distantAssemblyMs=performance.now()-began;
  await renderer.compileAsync(scene,camera);if(current!==generation)return;await paint();
  timing.distantFirstFrameMs=performance.now()-began;timing.distantEncodedBytes=manifest.packages.find(pkg=>pkg.kind==='coarse').totalBytes;
  schedule();$('status').textContent='Complete distant coverage ready; nearby detail streams within fixed limits';
 }catch(error){if(current===generation){await stop();throw error;}}
}
async function cycles(count=20){
 if(busy)return;busy=true;cycleStop=false;cycleReports.length=0;
 try{for(let i=0;i<count&&!cycleStop;i++){
  $('status').textContent=`Load/release cycle ${i+1}/${count}`;await start();await stream?.idle();await paint();
  const active=report();await stop();cycleReports.push({cycle:i+1,active:{textures:active.textures,detail:active.detail,memory:active.render.memory,heapBytes:active.heapBytes},released:{...renderer.info.memory},releasedPool:lastReleasePool,releasedHeapBytes:performance.memory?.usedJSHeapSize??null});
 }
 $('status').textContent=`${cycleReports.length} cycles completed; hardware/frame acceptance still pending`;return report();
 }finally{busy=false;}
}
async function cancelBoundary(){cycleStop=true;const loading=start();await stop();await loading;$('status').textContent=coarse?'FAIL: canceled preparation revived the map':'PASS: immediate cancellation kept the map released';}
for(const [id,fn]of [['load',start],['stop',()=>{cycleStop=true;return stop();}],['home',()=>spawn()],['tour',()=>{tour=!tour;routeStart=performance.now();previousPosition=null;}],['far',()=>{farOnly=!farOnly;stream?.dispose();stream=null;if(coarse&&!farOnly)schedule();$('status').textContent=farOnly?'Distant coverage only':'Nearby detail resumed';}],['retry',()=>stream?.retry()],['cycles',()=>cycles()],['cancel-boundary',cancelBoundary]])$(id).onclick=()=>Promise.resolve().then(fn).catch(error=>{$('status').textContent=error.message;});
const route=[track.spawn.position,...track.gates.map(g=>g.position),track.spawn.position],target=new THREE.Vector3();let lastFrame;
renderer.setAnimationLoop(now=>{
 if(tour){const t=(now-routeStart)/1000/30*(route.length-1)%(route.length-1),index=Math.floor(t),f=t-index,a=route[index],b=route[index+1];camera.position.set(...a.map((n,i)=>n+(b[i]-n)*f+(i===1?.8:0)));target.fromArray(b);target.y+=.8;camera.lookAt(target);}
 if(stream&&now-lastUpdate>100){const position=camera.position.toArray(),dt=previousPosition?(now-lastUpdate)/1000:1,velocity=position.map((n,i)=>previousPosition?Math.max(-100,Math.min(100,(n-previousPosition[i])/dt)):0);stream.update(position,velocity);previousPosition=position;lastUpdate=now;}
 renderer.render(scene,camera);if(coarse&&lastFrame&&frames.length<20000)frames.push(now-lastFrame);lastFrame=now;
 if(now-lastReport>500){$('report').textContent=JSON.stringify(report(),null,2);lastReport=now;}
});
$('status').textContent='Ready to load streaming experiment';
export {start,stop,cycles,report,renderer,camera,scene,stream,loader,coarse};
