import {Euler,Quaternion,Vector3} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {World} from '../../src/world.js';
import {MAPS,getTrackObstacles} from '../../shared/content.js';
import {createDroneState,resolveBuild} from '../../shared/physics.js';
import {GRAPHICS_PRESETS} from '../../src/graphics-settings.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const world=new World($('view'),false,{forceWebGL:params.get('backend')==='webgl'});
const controls=new OrbitControls(world.camera,world.renderer.domElement);
const spec=resolveBuild();let map,track,state,crashStart=0,gateIndex=-1,loaded=false,lastReport=0;
let crashOrigin,crashCamera,crashDirection,maxCameraDrift=0,maxViewTurn=0,crashFrames=0;
const errors=[];
addEventListener('error',event=>errors.push(event.message));
addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
for(const item of Object.values(MAPS))$('map').add(new Option(item.name,item.id));
$('map').value=params.get('map')||'hangar-c03-demo';
function tracks(){
  $('track').replaceChildren();
  for(const item of MAPS[$('map').value].tracks)$('track').add(new Option(item.name,item.id));
  if(params.get('track'))$('track').value=params.get('track');
}
$('map').onchange=tracks;tracks();
function inspect(position,target){
  world.activeDroneId=null;world.camera.position.fromArray(position);controls.target.fromArray(target);controls.update();
  world.inspectionCamera={position:world.camera.position.toArray(),target:controls.target.toArray()};
}
controls.addEventListener('change',()=>{if($('camera').value==='orbit')world.inspectionCamera={position:world.camera.position.toArray(),target:controls.target.toArray()};});
$('inspect').onclick=()=>{
  const position=$('position').value.split(',').map(Number),target=$('target').value.split(',').map(Number);
  if(position.length!==3||target.length!==3||![...position,...target].every(Number.isFinite))return;
  $('camera').value='orbit';controls.enabled=true;inspect(position,target);
};
function camera(){
  const mode=$('camera').value;controls.enabled=mode==='orbit';
  if(mode==='orbit')inspect(world.camera.position.toArray(),state?.position||[0,1,0]);
  else {world.inspectionCamera=null;world.activeDroneId='repair-drone';world.setCameraMode(mode);}
}
$('camera').onchange=camera;
function quality(){world.setGraphics({...GRAPHICS_PRESETS[$('quality').value],quality:$('quality').value,fixedResolution:[1280,720],adaptiveResolution:false});}
$('quality').onchange=quality;
function reset(){
  crashStart=0;state=createDroneState(track.spawn.position,track.spawn.yaw);
  world.upsertDrone('repair-drone',spec,state,true);world.resetDroneVisual('repair-drone',state);
  maxCameraDrift=maxViewTurn=crashFrames=0;camera();
}
$('reset').onclick=reset;
$('crash').onclick=()=>{
  if($('camera').value==='orbit'){$('camera').value='chase';camera();}
  reset();state.position[1]+=1;world.render(performance.now(),{prepareOnly:true});
  crashOrigin=new Vector3(...state.position);crashCamera=world.camera.position.clone();crashDirection=world.camera.getWorldDirection(new Vector3());
  state.crashed=true;crashStart=performance.now();
};
$('next').onclick=()=>{
  crashStart=0;gateIndex=(gateIndex+1)%track.gates.length;const gate=track.gates[gateIndex];
  state.position=[...gate.position];state.rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),gate.yaw).toArray();world.resetDroneVisual('repair-drone',state);
  $('camera').value='orbit';camera();inspect(gate.position.map((v,i)=>v+[-Math.sin(gate.yaw)*5,1,-Math.cos(gate.yaw)*5][i]),gate.position);
};
function report(){
  return {map:map?.id,track:track?.id,camera:$('camera').value,quality:$('quality').value,backend:world.renderer.backend?.isWebGPUBackend?'WebGPU':'WebGL2',framebuffer:[world.renderer.domElement.width,world.renderer.domElement.height],gate:gateIndex,courseObjects:track?.objects?.length,courseRoots:world.scene.children.filter(child=>child.name==='Selected course').length,colliders:map?getTrackObstacles(map.id,track.id).length:0,cameraPosition:world.camera.position.toArray(),dronePosition:state?.position,crashed:state?.crashed,crashFrames,maxCameraDrift,maxViewTurnDegrees:maxViewTurn*180/Math.PI,drawCalls:world.renderer.info.render.drawCalls,triangles:world.renderer.info.render.triangles,renderFatal:world.renderFatal||false,renderWarning:world.renderWarning||null,errors};
}
$('save').onclick=()=>{const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(report(),null,2)],{type:'application/json'}));link.download='parvoz-scene-repair-'+map.id+'.json';link.click();URL.revokeObjectURL(link.href);};
$('load').onclick=async()=>{
  loaded=false;$('load').disabled=true;$('status').textContent='Loading real map, selected track and collision data…';
  try{
    await world.ready;map=MAPS[$('map').value];track=map.tracks.find(t=>t.id===$('track').value);
    await world.load(map.id,track.id);quality();reset();
    await Promise.all([...world.drones.values()].map(d=>d.mesh.assetsReady));await world.prepareGraphics();
    const probe=await fetch('/tools/import-profiles/'+map.id+'.json').then(r=>r.json());
    $('camera').value='orbit';camera();inspect(probe.probe.position,probe.probe.target);
    loaded=true;for(const id of ['crash','reset','next','save'])$(id).disabled=false;
    $('status').textContent=JSON.stringify(report(),null,2);
  }catch(error){errors.push(error.message);$('status').textContent=error.stack;}
  finally{$('load').disabled=false;}
};
world.startAnimation(now=>{
  if(!loaded)return;
  if(crashStart){
    const t=(now-crashStart)/1000;
    state.rotation=new Quaternion().setFromEuler(new Euler(t*19,t*27,t*23)).toArray();
    state.position=crashOrigin.toArray();
  }
  world.render(now);
  if(crashStart){crashFrames++;maxCameraDrift=Math.max(maxCameraDrift,world.camera.position.distanceTo(crashCamera));maxViewTurn=Math.max(maxViewTurn,world.camera.getWorldDirection(new Vector3()).angleTo(crashDirection));}
  if(now-lastReport>500){lastReport=now;$('status').textContent=JSON.stringify(report(),null,2);}
});
