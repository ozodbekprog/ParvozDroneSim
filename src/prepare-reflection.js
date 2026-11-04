import {BackSide,BoxGeometry,Color,Mesh,MeshBasicMaterial,PerspectiveCamera,Vector3} from 'three';
import {compileScenePrograms} from './compile-scene-programs.js';

const yieldToBrowser=()=>globalThis.scheduler?.yield?.()||new Promise(resolve=>setTimeout(resolve,0));
const phi=(1+Math.sqrt(5))/2,invPhi=1/phi;
// Same capture atlas and roughness convolution as Three.js r180 PMREMGenerator (MIT).
const axes=[[-phi,invPhi,0],[phi,invPhi,0],[-invPhi,0,phi],[invPhi,0,phi],[0,phi,-invPhi],[0,phi,invPhi],[-1,1,-1],[1,1,-1],[-1,1,1],[1,1,1]].map(v=>new Vector3(...v));
function viewport(target,x,y,width,height){target.viewport.set(x,y,width,height);target.scissor.set(x,y,width,height);target.scissorTest=true;}

/** r180 fromSceneAsync still renders all six faces and blur passes synchronously.
 * Preserve its authored capture while allowing input between shader variants,
 * cube faces and convolution levels. Renderer/scene state is restored at every
 * asynchronous boundary; this adapter is deliberately isolated to the r180 API. */
export async function prepareReflection(generator,renderer,scene,{size=128,near=.1,far=100,position=new Vector3(),isCurrent=()=>true,yieldTask=yieldToBrowser}={}){
 // WebGL readback found a capture difference. Preserve its existing renderer
 // path until progressive captures have equal-image verification there too.
 if(renderer.backend?.isWebGLBackend)return isCurrent()?generator.fromSceneAsync(scene,0,near,far,{size,position}):null;
 const camera=new PerspectiveCamera(90,1,near,far);camera.coordinateSystem=renderer.coordinateSystem;camera.updateProjectionMatrix();
 const background=scene.background,solid=!background||background.isColor;
 const color=background?.isColor?background:renderer.getClearColor(new Color());
 const box=new Mesh(new BoxGeometry(),new MeshBasicMaterial({name:'PMREM.Background',color,side:BackSide,depthWrite:false,depthTest:false}));
 let target,complete=false;
 const withState=action=>{
  const prior={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),mrt:renderer.getMRT(),autoClear:renderer.autoClear,background:scene.background};
  try{renderer.autoClear=false;renderer.setMRT(null);if(background?.isColor)scene.background=null;return action();}
  finally{renderer.setRenderTarget(prior.target,prior.face,prior.mip);renderer.setMRT(prior.mrt);renderer.autoClear=prior.autoClear;scene.background=prior.background;}
 };
 try{
  if(!isCurrent())return null;
  generator._setSize(size);target=generator._allocateTarget();target.depthBuffer=true;generator._init(target);
  withState(()=>{renderer.setRenderTarget(target);renderer.clear();if(solid)renderer.render(box,camera);});
  const up=[1,1,1,1,-1,1],forward=[1,-1,1,-1,1,-1];
  for(let face=0;face<6;face++){
   if(!isCurrent())return null;
   const col=face%3;camera.position.copy(position);
   if(col===0){camera.up.set(0,up[face],0);camera.lookAt(position.x+forward[face],position.y,position.z);}
   else if(col===1){camera.up.set(0,0,up[face]);camera.lookAt(position.x,position.y+forward[face],position.z);}
   else{camera.up.set(0,up[face],0);camera.lookAt(position.x,position.y,position.z+forward[face]);}
   viewport(target,col*size,face>2?size:0,size,size);
   await compileScenePrograms(scene,camera,()=>withState(()=>{renderer.setRenderTarget(target);return renderer.compileAsync(scene,camera);}),{isCurrent,yieldTask});
   if(!isCurrent())return null;
   withState(()=>{renderer.setRenderTarget(target);renderer.render(scene,camera);});
   await yieldTask();
  }
  for(let i=1;i<generator._lodPlanes.length;i++){
   if(!isCurrent())return null;
   const sigma=Math.sqrt(generator._sigmas[i]**2-generator._sigmas[i-1]**2),axis=axes[(generator._lodPlanes.length-i-1)%axes.length];
   withState(()=>generator._blur(target,i-1,i,sigma,axis));
   await yieldTask();
  }
  target.scissorTest=false;target.viewport.set(0,0,target.width,target.height);target.scissor.set(0,0,target.width,target.height);
  complete=true;return target;
 }finally{
  if(!complete)target?.dispose();box.geometry.dispose();box.material.dispose();
 }
}
