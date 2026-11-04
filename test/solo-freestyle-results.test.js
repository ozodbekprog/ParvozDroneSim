import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function freeLoopbackPort() {
  const reservation = createServer();
  await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  return port;
}

test('local freestyle results retain personal bests, grant rewards and survive a server restart', { timeout: 20000 }, async () => {
  const fixture = mkdtempSync(join(project, '.solo-freestyle-results-'));
  let child;
  try {
    const port = await freeLoopbackPort();
    const base = `http://127.0.0.1:${port}`;
    async function startServer() {
      let started = false, spawnError;
      child = spawn(process.execPath, [join(project, 'server', 'index.js')], {
        cwd: project,
        env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', NODE_ENV: 'production', DATA_DIR: join(fixture, 'data') },
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
      });
      child.stdout.on('data', bytes => { if (String(bytes).includes('Singleplayer + Multiplayer:')) started = true; });
      child.stderr.on('data', () => {});
      child.on('error', error => { spawnError = error; });
      const deadline = Date.now() + 8000;
      while (!started && !spawnError && child.exitCode === null && Date.now() < deadline) await delay(20);
      if (spawnError) throw spawnError;
      assert.ok(started, 'The isolated result server must start.');
    }
    async function stopServer() {
      if (!child?.pid || child.exitCode !== null) return;
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill(); await exited;
    }
    async function request(path, { token, body, status = 200 } = {}) {
      const response = await fetch(base + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      assert.equal(response.status, status, `Unexpected response status from ${path}.`);
      return response.json();
    }

    await startServer();
    const catalog = await request('/api/catalog');
    const [map, secondMap] = catalog.maps;
    assert.ok(map && secondMap, 'Two maps are required to check independent personal bests.');
    const course = { map: map.id, track: map.tracks[0].id };
    const secondCourse = { map: secondMap.id, track: secondMap.tracks[0].id };
    await request('/api/solo-result', { body: { ...course, mode: 'freestyle', score: 300 }, status: 401 });
    const session = await request('/api/register', { body: { username: 'SoloFreestylePilot', password: 'temporary-result-test-only-123' } });
    const submit = (score, options = {}) => request('/api/solo-result', { token: session.token, body: { ...course, mode: 'freestyle', score }, ...options });

    assert.deepEqual(await submit(0), { saved: true, bestScore: 0, rewards: { xp: 0, credits: 0 } });
    assert.deepEqual(await submit(299), { saved: true, bestScore: 299, rewards: { xp: 29, credits: 37 } });
    assert.ok(!(await request('/api/me', { token: session.token })).achievements.includes('freestyle-300'));
    assert.deepEqual(await submit(300), { saved: true, bestScore: 300, rewards: { xp: 30, credits: 37 } });
    assert.deepEqual(await submit(100), { saved: true, bestScore: 300, rewards: { xp: 10, credits: 12 } });
    assert.deepEqual(await request('/api/solo-result', { token: session.token, body: { ...secondCourse, mode: 'freestyle', score: 2000 } }),
      { saved: true, bestScore: 2000, rewards: { xp: 100, credits: 150 } });
    const account = await request('/api/me', { token: session.token });
    assert.equal(account.user.xp, 169);
    assert.equal(account.user.credits, 236);
    assert.deepEqual(account.achievements, ['freestyle-300']);
    assert.deepEqual(account.records, [], 'Freestyle scores must not enter timed records.');
    assert.deepEqual(new Map(account.freestyleScores.map(entry => [entry.map, entry.best_score])), new Map([[map.id, 300], [secondMap.id, 2000]]));

    for (const score of [-1, 1.5, '300', null, 1000001, undefined]) await submit(score, { status: 400 });
    for (const invalidCourse of [{ map: 'missing-map', track: course.track }, { map: course.map, track: 'missing-track' }, { map: course.map, track: secondCourse.track }]) {
      await request('/api/solo-result', { token: session.token, body: { ...invalidCourse, mode: 'freestyle', score: 300 }, status: 400 });
    }
    assert.deepEqual(await request('/api/me', { token: session.token }), account, 'Rejected results must not change account progress.');

    const guest = await request('/api/guest', { body: {} });
    assert.deepEqual(await request('/api/solo-result', { token: guest.token, body: { ...course, mode: 'freestyle', score: 300 } }),
      { saved: false, bestScore: null, rewards: { xp: 0, credits: 0 } });
    const guestAccount = await request('/api/me', { token: guest.token });
    assert.deepEqual(guestAccount.freestyleScores, []);
    assert.deepEqual(guestAccount.achievements, []);
    assert.equal(guestAccount.user.xp, 0);
    assert.equal(guestAccount.user.credits, 0);

    // Timed local runs keep their existing contract and reward amounts.
    assert.deepEqual(await request('/api/solo-result', { token: session.token, body: { ...course, mode: 'race', timeMs: 10000 } }), { saved: true });
    const timedAccount = await request('/api/me', { token: session.token });
    assert.equal(timedAccount.user.xp, account.user.xp + 50);
    assert.equal(timedAccount.user.credits, account.user.credits + 60);
    assert.ok(timedAccount.records[0].best_ms >= 10000 && timedAccount.records[0].best_ms <= 10020);
    assert.deepEqual(timedAccount.freestyleScores, account.freestyleScores);
    assert.deepEqual(await request('/api/solo-result', { token: guest.token, body: { ...course, mode: 'race', timeMs: 10000 } }), { saved: true });
    assert.deepEqual((await request('/api/me', { token: guest.token })).records, []);

    await stopServer();
    await startServer();
    assert.deepEqual(await request('/api/me', { token: session.token }), timedAccount, 'Personal bests, achievements, rewards and sessions must survive restart.');
  } finally {
    if (child?.pid && child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited;
    }
    const resolved = resolve(fixture);
    if (!resolved.startsWith(project + sep + '.solo-freestyle-results-')) throw new Error('Unsafe result fixture cleanup path.');
    rmSync(resolved, { recursive: true, force: true });
  }
});
