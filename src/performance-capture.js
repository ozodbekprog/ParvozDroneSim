import { PerformanceRun } from './performance-report.js';
import { GRAPHICS_PRESETS } from './graphics-settings.js';

export class PerformanceCapture {
  constructor(world, notify) {
    this.world = world; this.notify = notify; this.run = null; this.report = null;
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.run) this.run.invalidReasons.add('Tab became hidden'); });
    window.addEventListener('blur', () => { if(this.run)this.run.invalidReasons.add('Document lost focus'); });
  }
  start(metadata) {
    if (this.run) return;
    this.previous = { ...this.world.graphics };
    this.world.setGraphics({ ...GRAPHICS_PRESETS.low, quality: 'low', adaptiveResolution: false, fixedResolution: [1280, 720] });
    this.world.resize();
    const backend = this.world.renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
    this.run = new PerformanceRun({ metadata: { ...metadata, backend, framebuffer: [1280,720], quality: 'low', adaptiveResolution: false,
      userAgent: navigator.userAgent, textureMiB: null, textureBudgetVerified: false } });
    this.notify('Low 1280×720 capture: fly for 30 seconds warmup + 3 minutes. F4 stops early. F6 downloads the report.');
  }
  update(now, { flying, cpuMs, map, track }) {
    if (!this.run) return;
    if (!flying) this.run.invalidReasons.add('Flight was paused or ended');
    if (map !== this.run.metadata.map || track !== this.run.metadata.track) this.run.invalidReasons.add('Map or course changed');
    const backend = this.world.renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
    if (backend !== this.run.metadata.backend) this.run.invalidReasons.add('Renderer backend changed');
    const info = this.world.renderer.info.render;
    if (this.world.graphics.quality !== 'low') this.run.invalidReasons.add('Graphics preset changed');
    if (!Number.isFinite(info.triangles) || !Number.isFinite(info.drawCalls ?? info.calls)) this.run.invalidReasons.add('Renderer counters unavailable');
    this.run.update(now, { hidden: document.hidden, focused: document.hasFocus(), width: this.world.renderer.domElement.width, height: this.world.renderer.domElement.height,
      adaptiveResolution: !!this.world.graphics.adaptiveResolution, cpuMs, triangles: info.triangles, drawCalls: info.drawCalls ?? info.calls });
    if (this.run.complete) this.finish();
  }
  finish() {
    if (!this.run) return;
    this.report = { ...this.run.result(), frames: this.run.samples };
    this.finishedAt=performance.now();
    this.run = null;
    this.world.setGraphics({ ...this.previous, fixedResolution: this.previous.fixedResolution || null }); this.world.resize();
    this.notify(this.report.valid ? 'Performance report ready. F6 downloads it; target hardware still needs confirmation.' : 'Capture ended with invalid conditions. F6 downloads the diagnostic report.');
  }
  download() {
    if (!this.report) return this.notify('No report yet. Start a flight and press F4.');
    const url = URL.createObjectURL(new Blob([JSON.stringify(this.report, null, 2)], {type:'application/json'}));
    const link = document.createElement('a'); link.href=url; link.download=`parvoz-drone-sim-low-720p-${Date.now()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
