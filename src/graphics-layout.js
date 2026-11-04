import {GRAPHICS_PRESETS} from './graphics-settings.js';
import {readableLabel} from './ui-design.js';
const toggle=(settings,key,label)=>`<label class="graphics-toggle"><span>${label}</span><input data-graphic="${key}" type="checkbox" ${settings[key]?'checked':''}/></label>`;
export function graphicsPanel(settings) {
  return `<div class="graphics-sections"><section class="graphics-section"><h3>Display</h3>
    <div class="fullscreen-setting"><label class="graphics-toggle"><span>Fullscreen</span><input id="fullscreen-toggle" type="checkbox"/></label><small id="fullscreen-status" role="status"></small></div>
    <div class="render-resolution-setting"><label for="graphics-resolution">Render resolution <strong id="resolution-value">${Math.round(settings.resolution*100)}%</strong></label><input id="graphics-resolution" type="range" min="30" max="125" step="1" value="${Math.round(settings.resolution*100)}" aria-describedby="resolution-help"/><div class="resolution-presets" role="group" aria-label="Render resolution presets">${[30,50,75,100].map(value=>`<button type="button" data-resolution="${value}" aria-pressed="${Math.round(settings.resolution*100)===value}">${value}%</button>`).join('')}</div><small id="resolution-help">Lower values reduce 3D detail and GPU load. Menus stay sharp. Manual changes turn adaptive resolution off.</small><output id="resolution-size"></output></div>
    ${toggle(settings,'adaptiveResolution','Adaptive resolution')}
    </section><section class="graphics-section"><h3>Scene quality</h3>
    <div class="graphics-presets" role="group" aria-label="Graphics quality">${['auto',...Object.keys(GRAPHICS_PRESETS)].map(name=>`<button data-preset="${name}" class="${settings.quality===name?'selected':''}" aria-pressed="${settings.quality===name}">${readableLabel(name.toUpperCase())}</button>`).join('')}</div><span id="graphics-quality-status" role="status">${settings.quality==='custom'?'Custom settings':''}</span>
    <label class="graphics-value">LOD distance <strong id="lod-value">${settings.lodDistanceScale.toFixed(2)}×</strong><input id="graphics-lod" type="range" min="25" max="400" value="${Math.round(settings.lodDistanceScale*100)}"/><small>Higher values keep detail farther away.</small></label>
    <label class="graphics-value">Texture size<select id="graphics-textures">${[256,512,1024,2048,0].map(size=>`<option value="${size}" ${size===settings.textureSize?'selected':''}>${size?size+' px maximum':'Original size'}</option>`).join('')}</select><small>Limited by the imported source; lower sizes reduce GPU memory.</small></label>
    ${toggle(settings,'normalMaps','Surface detail')}
    </section><section class="graphics-section"><h3>Lighting and effects</h3>
    <label class="graphics-value">Exposure <strong id="exposure-value">${settings.exposure.toFixed(2)}</strong><input id="graphics-exposure" type="range" min="70" max="180" value="${Math.round(settings.exposure*100)}"/></label>
    <div class="graphics-switches">${[['reflections','Reflections'],['shadows','Shadows'],['antialiasing','Antialiasing'],['ambientOcclusion','Ambient occlusion'],['bloom','Bloom'],['sunShafts','Sun shafts'],['clouds','Clouds'],['motionBlur','Motion blur']].map(([key,label])=>toggle(settings,key,label)).join('')}</div>
    </section></div><div class="diagnostic-actions"><button class="button" data-action="diagnostics">Performance diagnostics</button></div><output id="graphics-performance" class="auth-note"></output><p id="graphics-warning" class="auth-note" role="status"></p>`;
}
