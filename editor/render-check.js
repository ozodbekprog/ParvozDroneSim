import { RenderTarget, UnsignedByteType } from 'three';
import { World } from '../src/world.js';
import { GRAPHICS_PRESETS } from '../src/graphics-settings.js';
import { installCatalog, MAPS } from '../shared/catalog.js';
import { resolveBuild, createDroneState } from '../shared/physics.js';
import { FrameStats } from '../src/frame-stats.js';

const status = document.querySelector('#status'), results = document.querySelector('#results');
const mapSelect = document.querySelector('#map'), ao = document.querySelector('#ao'), motion = document.querySelector('#motion');
const world = new World(document.querySelector('#view'), false, { forceWebGL: new URLSearchParams(location.search).get('backend') === 'webgl' });
let checking = false;
function applyEffects(quality = 'custom') {
  world.setGraphics({ ...GRAPHICS_PRESETS.high, quality, resolution: 0.8, adaptiveResolution: false, ambientOcclusion: ao.checked, motionBlur: motion.checked });
}
async function loadMap() {
  results.textContent = '';
  const map = MAPS[mapSelect.value];
  await world.load(map.id, map.tracks[0].id);
  world.removeMissing([]);
  world.upsertDrone('check', resolveBuild(), createDroneState(map.tracks[0].spawn.position, map.tracks[0].spawn.yaw), true);
  applyEffects();
}
// Reuse the actual World, scene, materials and renderer across transitions. Read
// the GPU output so a silently black frame fails without a JS exception.
async function checkSwitching() {
  if (checking) return;
  checking = true;
  mapSelect.disabled = ao.disabled = motion.disabled = document.querySelector('#cycle').disabled = true;
  const target = new RenderTarget(96, 64, { type: UnsignedByteType, depthBuffer: false });
  const lines = [];
  let baseline;
  try {
    for (const [blur, occlusion, quality] of [[false,false,'custom'], [true,true,'ultra'], [true,false,'custom'], [false,false,'custom'], [false,true,'custom'], [true,true,'ultra'], [false,false,'custom']]) {
      motion.checked = blur; ao.checked = occlusion; applyEffects(quality);
      const device = world.renderer.backend.device;
      device?.pushErrorScope('validation');
      for (let frame = 0; frame < 4; frame++) { world.render(performance.now()); await new Promise(requestAnimationFrame); }
      world.renderer.setRenderTarget(target);
      try { world.render(performance.now()); } finally { world.renderer.setRenderTarget(null); world.renderer.setMRT(null); }
      const pixels = await world.renderer.readRenderTargetPixelsAsync(target, 0, 0, 96, 64);
      let brightness = 0;
      for (let i = 0; i < pixels.length; i += 4) brightness += pixels[i] + pixels[i+1] + pixels[i+2];
      brightness /= pixels.length / 4 * 3;
      const error = await device?.popErrorScope();
      if (!baseline) baseline = pixels.slice();
      let difference = 0;
      if (blur && !occlusion) {
        for (let i = 0; i < pixels.length; i += 4) for (let channel = 0; channel < 3; channel++) difference += Math.abs(pixels[i+channel] - baseline[i+channel]);
        difference /= pixels.length / 4 * 3;
      }
      const pass = brightness > 2 && difference < 0.75 && !error && !world.renderWarning;
      lines.push(`${pass ? 'PASS' : 'FAIL'} · ${MAPS[mapSelect.value].name} · blur ${blur} · AO ${occlusion} · brightness ${brightness.toFixed(1)}${blur && !occlusion ? ' · stationary pixel difference ' + difference.toFixed(3) : ''}${error ? ' · ' + error.message : ''}${world.renderWarning ? ' · ' + world.renderWarning : ''}`);
      results.textContent = lines.join('\n');
    }
  } catch (error) { results.textContent = lines.join('\n') + '\nFAIL · ' + error.message; }
  finally { target.dispose(); checking = false; mapSelect.disabled = ao.disabled = motion.disabled = document.querySelector('#cycle').disabled = false; }
}
try {
  installCatalog(await fetch('/editor-api/catalog').then(response => response.json())); await world.ready;
  for (const map of Object.values(MAPS)) mapSelect.add(new Option(map.name, map.id));
  const requestedMap = new URLSearchParams(location.search).get('map');
  mapSelect.value = MAPS[requestedMap] ? requestedMap : Object.values(MAPS).find(map => map.theme === 'ruins').id;
  await loadMap();
  mapSelect.addEventListener('change', loadMap);
  ao.addEventListener('change', applyEffects); motion.addEventListener('change', applyEffects);
  document.querySelector('#cycle').addEventListener('click', checkSwitching);
  const stats = new FrameStats();
  world.startAnimation(now => {
    if (checking) return;
    const start = performance.now(); world.render(now); stats.update(now, performance.now() - start);
    if (Math.floor(now / 500) !== world.checkTick) {
      world.checkTick = Math.floor(now / 500);
      status.textContent = `${world.renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2'} · ${stats.fps} FPS · ${stats.frameMs.toFixed(1)} ms/frame${world.renderWarning ? ' · ' + world.renderWarning : ''}`;
    }
  });
} catch (error) { status.textContent = 'Failed: ' + error.message; }
