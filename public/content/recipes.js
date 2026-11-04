import * as THREE from 'three';
import { applyMaterials, applyDroneColors } from '../../src/model-materials.js';
import { ROTOR_LAYOUT } from '../../shared/rotors.js';
import { gateFrameBoxes } from '../../shared/gates.js';
import { loadModel,sharedResources } from '../../src/asset-loader.js';
import {materialTextures} from '../../src/material-resources.js';
import { loadVisualLOD, findPartMounts } from '../../src/visual-lod.js';
import { releaseResources } from '../../src/resource-cleanup.js';
import {applyDroneConfiguration,clearDroneConfiguration,applyNativeSlotTransforms} from '../../src/drone-configuration.js';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function addVisualModel(parent, url, overrides = [], transform = {}, onReady, load = loadModel) {
  const definition = typeof url === 'string' ? { model: url } : url;
  parent.userData.assetController ||= new AbortController();
  const task=loadVisualLOD(definition, (url,node)=>load(url,node || definition.modelNode,{signal:parent.userData.assetController.signal}), disposeObject).then(async model => {
    if(parent.userData.disposed){disposeObject(model);return model;}
    try { await applyMaterials(model,overrides); } catch(error) { disposeObject(model); throw error; }
    if(parent.userData.disposed){disposeObject(model);return model;}
    model.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
    model.position.fromArray(transform.position || [0, 0, 0]);
    model.rotation.set(...(transform.rotation || [0, 0, 0]));
    model.scale.setScalar(transform.scale || 1);
    parent.add(model);
    onReady?.(model);
    return model;
  });
  task.catch(error=>{if(error.name!=='AbortError')console.warn(error.message);});return task;
}

function preparePartModels(group, build, load) {
  const installations=[];
  for (const part of build.visualParts || []) {
    const defaults=[],roots=[],jobs=[];
    const prior=group.userData.droneParts?.get(part.category);
    if(prior)defaults.push(...prior.defaults);
    else group.traverse(object=>{if(object.userData.category===part.category || build.partBindings?.[part.category]?.includes(object.name))defaults.push(object);});
    const installation={category:part.category,key:JSON.stringify(part),roots,defaults,part};installations.push(installation);
    if(!part.model){installation.ready=Promise.resolve();continue;}
    const mounts = findPartMounts(group, build, part.category);
    const anchors = mounts || (['motors', 'propellers'].includes(part.category) ? ROTOR_LAYOUT.map(r=>[r.x*0.22,0,r.z*0.22]) : [[0, 0, 0]]);
    for (const [index, anchor] of anchors.entries()) {
      const parent = new THREE.Group();
      parent.userData.category=part.category;
      if (!mounts) parent.position.fromArray(anchor);
      if (part.category==='propellers') { parent.name='prop'; parent.userData.motorIndex=mounts ? anchor.index : index; }
      const mount=mounts ? anchor.object : group;
      let root=parent;
      if(part.mountMatrix){root=new THREE.Group();root.applyMatrix4(new THREE.Matrix4().fromArray(part.mountMatrix));root.add(parent);}
      root.visible=false;mount.add(root);roots.push(root);
      const node=part.modelNodeByRotor?.[mounts?anchor.index:index];
      const definition=node?{...part,modelNode:node,modelLods:part.modelLods?.map(level=>({...level,modelNode:node}))}:part;
      jobs.push(addVisualModel(parent, definition, part.materials, { position: part.position, rotation: part.rotation, scale: part.scale }, model => applyDroneColors(model, build), load));
    }
    installation.ready=Promise.all(jobs);
  }
  return installations;
}
function discardParts(installations){for(const item of installations)for(const root of item.roots){root.removeFromParent();disposeObject(root);}}
function commitParts(group,installations){
  group.userData.droneParts ||= new Map();
  for(const item of installations){
    const prior=group.userData.droneParts.get(item.category);
    for(const root of prior?.roots||[]){root.removeFromParent();disposeObject(root);}
    for(const object of item.defaults)if(item.part.model)object.visible=false;else applyMaterials(object,item.part.materials);
    for(const root of item.roots)root.visible=true;
    group.userData.droneParts.set(item.category,{key:item.key,roots:item.roots,defaults:item.defaults});
  }
}
function addPartModels(group, build, load = loadModel) {
  if(group.userData.disposed)return [];
  const installations=preparePartModels(group,build,load);
  return [Promise.all(installations.map(item=>item.ready)).then(()=>{
    if(group.userData.disposed)discardParts(installations);else commitParts(group,installations);
  },error=>{discardParts(installations);throw error;})];
}

function detailDefinitions(build){
  const details=build.visualDetails,accessory=build.actionCamera&&build.accessories?.actionCamera;
  const selected=(definition,node)=>({...definition,modelNode:node,modelLods:definition.modelLods?.map(level=>({...level,modelNode:node}))});
  return [details?.frameNode&&['electrical-frame',selected(details,details.frameNode)],
    details?.batteryNodes?.[build.batteryId]&&['electrical-battery',selected(details,details.batteryNodes[build.batteryId])],
    accessory&&['action-camera',accessory]].filter(Boolean);
}
function prepareDetails(drone,build,load){
  const installations=[];
  for(const [category,definition] of detailDefinitions(build)){
    const key=JSON.stringify(definition);
    if(drone.userData.visualDetails?.get(category)?.key===key)continue;
    const root=new THREE.Group();root.visible=false;root.name=category;drone.add(root);
    if(definition.mountMatrix)root.applyMatrix4(new THREE.Matrix4().fromArray(definition.mountMatrix));
    installations.push({category,key,root,ready:addVisualModel(root,definition,definition.materials,build.modelTransform||{},undefined,load)});
  }
  return installations;
}
function discardDetails(items){for(const item of items){item.root.removeFromParent();disposeObject(item.root);}}
function commitDetails(drone,build,items){
  drone.userData.visualDetails ||= new Map();
  const wanted=new Set(detailDefinitions(build).map(([category])=>category));
  for(const [category,prior] of drone.userData.visualDetails)if(!wanted.has(category)||items.some(item=>item.category===category)){
    prior.root.removeFromParent();disposeObject(prior.root);drone.userData.visualDetails.delete(category);
  }
  for(const item of items){item.root.visible=true;drone.userData.visualDetails.set(item.category,{key:item.key,root:item.root});}
}

/** Replace only changed hardware, keeping the frame and other parts alive. */
export async function updateDroneParts(drone,build,{load=loadModel,isCurrent=()=>true}={}){
  const model=drone.userData.droneModel;
  if(!model||drone.userData.disposed)return false;
  const changed=(build.visualParts||[]).filter(part=>model.userData.droneParts?.get(part.category)?.key!==JSON.stringify(part));
  const installations=preparePartModels(model,{...build,visualParts:changed},load);
  const details=prepareDetails(drone,build,load);
  try{await Promise.all([...installations,...details].map(item=>item.ready));}
  catch(error){discardParts(installations);discardDetails(details);throw error;}
  if(!isCurrent()||drone.userData.disposed){discardParts(installations);discardDetails(details);return false;}
  clearDroneConfiguration(model);
  const wanted=new Set((build.visualParts||[]).map(part=>part.category));
  for(const [category,prior] of model.userData.droneParts||[])if(!wanted.has(category)){
    for(const root of prior.roots){root.removeFromParent();disposeObject(root);}
    for(const object of prior.defaults)object.visible=true;
    model.userData.droneParts.delete(category);
  }
  commitParts(model,installations);commitDetails(drone,build,details);applyDroneColors(model,build);applyDroneConfiguration(model,build);drone.userData.rotorVersion=(drone.userData.rotorVersion||0)+1;return true;
}
const material = (color, roughness = 0.82, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
function disposeObject(root) {
  const resources = new Set();
  root.traverse(object => {
    object.userData.disposed=true;
    object.userData.assetController?.abort();
    // Three.js shares the Sprite quad across every sprite (including the next
    // map's sun). Disposing it here invalidates GPU buffers still in use.
    if (object.geometry && !object.isSprite && !object.isBatchedMesh && !sharedResources.has(object.geometry)) resources.add(object.geometry);
    if (object.shadow) resources.add(object.shadow);
    if (object.isInstancedMesh||object.isBatchedMesh) resources.add(object);
    for (const mat of (Array.isArray(object.material) ? object.material : [object.material])) if (mat) {
      resources.add(mat);
      for (const value of materialTextures(mat)) if (value !== sunTexture && !sharedResources.has(value)) resources.add(value);
    }
  });
  const releases=[];root.traverse(object=>{if(object.releaseAsset)releases.push(()=>object.releaseAsset());});
  const errors=releaseResources(resources,releases);
  if(errors.length){root.userData.disposeErrors=errors.map(error=>error.message);console.warn('Scene cleanup:',...root.userData.disposeErrors);}
}
function sunGlowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.1, 'rgba(255,252,236,.9)');
  gradient.addColorStop(0.35, 'rgba(255,230,180,.25)');
  gradient.addColorStop(1, 'rgba(255,220,150,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  context.save(); context.translate(64, 64);
  for (let index = 0; index < 14; index++) {
    context.save(); context.rotate(index * Math.PI * 2 / 14);
    const ray = context.createLinearGradient(0, 8, 0, 63);
    ray.addColorStop(0, 'rgba(255,244,218,.18)'); ray.addColorStop(1, 'rgba(255,244,218,0)');
    context.fillStyle = ray; context.beginPath(); context.moveTo(-2, 8); context.lineTo(3, 8); context.lineTo(7, 63); context.lineTo(-7, 63); context.fill();
    context.restore();
  }
  context.restore();
  return new THREE.CanvasTexture(canvas);
}
const sunTexture = sunGlowTexture();
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

function random(seed) {
  let value = seed >>> 0;
  return () => { value = (1664525 * value + 1013904223) >>> 0; return value / 4294967296; };
}

function canvasTexture(base, variation = 24, scale = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = scale;
  const context = canvas.getContext('2d');
  context.fillStyle = base;
  context.fillRect(0, 0, scale, scale);
  const rng = random(base.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  for (let i = 0; i < 18000; i++) {
    const light = rng() > 0.5;
    const alpha = rng() * 0.08;
    context.fillStyle = `rgba(${light ? '255,255,255' : '0,0,0'},${alpha})`;
    const size = rng() * variation;
    context.fillRect(rng() * scale, rng() * scale, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(26, 26);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function skyDome(map) {
  const radius = Math.min((map.viewDistance || 1500)*.85, 1400);
  const geometry = new THREE.SphereGeometry(radius, 40, 20);
  const positions = geometry.getAttribute('position');
  const colors = [];
  const horizon = new THREE.Color(map.fog);
  const environment=map.environment || map.theme;
  const zenith = new THREE.Color(['neon','nightgrid'].includes(environment) ? '#07101f' : ['canyon','sunscar'].includes(environment) ? '#457ba5' : ['forest','pinecrest'].includes(environment) ? '#588da6' : '#597e99');
  for (let index = 0; index < positions.count; index++) {
    const height = positions.getY(index) / radius;
    const factor = THREE.MathUtils.smoothstep(height, -0.08, 0.7);
    const color = horizon.clone().lerp(zenith, factor);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false }));
  dome.renderOrder = -1;
  return dome;
}

function pineCrownGeometry(radius, height, seed) {
  const geometry = new THREE.CylinderGeometry(0.06, radius, height, 14, 9);
  const positions = geometry.getAttribute('position');
  const rng = random(seed);
  const offsets = Array.from({ length: 15 }, () => 0.82 + rng() * 0.32);
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index);
    const angle = Math.atan2(z, x);
    const radial = Math.round(((angle + Math.PI) / (2 * Math.PI)) * 14) % 14;
    const level = (y + height / 2) / height;
    const bough = 0.88 + 0.12 * Math.cos(level * Math.PI * 7);
    const scale = offsets[radial] * bough;
    positions.setXYZ(index, x * scale, y, z * scale);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function sandstoneGeometry(top, bottom, height, seed) {
  const geometry = new THREE.CylinderGeometry(top, bottom, height, 12, 8);
  const positions = geometry.getAttribute('position');
  const colors = [];
  const rng = random(seed);
  const radial = Array.from({ length: 13 }, () => 0.78 + rng() * 0.36);
  const base = new THREE.Color('#b98768');
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index);
    const angle = Math.atan2(z, x);
    const segment = Math.round(((angle + Math.PI) / (2 * Math.PI)) * 12) % 12;
    const band = 0.88 + Math.sin((y + height / 2) * 1.7 + seed) * 0.085;
    const scale = radial[segment] * band;
    positions.setXYZ(index, x * scale, y, z * scale);
    const shade = 0.72 + 0.16 * Math.sin(y * 2.4 + seed) + 0.09 * rng();
    const color = base.clone().multiplyScalar(shade);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createDrone(build, { load = loadModel } = {}) {
  const group = new THREE.Group();
  const size = build.class === 'three' ? 0.72 : build.class === 'seven' ? 1.28 : 1;
  if (build.model) {
    const placeholder = box(0.3, 0.05, 0.3, material(build.color || '#ef855e'));
    group.add(placeholder);
    group.assetsReady=addVisualModel(group, build, build.materials, build.modelTransform || {}, model => {
      group.remove(placeholder);placeholder.geometry.dispose();placeholder.material.dispose();
      model.traverse(node => { const index = (build.motorBindings || []).indexOf(node.name); if (index >= 0) node.userData.motorIndex = index; }); group.userData.rotorVersion=(group.userData.rotorVersion||0)+1;
      applyDroneColors(model, build);
    },load).then(async model=>{
      if(group.userData.disposed)return;
      applyNativeSlotTransforms(model,build);
      group.userData.droneModel=model;
      const details=prepareDetails(group,build,load);
      try{await Promise.all([...addPartModels(model,build,load),...details.map(item=>item.ready)]);}
      catch(error){discardDetails(details);throw error;}
      if(group.userData.disposed)discardDetails(details);else {commitDetails(group,build,details);applyDroneConfiguration(model,build);group.userData.rotorVersion=(group.userData.rotorVersion||0)+1;}
    });
    group.assetsReady.catch(()=>{});
    return group;
  }
  const main = material(build.color || '#fc623d', 0.34, 0.3);
  const carbon = material('#171b20', 0.62, 0.18);
  const dark = material('#0d1014', 0.43, 0.25);
  const glass = material('#25394b', 0.16, 0.25);
  const led = new THREE.MeshStandardMaterial({ color: build.led || '#58d5fb', emissive: build.led || '#58d5fb', emissiveIntensity: 2.5, roughness: 0.25 });
  group.add(box(0.26, 0.08, 0.35, main, 0, 0, 0));
  if (build.frameId === 'guarded') group.add(box(0.54, 0.025, 0.54, carbon, 0, -0.035, 0));
  if (build.frameId === 'light') group.add(box(0.18, 0.025, 0.25, carbon, 0, -0.045, 0));
  group.add(box(0.2, 0.055, 0.23, glass, 0, 0.068, 0.035));
  group.add(box(0.14, 0.07, 0.06, dark, 0, 0.03, 0.2));
  group.add(box(0.08, 0.025, 0.025, led, 0, 0.025, 0.235));
  for (const signX of [-1, 1]) for (const signZ of [-1, 1]) {
    const x = signX * 0.22, z = signZ * 0.22;
    const arm = box(0.045, 0.035, 0.35, carbon, signX * 0.13, -0.005, signZ * 0.13);
    arm.rotation.y = signX === signZ ? Math.PI / 4 : -Math.PI / 4;
    arm.userData.category='frame'; group.add(arm);
    const motorRadius = build.motorsId === 'race' ? 0.052 : build.motorsId === 'smooth' ? 0.049 : 0.045;
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(motorRadius, motorRadius, 0.045, 12), dark);
    motor.position.set(x, 0.03, z);
    motor.castShadow = true;
    motor.userData.category='motors'; group.add(motor);
    const prop = new THREE.Group();
    prop.position.set(x, 0.064, z);
    prop.name = 'prop'; prop.userData.category='propellers';
    prop.userData.motorIndex = ROTOR_LAYOUT.findIndex(r=>r.x===signX && r.z===signZ);
    const bladeMaterial = new THREE.MeshStandardMaterial({ color: build.propellersId === 'grip' ? '#d9af87' : '#abb5bc', transparent: true, opacity: 0.66, side: THREE.DoubleSide, roughness: 0.35, metalness: 0.08 });
    const bladeCount = build.propellersId === 'efficient' ? 2 : 3;
    for (let blade = 0; blade < bladeCount; blade++) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(build.propellersId === 'grip' ? 0.19 : 0.17, 0.004, 0.028), bladeMaterial);
      wing.position.x = 0.08;
      const pivot = new THREE.Group(); pivot.rotation.y = blade * Math.PI * 2 / bladeCount; pivot.add(wing); prop.add(pivot);
    }
    prop.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 12), dark));
    group.add(prop);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.019, 8, 8), led);
    light.position.set(x, -0.02, z);
    group.add(light);
  }
  group.add(box(0.16, 0.075, 0.13, carbon, 0, -0.09, -0.02));
  group.add(box(0.11, 0.014, 0.23, dark, 0, 0.112, -0.025));
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.025, 16), new THREE.MeshStandardMaterial({ color: '#161d27', metalness: 0.58, roughness: 0.18 }));
  lens.rotation.x = Math.PI / 2; lens.position.set(0, 0.035, 0.239); group.add(lens);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.21, 8), dark);
  antenna.position.set(0.06, 0.16, -0.14); antenna.rotation.x = 0.3; group.add(antenna);
  if (build.batteryId === 'endurance') group.add(box(0.16, 0.065, 0.2, dark, 0, 0.105, -0.04));
  if (build.cameraId === 'race') group.add(box(0.09, 0.055, 0.07, glass, 0, 0.06, 0.2));
  group.children.forEach((object,index)=>{object.name ||= 'drone-'+index; if(!object.userData.category)object.userData.category = index===2 || index===3 ? 'camera' : index===0 ? 'frame' : 'battery';});
  group.assetsReady=Promise.all([applyMaterials(group,build.materials), ...addPartModels(group, build)]); group.assetsReady.catch(()=>{});
  group.scale.setScalar(size);
  return group;
}

function createGate(gate, color) {
  const group = new THREE.Group();
  if (gate.frameSource === 'track' || gate.frameSource === 'map') {
    group.name = 'Authored checkpoint trigger';
    return {group, glow:null};
  }
  const frame = material('#262d34', 0.5, 0.5);
  const glow = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5, roughness: 0.25, metalness: 0.25 });
  if (gate.model) {
    frame.dispose();
    group.assetsReady=addVisualModel(group, gate, gate.materials || [], gate.modelTransform || {}, model => {
      let bound=0;
      model.traverse(object=>{
        if(!object.isMesh)return;
        const materials=Array.isArray(object.material)?object.material:[object.material];
        const replacements=materials.map(mat=>{
          if(mat.name!==gate.signalMaterial)return mat;
          if(!bound){
            const color=glow.color.clone(),emissive=glow.emissive.clone(),strength=glow.emissiveIntensity;
            glow.copy(mat);glow.color.copy(color);glow.emissive.copy(emissive);glow.emissiveIntensity=strength;
          }
          bound++;mat.dispose();return glow;
        });
        object.material=Array.isArray(object.material)?replacements:replacements[0];
      });
      if(!bound)throw new Error(`Gate signal material missing: ${gate.signalMaterial}`);
    });
  } else {
    for (const piece of gateFrameBoxes(gate)) {
      const mesh = box(...piece.size, piece.kind === 'frame' ? glow : frame, ...piece.position);
      mesh.userData.gatePart = piece.kind;
      group.add(mesh);
    }
  }
  group.userData.gateClass = gate.gateClass || 'open';
  group.position.set(...gate.position);
  group.rotation.y = gate.yaw;
  return { group, glow };
}

function addBuilding(scene, x, z, width, depth, height, mats, rng, night = false) {
  const building = box(width, height, depth, mats[Math.floor(rng() * mats.length)], x, height / 2, z);
  scene.add(building);
  const roof = box(width + 0.5, 0.4, depth + 0.5, material('#353b40', 0.79, 0.25), x, height + 0.2, z);
  scene.add(roof);
  const windows = new THREE.MeshStandardMaterial({ color: night ? '#819dd2' : '#485b64', emissive: night ? '#4763ba' : '#111e25', emissiveIntensity: night ? 1.5 : 0.12, roughness: 0.28, metalness: 0.12 });
  const placements = [];
  for (let level = 2.6; level < height - 1; level += 3.2) {
    for (let side = -1; side <= 1; side += 2) {
      for (let offset = -width / 2 + 1.4; offset < width / 2 - 0.5; offset += 2.5) {
        placements.push([x + offset, level, z + side * (depth / 2 + 0.04)]);
      }
    }
  }
  if (placements.length) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.15, 1.25, 0.06), windows, placements.length);
    const matrix = new THREE.Matrix4();
    placements.forEach((position, index) => mesh.setMatrixAt(index, matrix.makeTranslation(...position)));
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }
}

function addTree(scene, x, z, scale, rng) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.44 * scale, 4.3 * scale, 8), material('#4b3c2c'));
  trunk.position.set(x, 2.15 * scale, z); trunk.castShadow = true; scene.add(trunk);
  const leaf = material(new THREE.Color().setHSL(0.28 + rng() * 0.055, 0.27, 0.18 + rng() * 0.12));
  for (let i = 0; i < 3; i++) {
    const crown = new THREE.Mesh(new THREE.ConeGeometry((3.2 - i * 0.55) * scale, 6.3 * scale, 8), leaf);
    crown.position.set(x, (6.2 + i * 2.1) * scale, z); crown.castShadow = true; scene.add(crown);
  }
}

function nearRoute(x, z, track, radius = 12) {
  for (const gate of track.gates) if (Math.hypot(x - gate.position[0], z - gate.position[2]) < radius) return true;
  return false;
}

export function scenery(scene, map, track) {
  const rng = random(map.seed);
  const theme = map.theme;
  const concrete = [material('#737b7d'), material('#7c807c'), material('#666e71'), material('#92928b')];
  if (theme === 'hangar' || theme === 'orbital') {
    const beam = material(theme === 'orbital' ? '#4b647b' : '#596771', 0.55, 0.55);
    const wall = material(theme === 'orbital' ? '#536878' : '#9aa8a9', 0.73, 0.15);
    for (const x of [-82, 82]) scene.add(box(2, 26, 130, wall, x, 13, 0));
    for (const z of [-65, 65]) scene.add(box(165, 25, 2, wall, 0, 12.5, z));
    for (let x = -75; x <= 75; x += 15) {
      scene.add(box(0.7, 25, 0.8, beam, x, 12.5, -62));
      scene.add(box(0.7, 25, 0.8, beam, x, 12.5, 62));
      scene.add(box(0.6, 0.6, 130, beam, x, 24.5, 0));
    }
    for (let z = -54; z <= 54; z += 18) scene.add(box(164, 0.5, 0.7, beam, 0, 24.5, z));
    const ceiling = new THREE.MeshStandardMaterial({ color: theme === 'orbital' ? '#2c455e' : '#c1d0d0', transparent: true, opacity: theme === 'orbital' ? 0.75 : 0.32, metalness: 0.1, side: THREE.DoubleSide });
    scene.add(box(166, 0.3, 132, ceiling, 0, 25, 0));
    for (let i = 0; i < 24; i++) {
      const x = (rng() - 0.5) * 125, z = (rng() - 0.5) * 92;
      if (nearRoute(x, z, track, 10)) continue;
      scene.add(box(2 + rng() * 2, 1.5 + rng() * 1.5, 2 + rng() * 2, concrete[i % concrete.length], x, 1, z));
    }
    if (theme === 'orbital') {
      const blue = new THREE.MeshStandardMaterial({ color: '#84d7ff', emissive: '#2f99ff', emissiveIntensity: 1.6 });
      for (let z = -60; z <= 60; z += 12) for (const x of [-78, 78]) scene.add(box(0.4, 0.08, 5, blue, x, 0.12, z));
    }
  } else if (theme === 'ruins' || theme === 'neon') {
    const mats = theme === 'neon' ? [material('#283442', 0.5, 0.3), material('#334153', 0.46, 0.28), material('#1f2c3b', 0.55, 0.25)] : concrete;
    for (let ix = -5; ix <= 5; ix++) for (let iz = -5; iz <= 5; iz++) {
      if (rng() < 0.2) continue;
      const x = ix * 18 + (rng() - 0.5) * 3, z = iz * 18 + (rng() - 0.5) * 3;
      if (nearRoute(x, z, track, 15)) continue;
      addBuilding(scene, x, z, 9 + rng() * 5, 9 + rng() * 5, 10 + rng() * (theme === 'neon' ? 38 : 24), mats, rng, theme === 'neon');
    }
    const road = material(theme === 'neon' ? '#202936' : '#494d4d', theme === 'neon' ? 0.21 : 0.94);
    for (let i = -4; i <= 4; i++) {
      scene.add(box(8, 0.035, 190, road, i * 18 + 9, 0.025, 0));
      scene.add(box(190, 0.035, 8, road, 0, 0.025, i * 18 + 9));
    }
    if (theme === 'neon') {
      const colors = ['#1ac6fa', '#ff4dbd', '#e6b04c'];
      for (let i = 0; i < 34; i++) {
        const x = (rng() - 0.5) * 160, z = (rng() - 0.5) * 160;
        if (nearRoute(x, z, track, 4)) continue;
        const neon = new THREE.MeshStandardMaterial({ color: colors[i % 3], emissive: colors[i % 3], emissiveIntensity: 2.3 });
        scene.add(box(0.12, 2 + rng() * 6, 0.14, neon, x, 6, z));
      }
    }
  } else if (theme === 'forest') {
    const trees = [];
    for (let i = 0; i < 230; i++) {
      const x = (rng() - 0.5) * 200, z = (rng() - 0.5) * 200;
      if (nearRoute(x, z, track, 9)) continue;
      trees.push({ x, z, scale: 0.55 + rng() * 0.75, color: new THREE.Color().setHSL(0.28 + rng() * 0.055, 0.27, 0.18 + rng() * 0.12) });
    }
    const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.44, 4.3, 8), material('#4b3c2c'), trees.length);
    const crowns = [0, 1, 2].map(index => new THREE.InstancedMesh(pineCrownGeometry(3.2 - index * 0.55, 6.3, map.seed + index), material('#69805a'), trees.length));
    const matrix = new THREE.Matrix4();
    trees.forEach((tree, index) => {
      trunkMesh.setMatrixAt(index, matrix.compose(V(tree.x, 2.15 * tree.scale, tree.z), new THREE.Quaternion(), V(tree.scale, tree.scale, tree.scale)));
      crowns.forEach((mesh, level) => {
        mesh.setMatrixAt(index, matrix.compose(V(tree.x, (6.2 + level * 2.1) * tree.scale, tree.z), new THREE.Quaternion(), V(tree.scale, tree.scale, tree.scale)));
        mesh.setColorAt(index, tree.color);
      });
    });
    trunkMesh.castShadow = true; scene.add(trunkMesh);
    crowns.forEach(mesh => { mesh.castShadow = true; scene.add(mesh); });
    for (let i = 0; i < 65; i++) {
      const x = (rng() - 0.5) * 170, z = (rng() - 0.5) * 170;
      if (nearRoute(x, z, track, 7)) continue;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + rng() * 1.7, 0), material('#70766d'));
      rock.position.set(x, 0.4, z); rock.scale.y = 0.55; rock.castShadow = true; scene.add(rock);
    }
  } else if (theme === 'canyon') {
    const stone = [material('#a57459'), material('#b78362'), material('#986b58'), material('#c99b75')];
    for (let i = 0; i < 95; i++) {
      const x = (rng() - 0.5) * 230, z = (rng() - 0.5) * 230;
      if (nearRoute(x, z, track, 13)) continue;
      const height = 5 + rng() * 22;
      const pillar = new THREE.Mesh(sandstoneGeometry(2 + rng() * 5, 4 + rng() * 6, height, map.seed + i), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
      pillar.position.set(x, height / 2, z); pillar.castShadow = true; pillar.receiveShadow = true; scene.add(pillar);
      if (rng() > 0.6) scene.add(box(7 + rng() * 8, 2, 7 + rng() * 8, stone[i % stone.length], x, height + 0.1, z));
    }
    for (let i = 0; i < 14; i++) {
      const height = 22 + rng() * 25;
      scene.add(box(12 + rng() * 14, height, 14 + rng() * 14, stone[i % stone.length], (rng() - 0.5) * 245, height / 2, (rng() - 0.5) * 245));
    }
  } else if (theme === 'industrial') {
    const steel = material('#53616a', 0.43, 0.7), rust = material('#825b49', 0.84, 0.3);
    for (let i = 0; i < 36; i++) {
      const x = (rng() - 0.5) * 160, z = (rng() - 0.5) * 160;
      if (nearRoute(x, z, track, 11)) continue;
      const height = 8 + rng() * 15;
      if (rng() > 0.5) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(3 + rng() * 2, 3 + rng() * 2, height, 16), i % 3 ? steel : rust);
        tank.position.set(x, height / 2, z); tank.castShadow = true; scene.add(tank);
      } else addBuilding(scene, x, z, 8 + rng() * 7, 8 + rng() * 7, height, [steel, rust, ...concrete], rng);
    }
    for (let i = 0; i < 13; i++) {
      const z = -70 + i * 12;
      scene.add(box(150, 0.8, 0.8, steel, 0, 13 + (i % 3) * 2, z));
    }
  }
}


export { V, addVisualModel, material, box, sunTexture, disposeObject, skyDome, canvasTexture, createGate };
