export class RateLimiter {
  constructor(windowMs, limit) {
    this.windowMs = windowMs;
    this.limit = limit;
    this.entries = new Map();
  }

  allow(key, now = Date.now()) {
    const previous = this.entries.get(key);
    const entry = previous && now < previous.resetAt ? previous : { count: 0, resetAt: now + this.windowMs };
    entry.count++;
    this.entries.set(key, entry);
    return entry.count <= this.limit ? { allowed: true, retryAfter: 0 } : { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  prune(now = Date.now()) {
    for (const [key, entry] of this.entries) if (now >= entry.resetAt) this.entries.delete(key);
  }
}

export function clientAddress(request, trustProxy = false) {
  if (trustProxy) {
    const forwarded = request.headers['x-forwarded-for'];
    const first = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '';
    if (first) return first;
  }
  return request.socket.remoteAddress || 'unknown';
}
