const KEY = 'liftoff-graphics-v1';
import { automaticGraphicsPreset, graphicsHardware } from './automatic-graphics.js';
let automaticPreset;
export async function initializeAutomaticGraphics(renderer){automaticPreset=automaticGraphicsPreset(await graphicsHardware(renderer));return readGraphics();}
const surfacePresets={low:{reflections:false,normalMaps:false,textureSize:256,lodDistanceScale:.75,anisotropy:1},medium:{reflections:true,normalMaps:true,textureSize:512,lodDistanceScale:1,anisotropy:4},high:{reflections:true,normalMaps:true,textureSize:1024,lodDistanceScale:1.5,anisotropy:8},ultra:{reflections:true,normalMaps:true,textureSize:0,lodDistanceScale:2,anisotropy:8}};
export const GRAPHICS_PRESETS = {
  low: { resolution: 0.65, shadows: false, antialiasing: false, ambientOcclusion: false, bloom: false, sunShafts: false, clouds: false, exposure: 1.2, motionBlur: false },
  medium: { resolution: 0.85, shadows: true, antialiasing: true, ambientOcclusion: false, bloom: false, sunShafts: true, clouds: true, exposure: 1.3, motionBlur: false },
  high: { resolution: 1, shadows: true, antialiasing: true, ambientOcclusion: true, bloom: true, sunShafts: true, clouds: true, exposure: 1.35, motionBlur: false },
  ultra: { resolution: 1, shadows: true, antialiasing: true, ambientOcclusion: true, bloom: true, sunShafts: true, clouds: true, exposure: 1.4, motionBlur: false }
};
for(const [quality,values] of Object.entries(surfacePresets))Object.assign(GRAPHICS_PRESETS[quality],values);
for(const [quality,values] of Object.entries(GRAPHICS_PRESETS))values.lodMinimum=quality==='low'?1:0;
export function normalizeSurfaceSettings(settings){
  const resolution=Number(settings.resolution);
  return {...settings,resolution:Number.isFinite(resolution)?Math.max(.3,Math.min(1.25,resolution)):1,lodMinimum:settings.lodMinimum===1||settings.quality==='low'?1:0,lodDistanceScale:Math.max(.25,Math.min(4,Number(settings.lodDistanceScale)||1)),textureSize:[0,256,512,1024,2048].includes(Number(settings.textureSize))?Number(settings.textureSize):512,anisotropy:[1,2,4,8,16].includes(Number(settings.anisotropy))?Number(settings.anisotropy):1,reflections:settings.reflections!==false,normalMaps:settings.normalMaps!==false};
}

export function readGraphics() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* Restore defaults. */ }
  const quality = ['auto', 'low', 'medium', 'high', 'ultra', 'custom'].includes(saved.quality) ? saved.quality : 'auto';
  const automatic = automaticPreset || (/Android|iPhone|iPad/i.test(globalThis.navigator?.userAgent||'') ? 'low' : 'medium');
  const base = GRAPHICS_PRESETS[quality === 'auto' || quality === 'custom' ? automatic : quality];
  return normalizeSurfaceSettings({ adaptiveResolution: true, ...base, ...(quality==='auto'?{}:saved), quality,automaticPreset:automatic });
}

export function saveGraphics(patch) {
  const next = normalizeSurfaceSettings({ ...readGraphics(), ...patch });
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function selectGraphicsPreset(quality) {
  if (quality === 'auto') {
    localStorage.removeItem(KEY);
    return readGraphics();
  }
  return saveGraphics({ ...GRAPHICS_PRESETS[quality], quality });
}

export function selectRenderResolution(resolution) {
  return saveGraphics({ resolution, adaptiveResolution: false, quality: 'custom' });
}
