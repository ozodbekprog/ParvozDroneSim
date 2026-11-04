import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Mesh,PlaneGeometry,MeshStandardMaterial,Color,Vector3,Vector4,WebGPUCoordinateSystem} from 'three';
import {prepareReflection} from '../src/prepare-reflection.js';

function fixture(){
 const scene=new Scene();scene.background=new Color('#456789');
 const mesh=new Mesh(new PlaneGeometry(),new MeshStandardMaterial());mesh.frustumCulled=false;scene.add(mesh);
 const originalTarget={},originalMRT={},target={viewport:new Vector4(),scissor:new Vector4(),width:384,height:512,dispose(){this.disposed=true;}};
 const captures=[],blurs=[],renderer={coordinateSystem:WebGPUCoordinateSystem,autoClear:true,target:originalTarget,mrt:originalMRT,
  getRenderTarget(){return this.target;},getMRT(){return this.mrt;},getActiveCubeFace(){return 2;},getActiveMipmapLevel(){return 1;},
  setRenderTarget(value){this.target=value;},setMRT(value){this.mrt=value;},clear(){},getClearColor(color){return color.set('#000000');},
  compileAsync(){assert.equal(this.mrt,null);assert.equal(scene.background,null);return Promise.resolve();},
  render(object,camera){if(object===scene)captures.push({direction:camera.getWorldDirection(new Vector3()).toArray(),position:camera.position.toArray(),viewport:target.viewport.toArray()});}
 };
 const generator={_lodPlanes:[0,1,2],_sigmas:[0,.1,.2],_setSize(value){assert.equal(value,128);},_allocateTarget:()=>target,_init(){},_blur(...args){blurs.push(args);}};
 const restored=()=>{assert.equal(renderer.target,originalTarget);assert.equal(renderer.mrt,originalMRT);assert.equal(renderer.autoClear,true);assert.ok(scene.background.isColor);assert.equal(mesh.visible,true);};
 return {scene,renderer,generator,target,captures,blurs,restored};
}

test('WebGL keeps its native reflection capture until progressive image parity is verified',async()=>{
 const f=fixture(),expected={texture:{}},position=new Vector3(4,5,6);f.renderer.backend={isWebGLBackend:true};
 f.generator._allocateTarget=()=>{throw new Error('WebGL must retain native capture');};
 f.generator.fromSceneAsync=async(scene,sigma,near,far,options)=>{assert.equal(scene,f.scene);assert.equal(sigma,0);assert.equal(near,.2);assert.equal(far,300);assert.equal(options.size,128);assert.equal(options.position,position);return expected;};
 assert.equal(await prepareReflection(f.generator,f.renderer,f.scene,{near:.2,far:300,position}),expected);f.restored();
 assert.equal(await prepareReflection(f.generator,f.renderer,f.scene,{isCurrent:()=>false}),null);
});

test('reflection capture preserves six authored views and yields with renderer and scene restored',async()=>{
 const f=fixture();let yields=0;
 assert.equal(await prepareReflection(f.generator,f.renderer,f.scene,{position:new Vector3(3,4,5),yieldTask:async()=>{yields++;f.restored();}}),f.target);
 assert.equal(yields,8);assert.equal(f.captures.length,6);assert.equal(f.blurs.length,2);
 assert.deepEqual(f.captures.map(row=>row.viewport),[[0,0,128,128],[128,0,128,128],[256,0,128,128],[0,128,128,128],[128,128,128,128],[256,128,128,128]]);
 for(const row of f.captures)assert.deepEqual(row.position,[3,4,5]);
 const expected=[[1,0,0],[0,-1,0],[0,0,1],[-1,0,0],[0,1,0],[0,0,-1]];
 f.captures.forEach((row,i)=>row.direction.forEach((v,a)=>assert.ok(Math.abs(v-expected[i][a])<1e-6)));
 assert.equal(f.target.scissorTest,false);assert.deepEqual(f.target.viewport.toArray(),[0,0,384,512]);assert.ok(!f.target.disposed);f.restored();
});

test('leaving during a reflection capture stops later faces and releases its partial target',async()=>{
 const f=fixture();let current=true;
 assert.equal(await prepareReflection(f.generator,f.renderer,f.scene,{isCurrent:()=>current,yieldTask:async()=>{f.restored();current=false;}}),null);
 assert.equal(f.captures.length,1);assert.equal(f.blurs.length,0);assert.equal(f.target.disposed,true);f.restored();
});

test('failed reflection rendering restores the main render target and releases partial resources',async()=>{
 const f=fixture();f.renderer.render=()=>{throw new Error('device failed');};
 await assert.rejects(prepareReflection(f.generator,f.renderer,f.scene),/device failed/);
 assert.equal(f.target.disposed,true);f.restored();
});
