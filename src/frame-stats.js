export class FrameStats {
  constructor() { this.start = 0; this.frames = 0; this.fps = 0; this.frameMs = 0; this.cpuMs = 0; }
  update(now, cpuMs) {
    const gap=this.last?now-this.last:0;this.last=now;
    if(gap>250){this.start=now;this.frames=0;return;}
    if(typeof document!=='undefined' && document.hidden){this.start=now;this.frames=0;return;}
    if (!this.start) this.start = now;
    this.frames++;
    this.cpuMs += (cpuMs - this.cpuMs) * 0.1;
    if (now - this.start >= 500) {
      this.fps = Math.round(this.frames * 1000 / (now - this.start));
      this.frameMs = (now - this.start) / this.frames;
      this.frames = 0; this.start = now;
    }
  }
}
