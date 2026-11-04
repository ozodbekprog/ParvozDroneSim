export class SampleWindow {
  constructor(size = 600) {
    this.size = size;
    this.samples = [];
  }

  add(value) {
    this.samples.push(value);
    if (this.samples.length > this.size) this.samples.shift();
  }

  percentile(fraction) {
    if (!this.samples.length) return 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
  }

  clear() { this.samples.length = 0; }
}
