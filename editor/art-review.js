import { Vector2 } from 'three';
import { World } from '../src/world.js';
import { GRAPHICS_PRESETS } from '../src/graphics-settings.js';
import { installCatalog } from '../shared/catalog.js';
import { resolveBuild, createDroneState } from '../shared/physics.js';
import { PerformanceRun, estimateTextureMemory } from '../src/performance-report.js';

const $ = selector => document.querySelector(selector);
const looks = {
  clean:{label:'Действующая промзона',sky:'#93b4ce',fog:'#adbac3',ground:'#858982',sun:'#fff4dc',sunPosition:[-20,45,25],ambientIntensity:1.15,sunIntensity:2.4,description:'Светлая штукатурка, обслуживаемый бетон, прохладный дневной свет. Проёмы и архитектурные детали одинаковы во всех вариантах.'},
  worn:{label:'Изношенный двор',sky:'#8aa0af',fog:'#a5acaf',ground:'#716a61',sun:'#ffe5c4',sunPosition:[-20,35,25],ambientIntensity:1.05,sunIntensity:2.3,description:'Открытый кирпич, потёртый бетон и металлические детали. Основная мелкая фактура передаётся картами нормалей и шероховатости.'},
  evening:{label:'Тёплый вечер',sky:'#aa9c99',fog:'#c6afa0',ground:'#5e5146',sun:'#ffc280',sunPosition:[-35,12,25],ambientIntensity:.72,sunIntensity:2.6,description:'Тот же изношенный двор в тёплом вечернем свете. Динамические тени и постэффекты отключены, как на Low.'}
};
const shots = {yard:{position:[8,3.4,6],target:[-2,2.7,-5]},portal:{position:[3,1.6,1],target:[0,1.6,-9]},detail:{position:[-6.7,1.4,-1.7],target:[-8.5,1.6,-5.7]},drone:{position:[4.24,2.16,3.3],target:[4,2.01,3]},reverse:{position:[3.76,2.12,2.7],target:[4,2.01,3]},top:{position:[4.05,2.42,3.04],target:[4,2,3]}};
const world = new World($('#view'),false,{forceWebGL:new URLSearchParams(location.search).get('backend')==='webgl'});
let catalog, droneDefinition, hardware, look='worn', shot='yard', touring=false, tourStarted=0, run=null, runIndex=0, reports=[], capture=false, busy=true, textureMemory, diagnostic=false;
const backend=()=>world.renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2';
function rendererName(){
  const gl=world.renderer.backend.gl;
  if(!gl)return world.renderer.backend.device?.adapterInfo?.description || 'WebGPU — устройство не сообщило название';
  const debug=gl.getExtension('WEBGL_debug_renderer_info');
  return gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER);
}
function save(name,body,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([body],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function controls(disabled){document.querySelectorAll('[data-look],[data-shot],#tour,#benchmark,#smoke,#participants,#drone-lod,#spin,#capture').forEach(el=>el.disabled=disabled);}
async function loadLook(value){
  busy=true;controls(true);look=value;$('#status').textContent='Загрузка материалов…';
  const map={id:'ironworks-v2-review-'+value,name:'Ironworks review',theme:'industrial',environment:'industrial',...looks[value],wind:[0,0,0],gravity:1,fogDensity:.001,model:`/content/review/ironworks/${value}.glb`,groundPlane:false,colliders:[],tracks:[{id:'review-only',name:'Review',spawn:{position:[0,1.6,2],yaw:0},gates:[]}]};
  installCatalog({...catalog,maps:[...catalog.maps,map]});
  await world.load(map.id,'review-only');
  world.setGraphics({...GRAPHICS_PRESETS.low,quality:'low',fixedResolution:[1280,720],adaptiveResolution:false});world.setFov(65);
  world.inspectionCamera=shots[shot];await world.prepareGraphics();
  await participants();
  document.querySelectorAll('[data-look]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.look===look)));
  $('#description').textContent=looks[look].description;busy=false;controls(false);
}
function sampleTour(now){
  const t=(now-tourStarted)/1000*.14;
  return {position:[Math.sin(t)*6,2.1+Math.sin(t*.5)*.65,1+Math.cos(t)*5],target:[Math.sin(t+.8)*3,2,-6]};
}
async function participants(){
  world.removeMissing([]);
  const count=Number($('#participants').value);
  const build={...resolveBuild(),...droneDefinition,visualParts:[]};
  const level=$('#drone-lod').value;
  if(level!=='auto'){build.model=build.modelLods[Number(level)].model;delete build.modelLods;}
  // Inspect one stationary drone; the eight-participant case shows seven opponents.
  for(let i=0;i<(count===1?1:7);i++){
    const state=createDroneState(i===0?[4,2,3]:[-4+i,1.6+(i%2)*.4,-1-i*.6]);
    if($('#spin').checked)state.motors=[.16,.16,.16,.16];
    world.upsertDrone('review-'+i,build,state,false);
  }
  await Promise.all([...world.drones.values()].map(item=>item.mesh.assetsReady));
  textureMemory=estimateTextureMemory(world.scene);
}
function nextRun(now){
  runIndex++;tourStarted=now;
  run=new PerformanceRun({warmupMs:diagnostic?1000:30000,durationMs:diagnostic?20000:180000,metadata:{diagnostic,date:new Date().toISOString(),backend:backend(),hardware,requestedBackend:new URLSearchParams(location.search).get('backend')||'auto',look,participants:Number($('#participants').value),visibleDrones:Number($('#participants').value)===1?1:7,droneLod:$('#drone-lod').value,pass:runIndex,map:'ironworks-v2-review',routeVersion:1,contentStatus:'art-review-slice',droneStatus:'husky-kestrel-candidate',scope:'renderer-only; no flight physics or network; solo includes one inspection drone',userAgent:navigator.userAgent}});
}
try{
  [catalog,droneDefinition]=await Promise.all([fetch('/editor-api/catalog').then(r=>r.json()),fetch('/content/review/kestrel/review.json').then(r=>r.json())]);await world.ready;hardware=rendererName();await loadLook(look);
  document.querySelectorAll('[data-look]').forEach(el=>el.onclick=()=>loadLook(el.dataset.look).catch(fail));
  document.querySelectorAll('[data-shot]').forEach(el=>el.onclick=()=>{shot=el.dataset.shot;touring=false;world.inspectionCamera=shots[shot];});
  $('#tour').onclick=()=>{touring=!touring;tourStarted=performance.now();};
  $('#capture').onclick=()=>{capture=true;};
  $('#participants').onchange=()=>participants().catch(fail);
  $('#drone-lod').onchange=()=>participants().catch(fail);
  $('#spin').onchange=()=>{for(const item of world.drones.values())item.state.motors.fill($('#spin').checked?.16:0);};
  const startRun=async short=>{try{diagnostic=short;controls(true);await participants();reports=[];runIndex=0;$('#download').disabled=true;$('#stop').disabled=false;touring=true;nextRun(performance.now());}catch(error){fail(error);controls(false);}};
  $('#benchmark').onclick=()=>startRun(false);$('#smoke').onclick=()=>startRun(true);
  $('#stop').onclick=()=>{if(run){run.invalidReasons.add('Stopped by user');reports.push({...run.result(),samples:run.samples});}run=null;touring=false;controls(false);$('#stop').disabled=true;$('#download').disabled=!reports.length;};
  $('#download').onclick=()=>save(`ironworks-${look}-${backend()}-render-report.json`,JSON.stringify({targetHardwareVerified:false,reports},null,2),'application/json');
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&run)run.invalidReasons.add('Tab became hidden');});
  world.startAnimation(now=>{
    if(busy)return;
    if(touring)world.inspectionCamera=sampleTour(now);
    const start=performance.now();world.render(now);const cpuMs=performance.now()-start;
    const size=world.renderer.getDrawingBufferSize(new Vector2()),info=world.renderer.info.render;
    if(run){
      if(!document.hasFocus())run.invalidReasons.add('Browser window or tab lost focus');
      run.update(now,{width:size.x,height:size.y,hidden:document.hidden,adaptiveResolution:world.graphics.adaptiveResolution,triangles:info.triangles,drawCalls:info.drawCalls,textureMiB:textureMemory?.unknown?undefined:textureMemory?.mib,cpuMs});
      if(world.renderWarning)run.invalidReasons.add(world.renderWarning);
      $('#result').textContent=`Проход ${runIndex}/${diagnostic?1:3} · ${Math.max(0,Math.floor((now-run.started)/1000))}/${(run.warmupMs+run.durationMs)/1000} сек. · ${run.invalidReasons.size?'Замер недействителен: '+[...run.invalidReasons].join('; '):diagnostic?'Пробный замер':'прогрев 30 сек. + запись 180 сек.'}`;
      if(run.complete){reports.push({...run.result(),samples:run.samples});if(runIndex<(diagnostic?1:3))nextRun(now);else{run=null;touring=false;controls(false);$('#stop').disabled=true;$('#download').disabled=false;$('#result').textContent=JSON.stringify(reports.map(r=>({...r,samples:undefined})),null,2);}}
    }
    if(capture){capture=false;world.renderer.domElement.toBlob(blob=>{if(blob)save(`ironworks-${look}-${shot}-low-720p.png`,blob,'image/png');});}
    if(Math.floor(now/500)!==world.reviewTick){world.reviewTick=Math.floor(now/500);$('#status').textContent=`${backend()} · Low · ${size.x}×${size.y} · ${Math.round(info.triangles).toLocaleString()} треугольников · ${info.drawCalls} draw calls · текстуры ≈${textureMemory?.mib.toFixed(1)} MiB · адаптивное разрешение выключено${world.renderWarning?' · '+world.renderWarning:''}`;$('#runtime').textContent=`${hardware} · вкладка ${document.visibilityState} · окно ${document.hasFocus()?'в фокусе':'без фокуса'}`;}
  });
}catch(error){fail(error);}
function fail(error){$('#status').textContent='Ошибка: '+error.message;console.error(error);}
