import WebSocket from 'ws';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { NETWORK_PROTOCOL, roomPreparationKey } from '../shared/network-flight.js';
import { DEFAULT_FLIGHT_CONTROLLER } from '../shared/flight-controller.js';

export function loadOptions(args, defaultClients = 100) {
  const raw = Object.fromEntries(args.map(value => {
    const [key, ...parts] = value.replace(/^--/, '').split('='); return [key, parts.join('=') || true];
  }));
  const integer = (key, fallback, min, max) => {
    const value = Number(raw[key] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`--${key} must be ${min}–${max}.`);
    return value;
  };
  const base = new URL(String(raw.url || process.env.BASE_URL || 'http://127.0.0.1:2567'));
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Use an HTTP(S) URL without credentials.');
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('Remote capacity tests require HTTPS.');
  return { base: base.origin, count: integer('clients', defaultClients, 2, 100), seconds: integer('seconds', 3600, 10, 7200),
    roomSize: integer('room-size', 8, 2, 8), maps: String(raw.maps || raw.map || 'hangar').split(','), track: raw.track,
    coldAssets: !!raw['cold-assets'], report: raw.report && String(raw.report) };
}

export async function runLoadTest(options) {
  const clients = [], groups = [];
  let errors = 0, disconnects = 0, finishing = false, started = 0, startedAt, inputTimer, pingTimer, healthTimer;
  const failures = new Set(), assetResults = [];
  const abort = new AbortController();
  const request = async (path, init = {}, timeoutMs = 15000) => {
    const response = await fetch(new URL(path, options.base), { ...init, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(timeoutMs)]) });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
    return response;
  };
  const send = (client, message) => { if (client.socket.readyState === WebSocket.OPEN) client.socket.send(JSON.stringify(message)); };
  function waitFor(client, predicate, label, timeoutMs = 20000) {
    const existing = client.messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const listener = message => { if (predicate(message)) { clearTimeout(timer); client.listeners.delete(listener); resolve(message); } };
      const timer = setTimeout(() => { client.listeners.delete(listener); reject(new Error(`Client ${client.index}: ${label} timed out.`)); }, timeoutMs);
      client.listeners.add(listener);
    });
  }
  async function makeClient() {
    const guest = await (await request('/api/guest', { method: 'POST' })).json();
    const socket = new WebSocket(options.base.replace(/^http/, 'ws') + '/socket', { handshakeTimeout: 15000 });
    const client = { index: clients.length, socket, id: guest.user.id, messages: [], listeners: new Set(), seq: 0, resetId: null,
      lastAck: 0, acked: 0, sent: 0, snapshots: 0, movingSnapshots: 0, rtts: [], maxAckGapMs: 0, lastAckAt: performance.now(), resets: 0 };
    clients.push(client);
    socket.on('error', () => { if (!finishing) { errors++; failures.add(`Client ${client.index}: socket error`); } });
    socket.on('close', () => { if (!finishing) disconnects++; });
    socket.on('pong', () => { if (client.pingAt) { client.rtts.push(performance.now() - client.pingAt); client.pingAt = 0; } });
    socket.on('message', bytes => {
      const message = JSON.parse(String(bytes));
      if (message.type === 'error') { errors++; failures.add(message.error); }
      if (message.type === 'room') {
        client.room = message.room;
        if (message.room.status === 'countdown') { client.finished = false; client.lastAckAt = performance.now(); }
        if (message.room.status === 'ended' && client.group?.host === client) send(client, { type: 'restart' });
      }
      if (message.type === 'finish' && message.id === client.id) client.finished = true;
      if (message.type === 'input-stalled') send(client, { type: 'request-resync', resetId: client.resetId });
      if (message.type === 'input-resync') { client.resetId = message.resetId; client.seq = message.seq || 0; client.lastAck = 0; client.resets++; }
      if (message.type === 'snapshot') {
        const own = message.players.find(player => player.id === client.id);
        if (own) {
          if (client.resetId !== own.resetId) { client.resetId = own.resetId; client.seq = own.seq || 0; client.lastAck = own.seq || 0; }
          if (started && client.room?.status === 'running') {
            client.snapshots++;
            if (client.position && Math.hypot(...own.state.position.map((value, i) => value - client.position[i])) > 0.01) client.movingSnapshots++;
            client.position = own.state.position;
          }
          if (own.seq > client.lastAck) {
            if (started) {
              client.acked += own.seq - client.lastAck;
              client.maxAckGapMs = Math.max(client.maxAckGapMs, performance.now() - client.lastAckAt);
            }
            client.lastAck = own.seq; client.lastAckAt = performance.now();
          }
        }
      }
      client.messages.push(message); if (client.messages.length > 30) client.messages.shift();
      for (const listener of [...client.listeners]) listener(message);
    });
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    send(client, { type: 'auth', token: guest.token, protocol: NETWORK_PROTOCOL });
    await waitFor(client, message => message.type === 'authenticated' || message.type === 'error', 'authentication');
    if (errors) throw new Error([...failures].join('; '));
    return client;
  }
  const p95 = values => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.ceil(sorted.length * .95) - 1]; };
  try {
    const catalog = await (await request('/api/catalog')).json();
    if (!catalog.capacityTest) throw new Error('Refusing to load a live database. Start the isolated CAPACITY_TEST_MODE=1 deployment first.');
    if (catalog.protocol !== NETWORK_PROTOCOL) throw new Error('Client/server protocol mismatch.');
    const capacity = (await (await request('/api/rooms')).json()).capacity;
    if (!capacity || capacity.online !== 0 || capacity.available < options.count) throw new Error('Test server must be empty and admit the requested client count.');
    const maps = options.maps.map(id => {
      const map = catalog.maps.find(entry => entry.id === id);
      if (!map) throw new Error(`Unknown map: ${id}`);
      if (options.track && !map.tracks.some(track => track.id === options.track)) throw new Error(`Unknown track for ${id}`);
      return map;
    });
    // Start inputs before room creation so early groups do not stall while later groups connect.
    let inputClock = performance.now();
    inputTimer = setInterval(() => {
      const now = performance.now();
      const elapsed = (now - inputClock) / 1000; inputClock = now;
      for (const client of clients) {
        if (client.resetId === null || client.room?.status !== 'running' || client.finished) { client.commandBudget = 0; continue; }
        client.commandBudget = (client.commandBudget || 0) + elapsed * 60;
        const count = Math.min(8, Math.floor(client.commandBudget)); client.commandBudget -= count;
        if (!count) continue;
        if (client.commandBudget > 8 && started) failures.add('Load generator cannot sustain 60 Hz. Run it on another machine.');
        const phase = now / 1000 + client.index;
        send(client, { type: 'inputs', resetId: client.resetId, frames: Array.from({ length: count }, () => ({ seq: ++client.seq,
          input: { throttle: .58 + .12 * Math.sin(phase * .4), roll: .18 * Math.sin(phase * .3), pitch: .15 * Math.cos(phase * .2), yaw: .12 }, flightMode: 'angle' })) });
        if (started) client.sent += count;
        if (started && now - client.lastAckAt > 5000) failures.add(`Client ${client.index}: no command acknowledgement for 5 seconds`);
      }
    }, 8);
    pingTimer = setInterval(() => {
      for (const client of clients) if (client.socket.readyState === WebSocket.OPEN && !client.pingAt) { client.pingAt = performance.now(); client.socket.ping(); }
    }, 1000);
    for (let offset = 0; offset < options.count; offset += options.roomSize) {
      const group = { clients: [], map: maps[groups.length % maps.length] }; groups.push(group);
      // Serial registration respects public rate limits and keeps indices unique.
      for (let i = 0; i < Math.min(options.roomSize, options.count - offset); i++) { const client = await makeClient(); client.group = group; group.clients.push(client); }
      const host = group.host = group.clients[0], track = options.track || group.map.tracks[0].id;
      send(host, { type: 'create', map: group.map.id, track, mode: 'race', maxPlayers: options.roomSize, visibility: 'private' });
      const joined = await waitFor(host, message => message.type === 'joined', 'creation');
      for (const client of group.clients.slice(1)) { send(client, { type: 'join', code: joined.code }); await waitFor(client, message => message.type === 'joined', 'join'); }
      const { room } = await waitFor(host, message => message.type === 'room' && message.room.players.length === group.clients.length, 'lobby');
      const preparation = roomPreparationKey(room);
      for (const client of group.clients) send(client, { type: 'controller', profile: DEFAULT_FLIGHT_CONTROLLER, slot: 0, preparation });
      await Promise.all(group.clients.map(client => waitFor(client, message => message.type === 'controller-applied' && message.preparation === preparation, 'controller')));
      for (const client of group.clients) send(client, { type: 'assets-ready', map: group.map.id, track, revision: room.contentRevision, preparation });
      send(host, { type: 'start' });
      await waitFor(host, message => message.type === 'room' && message.room.status === 'running', 'start');
    }
    started = performance.now(); startedAt = new Date().toISOString();
    for (const client of clients) { client.lastAckAt = started; client.rtts = []; }
    console.log(JSON.stringify({ type: 'load-start', startedAt, clients: clients.length, rooms: groups.length, maps: options.maps }));
    healthTimer = setInterval(() => { request('/api/health').catch(error => { errors++; failures.add(error.message); }); }, 15000);
    let assetsDone = !options.coldAssets;
    const assets = options.coldAssets ? (async () => {
      const asset = [...(catalog.assets || [])].filter(item => item.url?.endsWith('.glb')).sort((a, b) => b.bytes - a.bytes)[0];
      if (!asset) throw new Error('Cold asset test requires a published GLB.');
      await Promise.all(clients.map(async client => {
        const response = await request(asset.url, { headers: { 'Cache-Control': 'no-cache' } }, Math.min(options.seconds, 600) * 1000);
        let bytes = 0;
        for await (const chunk of response.body) bytes += chunk.byteLength;
        if (bytes !== asset.bytes) throw new Error(`Client ${client.index}: incomplete asset download`);
        assetResults.push({ client: client.index, bytes });
      }));
      assetsDone = true;
    })().catch(error => { errors++; failures.add(error.message); }) : Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, options.seconds * 1000));
    if (!assetsDone) { failures.add('Asset downloads did not complete within the run'); abort.abort(); }
    await assets;
    const endedAt = new Date().toISOString();
    const pilotResults = clients.map(client => {
      if (!client.acked || !client.snapshots || !client.movingSnapshots || !client.rtts.length) failures.add(`Client ${client.index}: missing flight, movement or RTT samples`);
      return { client: client.index, sent: client.sent, acknowledged: client.acked, snapshots: client.snapshots, movingSnapshots: client.movingSnapshots,
        maxAckGapMs: Math.round(client.maxAckGapMs), pingP95Ms: p95(client.rtts), resyncs: client.resets };
    });
    const report = { type: 'load-result', schemaVersion: 1, startedAt, endedAt, seconds: (performance.now() - started) / 1000,
      requestedSeconds: options.seconds, clients: clients.length, rooms: groups.length, roomSize: options.roomSize, maps: options.maps,
      errors, disconnects, failures: [...failures], coldAssets: { requested: options.coldAssets, completed: assetResults.length, bytes: assetResults.reduce((sum, entry) => sum + entry.bytes, 0) },
      clientChecksPassed: errors === 0 && disconnects === 0 && failures.size === 0, capacityVerified: false, pilots: pilotResults };
    if (options.report) writeFileSync(options.report, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
    return report;
  } finally {
    finishing = true; abort.abort();
    clearInterval(inputTimer); clearInterval(pingTimer); clearInterval(healthTimer);
    for (const client of clients) client.socket.terminate();
  }
}
export async function main(defaultClients = 100) {
  try { const report = await runLoadTest(loadOptions(process.argv.slice(2), defaultClients)); if (!report.clientChecksPassed) process.exitCode = 1; }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
