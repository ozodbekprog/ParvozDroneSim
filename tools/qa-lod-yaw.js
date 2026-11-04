import {Vector3,Quaternion} from 'three';
import {materialTextures} from '../src/material-resources.js';

/** Local visual diagnosis: fixed camera position, full-detail range and yaw only.
 * Expose both actual framebuffers and source LOD selections for inspection. */
export function installYawProbe(world,{scenario,pause,hardware}){
 const button=document.createElement('button');button.textContent='Inspect maximum detail yaw';document.querySelector('nav').append(button);
 const filter=document.createElement('select');filter.id='yaw-filter';filter.setAttribute('aria-label','Yaw texture filtering');for(const n of [1,8])filter.add(new Option(n+'x texture filtering',n));document.querySelector('nav').append(filter);
 const output=document.createElement('output');output.id='yaw-result';const images=document.createElement('section');images.id='yaw-views';document.body.append(output,images);
 button.onclick=async()=>{
  const {map}=scenario();if(!map)return;button.disabled=true;pause();output.textContent='Preparing yaw comparison';images.replaceChildren();
  try{
   world.hangarPreview=false;world.menuScene=null;world.activeDroneId=null;world.presentation='flight';
   world.setGraphics({...world.graphics,quality:'custom',lodMinimum:0,lodDistanceScale:4,textureSize:0,normalMaps:true,anisotropy:Number(filter.value),fixedResolution:[1280,720],adaptiveResolution:false});
   const position=world.camera.position.clone(),forward=new Vector3();world.camera.getWorldDirection(forward);const axis=new Vector3(0,1,0),initial=[];
   world.scene.traverse(o=>{if(o.userData.visualLod)initial.push(o);});
   const sourceLODGroups=initial.map((o,id)=>({id,name:o.parent?.name||o.name}));
   const rows=[];let baseline;
   for(const yaw of [0,20,0]){
    const direction=forward.clone().applyQuaternion(new Quaternion().setFromAxisAngle(axis,yaw*Math.PI/180));world.inspectionCamera={position:position.toArray(),target:position.clone().addScaledVector(direction,20).toArray()};
    await world.prepareGraphics();world.render(performance.now());
    const levels=initial.map(o=>o.userData.visualLod.active);baseline||=levels;
    const textures=new Set();world.scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)for(const t of materialTextures(m))textures.add(t);});
    rows.push({yaw,position:world.camera.position.toArray(),fov:world.camera.fov,levels,changed:levels.flatMap((index,id)=>index===baseline[id]?[]:[{...sourceLODGroups[id],from:baseline[id],to:index}]),draws:world.renderer.info.render.drawCalls??world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles,textureAnisotropy:[...new Set([...textures].map(t=>t.anisotropy))]});
    const img=document.createElement('img');img.alt='Actual maximum-detail frame, yaw '+yaw+' degrees';img.style.maxWidth='640px';img.src=world.renderer.domElement.toDataURL('image/jpeg',.93);images.append(img);
   }
   output.textContent=JSON.stringify({map:map.id,backend:world.renderer.backend?.isWebGLBackend?'WebGL2':'WebGPU',hardware,framebuffer:[world.renderer.domElement.width,world.renderer.domElement.height],lodDistanceScale:world.graphics.lodDistanceScale,lodMinimum:world.graphics.lodMinimum,textureSize:world.graphics.textureSize,normalMaps:world.graphics.normalMaps,requestedAnisotropy:world.graphics.anisotropy,adaptiveResolution:false,sourceLODGroups,rows},null,2);
  }catch(error){output.textContent=error.stack;console.error(error);}finally{button.disabled=false;}
 };
}
