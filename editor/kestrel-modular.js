import {Vector2} from 'three';
import {World} from '../src/world.js';
import {GRAPHICS_PRESETS} from '../src/graphics-settings.js';
import {installCatalog,PARTS,DRONES} from '../shared/catalog.js';
import {defaultBuild,resolveBuild,createDroneState} from '../shared/physics.js';
import {estimateTextureMemory} from '../src/performance-report.js';
const $=s=>document.querySelector(s),world=new World($('#view'));
const centre=[3,1.4,4], shots={front:[.28,.15,.42],rear:[-.28,.15,-.42],side:[.48,.12,0],top:[.03,.55,.03],far:[0,5,26]};
let shot='front',spinning=false,busy=true,memory,item,checks=0;
const state=createDroneState(centre), selection=defaultBuild();
function camera(){world.inspectionCamera={position:shots[shot].map((v,i)=>v+centre[i]),target:centre};}
async function rebuild(){
  busy=true;document.querySelectorAll('button,select,input').forEach(e=>e.disabled=true);
  const build=resolveBuild({...selection,color:$('#body').value,led:$('#led').value}),lod=$('#lod').value;
  if(lod!=='auto')for(const definition of [build,...build.visualParts]){definition.model=definition.modelLods[+lod].model;delete definition.modelLods;}
  // Keep shared asset references alive while the next assembly loads.
  const nextId='assembly-'+(++checks),next=world.upsertDrone(nextId,build,state);
  await next.mesh.assetsReady;world.removeMissing([nextId]);item=next;
  camera();await world.prepareGraphics();memory=estimateTextureMemory(world.scene);
  const moving=new Set(),categories=new Set();item.mesh.traverse(o=>{if(o.name==='prop' && Number.isInteger(o.userData.motorIndex))moving.add(o.userData.motorIndex);if(o.userData.category)categories.add(o.userData.category);});
  $('#checks').textContent=`Сборка ${checks}: ${categories.size}/5 сменных категорий · ${moving.size}/4 осей пропеллеров · геометрия и текстуры загружены`;
  busy=false;document.querySelectorAll('button,select,input').forEach(e=>e.disabled=false);
  redraw();
}
function redraw(){world.render(performance.now());metrics();}
function metrics(){
  const size=world.renderer.getDrawingBufferSize(new Vector2()),info=world.renderer.info.render;
  $('#status').textContent=`${world.renderer.backend.isWebGPUBackend?'WebGPU':'WebGL2'} · Low · ${size.x}×${size.y} · ${info.triangles.toLocaleString()} треугольников сцены · ${info.drawCalls} draw calls · ≈${memory?.mib.toFixed(1)} MiB текстур`;
  const visible=[],angles=[];
  item.mesh.traverseVisible(o=>{if(o.userData.visualLod)visible.push(o.userData.visualLod.active);if(o.name==='prop')angles[o.userData.motorIndex]=o.rotation.y.toFixed(2);});
  $('#checks').textContent=$('#checks').textContent.split('\n')[0]+`\nАктивные LOD: ${[...new Set(visible)].join(', ') || $('#lod').value} · углы четырёх пропеллеров: ${angles.join(' / ')}`;
}
function fail(e){busy=false;$('#status').textContent='Ошибка: '+e.message;console.error(e);}
try{
  installCatalog(await fetch('/editor-api/catalog').then(r=>r.json()));
  const names={frame:'Рама',motors:'Моторы',propellers:'Лопасти',camera:'Камера',battery:'Батарея'};
  for(const [category,name] of Object.entries(names)){
    const label=document.createElement('label');label.textContent=name;const select=document.createElement('select');select.dataset.category=category;
    for(const part of PARTS[category].filter(p=>p.model && p.compatibleDrones?.includes('kestrel'))){const option=document.createElement('option');option.value=part.id;option.textContent=part.name+' · '+part.visualVariant;option.selected=part.id===selection[category];select.append(option);}
    label.append(select);$('#parts').append(label);select.onchange=()=>{selection[category]=select.value;rebuild().catch(fail);};
  }
  $('#source').href=DRONES.kestrel.attributionFile;
  await world.ready;await world.load('ironworks-v2','ironworks-v2-loading-run');
  world.setGraphics({...GRAPHICS_PRESETS.low,quality:'low',fixedResolution:[1280,720],adaptiveResolution:false});world.setFov(45);await rebuild();
  document.querySelectorAll('[data-shot]').forEach(b=>b.onclick=()=>{shot=b.dataset.shot;camera();redraw();});
  $('#spin').onclick=()=>{spinning=!spinning;state.motors.fill(spinning ? .18 : 0);$('#spin').textContent='Вращение: '+(spinning?'включено':'выключено');redraw();};
  $('#capture').onclick=()=>{redraw();saveImage();};$('#reload').onclick=()=>rebuild().catch(fail);
  for(const id of ['lod','body','led'])$('#'+id).onchange=()=>rebuild().catch(fail);
  world.startAnimation(now=>{
    if(busy)return;world.render(now);
    if(Math.floor(now/500)!==world.reviewTick){world.reviewTick=Math.floor(now/500);metrics();}
  });
}catch(e){fail(e);}
function saveImage(){world.renderer.domElement.toBlob(blob=>{const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=`kestrel-${shot}-${$('#lod').value}-720p.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});}
