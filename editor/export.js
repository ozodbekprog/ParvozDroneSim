import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { World } from '../src/world.js';
import { installCatalog,GAMEPLAY_OBSTACLES } from '../shared/catalog.js';
import { defaultBuild,resolveBuild } from '../shared/physics.js';
import { createDrone,disposeObject } from '../public/content/recipes.js';
const catalog=await fetch('/editor-api/catalog').then(r=>r.json());installCatalog(catalog);
const items=['maps','drones','parts'].flatMap(kind=>catalog[kind].map(item=>({kind,item})));
const select=document.querySelector('#asset'),status=document.querySelector('#status');
select.innerHTML=items.map((entry,index)=>`<option value="${index}">${entry.kind} — ${entry.item.name}</option>`).join('');status.textContent='Ready. Exports are saved on this PC.';
async function exportAsset({kind,item}) {
  let root,world;
  if(kind==='maps') {
    world=new World(document.createElement('div'),true);await world.load(item.id,item.tracks[0].id);
    await new Promise(resolve=>setTimeout(resolve,300));
    root=new THREE.Group();root.name=item.id;
    for(const object of [...world.scene.children]) if(!object.isLight && object!==world.skyDome && object!==world.sunVisual && object!==world.clouds && !world.gates.some(g=>g.group===object))root.add(object);
    for(const [index,collider] of (GAMEPLAY_OBSTACLES[item.id]||[]).entries()) {
      let geometry;if(collider.type==='mesh'){geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(collider.vertices,3));geometry.computeVertexNormals();}else geometry=new THREE.BoxGeometry(...collider.size);
      const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#7c8b93'}));mesh.name=`COLLIDER_${index}`;mesh.userData.collider=true;if(collider.position)mesh.position.fromArray(collider.position);if(collider.rotation)mesh.rotation.fromArray(collider.rotation);root.add(mesh);
    }
    for(const track of item.tracks)for(const [order,gate]of track.gates.entries()) {const marker=new THREE.Group();marker.name=`GATE_${String(order+1).padStart(3,'0')}`;marker.position.fromArray(gate.position);marker.rotation.y=gate.yaw;marker.userData={...gate,flightGate:true,order,track:track.id};root.add(marker);}
    const marker=new THREE.Group();marker.name='SPAWN';marker.position.fromArray(item.tracks[0].spawn.position);marker.rotation.y=item.tracks[0].spawn.yaw;marker.userData.flightSpawn=true;root.add(marker);
  }else {
    const build=defaultBuild();if(kind==='drones')build.drone=item.id;else build[item.category]=item.id;
    const drone=createDrone(resolveBuild(build));await drone.assetsReady;root=drone;
    if(kind==='parts') {root=new THREE.Group();const selected=drone.children.filter(object=>object.userData.category===item.category&&object.visible!==false);for(const object of ['motors','propellers'].includes(item.category)?selected.slice(0,1):selected){if(['motors','propellers'].includes(item.category)){object.position.x=0;object.position.z=0;delete object.userData.motorIndex;}root.add(object);}}
  }
  const buffer=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:false,trs:true});
  const response=await fetch(`/editor-api/export-model?kind=${kind}&id=${item.id}`,{method:'POST',headers:{'Content-Type':'model/gltf-binary'},body:buffer});const result=await response.json();if(!response.ok)throw new Error(result.error);
  if(world) {
    root.traverse(object=>{if(object.userData.collider)object.visible=false;});world.scene.add(root);
    const gate=item.tracks[0].gates[0];world.camera.position.set(gate.position[0]-20,13,gate.position[2]-24);world.camera.lookAt(...gate.position);world.renderer.setPixelRatio(1);world.renderer.setSize(640,360);world.camera.aspect=16/9;world.camera.updateProjectionMatrix();world.renderer.render(world.scene,world.camera);
    const blob=await new Promise(resolve=>world.renderer.domElement.toBlob(resolve,'image/jpeg',.8));await fetch('/editor-api/export-thumbnail?id='+item.id,{method:'POST',body:blob});world.renderer.dispose();
  }
  disposeObject(root);return result.folder;
}
async function run(list) {
  document.querySelectorAll('button').forEach(button=>button.disabled=true);
  try {for(const [index,entry]of list.entries()){status.textContent=`Exporting ${entry.item.name} (${index+1}/${list.length})…`;status.textContent=await exportAsset(entry);}status.textContent='Done. See C:/DroneLiftoffUz/export/editable/';}
  catch(error){status.textContent='Export failed: '+error.message;}
  finally {document.querySelectorAll('button').forEach(button=>button.disabled=false);}
}
document.querySelector('#one').onclick=()=>run([items[Number(select.value)]]);
document.querySelector('#all').onclick=()=>run(items);
