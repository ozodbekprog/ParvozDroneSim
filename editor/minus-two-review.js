import {Vector2} from 'three';
import {World} from '../src/world.js';
import {GRAPHICS_PRESETS} from '../src/graphics-settings.js';
import {installCatalog,GAMEPLAY_OBSTACLES} from '../shared/catalog.js';
import {resolveBuild,createDroneState,stepDrone,resolveEnvironmentCollision,FIXED_DT} from '../shared/physics.js';
import {estimateTextureMemory} from '../src/performance-report.js';
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search),probe=params.has('probe');
if(params.has('thumbnail'))document.head.append(Object.assign(document.createElement('style'),{textContent:'html,body,main{margin:0;padding:0;width:100%;height:100%;max-width:none;overflow:hidden}main>h1,main>p,main>nav,main>output{display:none}#view{width:100vw;height:100vh;aspect-ratio:auto}'}));
const profileFile=params.get('profile')||'tools/import-profiles/minus-two-demo.json';
if(!/^tools\/import-profiles\/[a-z0-9-]+\.json$/.test(profileFile))throw new Error('Invalid review profile path');
const importProfile=await fetch('/'+profileFile).then(r=>{if(!r.ok)throw new Error('Review profile unavailable');return r.json();});
const staging='/'+importProfile.staging,hoverHeight=importProfile.probe.position[1];
const world=new World($('#view'),false,{forceWebGL:params.get('backend')==='webgl'});
const shots={pilot:{position:[-15.752,1.4,-66.501],target:[-15.752,1.4,-48]},detail:{position:[-19,1.6,-61],target:[-22,1.6,-57]},ceiling:{position:[-15.752,1.3,-64],target:[-15.752,3,-51]},reverse:{position:[-15.752,1.4,-48],target:[-15.752,1.4,-66.5]}};
if(importProfile.id!=='minus-two-demo'){
  shots.pilot=importProfile.probe;
  shots.detail={position:importProfile.probe.position.map((v,i)=>v+(i===0?-2:0)),target:importProfile.probe.target};
  shots.ceiling={position:importProfile.probe.position,target:importProfile.probe.target.map((v,i)=>v+(i===1?2:0))};
  shots.reverse={position:importProfile.probe.target,target:importProfile.probe.position};
  $('h1').textContent=importProfile.map.name+' — импортированная карта';
}
let map,track,state,spec,obstacles,memory,flightMode='idle',touring=false,tourStart=0,last=0,accumulator=0;
document.title=importProfile.map.name+' — проверка Low';
$('#view').setAttribute('aria-label',importProfile.map.name);
const gameLink=Object.assign(document.createElement('a'),{href:'http://127.0.0.1:2567/',target:'_blank',textContent:'Локальная игра'});
document.querySelector('main>p').replaceChildren('Исходное окружение и трасса из Liftoff. ',gameLink,'. Выберите ракурс или проверьте взлёт Kestrel.');
if(importProfile.id!=='minus-two-demo'){
  $('[data-shot="detail"]').textContent='Рядом со стартом';
  $('[data-shot="ceiling"]').textContent='Взгляд выше';
}
const fullscreenButton=Object.assign(document.createElement('button'),{textContent:'Кадр на весь экран'});
$('nav').appendChild(fullscreenButton);
fullscreenButton.onclick=()=>$('#view').requestFullscreen();
document.head.appendChild(Object.assign(document.createElement('style'),{textContent:'#view:fullscreen{width:100vw;height:100vh;aspect-ratio:auto}'}));
const peaks={triangles:0,drawCalls:0,samples:0};
const frameCosts=new Map();
const costOutput=params.has('stats')?document.body.appendChild(document.createElement('pre')):null;
function restart(){state=createDroneState(track.spawn.position,track.spawn.yaw);flightMode='idle';touring=false;world.upsertDrone('review-kestrel',spec,state,true);}
function metrics(){const size=world.renderer.getDrawingBufferSize(new Vector2()),info=world.renderer.info.render;
  $('#peaks').textContent=`Максимум за осмотр: ${peaks.triangles} треугольников, ${peaks.drawCalls} draw calls (${peaks.samples} кадров).`;
  $('#status').textContent=`${probe?'Пробный участок':'Полная карта'} · ${world.renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2'} · Low · ${size.x}×${size.y} · ${info.triangles} треугольников · ${info.drawCalls} draw calls · ${memory?.mib.toFixed(1)} MiB текстур`;
  $('#flight').textContent=`Kestrel · ${flightMode} · позиция ${state.position.map(v=>v.toFixed(2)).join(', ')} · здоровье ${state.health.toFixed(3)} · ${state.grounded?'на земле':'в воздухе'}${state.crashed?' · столкновение':''}`;
}
try{
  const catalog=await fetch('/editor-api/catalog').then(r=>r.json());
  if(probe){
    obstacles=(await fetch(staging+'/collision.json').then(r=>r.json())).items;
    const report=await fetch(staging+'/probe-report.json').then(r=>r.json());
    map={...importProfile.map,id:importProfile.id+'-probe',name:importProfile.map.name+' probe',
      bounds:report.bounds,model:staging+'/probe.glb',colliders:obstacles,
      tracks:[{id:'probe',name:'Probe',laps:1,spawn:importProfile.course.spawn,gates:[{position:importProfile.probe.target,yaw:importProfile.course.spawn.yaw,width:importProfile.course.width,height:importProfile.course.height}]}]};
    catalog.maps.push(map);
  }else{map=catalog.maps.find(m=>m.id===importProfile.id);if(!map)throw new Error('Полный пакет ещё не подключён.');}
  installCatalog(catalog);track=map.tracks.find(t=>t.id===(params.get('track')||importProfile.course.id))||map.tracks[0];spec=resolveBuild();
  await world.ready;await world.load(map.id,track.id);
  obstacles=GAMEPLAY_OBSTACLES[map.id];
  world.setGraphics({...GRAPHICS_PRESETS.low,quality:'low',fixedResolution:[1280,720],adaptiveResolution:false});world.setFov(75);world.setFpvTilt(0);
  restart();world.inspectionCamera=shots.pilot;
  await Promise.all([...world.drones.values()].map(d=>d.mesh.assetsReady));await world.prepareGraphics();memory=estimateTextureMemory(world.scene);
  if(costOutput)world.scene.traverse(object=>{if(!object.isMesh)return;const before=object.onBeforeRender;object.onBeforeRender=function(...args){before?.apply(this,args);const group=args[5],triangles=(group?.count??object.geometry.index?.count??object.geometry.attributes.position.count)/3*(object.isInstancedMesh?object.count:1);const entry=frameCosts.get(object.name)||{name:object.name,triangles:0,calls:0};entry.triangles+=triangles;entry.calls++;frameCosts.set(object.name,entry);};});
  document.querySelectorAll('[data-shot]').forEach(b=>b.onclick=()=>{touring=false;world.inspectionCamera=b.dataset.shot==='drone'?{position:state.position.map((v,i)=>v+[-.9,.35,-.9][i]),target:[...state.position]}:shots[b.dataset.shot];});
  $('#takeoff').onclick=()=>{flightMode='hover';world.inspectionCamera=null;touring=false;};
  $('#land').onclick=()=>{flightMode='land';world.inspectionCamera=null;touring=false;};$('#reset').onclick=restart;
  $('#fpv').onclick=()=>{world.inspectionCamera=null;touring=false;};
  $('#tour').onclick=()=>{touring=!touring;tourStart=performance.now();};
  world.startAnimation(now=>{
    accumulator+=Math.min(.1,(now-(last||now))/1000);last=now;
    while(accumulator>=FIXED_DT){
      if(flightMode!=='idle'){
        const voltage=1-(1-state.battery)*.16;
        const hover=Math.pow(1/(spec.thrustToWeight*voltage*voltage),1/1.85);
        const throttle=flightMode==='land'?0:Math.max(0,Math.min(1,hover+(hoverHeight-state.position[1])*.09-state.velocity[1]*.07));
        stepDrone(state,{throttle,roll:0,pitch:0,yaw:0},spec,FIXED_DT,'angle',[0,0,0]);
        resolveEnvironmentCollision(state,map,track,obstacles,spec);
        if(flightMode==='land'&&state.grounded)flightMode='idle';
      }
      accumulator-=FIXED_DT;
    }
    world.upsertDrone('review-kestrel',spec,state,true);
    if(touring){const points=[track.spawn.position,...track.gates.map(g=>g.position),track.spawn.position],t=(now-tourStart)/2500,i=Math.floor(t)%(points.length-1),f=t%1;world.inspectionCamera={position:points[i].map((v,a)=>v+(points[i+1][a]-v)*f),target:points[i+1]};}
    world.activeDroneId=world.inspectionCamera?null:'review-kestrel';
    world.drones.get('review-kestrel').own=!world.inspectionCamera;
    frameCosts.clear();world.render(now);const info=world.renderer.info.render;
    peaks.triangles=Math.max(peaks.triangles,info.triangles);peaks.drawCalls=Math.max(peaks.drawCalls,info.drawCalls);peaks.samples++;
    if(Math.floor(now/500)!==world.reviewTick){world.reviewTick=Math.floor(now/500);metrics();if(costOutput)costOutput.textContent=JSON.stringify([...frameCosts.values()].sort((a,b)=>b.triangles-a.triangles).slice(0,20),null,2);}
  });metrics();
}catch(error){$('#status').textContent='Ошибка: '+error.message;console.error(error);}
