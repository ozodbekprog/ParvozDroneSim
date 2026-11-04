import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshBasicMaterial} from 'three';

const previous=globalThis.document;
const gradient={addColorStop(){}};
const context=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient},{get:(obj,key)=>obj[key]||(()=>{})});
globalThis.document={createElement:()=>({getContext:()=>context})};
const {createDrone,updateDroneParts,disposeObject}=await import('../public/content/recipes.js');
if(previous===undefined)delete globalThis.document;else globalThis.document=previous;

function fixture(){
  const load=async(url,node)=>{
    if(node==='broken')throw new Error('detail download failed');
    const group=new Group();group.name=node||'aircraft';
    if(!node){
      const stock=new Mesh(new BoxGeometry(.1,.05,.1),new MeshBasicMaterial());stock.name='stock-battery';group.add(stock);
      const socket=new Group();socket.name='battery-socket';group.add(socket);
    }
    return group;
  };
  const build={class:'five',model:'base.glb',modelTransform:{position:[0,-.055,0]},batteryId:'stock',mounts:{battery:['battery-socket']},partBindings:{battery:['stock-battery']},visualParts:[],
    visualDetails:{model:'details.glb',frameNode:'electrical-frame',batteryNodes:{stock:'wire-stock',large:'wire-large'}},
    accessories:{actionCamera:{model:'details.glb',modelNode:'action-camera',name:'Action camera'}},actionCamera:false};
  return {load,build};
}

test('wiring follows selected battery and optional camera swaps atomically while preserving body transform',async()=>{
  const {load,build}=fixture(),drone=createDrone(build,{load});await drone.assetsReady;
  const details=()=>drone.userData.visualDetails;
  assert.equal(details().size,2);
  assert.equal(details().get('electrical-battery').root.children[0].name,'wire-stock');
  assert.equal(details().get('electrical-frame').root.children[0].position.y,-.055);
  const frame=details().get('electrical-frame').root;
  const changed={...build,batteryId:'large',actionCamera:true};
  await updateDroneParts(drone,changed,{load});
  assert.equal(details().get('electrical-frame').root,frame);
  assert.equal(details().get('electrical-battery').root.children[0].name,'wire-large');
  assert.ok(details().has('action-camera'));
  const current=details().get('electrical-battery').root;
  await assert.rejects(updateDroneParts(drone,{...changed,visualDetails:{...build.visualDetails,batteryNodes:{large:'broken'}}},{load}),/download failed/);
  assert.equal(details().get('electrical-battery').root,current);
  await updateDroneParts(drone,build,{load});assert.equal(details().has('action-camera'),false);
  assert.equal(details().get('electrical-battery').root.children[0].name,'wire-stock');
  disposeObject(drone);
});

test('returning a changed category to stock restores the original visible component',async()=>{
  const {load,build}=fixture(),drone=createDrone(build,{load});await drone.assetsReady;
  const model=drone.userData.droneModel,stock=model.getObjectByName('stock-battery');
  await updateDroneParts(drone,{...build,visualParts:[{category:'battery',model:'replacement.glb',modelNode:'replacement'}]},{load});
  assert.equal(stock.visible,false);
  await updateDroneParts(drone,build,{load});
  assert.equal(stock.visible,true);assert.equal(model.getObjectByName('replacement'),undefined);
  disposeObject(drone);
});

test('a cancelled base model cannot start late accessory downloads',async()=>{
  const {build,load}=fixture();let release;
  const urls=[];
  const deferred=(url,node)=>{urls.push(url);return url==='base.glb'?new Promise(resolve=>release=resolve):load(url,node);};
  const drone=createDrone(build,{load:deferred});
  disposeObject(drone);release(new Group());await drone.assetsReady;
  assert.deepEqual(urls,['base.glb']);assert.equal(drone.userData.visualDetails,undefined);
});
