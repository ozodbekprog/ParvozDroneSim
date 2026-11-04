import {materialTextures} from './material-resources.js';
import {timingInvalidReasons} from './timing-conditions.js';
export const LOW_BUDGET = Object.freeze({ width: 1280, height: 720, medianMs: 16.7, onePercentLow: 50, triangles: 300000, drawCalls: 250, textureMiB: 256 });

/** Resident texture estimate, deduplicated across materials and LODs. Excludes render targets/driver overhead. */
export function estimateTextureMemory(root) {
  const seen = new Set(); let bytes = 0, unknown = 0;
  root.traverse(object => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      for (const texture of materialTextures(material)) {
        if (!texture?.isTexture || texture.isRenderTargetTexture || seen.has(texture)) continue;
        seen.add(texture);
        if (texture.isCompressedTexture && texture.mipmaps?.length) {
          bytes += texture.mipmaps.reduce((sum, mip) => sum + (mip.data?.byteLength || 0), 0);
        } else {
          const image = texture.image, width = image?.width, height = image?.height;
          if (!width || !height) { unknown++; continue; }
          // Conservative RGBA8 estimate for ordinary material images.
          const texelBytes = image.data?.BYTES_PER_ELEMENT ? image.data.byteLength / (width * height) : 4;
          let w = width, h = height;
          do { bytes += w * h * texelBytes; if (!texture.generateMipmaps || (w === 1 && h === 1)) break; w=Math.max(1,Math.floor(w/2));h=Math.max(1,Math.floor(h/2)); } while (true);
        }
      }
    }
  });
  return { bytes, mib:bytes/1048576, textures:seen.size, unknown, includesDriverOverhead:false };
}

export function summarizeFrames(samples) {
  const frames = samples.filter(sample => Number.isFinite(sample.ms) && sample.ms > 0);
  if (!frames.length) return null;
  const sorted = frames.map(frame => frame.ms).sort((a, b) => a - b);
  const medianMs = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const slowest = sorted.slice(-Math.max(1, Math.ceil(sorted.length * .01)));
  const elapsedMs = sorted.reduce((sum, ms) => sum + ms, 0);
  const peak = key => Math.max(...frames.map(frame => frame[key] || 0));
  return { frames: frames.length, elapsedMs, meanFps: frames.length * 1000 / elapsedMs, medianMs,
    p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], p99Ms: sorted[Math.ceil(sorted.length * .99) - 1],
    onePercentLow: 1000 / (slowest.reduce((sum, ms) => sum + ms, 0) / slowest.length),
    maxFrameMs: sorted.at(-1), framesOver50Ms: sorted.filter(ms => ms > 50).length,
    peakTriangles: peak('triangles'), peakDrawCalls: peak('drawCalls'), peakTextureMiB:peak('textureMiB'), textureMemoryMeasured:frames.every(frame=>Number.isFinite(frame.textureMiB)), meanCpuMs: frames.reduce((sum, frame) => sum + (frame.cpuMs || 0), 0) / frames.length };
}

/** Unlike the HUD, acceptance measurements retain stutters. Hidden tabs invalidate a run. */
export class PerformanceRun {
  constructor({ warmupMs = 30000, durationMs = 180000, metadata = {} } = {}) {
    this.warmupMs = warmupMs; this.durationMs = durationMs; this.metadata = metadata;
    this.samples = []; this.invalidReasons = new Set(); this.started = null; this.last = null; this.complete = false;
  }
  update(now, { hidden = false, focused = true, width, height, adaptiveResolution = false, ...sample } = {}) {
    if (this.complete) return;
    if (this.started === null) this.started = now;
    for(const reason of timingInvalidReasons({hidden,focused,width,height,adaptiveResolution}))this.invalidReasons.add(reason);
    const measuring = now - this.started >= this.warmupMs;
    if (measuring && this.last !== null && this.last - this.started >= this.warmupMs) this.samples.push({ ...sample, ms: now - this.last });
    this.last = now;
    this.complete = now - this.started >= this.warmupMs + this.durationMs;
  }
  result() {
    const summary = summarizeFrames(this.samples);
    const valid = this.complete && this.invalidReasons.size === 0 && !!summary;
    return { schemaVersion: 1, ...this.metadata, targetHardwareVerified: false, complete: this.complete, valid,
      invalidReasons: [...this.invalidReasons], warmupMs: this.warmupMs, durationMs: this.durationMs, summary,
      meetsFrameBudget: valid && summary.medianMs <= LOW_BUDGET.medianMs && summary.onePercentLow >= LOW_BUDGET.onePercentLow,
      meetsGeometryBudget: valid && summary.peakTriangles <= LOW_BUDGET.triangles && summary.peakDrawCalls <= LOW_BUDGET.drawCalls,
      meetsTextureBudget: valid && summary.textureMemoryMeasured ? summary.peakTextureMiB <= LOW_BUDGET.textureMiB : null };
  }
}
