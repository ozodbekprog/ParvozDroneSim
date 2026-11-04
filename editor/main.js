import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createDrone, scenery, box, material } from '../public/content/recipes.js';
import { applyMaterials } from '../src/model-materials.js';
import { installCatalog } from '../shared/catalog.js';
import { defaultBuild, resolveBuild } from '../shared/physics.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { MAP_LIST } from '../shared/content.js';
import './style.css';
import './sunset.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
document.querySelector('.editor-actions').insertAdjacentHTML('afterbegin','<a href="/editor/export.html">EXPORT EDITABLE ASSETS</a>');

const $ = selector => document.querySelector(selector);
const blank = () => ({ version: 2, maps: [], drones: [], parts: [], challenges: [], tutorials: [] });
let draft = blank(), kind = 'maps', index = -1, trackIndex = 0, selected = null, materialName = '', meshNames = [];
let dirty = false, sceneRevision = 0;
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const slug = value => `custom-${String(value || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`;
const current = () => draft[kind][index];
const status = message => { $('#status').textContent = message; };
const changed = () => { dirty = true; status('Unsaved draft changes.'); };

const sceneHost = $('#scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
sceneHost.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#465f6d');
scene.add(new THREE.HemisphereLight('#e8f7ff', '#405159', 2));
const sun = new THREE.DirectionalLight('#fff3d8', 3); sun.position.set(40, 70, 30); scene.add(sun);
const grid = new THREE.GridHelper(200, 100, '#7c9aaa', '#58717e'); scene.add(grid);
const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 1000); camera.position.set(14, 12, 18);
const orbit = new OrbitControls(camera, renderer.domElement); orbit.target.set(0, 2, 0); orbit.update();
const transform = new TransformControls(camera, renderer.domElement);
scene.add(transform.getHelper());
transform.addEventListener('dragging-changed', event => { orbit.enabled = !event.value; });
transform.addEventListener('objectChange', () => {
  if (!selected) return;
  const item = selected.data;
  if (selected.type === 'model') {
    const target = kind === 'parts' ? item : (item.modelTransform ||= { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 });
    target.position = selected.object.position.toArray();
    target.rotation = [selected.object.rotation.x, selected.object.rotation.y, selected.object.rotation.z];
    target.scale = selected.object.scale.x;
  } else if (selected.type === 'sphere') { item.position=selected.object.position.toArray(); item.radius=Math.max(0.005,selected.object.scale.x);
  } else if (selected.type === 'object') { item.position=selected.object.position.toArray(); item.rotation=[selected.object.rotation.x,selected.object.rotation.y,selected.object.rotation.z]; item.scale=selected.object.scale.x;
  } else if (selected.type === 'collider') {
    item.position = selected.object.position.toArray(); item.size = selected.object.scale.toArray();
  } else {
    item.position = selected.object.position.toArray();
    if (selected.type === 'gate' || selected.type === 'spawn') item.yaw = selected.object.rotation.y;
  }
  changed(); renderInspector();
});
const contentGroup = new THREE.Group(); scene.add(contentGroup);
const loader = new GLTFLoader();
loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/runtime/draco/'));
loader.setMeshoptDecoder(MeshoptDecoder);
loader.setKTX2Loader(new KTX2Loader().setTranscoderPath('/runtime/basis/').detectSupport(renderer));
const clickTargets = [];
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function resize() {
  const width = sceneHost.clientWidth, height = sceneHost.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(sceneHost);
function animate() { requestAnimationFrame(animate); renderer.render(scene, camera); }
animate();
window.addEventListener('keydown', event => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (event.code === 'KeyW') transform.setMode('translate');
  if (event.code === 'KeyE') transform.setMode('rotate');
  if (event.code === 'KeyR') transform.setMode('scale');
});

function mark(object, type, data) {
  object.userData.selection = { object, type, data };
  contentGroup.add(object); clickTargets.push(object);
}
function attach(entry) { selected = entry; transform.detach(); if (entry) transform.attach(entry.object); renderInspector(); }
renderer.domElement.addEventListener('pointerdown', event => {
  if (transform.dragging) return;
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(clickTargets, true)[0];
  if (hit) {
    let target = hit.object;
    while (target && !target.userData.selection) target = target.parent;
    if (target?.userData.selection) attach(target.userData.selection);
  }
});

function clearPreview() {
  transform.detach(); selected = null; clickTargets.length = 0; sceneRevision++;
  while (contentGroup.children.length) contentGroup.remove(contentGroup.children[0]);
}
function modelPreview(item) {
  if (!item.model) {
    const root = new THREE.Group();
    if (kind === 'maps') { scenery(root,item,item.tracks[trackIndex]); for(const collider of item.colliders || []) if(collider.size && collider.visible!==false) root.add(box(...collider.size,material('#657279'),...collider.position)); }
    else if (kind === 'drones') root.add(createDrone({...resolveBuild({...defaultBuild(),drone:item.id}),...item}));
    else if (kind === 'parts') root.add(createDrone(resolveBuild({...defaultBuild(),[item.category]:item.id})));
    else return;
    applyMaterials(root,item.materials); meshNames=[]; root.traverse(o=>{if(o.isMesh) meshNames.push(o.name);});
    mark(root,'model',item); renderInspector(); return;
  }
  const revision = sceneRevision;
  loader.load(item.model, gltf => {
    if (revision !== sceneRevision) return;
    const root = gltf.scene;
    root.position.fromArray(item.modelTransform?.position || item.position || [0, 0, 0]);
    root.rotation.set(...(item.modelTransform?.rotation || item.rotation || [0, 0, 0]));
    root.scale.setScalar(item.modelTransform?.scale || item.scale || 1);
    applyMaterials(root,item.materials);
    meshNames = [];
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      meshNames.push(mesh.name);

    });
    mark(root, 'model', item);
    if (!selected) attach(root.userData.selection);
    renderInspector();
  }, undefined, error => status(`Model failed to load: ${error.message}`));
}

function refreshPreview() {
  clearPreview(); meshNames = [];
  const item = current(); if (!item) return;
  if (['maps','drones','parts'].includes(kind)) modelPreview(item);
  if (['challenges','tutorials'].includes(kind)) {
    const map = draft.maps.find(map => map.id === item.map);
    const route = map?.tracks.find(track => track.id === item.track);
    if (map && route && !map.model) scenery(contentGroup, map, route);
    if (map?.model) loader.load(map.model,gltf=>{if(sceneRevision===revision)contentGroup.add(gltf.scene);});
    if (map) scene.background = new THREE.Color(map.sky);
  }
  const revision = sceneRevision;
  for(const object of item.objects || []) loader.load(object.model,gltf=>{
    if (revision !== sceneRevision) return;
    gltf.scene.position.fromArray(object.position || [0,0,0]); gltf.scene.rotation.set(...(object.rotation || [0,0,0])); gltf.scene.scale.setScalar(object.scale || 1); applyMaterials(gltf.scene,object.materials); mark(gltf.scene,'object',object);
  });
  if (kind === 'drones') for (const sphere of item.collision?.spheres || []) { const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:'#72efc0',wireframe:true})); mesh.position.fromArray(sphere.position); mesh.scale.setScalar(sphere.radius); mark(mesh,'sphere',sphere); }
  if (kind !== 'maps') return;
  scene.background = new THREE.Color(item.sky || '#465f6d');
  for (const collider of item.colliders || []) {
    if (collider.type === 'mesh') { const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(collider.vertices,3)); const wire=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#ed7e62',wireframe:true})); contentGroup.add(wire); continue; }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ed7e62', wireframe: true, depthTest: false }));
    mesh.position.fromArray(collider.position); mesh.scale.fromArray(collider.size); mark(mesh, 'collider', collider);
  }
  const track = item.tracks?.[trackIndex];
  if (!track) return;
  track.gates.forEach((gate, gateIndex) => {
    const marker = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 8, 20), new THREE.MeshBasicMaterial({ color: gateIndex === 0 ? '#ffe06a' : '#48d8ff', side: THREE.DoubleSide }));
    ring.scale.set(gate.width / 2, gate.height / 2, 1);
    marker.add(ring); marker.position.fromArray(gate.position); marker.rotation.y = gate.yaw; mark(marker, 'gate', gate);
  });
  const spawn = track.spawn || { position: [0, 1.4, -12], yaw: 0 };
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 8), new THREE.MeshBasicMaterial({ color: '#67ff82' }));
  marker.position.fromArray(spawn.position); marker.rotation.y = spawn.yaw; mark(marker, 'spawn', spawn);
}

const field = (label, key, value, type = 'text', step = 'any') => `<label>${label}<input data-field="${key}" type="${type}" ${type === 'number' ? `step="${step}"` : ''} value="${html(value)}" /></label>`;
const vectorFields = (label, key, values) => `<div class="section"><h3>${label}</h3><div class="field-row three">${['X','Y','Z'].map((axis, n) => `<label>${axis}<input data-vector="${key}" data-axis="${n}" type="number" step="0.1" value="${values?.[n] ?? 0}" /></label>`).join('')}</div></div>`;
const assetField = (label, key, value, types) => `<div class="asset-row"><label>${label}<input data-upload="${key}" type="file" accept="${types}" /></label><small>${html(value || 'No asset selected')}</small></div>`;

function renderTypes() {
  $('#types').innerHTML = ['maps', 'drones', 'parts', 'challenges', 'tutorials'].map(type => `<button data-type="${type}" class="${type === kind ? 'selected' : ''}">${type.toUpperCase()}</button>`).join('');
  $('#types').querySelectorAll('[data-type]').forEach(button => button.onclick = () => { kind = button.dataset.type; index = draft[kind].length ? 0 : -1; trackIndex = 0; renderAll(); });
}
function renderItems() {
  $('#items').innerHTML = draft[kind].map((item, n) => `<button data-index="${n}" class="${n === index ? 'selected' : ''}">${html(item.name || item.id || 'New item')}</button>`).join('');
  $('#items').querySelectorAll('[data-index]').forEach(button => button.onclick = () => { index = Number(button.dataset.index); trackIndex = 0; renderAll(); });
}

function renderInspector() {
  const item = current();
  if (!item) { $('#fields').innerHTML = '<p>Select or add an item.</p>'; return; }
  let markup = field('ID', 'id', item.id) + field('NAME', 'name', item.name);
  if (kind === 'maps') {
    const track = item.tracks[trackIndex];
    markup += field('REGION', 'region', item.region) + field('DESCRIPTION', 'description', item.description) + assetField('MAP GLB', 'model', item.model, '.glb,.fbx,.obj');
    markup += `<div class="field-row">${['sky','fog','ground','sun'].map(key => field(key.toUpperCase(), key, item[key], 'color')).join('')}</div>`;
    markup += vectorFields('SUN POSITION', 'sunPosition', item.sunPosition) + vectorFields('WIND', 'wind', item.wind);
    markup += field('GRAVITY', 'gravity', item.gravity, 'number', '0.01');
    markup += `<div class="section"><h3>COURSES</h3><select id="track-choice">${item.tracks.map((entry, n) => `<option value="${n}" ${n === trackIndex ? 'selected' : ''}>${html(entry.name)}</option>`).join('')}</select><button id="add-track">+ COURSE</button></div>`;
    if (track) {
      markup += field('COURSE ID', 'track.id', track.id) + field('COURSE NAME', 'track.name', track.name) + field('LAPS', 'track.laps', track.laps, 'number', '1');
      markup += vectorFields('START POSITION', 'spawn.position', track.spawn?.position) + field('START YAW (RADIANS)', 'spawn.yaw', track.spawn?.yaw ?? 0, 'number', '0.01');
      markup += `<div class="section"><h3>GATES · ORDERED</h3>${track.gates.map((gate, n) => `<div class="entry"><button data-gate="${n}">${n + 1}. ${gate.position.map(x => x.toFixed(1)).join(', ')}</button><button data-gate-up="${n}">↑</button><button data-gate-delete="${n}">×</button></div>`).join('')}<button id="add-gate">+ GATE</button></div>`;
      if (selected?.type === 'gate') markup += field('GATE WIDTH', 'selected.width', selected.data.width, 'number', '0.1') + field('GATE HEIGHT', 'selected.height', selected.data.height, 'number', '0.1') + field('GATE YAW', 'selected.yaw', selected.data.yaw, 'number', '0.01');
    }
    markup += `<div class="section"><h3>COLLISION BOXES</h3>${item.colliders.map((box, n) => `<div class="entry"><button data-collider="${n}">Box ${n + 1}</button><span>${box.type === 'mesh' ? (box.vertices.length/9)+' triangles' : box.size.map(x => x.toFixed(1)).join(' × ')}</span><button data-collider-delete="${n}">×</button></div>`).join('')}<button id="add-collider">+ BOX</button></div>`;
  } else if (kind === 'drones') {
    markup += assetField('DRONE GLB', 'model', item.model, '.glb,.fbx,.obj') + `<label>CLASS<select data-field="class">${['three','five','seven'].map(value => `<option ${value === item.class ? 'selected' : ''}>${value}</option>`).join('')}</select></label>`;
    for (const [key, label] of [['mass','MASS KG'],['arm','ARM M'],['thrustToWeight','THRUST / WEIGHT'],['motorTau','MOTOR RESPONSE S'],['angularDrag','ANGULAR DRAG'],['batterySeconds','BATTERY SECONDS']]) markup += field(label, key, item[key], 'number', '0.001');
    markup += vectorFields('DRAG', 'drag', item.drag) + field('COLOR', 'color', item.color, 'color');
  } else if (kind === 'parts') {
    markup += assetField('PART GLB', 'model', item.model, '.glb,.fbx,.obj') + `<label>CATEGORY<select data-field="category">${['frame','motors','propellers','battery','camera'].map(value => `<option ${value === item.category ? 'selected' : ''}>${value}</option>`).join('')}</select></label>`;
    for (const key of ['mass','thrust','response','drag','duration','durability','fov','scale']) markup += field(key.toUpperCase(), key, item[key] ?? (key === 'fov' ? 105 : 1), 'number', '0.01');
    markup += vectorFields('ATTACH POSITION', 'position', item.position) + vectorFields('ATTACH ROTATION', 'rotation', item.rotation);
  } else {
    const availableMaps = draft.maps;
    markup += `<label>MAP<select data-field="map">${availableMaps.map(map => `<option value="${html(map.id)}" ${item.map === map.id ? 'selected' : ''}>${html(map.name)}</option>`).join('')}</select></label>`;
    const map = availableMaps.find(map => map.id === item.map);
    markup += `<label>COURSE<select data-field="track">${(map?.tracks || []).map(track => `<option value="${html(track.id)}" ${item.track === track.id ? 'selected' : ''}>${html(track.name)}</option>`).join('')}</select></label>`;
    if (kind === 'tutorials') { markup += '<div class="section"><h3>LESSON STEPS</h3>'+item.steps.map((step,n)=>'<label>Step '+(n+1)+'<textarea data-step-text="'+n+'">'+html(step.text)+'</textarea></label><select data-step-objective="'+n+'">'+['altitude','speed','land','gate','manual'].map(o=>'<option '+(o===step.objective?'selected':'')+'>'+o+'</option>').join('')+'</select><label>Target<input type="number" data-step-target="'+n+'" value="'+step.target+'" /></label><label>Hold seconds<input type="number" data-step-duration="'+n+'" value="'+step.duration+'" /></label><button data-step-delete="'+n+'">Remove step</button>').join('')+'<button id="add-step">+ STEP</button></div>'; }
    else markup += field('TARGET SECONDS', 'target', item.target, 'number', '1') + field('REWARD', 'reward', item.reward, 'number', '1');
  }
  if (selected?.type === 'object') {
    markup += '<div class="section"><h3>SELECTED OBJECT</h3>' + assetField('REPLACE MODEL','selected.model',selected.data.model,'.glb,.fbx,.obj')
      + vectorFields('POSITION','selected.position',selected.data.position) + vectorFields('ROTATION','selected.rotation',selected.data.rotation)
      + field('SCALE','selected.scale',selected.data.scale || 1,'number','0.01')
      + '<button id="remove-object">REMOVE OBJECT</button></div>';
  }
  if (['maps','drones','parts'].includes(kind) || selected?.type === 'object') {
    markup += `<div class="section"><h3>MATERIALS</h3><label>MODEL MESH<select id="mesh-choice"><option value="">Select mesh</option>${meshNames.map(name => `<option value="${html(name)}" ${name === materialName ? 'selected' : ''}>${html(name)}</option>`).join('')}</select></label>`;
    if (materialName) {
      const target = selected?.type === 'object' ? selected.data : item;
      const override = target.materials?.find(entry => entry.mesh === materialName) || {};
      markup += field('BASE COLOR', 'material.baseColor', override.baseColor || '#ffffff', 'color') + field('ROUGHNESS','material.roughness',override.roughness ?? .8,'number','.05') + field('METALNESS','material.metalness',override.metalness ?? 0,'number','.05') + assetField('BASE TEXTURE', 'material.baseTexture', override.baseTexture, '.png,.jpg,.jpeg') + assetField('NORMAL TEXTURE', 'material.normalTexture', override.normalTexture, '.png,.jpg,.jpeg');
    }
    markup += '</div>';
  }
  if (['maps','challenges','tutorials'].includes(kind)) markup += '<div class="section"><h3>SCENE OBJECTS</h3>'+(item.objects || []).map((object,n)=>'<div class="entry"><button data-object="'+n+'">'+html(object.model.split('/').at(-1))+'</button><button data-object-delete="'+n+'">×</button></div>').join('')+'<input id="add-object" type="file" accept=".glb,.fbx,.obj"/><button id="generate-collision">GENERATE TRIANGLE COLLISION</button></div>';
  if (kind === 'drones') markup += '<div class="section"><h3>COMPOUND COLLISION</h3><button id="generate-spheres">FIT SPHERES TO MODEL</button><button id="add-sphere">+ SPHERE</button>'+ (item.collision?.spheres || []).map((sphere,n)=>'<div class="entry"><button data-sphere="'+n+'">Sphere '+(n+1)+'</button><button data-sphere-delete="'+n+'">×</button></div>').join('')+'</div>';
  markup += '<details><summary>Full item data (JSON)</summary><textarea id="item-json" rows="14">'+html(JSON.stringify(item,null,2))+'</textarea><button id="apply-json">APPLY ITEM DATA</button></details>';
  markup += '<div class="section"><button id="delete-item">DELETE ITEM</button></div>';
  $('#fields').innerHTML = markup;
  bindInspector();
}

function resolveField(key) {
  const item = current();
  if (key.startsWith('track.')) return [item.tracks[trackIndex], key.slice(6)];
  if (key.startsWith('spawn.')) { item.tracks[trackIndex].spawn ||= { position: [0, 1.4, -12], yaw: 0 }; return [item.tracks[trackIndex].spawn, key.slice(6)]; }
  if (key.startsWith('selected.')) return [selected.data, key.slice(9)];
  if (key.startsWith('material.')) {
    const target = selected?.type === 'object' ? selected.data : item;
    target.materials ||= [];
    let entry = target.materials.find(entry => entry.mesh === materialName);
    if (!entry) { entry = { mesh: materialName }; target.materials.push(entry); }
    return [entry, key.slice(9)];
  }
  return [item, key];
}

async function upload(file) {
  if (/\.(fbx|obj)$/i.test(file.name)) {
    const object = /\.fbx$/i.test(file.name) ? new FBXLoader().parse(await file.arrayBuffer(),'') : new OBJLoader().parse(await file.text());
    const bytes = await new GLTFExporter().parseAsync(object,{binary:true});
    file = new File([bytes],file.name.replace(/\.(fbx|obj)$/i,'.glb'),{type:'model/gltf-binary'});
  }
  const response = await fetch(`/editor-api/asset?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result.path;
}

function bindInspector() {
  $('#remove-object')?.addEventListener('click',()=>{current().objects.splice(current().objects.indexOf(selected.data),1);changed();refreshPreview();renderInspector();});
  $('#fields').querySelectorAll('[data-object]').forEach(el=>el.onclick=()=>{const data=current().objects[Number(el.dataset.object)];const node=clickTargets.find(o=>o.userData.selection?.data===data);if(node){meshNames=[];node.traverse(o=>{if(o.isMesh)meshNames.push(o.name);});attach(node.userData.selection);}});
  $('#fields').querySelectorAll('[data-object-delete]').forEach(el=>el.onclick=()=>{current().objects.splice(Number(el.dataset.objectDelete),1);changed();refreshPreview();renderInspector();});
  $('#apply-json')?.addEventListener('click',()=>{try { draft[kind][index]=JSON.parse($('#item-json').value); changed(); renderAll(); } catch(error) {status(error.message);} });
  for(const key of ['text','objective','target','duration']) $('#fields').querySelectorAll('[data-step-'+key+']').forEach(el=>el.onchange=()=>{current().steps[Number(el.getAttribute('data-step-'+key))][key]=['target','duration'].includes(key)?Number(el.value):el.value;changed();});
  $('#add-step')?.addEventListener('click',()=>{current().steps.push({text:'New instruction',objective:'altitude',target:2,duration:2});changed();renderInspector();});
  $('#fields').querySelectorAll('[data-step-delete]').forEach(el=>el.onclick=()=>{current().steps.splice(Number(el.dataset.stepDelete),1);changed();renderInspector();});
  $('#add-object')?.addEventListener('change',async event=>{try{const path=await upload(event.target.files[0]);(current().objects ||= []).push({model:path,position:orbit.target.toArray(),rotation:[0,0,0],scale:1,materials:[]});changed();refreshPreview();renderInspector();}catch(error){status(error.message);}});
  $('#generate-collision')?.addEventListener('click',()=>{try { const vertices=[];contentGroup.updateMatrixWorld(true);for(const root of clickTargets.filter(o=>['model','object'].includes(o.userData.selection.type))) root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,ix=o.geometry.index;const matrices=[];if(o.isInstancedMesh)for(let n=0;n<o.count;n++){const m=new THREE.Matrix4();o.getMatrixAt(n,m);matrices.push(new THREE.Matrix4().multiplyMatrices(o.matrixWorld,m));}else matrices.push(o.matrixWorld);for(const matrix of matrices)for(let i=0;i<(ix?.count || p.count);i++){if(vertices.length>=900000)throw new Error('Collision exceeds 100,000 triangles. Import a simpler collision mesh or use boxes.');const v=new THREE.Vector3().fromBufferAttribute(p,ix?ix.getX(i):i).applyMatrix4(matrix);vertices.push(...v.toArray());}});current().colliders=(current().colliders || []).filter(c=>c.generated!==true);current().colliders.push({type:'mesh',vertices,generated:true});changed();refreshPreview();renderInspector();}catch(error){status(error.message);}});
  $('#generate-spheres')?.addEventListener('click',()=>{const spheres=[];contentGroup.updateMatrixWorld(true);for(const root of clickTargets.filter(o=>o.userData.selection.type==='model')) root.traverse(o=>{if(!o.isMesh || spheres.length>=64)return;const b=new THREE.Box3().setFromObject(o),size=b.getSize(new THREE.Vector3());spheres.push({position:b.getCenter(new THREE.Vector3()).toArray(),radius:Math.min(2,Math.max(.005,Math.min(size.x,size.y,size.z)/2))});});current().collision={spheres};changed();refreshPreview();renderInspector();});
  $('#add-sphere')?.addEventListener('click',()=>{(current().collision ||= {spheres:[]}).spheres.push({position:[0,0,0],radius:.08});changed();refreshPreview();renderInspector();});
  $('#fields').querySelectorAll('[data-sphere]').forEach(el=>el.onclick=()=>{const data=current().collision.spheres[Number(el.dataset.sphere)];attach(clickTargets.find(o=>o.userData.selection.data===data)?.userData.selection);});
  $('#fields').querySelectorAll('[data-sphere-delete]').forEach(el=>el.onclick=()=>{current().collision.spheres.splice(Number(el.dataset.sphereDelete),1);changed();refreshPreview();renderInspector();});
  $('#fields').querySelectorAll('[data-field]').forEach(element => element.addEventListener('change', () => {
    const [object, key] = resolveField(element.dataset.field);
    object[key] = element.type === 'number' ? Number(element.value) : element.value;
    changed();
    if (['model','sky','color','class','baseColor','roughness','metalness'].includes(key)) refreshPreview();
    if (['name','id'].includes(key)) renderItems();
    if (key === 'map') { const map = draft.maps.find(map => map.id === object.map); object.track = map?.tracks[0]?.id || ''; renderInspector(); }
  }));
  $('#fields').querySelectorAll('[data-vector]').forEach(element => element.addEventListener('change', () => {
    const [object, key] = resolveField(element.dataset.vector);
    object[key] ||= [0, 0, 0]; object[key][Number(element.dataset.axis)] = Number(element.value);
    changed(); refreshPreview();
  }));
  $('#fields').querySelectorAll('[data-upload]').forEach(element => element.addEventListener('change', async () => {
    try {
      const file = element.files[0]; if (!file) return;
      const path = await upload(file);
      const [object, key] = resolveField(element.dataset.upload); object[key] = path;
      changed(); refreshPreview(); renderInspector(); status(`Imported ${file.name}. Save Draft to keep the reference.`);
    } catch (error) { status(error.message); }
  }));
  $('#track-choice')?.addEventListener('change', event => { trackIndex = Number(event.target.value); refreshPreview(); renderInspector(); });
  $('#add-track')?.addEventListener('click', () => { const item = current(); const n = item.tracks.length + 1; item.tracks.push({ id: slug(`${item.id}-course-${n}`), name: `Course ${n}`, laps: 1, spawn: { position: [0, 1.4, -12], yaw: 0 }, gates: [] }); trackIndex = n - 1; changed(); refreshPreview(); renderInspector(); });
  $('#add-gate')?.addEventListener('click', () => { const track = current().tracks[trackIndex]; const point = orbit.target; track.gates.push({ position: [point.x, Math.max(3, point.y), point.z], yaw: 0, width: 8, height: 6 }); changed(); refreshPreview(); renderInspector(); });
  $('#add-collider')?.addEventListener('click', () => { const point = orbit.target; current().colliders.push({ position: [point.x, Math.max(1, point.y), point.z], size: [4, 2, 4] }); changed(); refreshPreview(); renderInspector(); });
  $('#fields').querySelectorAll('[data-gate]').forEach(button => button.onclick = () => { const gate = current().tracks[trackIndex].gates[Number(button.dataset.gate)]; const marker = clickTargets.find(object => object.userData.selection?.data === gate); if (marker) attach(marker.userData.selection); });
  $('#fields').querySelectorAll('[data-gate-up]').forEach(button => button.onclick = () => { const gates = current().tracks[trackIndex].gates, n = Number(button.dataset.gateUp); if (n > 0) [gates[n - 1], gates[n]] = [gates[n], gates[n - 1]]; changed(); refreshPreview(); renderInspector(); });
  $('#fields').querySelectorAll('[data-gate-delete]').forEach(button => button.onclick = () => { current().tracks[trackIndex].gates.splice(Number(button.dataset.gateDelete), 1); changed(); refreshPreview(); renderInspector(); });
  $('#fields').querySelectorAll('[data-collider]').forEach(button => button.onclick = () => { const box = current().colliders[Number(button.dataset.collider)]; const marker = clickTargets.find(object => object.userData.selection?.data === box); if (marker) attach(marker.userData.selection); });
  $('#fields').querySelectorAll('[data-collider-delete]').forEach(button => button.onclick = () => { current().colliders.splice(Number(button.dataset.colliderDelete), 1); changed(); refreshPreview(); renderInspector(); });
  $('#mesh-choice')?.addEventListener('change', event => { materialName = event.target.value; renderInspector(); });
  $('#delete-item')?.addEventListener('click', event => { if (event.currentTarget.dataset.confirm !== 'yes') { event.currentTarget.dataset.confirm = 'yes'; event.currentTarget.textContent = 'CONFIRM DELETE'; return; } draft[kind].splice(index, 1); index = Math.min(index, draft[kind].length - 1); changed(); renderAll(); });
}

function renderAll() { installCatalog(draft); materialName = ''; renderTypes(); renderItems(); refreshPreview(); renderInspector(); }
$('#add-item').onclick = () => {
  const n = draft[kind].length + 1, id = slug(`${kind.slice(0, -1)}-${n}`);
  const defaults = {
    maps: { id, theme:'custom', seed:1, objects:[], name: `New Map ${n}`, region: 'Custom Region', description: '', model: '', materials: [], sky: '#91b4cf', fog: '#9ab4bb', ground: '#777c78', sun: '#fff1cb', sunPosition: [68, 95, 45], wind: [0, 0, 0], gravity: 1, colliders: [], tracks: [{ id: slug(`course-${n}`), name: 'First Course', laps: 1, spawn: { position: [0, 1.4, -12], yaw: 0 }, gates: [{ position: [0, 3, 10], yaw: 0, width: 8, height: 6 }, { position: [20, 3, 20], yaw: 1.5, width: 8, height: 6 }, { position: [0, 3, 30], yaw: 3.14, width: 8, height: 6 }] }] },
    drones: { id, name: `New Drone ${n}`, class: 'five', unlock:'starter', model: '', materials: [], mass: 0.68, arm: 0.115, thrustToWeight: 5.6, motorTau: 0.035, drag: [0.034, 0.045, 0.021], angularDrag: 0.11, batterySeconds: 360, color: '#fc623d' },
    parts: { id, name: `New Part ${n}`, category: 'frame', model: '', materials: [], position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, mass: 0, thrust: 1, response: 1, drag: 1, duration: 1, durability: 1, fov: 105, cost: 0 },
    tutorials: {id,name:'New Lesson '+n,map:draft.maps[0].id,track:draft.maps[0].tracks[0].id,steps:[{text:'Hold a steady hover',objective:'altitude',target:1,duration:3}]},
    challenges: { id, name: `New Challenge ${n}`, map: draft.maps[0]?.id || 'hangar', track: draft.maps[0]?.tracks[0]?.id || 'hangar-circuit', target: 120, reward: 100 }
  };
  draft[kind].push(defaults[kind]); index = draft[kind].length - 1; trackIndex = 0; changed(); renderAll();
};
$('#save-draft').onclick = async () => {
  try { const response = await fetch('/editor-api/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); dirty = false; status('Draft saved.'); }
  catch (error) { status(error.message); }
};
$('#publish').onclick = async () => {
  if (dirty) { status('Save Draft before publishing.'); return; }
  try { const response = await fetch('/editor-api/publish', { method: 'POST' }); const result = await response.json(); if (!response.ok) throw new Error(result.error); status(`Published ${result.counts.maps} maps, ${result.counts.drones} drones, ${result.counts.parts} parts, ${result.counts.challenges} challenges. Rebuild and restart the game.`); }
  catch (error) { status(error.message); }
};

try {
  const response = await fetch('/editor-api/draft'); if (!response.ok) throw new Error('Could not load draft.');
  draft = await response.json();
  const publication = await fetch('/editor-api/status').then(response=>response.json());
  status(publication.published ? `Last published ${new Date(publication.at).toLocaleString()}. Draft loaded.` : 'Draft loaded.');
}
catch (error) { status(error.message); }
index = draft.maps.length ? 0 : -1; renderAll();
