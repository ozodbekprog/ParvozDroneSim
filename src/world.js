import * as THREE from 'three';
import {sceneTrack} from '../shared/scene-content.js';
import { WebGPURenderer, PostProcessing, PMREMGenerator } from 'three/webgpu';
import { pass, renderOutput, vec4, float, vec2, materialColor, positionWorld, texture as tslTexture, normalMap as tslNormalMap } from 'three/tsl';
import { registerMaterialResources } from './material-resources.js';
import { cameraMotionBlur } from './camera-motion-blur.js';
import { setSunShadowSize } from './shadow-settings.js';
import { sunShafts } from './sun-shafts.js';
import { rotorTelemetry } from '../shared/rotors.js';
import { advanceRotor } from './rotor-animation.js';
import { configureAssetRenderer, loadTexture, sharedResources } from './asset-loader.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { interpolateSnapshots } from './flight-smoothing.js';
import { MAPS, GAMEPLAY_OBSTACLES, getTrack } from '../shared/content.js';
import { applyMaterials } from './model-materials.js';
import { updateVisualLODs } from './visual-lod.js';
import { applySurfaceSettings,rendererTextureAnisotropy } from './surface-settings.js';
import { renderPixelRatio } from './render-resolution.js';
import { rotate } from '../shared/physics.js';
import { selectedMap } from '../shared/map-selection.js';
import { previewSphere, visibleModelBounds, previewGeometryPoints } from './drone-preview.js';
import { chaseCameraShot,flightCameraFov } from './chase-camera.js';
import {rigidCameraShot} from './rigid-camera.js';
import { constrainCamera,fpvCameraOffset,cameraNearRadius } from './camera-obstruction.js';
import { renderFrame } from './render-frame.js';
import { repairTextureBindings } from './texture-bindings.js';
import {prepareMapCollisions,releaseMapCollisions} from './map-collisions.js';
import {loadPreparedCollisions} from './collision-preparation.js';
import {collisionFileFor} from '../shared/collision-binary.js';
import { createMenuCameraShot, sampleMenuCameraShot,previewCameraDistance } from './menu-camera.js';
import { createPreviewOrbit, orbitPreviewCamera, zoomPreviewCamera, samplePreviewOrbit, focusPreviewPart, advancePreviewOrbit } from './preview-orbit.js';
import { SceneTransition } from './scene-transition.js';
import { sceneDrawDistance } from './scene-distance.js';
import { freezeScenery } from './static-scenery.js';
import { addVisualModelsCooperative } from './cooperative-scene-models.js';
import {batchStaticSceneryAsync} from './scenery-batches.js';
import {supportsSceneryBatches,sceneryBatchOptions} from './scenery-batch-support.js';
import {skyReflectionProbe} from './sky-reflection-probe.js';
import {compileScenePrograms} from './compile-scene-programs.js';
import {prepareSceneTextures} from './prepare-scene-textures.js';
import {prepareReflection} from './prepare-reflection.js';
import {installNativeTerrain} from './native-terrain.js';

import { V, addVisualModel, material, box, sunTexture, disposeObject, skyDome, canvasTexture, createGate, createDrone, scenery } from '../public/content/recipes.js';
const scratchVecA = new THREE.Vector3(), scratchVecB = new THREE.Vector3(), scratchVecC = new THREE.Vector3(), scratchDefaultFpv = new THREE.Vector3(0, 0.04, 0.08);
const scratchQuatA = new THREE.Quaternion(), scratchQuatIdentity = new THREE.Quaternion(), scratchHeroRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, 0.55, -0.20));
const propNamePattern = /^prop[_-]([0-3])$/i;
let cachedTerrainDetailMaps = null;
function getTerrainDetailMaps() {
  if (cachedTerrainDetailMaps) return cachedTerrainDetailMaps;
  const size = 256, heights = new Float32Array(size * size);
  const hash = (x, y, s) => {
    let h = (Math.imul(x & 255, 374761393) + Math.imul(y & 255, 668265263) + Math.imul(s, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const sampleOctave = (u, v, period, seed) => {
    const x = u * period, y = v * period, x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), p = period - 1;
    const n00 = hash(x0 & p, y0 & p, seed), n10 = hash((x0 + 1) & p, y0 & p, seed);
    const n01 = hash(x0 & p, (y0 + 1) & p, seed), n11 = hash((x0 + 1) & p, (y0 + 1) & p, seed);
    return (n00 + (n10 - n00) * sx) + ((n01 + (n11 - n01) * sx) - (n00 + (n10 - n00) * sx)) * sy;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const r16 = 1.0 - Math.abs(sampleOctave(u, v, 16, 1) * 2.0 - 1.0);
      const r32 = 1.0 - Math.abs(sampleOctave(u, v, 32, 2) * 2.0 - 1.0);
      const r64 = 1.0 - Math.abs(sampleOctave(u, v, 64, 3) * 2.0 - 1.0);
      heights[y * size + x] = r16 * 0.45 + r32 * 0.35 + r64 * 0.20;
    }
  }
  let meanH = 0;
  for (let i = 0; i < heights.length; i++) meanH += heights[i];
  meanH /= heights.length;
  let varH = 0;
  for (let i = 0; i < heights.length; i++) {
    const d = heights[i] - meanH;
    varH += d * d;
  }
  const stdH = Math.sqrt(varH / heights.length) || 1;
  for (let i = 0; i < heights.length; i++) heights[i] = (heights[i] - meanH) / stdH;
  const normalData = new Uint8Array(size * size * 4), albedoData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const h = heights[y * size + x];
      const hL = heights[y * size + ((x - 1) & 255)], hR = heights[y * size + ((x + 1) & 255)];
      const hD = heights[((y - 1) & 255) * size + x], hU = heights[((y + 1) & 255) * size + x];
      const dx = (hR - hL) * 2.2, dy = (hU - hD) * 2.2, dz = 1.0, inv = 1 / Math.hypot(dx, dy, dz), idx = (y * size + x) * 4;
      normalData[idx] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      normalData[idx + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255);
      normalData[idx + 2] = Math.round((dz * inv * 0.5 + 0.5) * 255);
      normalData[idx + 3] = 255;
      const contrast = Math.max(0, Math.min(1, 0.5 + h * 0.48));
      albedoData[idx] = Math.round(Math.max(0, Math.min(255, (0.10 + contrast * 0.80) * 255)));
      albedoData[idx + 1] = Math.round(Math.max(0, Math.min(255, (0.08 + contrast * 0.84) * 255)));
      albedoData[idx + 2] = Math.round(Math.max(0, Math.min(255, (0.16 + contrast * 0.68) * 255)));
      albedoData[idx + 3] = 255;
    }
  }
  const setup = data => {
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.colorSpace = THREE.NoColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.channel = 0; tex.anisotropy = 16;
    tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.updateMatrix(); tex.needsUpdate = true; sharedResources.add(tex);
    return tex;
  };
  const normal = setup(normalData), albedo = setup(albedoData);
  const p = positionWorld.xz;
  const pRot1 = vec2(p.x.mul(0.7986).sub(p.y.mul(0.6018)), p.x.mul(0.6018).add(p.y.mul(0.7986)));
  const pRot2 = vec2(p.x.mul(0.3907).add(p.y.mul(0.9205)), p.y.mul(0.3907).sub(p.x.mul(0.9205)));
  const uvMid = p.mul(0.085), uvBlade = pRot1.mul(0.34), uvFine = pRot2.mul(1.25);
  const mid = tslTexture(albedo, uvMid).rgb.sub(0.5);
  const blade = tslTexture(albedo, uvBlade).rgb.sub(0.5);
  const fine = tslTexture(albedo, uvFine).rgb.sub(0.5);
  const mod = mid.mul(0.75).add(blade.mul(0.95)).add(fine.mul(0.85)).add(1.0).clamp(0.42, 1.58);
  const colorNode = materialColor.rgb.mul(mod);
  const nMid = tslTexture(normal, uvMid).xyz.mul(2).sub(1);
  const nBlade = tslTexture(normal, uvBlade).xyz.mul(2).sub(1);
  const nFine = tslTexture(normal, uvFine).xyz.mul(2).sub(1);
  const nCombined = nMid.mul(0.75).add(nBlade.mul(0.95)).add(nFine.mul(0.8)).normalize().mul(0.5).add(0.5);
  const normalNode = tslNormalMap(nCombined, vec2(1.4, 1.4));
  cachedTerrainDetailMaps = { normal, albedo, colorNode, normalNode, resources: { textures: [albedo, normal], unscaled: [albedo, normal] } };
  return cachedTerrainDetailMaps;
}
function collectRotorNodes(root) {
  const found = [];
  root.traverse(child => {
    const match = child.userData.motorIndex === undefined ? propNamePattern.exec(child.name) : null;
    const index = child.userData.motorIndex ?? (match ? Number(match[1]) : undefined);
    if (index === undefined || index < 0 || index > 3) return;
    for (let parent = child.parent; parent && parent !== root; parent = parent.parent) {
      if (parent.userData.motorIndex !== undefined || propNamePattern.test(parent.name)) return;
    }
    found.push({ child, index });
  });
  return found;
}
export class World {
  constructor(container, thumbnail = false, options = {}) {
    this.container = container;
    this.thumbnail = thumbnail;
    this.renderer = thumbnail ? new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }) : new WebGPURenderer({ antialias: false, powerPreference: 'high-performance',forceWebGL:options.forceWebGL===true });
    this.ready = thumbnail ? Promise.resolve() : this.renderer.init();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.setSize(container.clientWidth || 320, container.clientHeight || 180, false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(105, (container.clientWidth || 320) / (container.clientHeight || 180), 0.02, 1500);
    this.scene = new THREE.Scene();
    this.presentation='menu';
    this.drones = new Map();
    this.cameraMode = 'fpv';
    this.lastTime = performance.now();
    this.stageRects = new Map();
    if (!thumbnail) {
      const resized = () => { this.needsResize = true; this.stageRects.clear(); };
      this.resizeObserver = new ResizeObserver(resized); this.resizeObserver.observe(container);
      window.addEventListener('resize', resized); document.addEventListener('fullscreenchange', resized);
      window.visualViewport?.addEventListener('resize', resized);
    }
    this.hangarPreview = false;
    this.hangarOrbit = createPreviewOrbit();
    this.menuScene = null;
    this.menuReducedMotion = !thumbnail && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.fpvTilt = 25;
    this.graphics = { quality: 'auto', resolution: 1, shadows: true, antialiasing: true, ambientOcclusion: true, bloom: true, sunShafts: true, clouds: true, exposure: 1.35, motionBlur: false };
    this.post = null;
    this.sunVisual = null;
    this.postResources = [];
    this.mapPreviews = new Map();
    this.mapPreviewToken = 0;
    this.predictionRemainder = 0;
    this.renderer.info.autoReset=false;
    this.ready=this.ready.then(()=>{ configureAssetRenderer(this.renderer);repairTextureBindings(this.renderer);this.renderer.backend?.device?.lost?.then(info=>{ if(info.reason!=='destroyed') this.recoverRenderer('GPU device lost'); }); }).catch(()=>this.recoverRenderer('WebGPU initialization failed'));
  }

  setGraphics(settings) {
    this.graphics = { ...this.graphics, ...settings };
    if(this.map){this.camera.far=sceneDrawDistance(this.map,this.graphics);this.camera.updateProjectionMatrix();this.resizeSky();}
    this.adaptiveScale=1;
    const ratio = renderPixelRatio(this.container.clientWidth || 320, this.container.clientHeight || 180, this.graphics, window.devicePixelRatio);
    this.renderer.setPixelRatio(ratio);
    this.renderer.shadowMap.enabled = this.graphics.shadows;
    this.renderer.toneMappingExposure = this.graphics.exposure;
    if (this.sunVisual) this.sunVisual.visible = this.graphics.sunShafts;
    if (this.clouds) this.clouds.visible = this.graphics.clouds;
    this.sunLight = setSunShadowSize(this.scene, this.sunLight, ['high', 'ultra'].includes(this.graphics.quality) ? 2048 : 1024);
    if(this.sunLight) this.sunLight.shadow.needsUpdate=true;
    const signature = JSON.stringify([this.graphics.bloom, this.graphics.ambientOcclusion, this.graphics.antialiasing, this.graphics.motionBlur,this.graphics.sunShafts]);
    if (signature !== this.postSignature) { this.postSignature = signature; this.rebuildPost(); }
    this.resize();
    this.surfaceReady=this.updateSurfaces();this.surfaceReady.catch(error=>{this.renderWarning='Surface settings: '+error.message;});
  }

  async updateSurfaces() {
    const scene=this.scene;await this.ready;await this.mapReady;
    if(scene!==this.scene)return;
    applySurfaceSettings(scene,this.graphics,rendererTextureAnisotropy(this.renderer));
    if(!this.map&&!this.workbench)return;
    if(!this.graphics.reflections){scene.environment=null;this.reflectionTarget?.dispose();this.reflectionTarget=null;return;}
    if(this.reflectionTarget&&this.reflectionScene===scene){scene.environment=this.reflectionTarget.texture;return;}
    if(this.reflectionTask)return this.reflectionTask.then(()=>scene===this.scene&&this.updateSurfaces());
    this.reflectionTask=(async()=>{
      this.reflectionBuilding=true;
      const generator=this.thumbnail?new THREE.PMREMGenerator(this.renderer):new PMREMGenerator(this.renderer);
      const hidden=[...this.drones.values()].map(d=>[d.mesh,d.mesh.visible]);for(const [mesh] of hidden)mesh.visible=false;
      scene.environment=null;
      const position=new THREE.Vector3(...(this.track?.spawn?.position||[0,1.5,0]));position.y=Math.max(position.y,1.5);
      const camera=new THREE.PerspectiveCamera();camera.position.copy(position);
      const probe=skyReflectionProbe(this.skyDome,this.map?.ground||'#777777');
      if(!probe)updateVisualLODs(scene,camera,{low:this.graphics.lodMinimum===1||this.graphics.quality==='low',distanceScale:this.graphics.lodDistanceScale});
      try{
        const target=this.thumbnail?generator.fromScene(probe?.scene||scene,0,.1,probe?.far||this.camera.far):await prepareReflection(generator,this.renderer,probe?.scene||scene,{far:probe?.far||this.camera.far,size:128,position:probe?.position||position,isCurrent:()=>scene===this.scene&&this.graphics.reflections});
        if(!target)return;
        if(scene!==this.scene||!this.graphics.reflections){target.dispose();return;}
        this.reflectionTarget?.dispose();this.reflectionTarget=target;this.reflectionScene=scene;
        scene.environment=target.texture;scene.environmentIntensity=.65;
      }finally{for(const [mesh,visible] of hidden)mesh.visible=visible;probe?.dispose();generator.dispose();this.reflectionBuilding=false;}
    })();
    try{await this.reflectionTask;}finally{this.reflectionTask=null;}
  }

  rebuildPost() {
    this.post?.dispose();
    for (const resource of this.postResources || []) resource.dispose?.();
    this.postResources = [];
    this.post = null;
    this.aoTexture=null; this.shafts=null; this.motionEffect=null;
    this.scenePass=null;
    if (this.thumbnail || this.presentation!=='flight' || !this.scene || !this.camera) return;
    const { bloom: useBloom, ambientOcclusion, antialiasing, motionBlur: useMotionBlur } = this.graphics;
    if (!useBloom && !ambientOcclusion && !antialiasing && !useMotionBlur && !this.graphics.sunShafts) return;
    const scenePass = pass(this.scene, this.camera);
    this.scenePass=scenePass;
    this.postResources.push(scenePass);
    let color = scenePass.getTextureNode('output');
    if (useMotionBlur) {
      this.motionEffect = cameraMotionBlur(color, scenePass.getTextureNode('depth'), this.camera);
      color = this.motionEffect.node;
    }
    if (ambientOcclusion) {
      const depth = scenePass.getTextureNode('depth');
      const occlusion = ao(depth, null, this.camera);
      occlusion.resolutionScale = 0.5;
      occlusion.samples.value = 8;
      occlusion.radius.value = 0.25;
      occlusion.thickness.value = 0.5;
      occlusion.distanceExponent.value = 1.6;
      occlusion.scale.value = 0.45;
      const nearWeight = depth.oneMinus().mul(750).clamp(0, 1);
      const cleanAo = occlusion.getTextureNode().r.add(0.14).clamp(0.75, 1);
      const aoFactor = float(1).sub(float(1).sub(cleanAo).mul(nearWeight));
      color = vec4(color.rgb.mul(aoFactor), color.a);
      this.postResources.push(occlusion);
    }
    if(this.graphics.sunShafts) { this.shafts=sunShafts(scenePass.getTextureNode('depth')); this.postResources.push(this.shafts.texture); color=vec4(color.rgb.add(this.shafts.texture.rgb),color.a); }
    if (useBloom) { const glow = bloom(color, 0.25, 0.28, 0.95); this.postResources.push(glow); color = color.add(glow); }
    const pipeline = new PostProcessing(this.renderer);
    if (antialiasing) { pipeline.outputColorTransform = false; color = fxaa(renderOutput(color)); }
    pipeline.outputNode = color;
    this.post = pipeline;
    this.resize();
  }

  load(mapId, trackId, {force=false,presentation='flight',course=true,signal} = {}) {
    this.collisionSignal=signal;
    if(this.map?.id!==mapId)releaseMapCollisions(this.map);
    this.performanceWarmUntil=performance.now()+4000;
    if(!this.presentationDraft)this.sceneTransition?.cancel();
    this.setMenuScene(false);
    if(!force && this.canReuseEnvironment(mapId)) {
      if(this.presentation!==presentation){this.presentation=presentation;this.rebuildPost();}this.hangarPreview=false;this.workbench=null;
      if(this.garageGroup)this.garageGroup.visible=false;
      return this.mapReady=Promise.all([this.prepareCourse(trackId,course),this.prepareMapCollisions(presentation)]);
    }
    if (!force && this.environmentReady && this.map?.id === mapId && this.track?.id === trackId && this.courseActive===course && !this.hangarPreview && !this.workbench) {
      if(this.presentation!==presentation){this.presentation=presentation;this.rebuildPost();}
      return this.mapReady=Promise.all([this.mapReady,this.prepareMapCollisions(presentation)]);
    }
    this.presentation=presentation;this.renderFatal=false;this.environmentReady=false;this.garageGroup=null;
    this.hangarPreview = false;
    this.workbench = null;
    this.groundReady = Promise.resolve();
    this.reflectionTarget?.dispose();this.reflectionTarget=null;
    const persistent = new Set([...this.drones.values()].map(item => item.mesh));
    this.scene.userData.disposed = true;
    const retired=this.scene;
    const retire=()=>{for(const child of retired.children)if(!persistent.has(child))disposeObject(child);};
    if(this.reflectionTask)this.reflectionTask.then(retire,retire);else retire();
    this.scene = new THREE.Scene();
    const map = selectedMap(MAPS, mapId);
    const originalTrack = getTrack(map.id, trackId),track=sceneTrack(originalTrack,course);
    this.map = map; this.track = originalTrack; this.courseActive=course;this.gates = [];
    const environment = map.environment || map.theme;
    const indoor = map.indoor ?? ['hangar', 'orbital'].includes(environment);
    const night = ['neon', 'nightgrid'].includes(environment);
    this.camera.far = sceneDrawDistance(map,this.graphics);
    this.camera.updateProjectionMatrix();
    this.scene.background = new THREE.Color(map.sky);
    this.scene.fog = new THREE.FogExp2(map.fog, map.fogDensity ?? (night ? 0.003 : 0.0018));
    this.skyDome = indoor ? null : skyDome({...map, viewDistance:this.camera.far});
    if (this.skyDome) this.scene.add(this.skyDome);
    if(this.scene.fog&&(this.graphics.lodMinimum===1||this.graphics.quality==='low'))this.scene.fog.density=Math.max(this.scene.fog.density,.009);
    const hemi = new THREE.HemisphereLight(night ? '#4b74a4' : '#d5e8ff', map.ground, map.ambientIntensity ?? (night ? 1.1 : 1.45));
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(map.sun, map.sunIntensity ?? (night ? 1.8 : 3.4));
    const sunPosition = map.sunPosition || (map.theme === 'neon' ? [-45, 95, 45] : [68, 95, 45]);
    this.sunOffset = new THREE.Vector3(...sunPosition).normalize().multiplyScalar(320);
    this.shadowCenter = new THREE.Vector3(0,0,0);
    sun.position.copy(this.sunOffset);
    sun.castShadow = !indoor;
    sun.shadow.mapSize.setScalar(['high', 'ultra'].includes(this.graphics.quality) ? 2048 : 1024);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -85;
    sun.shadow.camera.right = sun.shadow.camera.top = 85;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 520;
    sun.shadow.bias = -0.00055; sun.shadow.normalBias = 0.075; sun.shadow.radius = 2;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sunLight=sun; sun.shadow.autoUpdate=false; sun.shadow.needsUpdate=true;
    this.homeLight=new THREE.PointLight('#d9edff',0,2,1);this.homeLight.name='Home aircraft fill';this.scene.add(this.homeLight);
    this.sunVisual = null;
    this.clouds = null;
    if (!indoor) {
      const light = new THREE.SpriteMaterial({ map: sunTexture, color: map.sun, transparent: true, opacity: night ? 0.24 : 0.68, depthWrite: false, fog: false });
      this.sunVisual = new THREE.Sprite(light);
      this.sunVisual.scale.set(22, 22, 1);
      this.sunVisual.position.copy(sun.position).multiplyScalar(2.5);
      this.sunDirection=sun.position.clone().normalize();
      this.sunVisual.visible = this.graphics.sunShafts;
      this.scene.add(this.sunVisual);
      this.clouds = new THREE.Group();
      const cloudMaterial = new THREE.MeshBasicMaterial({ color: map.cloudColor || '#e4ebec', transparent: true, opacity: night ? 0.07 : 0.10, depthWrite: false, fog: false });
      for (let index = 0; index < 17; index++) {
        const patch = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), cloudMaterial);
        patch.position.set(Math.sin(index * 2.37) * 350, 145 + index % 4 * 12, Math.cos(index * 1.91) * 350);
        patch.scale.set(45 + index % 5 * 12, 2.2, 16 + index % 4 * 5);
        this.clouds.add(patch);
      }
      this.clouds.visible = this.graphics.clouds;
      this.scene.add(this.clouds);
    }
    if(!map.model || map.groundPlane) {
    const concrete = ['hangar', 'industrial', 'neon', 'orbital', 'ruins'].includes(map.theme);
    const texture = map.groundTexture ? loadTexture(map.groundTexture) : map.theme === 'forest' ? loadTexture('/content/assets/forest-floor.png') : map.theme === 'canyon' ? loadTexture('/content/assets/canyon-floor.png') : concrete ? loadTexture('/content/assets/concrete-floor.png') : canvasTexture(map.ground, 12);
    this.groundReady = texture.assetsReady || Promise.resolve();
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(96, 96);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16;
    const tint = { hangar: '#e4e9e7', industrial: '#9ba2a4', neon: '#526078', orbital: '#a2b7c9', ruins: '#b3a59a' }[map.theme] || '#ffffff';
    const groundMaterial = new THREE.MeshStandardMaterial({ map: texture, color: tint, roughness: map.theme === 'neon' ? 0.24 : 0.9, metalness: map.theme === 'orbital' ? 0.42 : 0.04 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(650, 650), groundMaterial);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
    }
    const builtins = new THREE.Group(); builtins.name = 'environment';
    if (!map.model) scenery(builtins, map, track);
    const materialReady = applyMaterials(builtins, map.materials); this.scene.add(builtins);
    const jobs=[materialReady, this.groundReady || Promise.resolve()];
    const courseGroup=new THREE.Group();courseGroup.name='Selected course';this.courseGroup=courseGroup;this.scene.add(courseGroup);
    const prepareStaticModel=(roots,model)=>{
      freezeScenery(model);
      model.traverse(object=>{
        if(!object.isMesh||!object.geometry)return;
        const matName=object.material?.name||'';
        if(/^TerrainSurface_|GolfHorizon|HorizonDisplacement/i.test(object.name||'')||/^TerrainSurface_|GolfHorizon|Native tiled terrain/i.test(matName)){
          object.castShadow=false;
          if(/^TerrainSurface_|GolfHorizon/i.test(matName)&&!map.terrainSplat&&object.material){
            const detail=getTerrainDetailMaps();
            object.material.colorNode=detail.colorNode;
            object.material.normalNode=detail.normalNode;
            object.material.roughness=0.92;
            registerMaterialResources(object.material,detail.resources);
          }
          return;
        }
        if(!object.castShadow)return;
        if(!object.geometry.boundingSphere)object.geometry.computeBoundingSphere();
        const e=object.matrixWorld.elements,sx=Math.hypot(e[0],e[1],e[2]),sy=Math.hypot(e[4],e[5],e[6]),sz=Math.hypot(e[8],e[9],e[10]);
        const worldRadius=(object.geometry.boundingSphere?.radius||0)*Math.max(sx,sy,sz);
        if(worldRadius<0.65||(!object.isInstancedMesh&&worldRadius>320))object.castShadow=false;
      });
      roots.push(model);
    };
    const staticRoots=[],courseStaticRoots=[];
    const keepStatic=model=>prepareStaticModel(staticRoots,model);
    const keepCourseStatic=model=>prepareStaticModel(courseStaticRoots,model);
    const targetScene=this.scene;
    const stillLoading=()=>this.scene===targetScene&&!targetScene.userData.disposed&&!signal?.aborted;
    if(map.objects?.length)jobs.push(addVisualModelsCooperative(map.objects,object=>addVisualModel(targetScene,object,object.materials,object,keepStatic),{shouldContinue:stillLoading,batchSize:32,budgetMs:10}));
    if(track.objects?.length)jobs.push(addVisualModelsCooperative(track.objects,object=>addVisualModel(courseGroup,object,object.materials,object,keepCourseStatic),{shouldContinue:stillLoading,batchSize:32,budgetMs:10}));
    if (map.model) {
      jobs.push(addVisualModel(targetScene, map, map.materials, map.modelTransform || {}, model => {
        if (this.scene !== targetScene) {targetScene.remove(model);disposeObject(model);} else {keepStatic(model);this.sunLight.shadow.needsUpdate=true;}
      }));
    }
    const obstacleMaterial = material(map.theme === 'forest' ? '#3d4b38' : map.theme === 'canyon' ? '#9a6d55' : map.theme === 'orbital' ? '#62798d' : '#5b6870', 0.78, map.theme === 'industrial' ? 0.4 : 0.07);
    const obstacles = new THREE.Group(); obstacles.name = 'collision scenery';
    for (const obstacle of GAMEPLAY_OBSTACLES[map.id] || []) {
      if (!obstacle.size || obstacle.visible === false || map.model) continue;
      const [width, height, depth] = obstacle.size;
      const [x, y, z] = obstacle.position;
      if (map.theme === 'forest') {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.28, width * 0.42, height, 9), obstacleMaterial);
        trunk.position.set(x, y, z); trunk.castShadow = true; obstacles.add(trunk);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(3.4, 9, 9), material('#395c42'));
        crown.position.set(x, height + 2, z); crown.castShadow = true; obstacles.add(crown);
      } else if (map.theme === 'canyon') {
        const stone = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.38, width * 0.54, height, 7), obstacleMaterial);
        stone.position.set(x, y, z); stone.castShadow = true; obstacles.add(stone);
      } else obstacles.add(box(width, height, depth, obstacleMaterial, x, y, z));
    }
    applyMaterials(obstacles, map.materials); this.scene.add(obstacles);
    track.gates.forEach((gate, index) => {
      const result = createGate(gate, index === 0 ? '#f6d36f' : '#47c6db');
      this.gates.push(result);
      courseGroup.add(result.group);
      if(result.group.assetsReady)jobs.push(result.group.assetsReady);
    });
    for (const drone of this.drones.values()) this.scene.add(drone.mesh);
    this.setActiveGate(0);
    this.rebuildPost();
    const loadedScene = this.scene;
    jobs.push(this.prepareMapCollisions(presentation));
    if(collisionFileFor(track))jobs.push(loadPreparedCollisions(collisionFileFor(track),{signal}).then(colliders=>{if(this.scene!==loadedScene)return;track.colliders=colliders;}));
    this.mapReady=Promise.all(jobs).then(async()=>{if(this.scene===loadedScene){
      await installNativeTerrain(loadedScene,map.terrainSplat);
      if(this.scene!==loadedScene)return;
      const current=()=>this.scene===loadedScene&&!loadedScene.userData.disposed&&!signal?.aborted;
      const batchOpts=supportsSceneryBatches(this.renderer)?{...sceneryBatchOptions(this.renderer,this.sceneryBatchOptions),shouldContinue:current,budgetMs:14}:null;
      const start=performance.now(),result=batchOpts?await batchStaticSceneryAsync(staticRoots,loadedScene,batchOpts):{meshes:0,batches:0};
      if(!current())return;
      const courseResult=batchOpts&&courseStaticRoots.length?await batchStaticSceneryAsync(courseStaticRoots,courseGroup,batchOpts):{meshes:0,batches:0};
      if(!current())return;
      this.sceneryBatchStats={meshes:result.meshes+courseResult.meshes,batches:result.batches+courseResult.batches,ms:performance.now()-start};
      applySurfaceSettings(loadedScene,this.graphics,rendererTextureAnisotropy(this.renderer));if(this.sunLight)this.sunLight.shadow.needsUpdate=true;this.environmentReady=true;
    }});this.mapReady.catch(error=>{if(error.name!=='AbortError'&&this.scene===loadedScene)this.renderWarning=error.message;});return this.mapReady;
  }

  canReuseEnvironment(mapId){return this.environmentReady && this.map?.id===mapId && this.map.model && !this.scene.userData.disposed;}

  prepareMapCollisions(presentation){return prepareMapCollisions(this.map,presentation,{signal:this.collisionSignal});}

  prepareCourse(trackId,course){
    const original=getTrack(this.map.id,trackId),track=sceneTrack(original,course);
    const key=`course:${this.map.id}:${original.id}:${course}`;
    if(this.sceneTransition?.pending && this.sceneTransition.pending.key!==key)this.sceneTransition.cancel();
    if(this.track?.id===original.id && this.courseActive===course){if(this.courseGroup)this.courseGroup.visible=course;return Promise.resolve();}
    if(!course && !this.courseActive){this.track=original;return Promise.resolve();}
    const scene=this.scene;
    this.sceneTransition ||= new SceneTransition();
    return this.sceneTransition.request(key,()=>{
      const group=new THREE.Group(),gates=[],jobs=[],courseStaticRoots=[];group.name='Selected course';
      const activeCourse=()=>this.scene===scene&&!group.userData.disposed&&!this.collisionSignal?.aborted;
      const keepCourseStatic=model=>{
        freezeScenery(model);
        model.traverse(object=>{
          if(!object.isMesh||!object.geometry)return;
          const matName=object.material?.name||'';
          if(/^TerrainSurface_|GolfHorizon|HorizonDisplacement/i.test(object.name||'')||/^TerrainSurface_|GolfHorizon|Native tiled terrain/i.test(matName)){
            object.castShadow=false;
            return;
          }
          if(!object.castShadow)return;
          if(!object.geometry.boundingSphere)object.geometry.computeBoundingSphere();
          const e=object.matrixWorld.elements,sx=Math.hypot(e[0],e[1],e[2]),sy=Math.hypot(e[4],e[5],e[6]),sz=Math.hypot(e[8],e[9],e[10]);
          const worldRadius=(object.geometry.boundingSphere?.radius||0)*Math.max(sx,sy,sz);
          if(worldRadius<0.65||(!object.isInstancedMesh&&worldRadius>320))object.castShadow=false;
        });
        courseStaticRoots.push(model);
      };
      if(track.objects?.length)jobs.push(addVisualModelsCooperative(track.objects,object=>addVisualModel(group,object,object.materials,object,keepCourseStatic),{shouldContinue:activeCourse,batchSize:96,budgetMs:14}));
      for(const [index,gate] of track.gates.entries()){
        const result=createGate(gate,index===0?'#f6d36f':'#47c6db');gates.push(result);group.add(result.group);
        if(result.group.assetsReady)jobs.push(result.group.assetsReady);
      }
      if(collisionFileFor(track))jobs.push(loadPreparedCollisions(collisionFileFor(track),{signal:this.collisionSignal}).then(data=>{track.colliders=data;}));
      const ready=Promise.all(jobs).then(async()=>{
        if(activeCourse()&&courseStaticRoots.length&&supportsSceneryBatches(this.renderer)){
          await batchStaticSceneryAsync(courseStaticRoots,group,{...sceneryBatchOptions(this.renderer,this.sceneryBatchOptions),shouldContinue:activeCourse,budgetMs:14});
        }
      });
      return {ready,dispose:()=>disposeObject(group),commit:()=>{
        if(this.scene!==scene){disposeObject(group);return;}
        if(this.courseGroup){scene.remove(this.courseGroup);disposeObject(this.courseGroup);}
        scene.add(group);this.courseGroup=group;this.track=original;this.courseActive=course;this.gates=gates;
        applySurfaceSettings(group,this.graphics,rendererTextureAnisotropy(this.renderer));this.setActiveGate(0);if(this.sunLight)this.sunLight.shadow.needsUpdate=true;
      }};
    });
  }

  setActiveGate(index) {
    this.gates?.forEach((gate, i) => {
      if(!gate.glow)return;
      const next = i === (index + 1) % this.gates.length && i !== index;
      gate.glow.color.set(i === index ? '#ffdc75' : next ? '#87c9ff' : '#5b9faa');
      gate.glow.emissive.set(i === index ? '#ffb42f' : next ? '#3a8acf' : '#1c738c');
      gate.glow.emissiveIntensity = i === index ? 2.7 : next ? 1.6 : 0.45;
    });
  }

  invalidateEnvironment() {
    // Keep the active map paired with its sky/lights until a replacement commits.
    // Clearing map alone leaves the render loop holding that map's sun effects.
    this.environmentReady=false;
    this.setMenuScene(false);
  }

  setMenuScene(active, { mapId, trackId, kind = 'menu',course=false } = {}) {
    const generation=this.menuGeneration=(this.menuGeneration||0)+1;
    if (!active) {
      if(this.sceneTransition?.pending?.key.startsWith('menu:'))this.sceneTransition.cancel();
      if (this.menuScene) this.setFov(this.menuScene.flightFov);
      this.menuScene = null;
      this.camera.clearViewOffset();
      return Promise.resolve();
    }
    const map = selectedMap(MAPS, mapId);
    const track = getTrack(map.id, trackId);
    const key = `menu:${map.id}:${track.id}:${kind}:${course}`;
    if(this.sceneTransition?.pending?.key.startsWith(`menu:${map.id}:${track.id}:`)){
      return this.mapReady=this.sceneTransition.pending.promise.then(()=>generation===this.menuGeneration?this.setMenuScene(true,{mapId,trackId,kind,course}):undefined);
    }
    if (this.menuScene?.key === key && this.map === map && this.track === track && !this.hangarPreview) return this.mapReady;
    if(this.canReuseEnvironment(map.id)){
      this.sceneTransition?.cancel();
      this.mapReady=(course||this.track?.id!==track.id?this.prepareCourse(track.id,course):Promise.resolve()).then(async()=>{
        if(generation!==this.menuGeneration || this.map!==map)return;
        this.hangarPreview=false;this.workbench=null;this.workbenchAnchor=null;
        if(this.garageGroup)this.garageGroup.visible=false;
        if(!course&&this.courseGroup)this.courseGroup.visible=false;
        const shot=createMenuCameraShot(map,track);
        this.menuScene={key,kind,shot,flightFov:this.flightFov||this.camera.fov,started:performance.now(),loaded:true};
        if(this.presentation!=='menu'){this.presentation='menu';this.rebuildPost();}
        this.camera.fov=shot.fov;this.camera.updateProjectionMatrix();this.camera.clearViewOffset();
        if(this.ready&&this.renderer?.compileAsync)await this.compileGraphics({blockRender:true});
        if(generation!==this.menuGeneration || this.map!==map)return;
        this.onSceneStatus?.({status:'ready',mapId:map.id});
      });
      return this.mapReady;
    }
    this.sceneTransition ||= new SceneTransition();
    this.onSceneStatus?.({status:'loading',mapId:map.id});
    this.mapReady=this.sceneTransition.request(key,()=>{
      const draft=this.createPresentationDraft(map.id,track.id,'menu',{course});
      return {ready:draft.mapReady,dispose:()=>this.disposePresentationDraft(draft),commit:()=>{
        this.commitPresentationDraft(draft);this.hangarPreview=false;this.workbenchAnchor=null;
        const shot=createMenuCameraShot(map,track);
        this.menuScene={key,kind,shot,flightFov:this.flightFov||this.camera.fov,started:performance.now(),loaded:true};
        this.camera.fov=shot.fov;this.camera.updateProjectionMatrix();this.camera.clearViewOffset();
      }};
    }).then(async()=>{
      if(generation!==this.menuGeneration || this.map!==map)return;
      if(this.ready&&this.renderer?.compileAsync)await this.compileGraphics({blockRender:true});
      if(generation!==this.menuGeneration || this.map!==map)return;
      this.onSceneStatus?.({status:'ready',mapId:map.id});
    }).catch(error=>{this.onSceneStatus?.({status:'error',mapId:map.id,error:error.message});throw error;});
    return this.mapReady;
  }

  createPresentationDraft(mapId,trackId,presentation,{course=true}={}){
    const draft=Object.create(this);
    Object.assign(draft,{presentationDraft:true,environmentReady:false,courseGroup:null,garageGroup:null,scene:new THREE.Scene(),drones:new Map(),map:null,track:null,menuScene:null,workbench:null,hangarPreview:false,reflectionTask:null,reflectionTarget:null,camera:this.camera.clone(),rebuildPost(){}});
    draft.load(mapId,trackId,{presentation,course});return draft;
  }
  disposePresentationDraft(draft){
    if(draft.scene.userData.disposed)return;
    draft.scene.userData.disposed=true;disposeObject(draft.scene);
  }
  commitPresentationDraft(draft){
    if(this.map?.id!==draft.map?.id)releaseMapCollisions(this.map);
    // Keep the two already prepared menu aircraft, including their GPU resources.
    const retained=['preview','home-drone'].map(id=>this.drones.get(id)).filter(Boolean);
    for(const item of retained){item.mesh.removeFromParent();item.mesh.visible=false;}
    const preview=this.drones.get('preview');if(preview)preview.needsPlacement=true;
    this.removeMissing(['preview','home-drone']);
    const retired=this.scene;retired.userData.disposed=true;
    const retire=()=>disposeObject(retired);
    if(this.reflectionTask)this.reflectionTask.then(retire,retire);else retire();
    this.reflectionTarget?.dispose();this.reflectionTarget=null;
    for(const key of ['scene','map','track','gates','courseActive','presentation','environmentReady','courseGroup','garageGroup','workbench','skyDome','sunVisual','clouds','sunLight','homeLight','sunOffset','shadowCenter','sunDirection','groundReady'])this[key]=draft[key];
    for(const item of retained)this.scene.add(item.mesh);
    this.camera.far=draft.camera.far;this.camera.updateProjectionMatrix();this.renderFatal=false;this.renderWarning=null;
    this.rebuildPost();this.motionEffect?.history?.reset?.();
  }
  loadGarageModel(scene,garage){const group=new THREE.Group();group.name='Workshop presentation';scene.add(group);return addVisualModel(group,garage,garage.materials,garage,freezeScenery).then(()=>group);}
  resizeSky(){
    if(!this.skyDome)return;
    const radius=this.skyDome.geometry.parameters.radius;this.skyDome.scale.setScalar(Math.min(this.camera.far*.85,1400)/radius);
    if(this.scene.fog)this.scene.fog.density=this.graphics.lodMinimum===1||this.graphics.quality==='low'?Math.max(this.map?.fogDensity||0,.009):this.map?.fogDensity||0;
  }

  upsertDrone(id, build, state, own = false, ghost = false, interpolate = false, resetId = 0) {
    let item = this.drones.get(id);
    if (!item) {
      const mesh = createDrone(build);
      if (ghost) mesh.traverse(object => {
        if (!object.isMesh) return;
        object.material = object.material.clone();
        object.material.transparent = true;
        object.material.opacity = 0.3;
        object.material.depthWrite = false;
        object.castShadow = false;
      });
      mesh.traverse(object => { if (object.isMesh) object.userData.baseColor = object.material.color?.clone(); });
      this.scene.add(mesh);
      item = { mesh, state, own, spec:build, snapshots: [], visualPosition: new THREE.Vector3(...state.position), visualRotation: new THREE.Quaternion(...state.rotation) };
      this.drones.set(id, item);
      Promise.resolve(mesh.assetsReady).then(()=>{if(this.drones.get(id)===item)item.fpvOffset=fpvCameraOffset(mesh,build);}).catch(()=>{});
    }
    item.state = state; item.own = own;
    if (own) { this.setMenuScene(false); this.activeDroneId = id; item.snapshots = []; this.hangarPreview = false; }
    if (interpolate) {
      if (item.resetId !== resetId) { item.snapshots = []; item.resetId = resetId; }
      item.snapshots.push({ time: performance.now(), state: structuredClone(state) });
      if (item.snapshots.length > 32) item.snapshots.shift();
    }
    return item;
  }

  replaceDrone(id, build, state) {
    const prior = this.drones.get(id);
    if (prior) { this.scene.remove(prior.mesh); disposeObject(prior.mesh); this.drones.delete(id); }
    return this.upsertDrone(id, build, state);
  }

  resetDroneVisual(id, state) {
    const item = this.drones.get(id);
    if (!item) return;
    item.visualPosition.set(...state.position);
    item.visualRotation.set(...state.rotation);
    item.correction = new THREE.Vector3();
    item.rotationCorrection = new THREE.Quaternion();
    item.chaseCamera=null;
    if(id===this.activeDroneId)this.camera.position.set(...state.position);
  }

  correctDroneVisual(id, before, after) {
    const item = this.drones.get(id);
    if (!item) return;
    const delta = new THREE.Vector3(...before.position).sub(new THREE.Vector3(...after.position));
    if (delta.length() > 3) return this.resetDroneVisual(id, after);
    item.correction ||= new THREE.Vector3();
    item.correction.add(delta);
    // Only smooth a reconciliation error. Live stick rotations never pass through a filter.
    const correction = new THREE.Quaternion(...before.rotation).multiply(new THREE.Quaternion(...after.rotation).invert());
    item.rotationCorrection ||= new THREE.Quaternion();
    item.rotationCorrection.multiply(correction);
  }

  removeMissing(ids) {
    if(!ids.includes(this.activeDroneId))this.activeDroneId=null;
    for (const [id, item] of this.drones) if (!ids.includes(id)) { this.scene.remove(item.mesh); disposeObject(item.mesh); this.drones.delete(id); }
  }

  setCameraMode(mode) { if(this.cameraMode!==mode)for(const item of this.drones.values())item.chaseCamera=null;this.cameraMode = mode;if(this.presentation==='flight')this.setFov(this.flightFov||105); }
  cameraObstacles(){
    const environment=GAMEPLAY_OBSTACLES[this.map?.id]||[],course=this.courseActive?this.track?.colliders:undefined;
    const cache=this.cameraCollisionCache;
    if(cache?.environment===environment&&cache.course===course)return cache.obstacles;
    const obstacles=course?.length?[...environment,...course]:environment;
    this.cameraCollisionCache={environment,course,obstacles};return obstacles;
  }
  orbitHangarPreview(deltaX, deltaY) { orbitPreviewCamera(this.hangarOrbit, deltaX, deltaY); }
  zoomHangarPreview(amount) { zoomPreviewCamera(this.hangarOrbit, amount); }
  resetHangarPreview() {
    this.hangarOrbit=createPreviewOrbit();
    const shot=this.map?.garage?.cameraShots?.[this.hangarLayout];
    if(shot)Object.assign(this.hangarOrbit,shot);
  }
  focusWorkbenchPart(part) { focusPreviewPart(this.hangarOrbit, part, this.menuReducedMotion); }
  addContentObjects(objects = []) {
    return Promise.all(objects.map(object => addVisualModel(this.scene, object, object.materials, object)));
  }
  installDronePreview(mesh, spec, state) {
    // Retained previews are hidden while another menu is displayed. Restore
    // the root before measuring visible parts, or an empty box yields -Infinity.
    mesh.visible=true;
    if(this.workbenchAnchor){
      mesh.position.fromArray(this.workbenchAnchor);mesh.updateMatrixWorld(true);
      const bounds=visibleModelBounds(mesh);
      if(bounds&&!bounds.isEmpty())mesh.position.y+=this.workbenchAnchor[1]-bounds.min.y;
      state.position=mesh.position.toArray();
    }
    const prior=this.drones.get('preview');
    this.scene.add(mesh);
    this.drones.set('preview',{mesh,spec,state,own:false,snapshots:[],visualPosition:new THREE.Vector3(...state.position),visualRotation:new THREE.Quaternion(...state.rotation)});
    if(prior&&prior.mesh!==mesh){this.scene.remove(prior.mesh);disposeObject(prior.mesh);}
  }

  installHomeDrone(mesh,spec,key){
    const prior=this.drones.get('home-drone');
    if(prior){this.scene.remove(prior.mesh);disposeObject(prior.mesh);}
    const sphere=previewSphere(mesh);
    this.scene.add(mesh);this.drones.set('home-drone',{mesh,spec,key,hero:true,sphere});
    this.updateHomeLight();
  }

  updateHomeLight(){
    const hero=this.drones.get('home-drone');
    // Light membership participates in Three's material cache key. Keep the
    // fill outside the hidden aircraft so menu switches only update uniforms.
    if(this.homeLight?.parent!==this.scene){
      this.homeLight=null;
      if(hero){this.homeLight=new THREE.PointLight('#d9edff',0,2,1);this.homeLight.name='Home aircraft fill';this.scene.add(this.homeLight);}
    }
    if(!this.homeLight)return;
    this.homeLight.intensity=hero?.mesh.visible?1.4:0;
    if(hero?.mesh.visible){
      hero.mesh.updateWorldMatrix(true,false);
      this.homeLight.position.set(.4,.55,-.6).applyMatrix4(hero.mesh.matrixWorld);
    }
  }

  leaveHangarPreview(){
    this.previewGeneration=(this.previewGeneration||0)+1;
    if(this.sceneTransition?.pending?.key.startsWith('preview:'))this.sceneTransition.cancel();
    this.hangarPreview=false;
    const preview=this.drones.get('preview');if(preview)preview.mesh.visible=false;
    this.removeMissing(['preview','home-drone']);
  }

  prepareHangarPreview(layout = 'selection',mapId) {
    const generation=this.previewGeneration=(this.previewGeneration||0)+1;
    const layoutChanged=this.hangarLayout!==layout;
    this.hangarLayout=layout;
    if(layoutChanged)this.resetHangarPreview();
    const environment=MAPS[mapId]?.garage ? MAPS[mapId] : null;
    if(environment){
      if(this.sceneTransition?.pending?.key.startsWith('menu:'+environment.id+':')){
        return this.mapReady=this.sceneTransition.pending.promise.then(()=>generation===this.previewGeneration?this.prepareHangarPreview(layout,mapId):undefined);
      }
      if(this.workbench===environment.id&&this.map?.id===environment.id){this.setMenuScene(false);this.presentation='preview';this.hangarPreview=true;this.setFov(55);return this.mapReady;}
      if(this.canReuseEnvironment(environment.id)){
        this.menuGeneration=(this.menuGeneration||0)+1;
        if(this.garageGroup){
          this.sceneTransition?.cancel();
          this.garageGroup.visible=true;
          if(this.courseGroup)this.courseGroup.visible=false;
          this.workbench=environment.id;this.hangarPreview=true;this.presentation='preview';this.workbenchAnchor=environment.garage.anchor;this.menuScene=null;this.setFov(55);this.resetHangarPreview();this.rebuildPost();
          return this.mapReady=Promise.resolve();
        }
        this.sceneTransition ||= new SceneTransition();
        this.mapReady=this.sceneTransition.request('preview:'+environment.id,()=>{
          const group=new THREE.Group();
          return {ready:this.loadGarageModel(group,environment.garage),dispose:()=>disposeObject(group),commit:()=>{
            this.scene.add(group);this.garageGroup=group;group.visible=true;
            if(this.courseGroup)this.courseGroup.visible=false;
            this.workbench=environment.id;this.hangarPreview=true;this.presentation='preview';this.workbenchAnchor=environment.garage.anchor;this.menuScene=null;this.setFov(55);this.resetHangarPreview();this.rebuildPost();
          }};
        });
        return this.mapReady;
      }
      this.sceneTransition ||= new SceneTransition();
      this.mapReady=this.sceneTransition.request('preview:'+environment.id,()=>{
        const draft=this.createPresentationDraft(environment.id,environment.tracks[0].id,'preview',{course:false});
        draft.gates?.forEach(gate=>gate.group.visible=false);
        return {ready:Promise.all([draft.mapReady,this.loadGarageModel(draft.scene,environment.garage).then(group=>{draft.garageGroup=group;})]),dispose:()=>this.disposePresentationDraft(draft),commit:()=>{
          this.commitPresentationDraft(draft);this.workbench=environment.id;this.hangarPreview=true;this.workbenchAnchor=environment.garage.anchor;this.menuScene=null;this.setFov(55);this.resetHangarPreview();
        }};
      });
      this.mapReady.catch(error=>{this.renderWarning=error.message;});return this.mapReady;
    }
    this.setMenuScene(false);this.presentation='preview';this.setFov(55);this.workbenchAnchor=null;
    this.sceneTransition?.cancel();
    if(this.workbench===true) {this.hangarPreview=true;return this.mapReady;}
    releaseMapCollisions(this.map);
    this.removeMissing([]);
    const retired=this.scene;retired.userData.disposed=true;
    if(this.reflectionTask)this.reflectionTask.then(()=>disposeObject(retired),()=>disposeObject(retired));else disposeObject(retired);
    this.reflectionTarget?.dispose();this.reflectionTarget=null;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#182330');
    this.map=null;this.track=null;this.gates=[];this.skyDome=this.sunVisual=this.clouds=null;
    this.sunLight=null;this.sunOffset=null;this.groundReady=this.mapReady=Promise.resolve();
    const key=new THREE.DirectionalLight('#fff1df',3.4);key.position.set(-2,3,4);
    const rim=new THREE.DirectionalLight('#94dfff',2);rim.position.set(3,1,-2);
    this.scene.add(new THREE.HemisphereLight('#d9eaff','#526078',1.6),key,rim);
    this.workbench=true;this.hangarPreview=true;this.rebuildPost();
  }

  async populateMapPreviews(elements) {
    const pending = [...elements];
    for (const img of pending) {const map=MAPS[img.dataset.mapPreview];if(map?.thumbnail)img.src=map.thumbnail;else if(this.mapPreviews.has(img.dataset.mapPreview))img.src=this.mapPreviews.get(img.dataset.mapPreview);}
    if(!pending.some(img=>{const map=MAPS[img.dataset.mapPreview];return map&&!map.model&&!map.thumbnail&&!this.mapPreviews.has(map.id);}))return;
    if (this.generatingPreviews) return;
    const token = ++this.mapPreviewToken;
    this.generatingPreviews = true;
    const preview = new World(document.createElement('div'), true);
    preview.renderer.setPixelRatio(1); preview.renderer.setSize(320, 180); preview.renderer.shadowMap.enabled = false;
    preview.camera.fov = 65; preview.camera.aspect = 16 / 9; preview.camera.updateProjectionMatrix();
    try {
      for (const map of Object.values(MAPS)) {
        if (token !== this.mapPreviewToken) break;
        if (this.mapPreviews.has(map.id)) continue;
        if(map.model || map.thumbnail)continue; // Never download a full custom map for a card.
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (token !== this.mapPreviewToken) break;
        await preview.load(map.id, map.tracks[0].id, {course:false});
        const gate = map.tracks[0].gates[0];
        preview.camera.position.set(gate.position[0] - 20, 13, gate.position[2] - 24);
        preview.camera.lookAt(...gate.position);
        await waitForSceneTextures(preview.scene, () => token !== this.mapPreviewToken);
        if (token !== this.mapPreviewToken) break;
        preview.renderer.render(preview.scene, preview.camera);
        const url = preview.renderer.domElement.toDataURL('image/jpeg', 0.8);
        this.mapPreviews.set(map.id, url);
        document.querySelectorAll('[data-map-preview]').forEach(img => { if (img.dataset.mapPreview === map.id) img.src = url; });
      }
    } finally { disposeObject(preview.scene); preview.renderer.dispose(); this.generatingPreviews = false; }
  }
  cancelMapPreviews() { this.mapPreviewToken = (this.mapPreviewToken || 0) + 1; }
  setFpvTilt(degrees) { this.fpvTilt = THREE.MathUtils.clamp(Number(degrees) || 0, 0, 60); }
  setFov(fov) { this.flightFov=fov;this.camera.fov=this.presentation==='flight'?flightCameraFov(this.cameraMode,fov):fov;this.camera.updateProjectionMatrix(); }
  getStageRect(selector) {
    if (typeof document === 'undefined') return null;
    const el = document.querySelector(selector);
    const cached = this.stageRects?.get(selector);
    if (!el) {
      if (cached?.el) { this.resizeObserver?.unobserve(cached.el); this.stageRects.delete(selector); }
      return null;
    }
    if (cached && cached.el === el && cached.rect.width > 0 && cached.rect.height > 0) return cached.rect;
    if (cached?.el && cached.el !== el) this.resizeObserver?.unobserve(cached.el);
    const rect = el.getBoundingClientRect();
    this.resizeObserver?.observe(el);
    this.stageRects?.set(selector, { el, rect });
    return rect;
  }
  resize() {
    this.stageRects?.clear();
    const containerWidth = this.container.clientWidth, containerHeight = this.container.clientHeight;
    if (!containerWidth || !containerHeight) return;
    const fixed = !this.thumbnail && this.graphics.fixedResolution;
    const [width, height] = fixed || [containerWidth, containerHeight];
    const ratio = fixed ? 1 : this.thumbnail ? this.renderer.getPixelRatio() : renderPixelRatio(width, height, this.graphics, window.devicePixelRatio, this.adaptiveScale || 1);
    if (ratio !== this.renderer.getPixelRatio()) this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.renderer.setViewport(0, 0, width, height); this.renderer.setScissorTest(false);
    this.aoTexture?.setSize(Math.ceil(width*ratio*0.5),Math.ceil(height*ratio*0.5));
    this.shafts?.texture.setSize(Math.ceil(width*ratio*0.25),Math.ceil(height*ratio*0.25));
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.resizeState = [containerWidth, containerHeight, window.devicePixelRatio]; this.needsResize = false;
    this.motionEffect?.history?.reset?.();
  }

  async prepareGraphics() {
    await this.ready; this.resize();
    await this.updateSurfaces();
    const scene=this.scene;
    await this.prepareTextures();
    if(this.scene!==scene||scene.userData.disposed)return;
    await this.compileGraphics({blockRender:true});
    this.render(performance.now());
  }

  async prepareTextures(){
    await this.ready;
    const scene=this.scene;
    this.camera.coordinateSystem=this.renderer.coordinateSystem;this.camera.updateProjectionMatrix();
    this.render(performance.now(),{prepareOnly:true});
    this.graphicsPreparing=(this.graphicsPreparing||0)+1;
    try{this.texturePreparation=await prepareSceneTextures(scene,this.camera,this.renderer,{isCurrent:()=>this.scene===scene&&!scene.userData.disposed,warmAllScenery:true});}
    finally{this.graphicsPreparing--;}
    return this.texturePreparation;
  }

  async compileGraphics({blockRender=true}={}){
    await this.ready;
    const scene=this.scene,camera=this.camera;
    this.camera.coordinateSystem=this.renderer.coordinateSystem;this.camera.updateProjectionMatrix();
    this.render(performance.now(),{prepareOnly:true});
    if(blockRender)this.graphicsPreparing=(this.graphicsPreparing||0)+1;
    const cacheKey=`${this.renderer.backend?.isWebGPUBackend?'wgpu':'webgl'}:${this.scenePass?'post:'+this.postSignature:'direct'}:${this.graphics.shadows?1:0}`;
    try{return await compileScenePrograms(scene,camera,()=>{
      const renderer=this.renderer,target=renderer.getRenderTarget(),mrt=renderer.getMRT();
      try{
        if(this.scenePass){renderer.setRenderTarget(this.scenePass.renderTarget);renderer.setMRT(this.scenePass.getMRT());}
        // r180 renders screen output through a linear offscreen target even on
        // Low. Compiling against the canvas bakes a different output transform
        // and leaves the actual scene pipelines cold for the first frame.
        else{const framebuffer=renderer._getFrameBufferTarget?.();if(framebuffer)renderer.setRenderTarget(framebuffer);}
        return renderer.compileAsync(scene,camera);
      }finally{renderer.setRenderTarget(target);renderer.setMRT(mrt);}
    },{isCurrent:()=>this.scene===scene&&!scene.userData.disposed,cacheKey,renderer:this.renderer});}
    finally{if(blockRender)this.graphicsPreparing--;}
  }

  render(now,{prepareOnly=false}={}) {
    if(this.recovering||this.reflectionBuilding||this.renderFatal) return;
    const size = this.resizeState;
    if (!this.thumbnail && (this.needsResize || !size || size[0] !== this.container.clientWidth || size[1] !== this.container.clientHeight || size[2] !== window.devicePixelRatio)) this.resize();
    this.renderer.info.reset();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    let own = this.drones.get(this.activeDroneId) || null;
    for (const item of this.drones.values()) {
      if(item===this.drones.get('preview')&&(!this.hangarPreview||item.needsPlacement)){item.mesh.visible=false;continue;}
      if (!item.state) continue;
      const state = item.snapshots.length ? interpolateSnapshots(item.snapshots, now - 100) : item.state;
      item.visualPosition.set(...state.position);
      item.visualRotation.set(...state.rotation);
      if (item.own) {
        const t = Math.min(1 / 60, this.predictionRemainder || 0);
        if (state.velocity && !state.grounded) item.visualPosition.addScaledVector(scratchVecA.set(...state.velocity), t);
        if (state.angularVelocity && !state.grounded) {
          const omega = scratchVecA.set(...state.angularVelocity), speed = omega.length();
          if (speed > 0) item.visualRotation.multiply(scratchQuatA.setFromAxisAngle(omega.divideScalar(speed), speed * t));
        }
        if (item.correction) { item.visualPosition.add(item.correction); item.correction.multiplyScalar(Math.exp(-dt / 0.06)); }
        if (item.rotationCorrection) { item.visualRotation.premultiply(item.rotationCorrection); item.rotationCorrection.slerp(scratchQuatIdentity, 1 - Math.exp(-dt / 0.035)); }
      }
      item.mesh.position.copy(item.visualPosition);
      item.mesh.quaternion.copy(item.visualRotation);
      item.mesh.visible = !(item.own && this.cameraMode === 'fpv');
      const rotorVersion = item.mesh.userData.rotorVersion || 0;
      if (item.rotorVersion !== rotorVersion) { item.rotorVersion = rotorVersion; item.rotorNodes = collectRotorNodes(item.mesh); }
      const rotors=rotorTelemetry(state,item.spec),nodes=item.rotorNodes;
      for(let i=0;i<nodes.length;i++){
        const {child,index}=nodes[i],rotor=rotors[index];
        advanceRotor(child,item.mesh,dt*rotor.radiansPerSecond*rotor.direction);
      }
    }
    if (own?.state) {
      const state = { position: own.visualPosition.toArray(), rotation: own.visualRotation.toArray(),crashed:own.state.crashed };
      const obstacles=this.cameraObstacles();
      const forward = rotate(state.rotation, [0, 0, 1]);
      const up = rotate(state.rotation, [0, 1, 0]);
      if (this.cameraMode === 'fpv') {
        const tilt = THREE.MathUtils.degToRad(this.fpvTilt);
        const offset=own.fpvOffset || scratchDefaultFpv;
        const position=scratchVecA.set(...state.position).add(scratchVecB.copy(offset).applyQuaternion(own.visualRotation));
        this.camera.position.copy(constrainCamera(state.position,position,obstacles,cameraNearRadius(this.camera)));
        const target = scratchVecC.copy(this.camera.position).add(scratchVecA.set(...forward).multiplyScalar(Math.cos(tilt) * 12)).add(scratchVecB.set(...up).multiplyScalar(Math.sin(tilt) * 12));
        this.camera.up.set(...up);
        this.camera.lookAt(target);
      } else if(this.cameraMode==='chase-rigid') {
        const shot=rigidCameraShot(state,{memory:own.chaseCamera||={}});
        this.camera.position.copy(constrainCamera(state.position,shot.position,obstacles,cameraNearRadius(this.camera)));
        this.camera.up.copy(shot.up);this.camera.lookAt(shot.target);
      } else {
        const {position, target}=chaseCameraShot(state,own.chaseCamera||={},dt);
        this.camera.position.copy(position);
        this.camera.position.copy(constrainCamera(state.position,this.camera.position,obstacles,cameraNearRadius(this.camera)));
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(target);
      }
    } else if (this.hangarPreview && this.drones.has('preview')) {
      advancePreviewOrbit(this.hangarOrbit, dt);
      const preview = this.drones.get('preview');
      const sphere=preview.previewSphere ||= previewSphere(preview.mesh);
      if(!preview.previewBounds){const box=visibleModelBounds(preview.mesh);preview.previewBounds={min:box.min.toArray(),max:box.max.toArray(),points:previewGeometryPoints(preview.mesh)};}
      const center=sphere?.center || preview.mesh.position;
      preview.previewDiameter=sphere ? sphere.radius*2 : .4;
      const stageRect = this.getStageRect('.hangar-stage');
      const viewport = { width: this.container.clientWidth, height: this.container.clientHeight };
      const stageSize = stageRect?.width > 0 && stageRect?.height > 0 ? stageRect : viewport;
      const shot = samplePreviewOrbit(this.hangarOrbit, center.toArray(), preview.previewDiameter, this.camera.fov, viewport, stageSize, preview.previewBounds,
        {minDistance:Math.max(.18,preview.previewDiameter*.4),maxDistance:2.2,mapBounds:this.map?.bounds});
      this.camera.position.copy(constrainCamera(center,shot.position,this.cameraObstacles(),.06));
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(center);
      if (stageRect) {
        const targetY = (stageRect.top + stageRect.height / 2) / this.container.clientHeight;
        const targetX = (stageRect.left + stageRect.width / 2) / this.container.clientWidth;
        this.camera.setViewOffset(this.container.clientWidth, this.container.clientHeight, (0.5 - targetX) * this.container.clientWidth, (0.5 - targetY) * this.container.clientHeight, this.container.clientWidth, this.container.clientHeight);
      }
    } else if (this.menuScene) {
      const shot = sampleMenuCameraShot(this.menuScene.shot, (now - this.menuScene.started) / 1000, this.menuReducedMotion||this.menuScene.kind==='home');
      this.camera.position.set(...shot.position);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(...shot.target);
      const bounds = this.getStageRect('.menu-world-stage');
      const targetX = bounds?.width > 0 ? (bounds.left + bounds.width / 2) / this.container.clientWidth : this.menuScene.kind === 'home' ? 0.64 : 0.56;
      const targetY = bounds?.height > 0 ? (bounds.top + bounds.height / 2) / this.container.clientHeight : 0.52;
      this.camera.setViewOffset(this.container.clientWidth, this.container.clientHeight, (0.5 - targetX) * this.container.clientWidth, (0.5 - targetY) * this.container.clientHeight, this.container.clientWidth, this.container.clientHeight);
    } else if (this.inspectionCamera) {
      this.camera.position.fromArray(this.inspectionCamera.position);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(...this.inspectionCamera.target);
    } else {
      this.camera.position.set(0, 9, -22);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(0, 3, 10);
    }
    if (!this.hangarPreview && !this.menuScene) this.camera.clearViewOffset();
    const hero=this.drones.get('home-drone');
    if(hero){
      hero.mesh.visible=this.menuScene?.kind==='home';
      if(hero.mesh.visible){
        const area=this.getStageRect('.menu-world-stage');
        const viewport={width:this.container.clientWidth,height:this.container.clientHeight};
        const distance=previewCameraDistance((hero.sphere?.radius||.2)*2,this.camera.fov,viewport,area?.width?area:viewport)*.82;
        hero.mesh.quaternion.copy(this.camera.quaternion).multiply(scratchHeroRot);
        hero.mesh.position.copy(this.camera.position).addScaledVector(this.camera.getWorldDirection(scratchVecA),distance);
        if(hero.sphere)hero.mesh.position.sub(scratchVecB.copy(hero.sphere.center).applyQuaternion(hero.mesh.quaternion));
      }
    }
    this.updateHomeLight();
    if(this.sunLight && this.sunOffset && this.graphics.shadows) {
      const center = scratchVecA.set(Math.round(this.camera.position.x/48)*48, 0, Math.round(this.camera.position.z/48)*48);
      if(this.shadowCenter.distanceToSquared(center)>1) {
        this.shadowCenter.copy(center); this.sunLight.target.position.copy(center);
        this.sunLight.position.copy(center).add(this.sunOffset);
        this.sunLight.target.updateMatrixWorld(); this.sunLight.shadow.needsUpdate=true;
      }
    }
    if (this.skyDome) this.skyDome.position.copy(this.camera.position);
    if(this.sunVisual && this.sunDirection) this.sunVisual.position.copy(this.camera.position).addScaledVector(this.sunDirection,450);
    if(this.shafts && this.sunVisual) {
      const projected=scratchVecA.copy(this.sunVisual.position).project(this.camera);
      const front=this.sunDirection.dot(this.camera.getWorldDirection(scratchVecB))>0;
      this.shafts.position.value.set(projected.x*0.5+0.5,0.5-projected.y*0.5);
      this.shafts.aspect.value=this.camera.aspect; this.shafts.tint.value.set(this.map.sun);
      this.shafts.strength.value=front && Math.abs(projected.x)<1.3 && Math.abs(projected.y)<1.3 ? 0.7 : 0;
    }
    updateVisualLODs(this.scene, this.camera, { low: this.graphics.lodMinimum===1||this.graphics.quality === 'low', distanceScale:this.graphics.lodDistanceScale });
    if(this.hangarPreview){const preview=this.drones.get('preview');if(preview)updateVisualLODs(preview.mesh,this.camera,{preview:true});}
    if(prepareOnly||this.graphicsPreparing)return;
    this.motionEffect?.update(now, this.renderer.domElement.width, this.renderer.domElement.height);
    const result=renderFrame({post:this.post?()=>this.post.render():null,direct:()=>this.renderer.render(this.scene,this.camera),reset:()=>{
      this.post?.dispose();this.post=null;this.motionEffect=null;
      this.renderer.setRenderTarget(null);this.renderer.setMRT(null);
      this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    }});
    if(result.postError)this.renderWarning='Post effect disabled: '+result.postError.message;
    if(result.ok){if(this.menuScene?.loaded){this.menuScene.rendered=true;this.onMenuFrame?.(this.menuScene);}return;}
    if(this.menuScene)this.menuScene.rendered=false;
    this.onRenderFailure?.(result.error);
    if(this.renderer.backend?.isWebGLBackend){this.renderFatal=true;this.renderWarning='Graphics unavailable: '+result.error.message;return;}
    this.recoverRenderer(result.error.message).catch(error=>{this.renderFatal=true;this.renderWarning=error.message;});
  }

  adjustPerformance(fps) {
    if(this.presentation!=='flight'||this.hangarPreview||this.menuScene||performance.now()<(this.performanceWarmUntil||0))return;
    if(document.hidden || this.graphics.fixedResolution || !this.graphics.adaptiveResolution || !fps || fps<5 || this.recovering) return;
    const minScale=this.graphics.quality==='ultra'?0.92:this.graphics.quality==='high'?0.82:0.6;
    const lowThreshold=this.graphics.quality==='ultra'?34:this.graphics.quality==='high'?42:48;
    const previous=this.adaptiveScale||1, next=THREE.MathUtils.clamp(previous+(fps<lowThreshold?-0.05:fps>55?0.02:0),minScale,1);
    if(Math.abs(next-previous)<0.01) return;
    this.adaptiveScale=next;
    const width=this.container.clientWidth||320,height=this.container.clientHeight||180;
    this.renderer.setPixelRatio(renderPixelRatio(width,height,this.graphics,window.devicePixelRatio,next)); this.resize();
  }

  startAnimation(callback) { this.animationCallback=callback;this.renderer.setAnimationLoop(callback); }

  async recoverRenderer(reason) {
    if(this.recovering || this.thumbnail) return;
    this.recovering=true; this.renderWarning=reason+'; using WebGL2 without post effects.';
    const previous=this.renderer;
    let next;
    try {
      this.onRendererRecovery?.('starting',reason);
      next=new WebGPURenderer({forceWebGL:true,antialias:false,powerPreference:'high-performance'});
      await next.init();
      repairTextureBindings(next);
      previous.setAnimationLoop(null);
      this.renderer=next;
      try{this.post?.dispose();}catch{}this.post=null;
      previous.domElement.remove(); this.container.appendChild(this.renderer.domElement);
      this.renderer.domElement.style.width='100%';this.renderer.domElement.style.height='100%';
      this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=this.graphics.exposure;
      this.renderer.shadowMap.enabled=this.graphics.shadows;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      this.renderer.info.autoReset=false; this.resize();
      this.renderFatal=false;
      if(this.animationCallback)await this.renderer.setAnimationLoop(this.animationCallback);
      try{previous.dispose();}catch{}
      this.onRendererRecovery?.('ready');
    } catch(error) {
      if(this.renderer!==next)next?.dispose();
      this.onRendererRecovery?.('failed',error.message);throw error;
    } finally { this.recovering=false; }
  }
}

async function waitForSceneTextures(scene, cancelled = () => false) {
  const textures=[]; scene.traverse(o=>{for(const mat of Array.isArray(o.material)?o.material:[o.material]) if(mat?.map) textures.push(mat.map);});
  const started=performance.now();
  while(!cancelled() && textures.some(t=>!t.image || (t.image.complete===false)) && performance.now()-started<5000) await new Promise(resolve=>setTimeout(resolve,40));
}
