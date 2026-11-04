export function playerLimit(value = '100') {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('MAX_MULTIPLAYER_PLAYERS must be an integer from 1 to 100.');
  return limit;
}

/** Authenticated network clients reserve a slot, including the queue and lobby. */
export class Admission {
  constructor(limit) { this.limit = limit; this.clients = new Map(); }
  acquire(socket, playerId) {
    if (this.clients.has(socket)) return this.clients.get(socket) === playerId ? null : 'ALREADY_AUTHENTICATED';
    if ([...this.clients.values()].includes(playerId)) return 'PILOT_ONLINE';
    if (this.clients.size >= this.limit) return 'SERVER_FULL';
    this.clients.set(socket, playerId);
    return null;
  }
  release(socket) { this.clients.delete(socket); }
  view() { return { online: this.clients.size, limit: this.limit, available: Math.max(0, this.limit - this.clients.size) }; }
}
