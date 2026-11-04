import {Vector2} from 'three';
import {World} from '../src/world.js';
import {GRAPHICS_PRESETS} from '../src/graphics-settings.js';
import {installCatalog} from '../shared/catalog.js';
import {resolveBuild,createDroneState} from '../shared/physics.js';
import {estimateTextureMemory} from '../src/performance-report.js';
const $=s=>document.querySelector(s);
const world=new World($('#view'),false,{forceWebGL:new URLSearchParams(location.search).get('backend')==='webgl'});
const shots={yard:{position:[8,3.4,6],target:[-2,2.7,-5]},portal:{position:[3,1.6,1],target:[0,1.6,-9]},interior:{position:[3,2.4,-7],target:[-2,2.2,-11]},rear:{position:[5,2.5,-17],target:[0,1.4,-11]},gate:{position:[1.85,1.9,3.4],target:[.9,1.4,2]},overview:{position:[205,165,190],target:[0,3,0]},foundry:{position:[-53,8,-31],target:[-90,7,-65]},foundryInside:{position:[-95,4,-51],target:[-90,8,-67]},loading:{position:[62,7,-14],target:[92,5,-44]},pipes:{position:[98,7,88],target:[64,6,61]},field:{position:[-137,4,18],target:[-66,4,-22]}};
let catalog,map,track,drone,busy=true,touring=false,tourStart=0,shot='overview',memory;
const controls=disabled=>document.querySelectorAll('button,select').forEach(e=>e.disabled=disabled);
async function participants(){
  world.removeMissing([]);
  const build=resolveBuild();
  if($('#participants').value==='8')for(let i=0;i<7;i++){
    const state=createDroneState([-.8+(i%3)*.8,1.5,4+Math.floor(i/3)*.7]);state.motors.fill(.2);
    world.upsertDrone('review-'+i,build,state,false);
  }
  await Promise.all([...world.drones.values()].map(d=>d.mesh.assetsReady));memory=estimateTextureMemory(world.scene);world.render(performance.now());metrics();
}
async function reload(){
  busy=true;controls(true);world.removeMissing([]);
  await world.load(map.id,track.id,{force:true});
  world.setGraphics({...GRAPHICS_PRESETS.low,quality:'low',fixedResolution:[1280,720],adaptiveResolution:false});world.setFov(65);
  world.inspectionCamera=shots[shot];await world.prepareGraphics();await participants();
  busy=false;controls(false);
}
function routeCamera(now){
  const points=[track.spawn.position,...track.gates.map(g=>g.position),track.spawn.position];
  const t=(now-tourStart)/2400,index=Math.floor(t)%(points.length-1),f=t%1;
  const position=points[index].map((v,a)=>v+(points[index+1][a]-v)*f);
  const target=points[index+1].map((v,a)=>v+(points[(index+2)%points.length][a]-v)*.12);
  return {position,target};
}
try{
  catalog=await fetch('/editor-api/catalog').then(r=>r.json());
  installCatalog(catalog);drone=catalog.drones.find(d=>d.id==='kestrel');map=catalog.maps.find(m=>m.id==='ironworks-v2');track=map.tracks.find(t=>t.id==='ironworks-v2-site-run')||map.tracks.find(t=>t.id==='ironworks-v2-loading-run');
  await world.ready;await reload();
  $('[data-shot="overview"]').setAttribute('aria-pressed','true');
  document.querySelectorAll('[data-shot]').forEach(button=>button.onclick=()=>{shot=button.dataset.shot;touring=false;world.inspectionCamera=shots[shot];world.render(performance.now());metrics();});
  $('#tour').onclick=()=>{touring=!touring;tourStart=performance.now();};$('#capture').onclick=()=>{world.render(performance.now());saveImage();};
  $('#participants').onchange=()=>participants().catch(fail);$('#reload').onclick=()=>reload().catch(fail);
  $('#route').textContent=`${map.siteSizeMetres?.join(' × ') || '48 × 48'} м · ${map.zones?.length || 1} зон\n${track.name} · 1 круг · ${track.gates.length} ворот · чистый проём 2,6 × 2,2 м`;
  world.startAnimation(now=>{
    if(busy)return;
    if(touring){world.inspectionCamera=routeCamera(now);world.setActiveGate(Math.floor((now-tourStart)/2400)%track.gates.length);}
    world.render(now);
    if(Math.floor(now/500)!==world.reviewTick){world.reviewTick=Math.floor(now/500);metrics();}
  });
}catch(error){fail(error);}
function fail(error){$('#status').textContent='Ошибка: '+error.message;console.error(error);}
function metrics(){const size=world.renderer.getDrawingBufferSize(new Vector2()),info=world.renderer.info.render;$('#status').textContent=`${world.renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2'} · Low · ${size.x}×${size.y} · ${info.triangles.toLocaleString()} треугольников · ${info.drawCalls} draw calls · ≈${memory?.mib.toFixed(1)} MiB текстур${world.renderWarning?' · '+world.renderWarning:''}`;}
function saveImage(){world.renderer.domElement.toBlob(blob=>{const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=`ironworks-v2-${shot}-low-720p.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});}
