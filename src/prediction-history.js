// Snapshots describe a past command, never the client's current frame.
export function samePhysicsState(a, b) {
  if (!a || !b) return false;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[key], y = b[key];
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length || x.some((value, i) => !Number.isFinite(value) || Math.abs(value - y[i]) > 1e-6)) return false;
    } else if (typeof x === 'number' && typeof y === 'number') {
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x - y) > 1e-6) return false;
    } else if (x !== y) return false;
  }
  return true;
}

export class PredictionHistory {
  constructor() { this.entries = []; this.ack = 0; this.confirmed = null; }
  reset(state, seq = 0) { this.entries = []; this.ack = seq; this.confirmed = structuredClone(state); }
  record(command, state) {
    if (this.entries.length >= 240) return false;
    this.entries.push({ command, state: structuredClone(state) });
    return true;
  }
  accept(authoritative, seq, current, simulate) {
    if (seq < this.ack) return { state: current, corrected: false };
    const entry = this.entries.find(item => item.command.seq === seq);
    const past = entry?.state || (seq === this.ack ? this.confirmed : null);
    const matches = samePhysicsState(past, authoritative);
    this.entries = this.entries.filter(item => item.command.seq > seq);
    this.ack = seq; this.confirmed = structuredClone(authoritative);
    if (matches) return { state: current, corrected: false };
    const state = structuredClone(authoritative);
    for (const item of this.entries) { simulate(state, item.command); item.state = structuredClone(state); }
    return { state, corrected: true };
  }
}
