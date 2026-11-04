import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { defaultBuild } from '../shared/physics.js';
import { DEFAULT_FLIGHT_CONTROLLER } from '../shared/flight-controller.js';
import { NETWORK_PROTOCOL, roomPreparationKey } from '../shared/network-flight.js';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function freeLoopbackPort() {
  const reservation = createServer();
  await new Promise((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  return port;
}

test('weekly preparation, ranked standard setup and cancelled queues work over real transport', { timeout: 30000 }, async () => {
  const fixture = mkdtempSync(join(project, '.ui-network-flow-'));
  const clients = [];
  let child;
  try {
    const port = await freeLoopbackPort();
    const base = `http://127.0.0.1:${port}`;
    let started = false;
    let spawnError;
    child = spawn(process.execPath, [join(project, 'server', 'index.js')], {
      cwd: project,
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'production', DATA_DIR: join(fixture, 'data') },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', bytes => { if (String(bytes).includes('Singleplayer + Multiplayer:')) started = true; });
    // Consume output without including potentially sensitive server responses
    // or authentication data in failed assertions.
    child.stderr.on('data', () => {});
    child.on('error', error => { spawnError = error; });
    const startupDeadline = Date.now() + 8000;
    while (!started && !spawnError && child.exitCode === null && Date.now() < startupDeadline) await delay(20);
    if (spawnError) throw spawnError;
    assert.ok(started, 'The isolated game server must start before transport checks.');

    async function request(path, { token, body } = {}) {
      const response = await fetch(base + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      assert.equal(response.status, 200, `Unexpected status from ${path}.`);
      return response.json();
    }

    async function credentials(username) {
      return request(username ? '/api/register' : '/api/guest', { body: username ? { username, password: 'temporary-test-only-123' } : {} });
    }

    async function connect(session) {
      const socket = new WebSocket(base.replace('http:', 'ws:') + '/socket');
      const messages = [];
      const entry = {
        socket, messages, id: session.user.id,
        send: value => socket.send(JSON.stringify(value)),
        async wait(predicate, after = 0) {
          const deadline = Date.now() + 5000;
          while (Date.now() < deadline) {
            const found = messages.slice(after).find(predicate);
            if (found) return found;
            await delay(10);
          }
          throw new Error('The expected server message did not arrive. Received types: ' + messages.slice(after).map(message => message.type).join(', '));
        },
        async close() {
          if (socket.readyState === WebSocket.CLOSED) return;
          await new Promise(resolve => { socket.once('close', resolve); socket.close(); });
        }
      };
      clients.push(entry);
      socket.on('message', bytes => messages.push(JSON.parse(String(bytes))));
      await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
      entry.send({ type: 'auth', token: session.token, protocol: NETWORK_PROTOCOL });
      await entry.wait(message => message.type === 'authenticated');
      return entry;
    }

    const weekly = await connect(await credentials());
    weekly.send({ type: 'solo', mode: 'weekly' });
    const lobby = (await weekly.wait(message => message.type === 'room' && message.room.status === 'lobby' && message.room.startRequested)).room;
    assert.equal(lobby.solo, true);
    assert.equal(lobby.mode, 'weekly');
    assert.equal(lobby.players[0].ready, false);
    assert.equal(lobby.players[0].controllerReady, false);
    const preparation = roomPreparationKey(lobby);
    const assetsReady = { type: 'assets-ready', preparation, revision: lobby.contentRevision, map: lobby.map, track: lobby.track };
    const waitingMark = weekly.messages.length;
    weekly.send(assetsReady);
    await delay(100);
    assert.ok(!weekly.messages.slice(waitingMark).some(message => message.type === 'room' && message.room.status === 'countdown'), 'Assets without an acknowledged controller must not start a weekly run.');
    weekly.send({ type: 'controller', preparation, profile: DEFAULT_FLIGHT_CONTROLLER, slot: 0 });
    await weekly.wait(message => message.type === 'controller-applied', waitingMark);
    await delay(100);
    assert.ok(!weekly.messages.slice(waitingMark).some(message => message.type === 'room' && message.room.status === 'countdown'), 'Controller readiness alone must not skip asset preparation.');
    weekly.send(assetsReady);
    const countdown = (await weekly.wait(message => message.type === 'room' && message.room.status === 'countdown', waitingMark)).room;
    assert.ok(countdown.players.every(player => player.ready && player.controllerReady));
    await weekly.close();

    const [cancelledSession, customSession, opponentSession] = await Promise.all([
      credentials('UiFlowCancelled'), credentials('UiFlowCustom'), credentials('UiFlowOpponent')
    ]);
    const customBuild = { ...defaultBuild('armattan-gecko'), color: '#abcdef', led: '#123456' };
    assert.deepEqual((await request('/api/build', { token: customSession.token, body: { build: customBuild } })).build, customBuild);
    const incompatible={...customBuild,motors:'lf-hypetrain2306motor01'};
    assert.equal((await request('/api/build',{token:customSession.token,body:{build:incompatible}})).build.motors,customBuild.motors,'The server replaces incompatible five-inch motors with the Gecko stock motor.');

    const cancelled = await connect(cancelledSession);
    cancelled.send({ type: 'queue' });
    await cancelled.close();
    const custom = await connect(customSession);
    custom.send({ type: 'queue' });
    await delay(250);
    assert.ok(!custom.messages.some(message => message.type === 'joined'), 'A cancelled queue entry must not match a later pilot.');

    const opponent = await connect(opponentSession);
    opponent.send({ type: 'queue' });
    for (const entry of [custom, opponent]) {
      const joined = await entry.wait(message => message.type === 'joined');
      assert.deepEqual(joined.build, defaultBuild());
      const ranked = (await entry.wait(message => message.type === 'room' && message.room.ranked && message.room.players.length === 2 && message.room.status === 'lobby' && message.room.startRequested)).room;
      assert.ok(!ranked.players.some(player => player.id === cancelled.id));
      assert.ok(ranked.players.every(player => JSON.stringify(player.build) === JSON.stringify(defaultBuild())));
      const mark = entry.messages.length;
      entry.send({ type: 'controller', preparation: roomPreparationKey(ranked), slot: 2, profile: {
        ...DEFAULT_FLIGHT_CONTROLLER,
        pid: { ...DEFAULT_FLIGHT_CONTROLLER.pid, roll: { p: 99, i: 99, d: 99 } },
        rates: { ...DEFAULT_FLIGHT_CONTROLLER.rates, roll: { rcRate: 2.5, superRate: 0.95, expo: 0.7 } }
      } });
      const applied = await entry.wait(message => message.type === 'controller-applied', mark);
      assert.deepEqual(applied.profile, DEFAULT_FLIGHT_CONTROLLER);
      assert.equal(applied.slot, 0);
      assert.equal(applied.drone, defaultBuild().drone);
    }
    // Standardized race data must not replace the pilot's saved custom setup.
    assert.deepEqual((await request('/api/me', { token: customSession.token })).user.build, customBuild);
  } finally {
    for (const entry of clients) entry.socket.terminate();
    if (child?.pid && child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill();
      await exited;
    }
    const resolved = resolve(fixture);
    if (!resolved.startsWith(project + sep + '.ui-network-flow-')) throw new Error('Unsafe test data cleanup path.');
    rmSync(resolved, { recursive: true, force: true });
  }
});
