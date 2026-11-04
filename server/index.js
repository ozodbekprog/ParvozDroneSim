import { createServer } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { WebSocketServer } from 'ws';
import { selectedMap, defaultMap } from '../shared/map-selection.js';
import { careerUnlockSatisfied } from '../shared/career-unlocks.js';
import { MAPS, MAP_LIST, GAMEPLAY_OBSTACLES, CAREER, getTrack, getTrackObstacles, getSpawn } from '../shared/content.js';
import { DRONES, PARTS, FIXED_DT, defaultBuild, resolveBuild, createDroneState, stepDrone, gateCrossed, resolveEnvironmentCollision } from '../shared/physics.js';
import { DEFAULT_FLIGHT_CONTROLLER, validateFlightController } from '../shared/flight-controller.js';
import { fixedSteps } from '../shared/timing.js';
import { resetFreestyle, scoreFreestyle } from '../shared/freestyle.js';
import { applyCustomContent } from '../shared/custom-content.js';
import { simulateCommand, resetAtCheckpoint } from '../shared/flight-session.js';
import { streamFile,servePublicAsset } from './static-files.js';
import { watchContent } from './content-watch.js';
import {hydrateCollisionPayload} from '../shared/collision-preparation.js';
import {collisionFileFor} from '../shared/collision-binary.js';
import { prepareCollisions } from '../shared/collision.js';
import { NETWORK_PROTOCOL, resetCommandStream, enqueueCommands, takeCommands, canStartRoom, roomPreparationKey, effectiveFlightBuild } from '../shared/network-flight.js';
import { RateLimiter, clientAddress } from './rate-limit.js';
import { SampleWindow } from './performance-metrics.js';
import { normalizeRoomOptions, sanitizeChat, cupCourses, cupRoundPoints, cupStandings, publicRoomListing } from './room-rules.js';
import { passwordHash, verifyPassword, validPassword, migrateAccountRecovery, issueRecoveryCode, recoverAccount } from './account-security.js';
import { Admission, playerLimit } from './admission.js';
import {courseEnabled,sceneTrack} from '../shared/scene-content.js';
import { BRAND } from '../shared/brand.js';
import { migrateDroneFleets, readAccountFleet, saveAccountFleet } from './drone-fleet.js';
import {isPartCompatible} from '../shared/part-compatibility.js';

const admission = new Admission(playerLimit(process.env.MAX_MULTIPLAYER_PLAYERS));
const capacityTest = process.env.CAPACITY_TEST_MODE === '1';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const customManifest = join(root, 'public', 'content', 'catalog.json');
let customContent = existsSync(customManifest) ? JSON.parse(readFileSync(customManifest, 'utf8')) : { version: 1, maps: [], drones: [], parts: [], challenges: [] };
applyCustomContent(customContent);
const loadedCollision=new Set();
function hydrateCollision() { loadedCollision.clear(); }
function ensureCollision(map,track) {
  const mapFile=collisionFileFor(map),trackFile=collisionFileFor(track);
  if(mapFile&&!loadedCollision.has(mapFile)){GAMEPLAY_OBSTACLES[map.id]=[...map.colliders,...hydrateCollisionPayload(readFileSync(join(root,'public',mapFile.slice(1))))];prepareCollisions(GAMEPLAY_OBSTACLES[map.id]);loadedCollision.add(mapFile);}
  if(trackFile&&!loadedCollision.has(trackFile)){track.colliders=hydrateCollisionPayload(readFileSync(join(root,'public',trackFile.slice(1))));prepareCollisions(track.colliders);loadedCollision.add(trackFile);}
}
hydrateCollision();
// Capacity runs never open the production database, even if DATA_DIR is reused by mistake.
const dataDir = join(process.env.DATA_DIR || join(root, 'data'), capacityTest ? 'capacity-test' : '.');
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, 'liftoff.sqlite'));
db.exec(`
  PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, xp INTEGER DEFAULT 0, credits INTEGER DEFAULT 0, rating INTEGER DEFAULT 1000, build TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS records (user_id INTEGER NOT NULL, track TEXT NOT NULL, best_ms INTEGER NOT NULL, PRIMARY KEY(user_id, track));
  CREATE TABLE IF NOT EXISTS career (user_id INTEGER NOT NULL, mission TEXT NOT NULL, stars INTEGER NOT NULL, PRIMARY KEY(user_id, mission));
  CREATE TABLE IF NOT EXISTS achievements (user_id INTEGER NOT NULL, code TEXT NOT NULL, PRIMARY KEY(user_id, code));
  CREATE TABLE IF NOT EXISTS replays (user_id INTEGER NOT NULL, track TEXT NOT NULL, best_ms INTEGER NOT NULL, build TEXT NOT NULL, frames TEXT NOT NULL, PRIMARY KEY(user_id, track));
  CREATE TABLE IF NOT EXISTS weekly_records (user_id INTEGER NOT NULL, week INTEGER NOT NULL, track TEXT NOT NULL, best_ms INTEGER NOT NULL, PRIMARY KEY(user_id, week, track));
  CREATE TABLE IF NOT EXISTS freestyle_scores (user_id INTEGER NOT NULL, map TEXT NOT NULL, best_score INTEGER NOT NULL, PRIMARY KEY(user_id, map));
  CREATE TABLE IF NOT EXISTS owned_parts (user_id INTEGER NOT NULL, category TEXT NOT NULL, part TEXT NOT NULL, PRIMARY KEY(user_id, category, part));
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, player TEXT NOT NULL, expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS cup_scores (user_id INTEGER PRIMARY KEY, wins INTEGER DEFAULT 0, podiums INTEGER DEFAULT 0, points INTEGER DEFAULT 0);
`);
migrateAccountRecovery(db);
migrateDroneFleets(db);

const sessions = new Map();
db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
for (const row of db.prepare('SELECT * FROM sessions').all()) sessions.set(row.token, { player: JSON.parse(row.player), expires: row.expires });
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) if (session.expires < now) sessions.delete(token);
  db.prepare('DELETE FROM sessions WHERE expires < ?').run(now);
}, 60 * 60_000).unref();
const rooms = new Map();
let draining = false;
let pendingContent;
function acceptContent(result) {
  if (result.catalog.revision === customContent.revision) return;
  if([...rooms.values()].some(room=>['running','countdown'].includes(room.status))) {pendingContent=result;return;}
  customContent=result.catalog;applyCustomContent(customContent);hydrateCollision();
  for(const room of rooms.values()) if(room.status==='lobby') {
    room.contentRevision=customContent.revision;
    room.map=selectedMap(MAPS,room.map.id);room.track=sceneTrack(getTrack(room.map.id,room.track.id),courseEnabled(room));ensureCollision(room.map,room.track);room.obstacles=getTrackObstacles(room.map.id,room.track);room.freestyleObstacles=room.obstacles.filter(obstacle=>obstacle.size);
    for(const item of room.players.values()) {item.ready=false;item.controllerReady=false;item.build=effectiveFlightBuild(safeBuild(item.build,item.player),room.ranked);item.spec=resolveBuild(item.build);if(room.ranked)item.controller=validateFlightController(DEFAULT_FLIGHT_CONTROLLER);}
    notifyRoom(room);
  }
  for(const warning of result.warnings)console.warn(warning);
  console.log('Folder content loaded: '+customContent.revision);
}
if(process.env.NODE_ENV!=='production') watchContent(root,acceptContent);
setInterval(()=>{if(pendingContent){const result=pendingContent;pendingContent=null;acceptContent(result);}},1000).unref();
const sockets = new Map();
const rankQueue = [];
const port = Number(process.env.PORT || 2567);
const bindHost = process.env.HOST || '0.0.0.0';
const localOnly = ['127.0.0.1', '::1', 'localhost'].includes(bindHost);
const trustProxy = process.env.TRUST_PROXY === '1';
const loginLimit = new RateLimiter(10 * 60_000, 120);
const accountLimit = new RateLimiter(10 * 60_000, 8);
const registerLimit = new RateLimiter(60 * 60_000, 20);
const guestLimit = new RateLimiter(10 * 60_000, 120);
const socketLimit = new RateLimiter(60_000, 180);
const chatLimit = new RateLimiter(10_000, 6);
const recoveryLimit = new RateLimiter(10 * 60_000, 20);
const recoveryAccountLimit = new RateLimiter(10 * 60_000, 5);
setInterval(() => [loginLimit, accountLimit, registerLimit, guestLimit, socketLimit, chatLimit, recoveryLimit, recoveryAccountLimit].forEach(limit => limit.prune()), 60_000).unref();

function guardRequest(request, response, limiter, key) {
  const result = limiter.allow(key);
  if (result.allowed) return true;
  response.setHeader('Retry-After', String(Math.max(1, result.retryAfter)));
  json(response, 429, { error: 'Too many attempts. Please try again later.' });
  return false;
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function readJson(request, limit = 20_000) {
  let input = '';
  for await (const chunk of request) {
    input += chunk;
    if (input.length > limit) throw Object.assign(new Error('Request too large'), { status: 413 });
  }
  try {
    const value = input ? JSON.parse(input) : {};
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Expected object');
    return value;
  } catch { throw Object.assign(new Error('Invalid JSON object'), { status: 400 }); }
}

function issueSession(player) {
  const token = randomBytes(24).toString('base64url');
  sessions.set(token, { player, expires: Date.now() + 7 * 24 * 3600_000 });
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(token, JSON.stringify(player), sessions.get(token).expires);
  return token;
}

function getSession(request) {
  const token = request.headers.authorization?.replace(/^Bearer /, '');
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) return null;
  return session.player;
}

function publicUser(row) {
  return { id: row.id, username: row.username, xp: row.xp, credits: row.credits, rating: row.rating, build: JSON.parse(row.build), guest: false };
}

function loadUser(id) {
  return publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

function unlocks(user) {
  if (user.guest) return Object.values(DRONES).filter(d=>!d.unlock || d.unlock==='starter').map(d=>d.id);
  const completed = db.prepare('SELECT mission FROM career WHERE user_id = ? AND stars > 0').all(user.id).map(row => row.mission);
  return Object.values(DRONES).filter(drone => !drone.unlock || drone.unlock === 'starter' || careerUnlockSatisfied(drone.unlock,completed.length,CAREER.length)).map(drone => drone.id);
}

function ownedParts(user) {
  const owned = Object.fromEntries(Object.entries(PARTS).map(([category, items]) => [category, items.filter(part => part.cost === 0).map(part => part.id)]));
  if (user.guest) return Object.fromEntries(Object.entries(PARTS).map(([category, items]) => [category, items.map(part => part.id)]));
  for (const row of db.prepare('SELECT category,part FROM owned_parts WHERE user_id=?').all(user.id)) owned[row.category]?.push(row.part);
  return owned;
}

function safeBuild(build, player) {
  const next = defaultBuild(unlocks(player).includes(build?.drone)?build.drone:'kestrel');
  const owned = ownedParts(player);
  for (const category of Object.keys(PARTS)) {
    const part=PARTS[category].find(part=>part.id===build?.[category]);
    if (part && owned[category].includes(part.id) && isPartCompatible(DRONES[next.drone],category,part)) next[category] = part.id;
  }
  for (const color of ['color', 'led']) if (/^#[0-9a-fA-F]{6}$/.test(build?.[color])) next[color] = build[color];
  if(DRONES[next.drone]?.accessories?.actionCamera)next.actionCamera=false;
  return next;
}

function weekChallenge() {
  const start = Date.UTC(2026, 0, 5);
  const week = Math.floor((Date.now() - start) / (7 * 86400_000));
  const map = MAP_LIST[((week % MAP_LIST.length) + MAP_LIST.length) % MAP_LIST.length];
  return { week, map: map.id, track: map.tracks[0].id };
}

async function handleApi(request, response, path) {
  if (path.startsWith('/api/internal/')) {
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) return json(response, 403, { error: 'Local access only.' });
    if (path === '/api/internal/status' && request.method === 'GET') return json(response, 200, { draining, activeRooms: [...rooms.values()].filter(room => ['running', 'countdown', 'paused'].includes(room.status)).length, rooms: rooms.size });
    if (path === '/api/internal/drain' && request.method === 'POST') { draining = true; return json(response, 200, { draining: true }); }
    if (path === '/api/internal/resume' && request.method === 'POST') { draining = false; return json(response, 200, { draining: false }); }
    if (path === '/api/internal/metrics' && request.method === 'GET') return json(response, 200, currentMetrics());
    return json(response, 404, { error: 'Not found.' });
  }
  if (path === '/api/health') return json(response, 200, { status: 'ok', version: '0.2.0' });
  if (path === '/api/rooms' && request.method === 'GET') return json(response, 200, { rooms: publicRoomListing(rooms.values()), capacity: admission.view() });
  if(path==='/api/content-revision')return json(response,200,{revision:customContent.revision});
  if (path === '/api/catalog' && request.method === 'GET') {
    const status={protocol:NETWORK_PROTOCOL,revision:customContent.revision,weekly:weekChallenge(),localOnly,multiplayer:true,capacityTest};
    const knownRevision=new URL(request.url,'http://localhost').searchParams.get('knownRevision');
    if(customContent.revision && knownRevision===customContent.revision)return json(response,200,{...status,contentUnchanged:true});
    return json(response,200,{...status,assets:customContent.assets||[],maps:MAP_LIST,drones:DRONES,parts:PARTS,career:CAREER,customContent});
  }
  if (path === '/api/register' && request.method === 'POST') {
    const address = clientAddress(request, trustProxy);
    if (!guardRequest(request, response, registerLimit, address)) return;
    const body = await readJson(request);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username) || password.length < 8 || password.length > 128) return json(response, 400, { error: 'Use a callsign of 3–20 letters, numbers or underscores and a password of 8–128 characters.' });
    try {
      const result = db.prepare('INSERT INTO users (username,password,build) VALUES (?,?,?)').run(username, await passwordHash(password), JSON.stringify(defaultBuild()));
      const player = loadUser(Number(result.lastInsertRowid));
      return json(response, 200, { token: issueSession(player), user: player });
    } catch (error) {
      if (/UNIQUE constraint failed: users.username/.test(error.message)) return json(response, 409, { error: 'Username already exists.' });
      throw error;
    }
  }
  if (path === '/api/login' && request.method === 'POST') {
    const address = clientAddress(request, trustProxy);
    if (!guardRequest(request, response, loginLimit, address)) return;
    const body = await readJson(request);
    const username = String(body.username || '').trim();
    if (!guardRequest(request, response, accountLimit, `${address}:${username.toLowerCase()}`)) return;
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    const password = String(body.password || '');
    if (!row || password.length > 128 || !await verifyPassword(password, row.password)) return json(response, 401, { error: 'Invalid username or password.' });
    if (db.prepare('SELECT password FROM users WHERE id=?').get(row.id)?.password !== row.password) return json(response, 401, { error: 'Password changed. Sign in again.' });
    const player = publicUser(row);
    return json(response, 200, { token: issueSession(player), user: player });
  }
  if (path === '/api/guest' && request.method === 'POST') {
    if (!guardRequest(request, response, guestLimit, clientAddress(request, trustProxy))) return;
    const player = { id: `guest-${randomBytes(4).toString('hex')}`, username: `Guest ${Math.floor(Math.random() * 9000 + 1000)}`, guest: true, xp: 0, credits: 0, rating: 1000, build: defaultBuild() };
    return json(response, 200, { token: issueSession(player), user: player });
  }
  if (path === '/api/account/recover' && request.method === 'POST') {
    const address = clientAddress(request, trustProxy);
    if (!guardRequest(request, response, recoveryLimit, address)) return;
    const body = await readJson(request);
    const username = String(body.username || '').trim().slice(0, 21);
    if (!guardRequest(request, response, recoveryAccountLimit, `${address}:${username.toLowerCase()}`)) return;
    if (!validPassword(body.newPassword)) return json(response, 400, { error: 'Password must contain 8–128 characters.' });
    const id = await recoverAccount(db, username, body.code, body.newPassword);
    if (id === null) return json(response, 400, { error: 'Invalid callsign or recovery code.' });
    const revoked = new Set();
    for (const [token, session] of sessions) if (session.player.id === id) { revoked.add(token); sessions.delete(token); }
    for (const socket of wss.clients) if (revoked.has(socket.sessionToken)) {
      admission.release(socket); leaveRoom(socket);
      const queued = rankQueue.findIndex(entry => entry.socket === socket);
      if (queued !== -1) rankQueue.splice(queued, 1);
      socket.close(1008, 'Password changed. Sign in again.');
    }
    return json(response, 200, { recovered: true });
  }
  const player = getSession(request);
  if (!player) return json(response, 401, { error: 'Sign in to continue.' });
  if(path==='/api/fleet' && ['GET','POST'].includes(request.method)){
    if(player.guest)return json(response,403,{error:'Guest drones are saved on this device. Sign in to sync a Hangar.'});
    if(request.method==='GET')return json(response,200,readAccountFleet(db,player.id));
    const owned=ownedParts(player),unlocked=unlocks(player);
    const result=saveAccountFleet(db,player.id,await readJson(request,256000),build=>unlocked.includes(build.drone)&&Object.keys(PARTS).every(category=>owned[category].includes(build[category])));
    const build=loadUser(player.id).build;
    for(const session of sessions.values())if(session.player.id===player.id)session.player.build=build;
    return json(response,200,result);
  }
  if (path === '/api/account/recovery-code' && request.method === 'POST') {
    if (player.guest) return json(response, 403, { error: 'Create a pilot account first.' });
    const address = clientAddress(request, trustProxy);
    if (!guardRequest(request, response, recoveryLimit, address) || !guardRequest(request, response, recoveryAccountLimit, `issue:${player.id}`)) return;
    const body = await readJson(request);
    const code = await issueRecoveryCode(db, player.id, body.password);
    if (!code) return json(response, 403, { error: 'Password is incorrect or has changed. Sign in again.' });
    return json(response, 200, { code });
  }
  if (path === '/api/logout' && request.method === 'POST') {
    const currentToken = request.headers.authorization?.replace(/^Bearer /, '');
    sessions.delete(currentToken);
    db.prepare('DELETE FROM sessions WHERE token=?').run(currentToken);
    for (const socket of wss.clients) if (socket.sessionToken === currentToken) socket.close(1000, 'Signed out');
    return json(response, 200, { signedOut: true });
  }
  if (path === '/api/me' && request.method === 'GET') {
    const user = player.guest ? player : loadUser(player.id);
    const records = player.guest ? [] : db.prepare('SELECT track,best_ms FROM records WHERE user_id=?').all(player.id);
    const career = player.guest ? [] : db.prepare('SELECT mission,stars FROM career WHERE user_id=?').all(player.id);
    const achievements = player.guest ? [] : db.prepare('SELECT code FROM achievements WHERE user_id=?').all(player.id).map(row => row.code);
    const freestyleScores = player.guest ? [] : db.prepare('SELECT map,best_score FROM freestyle_scores WHERE user_id=? ORDER BY map').all(player.id);
    const recoveryEnabled = !player.guest && !!db.prepare('SELECT recovery_hash FROM users WHERE id=?').get(player.id)?.recovery_hash;
    return json(response, 200, { user, records, career, achievements, freestyleScores, recoveryEnabled, unlocks: unlocks(user), ownedParts: ownedParts(user) });
  }
  if (path === '/api/solo-result' && request.method === 'POST') {
    const body = await readJson(request); const map = MAPS[body?.map]; const track = map?.tracks?.find(t=>t.id===body.track);
    if (body?.mode === 'freestyle') {
      // Local scores are personal progress. They never enter ranked or weekly standings.
      if (!track || !Number.isSafeInteger(body.score) || body.score < 0 || body.score > 1_000_000) return json(response,400,{error:'Invalid local result'});
      return json(response,200,saveFreestyleResult(player,map.id,body.score));
    }
    if (!track || !['race','time','career','weekly'].includes(body.mode) || !Number.isFinite(body.timeMs) || body.timeMs < 1000 || body.timeMs > 3600000) return json(response,400,{error:'Invalid local result'});
    // Local results never enter competitive weekly/ranked tables.
    finishPlayer({started:Date.now()-body.timeMs, mode:body.mode==='weekly'?'time':body.mode,track}, {player,finishMs:null,replay:[],maxSpeed:0});
    return json(response,200,{saved:true});
  }
  if (path === '/api/build' && request.method === 'POST') {
    const input = (await readJson(request)).build;
    const requested=input&&{...input,antenna:input.antenna??defaultBuild(input.drone).antenna};
    const owned = ownedParts(player);
    if (!unlocks(player).includes(requested?.drone) || Object.keys(PARTS).some(category => !owned[category].includes(requested?.[category]))) return json(response, 403, { error: 'Unlock the drone and buy selected parts before saving this build.' });
    const build = safeBuild(requested, player);
    player.build = build;
    if (player.guest) db.prepare('UPDATE sessions SET player=? WHERE token=?').run(JSON.stringify(player), request.headers.authorization?.replace(/^Bearer /, ''));
    if (!player.guest) db.prepare('UPDATE users SET build=? WHERE id=?').run(JSON.stringify(build), player.id);
    return json(response, 200, { build });
  }
  if (path === '/api/buy-part' && request.method === 'POST') {
    if (player.guest) return json(response, 403, { error: 'Create a pilot account to buy parts.' });
    const body = await readJson(request);
    const category = String(body.category || ''), id = String(body.id || '');
    const part = PARTS[category]?.find(item => item.id === id);
    if (!part) return json(response, 400, { error: 'Unknown drone part.' });
    if (ownedParts(player)[category].includes(id)) return json(response, 200, { user: loadUser(player.id), ownedParts: ownedParts(player) });
    const paid = db.prepare('UPDATE users SET credits=credits-? WHERE id=? AND credits>=?').run(part.cost, player.id, part.cost);
    if (!paid.changes) return json(response, 400, { error: `Need ${part.cost} credits for ${part.name}.` });
    db.prepare('INSERT INTO owned_parts (user_id,category,part) VALUES (?,?,?)').run(player.id, category, id);
    return json(response, 200, { user: loadUser(player.id), ownedParts: ownedParts(player) });
  }
  if (path === '/api/leaderboard' && request.method === 'GET') {
    const url = new URL(request.url, 'http://localhost');
    const track = String(url.searchParams.get('track') || defaultMap(MAPS).tracks[0].id);
    const rows = db.prepare('SELECT u.username,r.best_ms FROM records r JOIN users u ON u.id=r.user_id WHERE r.track=? ORDER BY r.best_ms ASC LIMIT 30').all(track);
    return json(response, 200, { rows });
  }
  if (path === '/api/rankings' && request.method === 'GET') {
    return json(response, 200, { rows: db.prepare('SELECT username,rating,xp FROM users ORDER BY rating DESC LIMIT 30').all() });
  }
  if (path === '/api/cup-leaderboard' && request.method === 'GET') {
    return json(response, 200, { rows: db.prepare('SELECT u.username,c.wins,c.podiums,c.points FROM cup_scores c JOIN users u ON u.id=c.user_id ORDER BY c.wins DESC,c.points DESC LIMIT 12').all() });
  }
  if (path === '/api/weekly' && request.method === 'GET') {
    const challenge = weekChallenge();
    const rows = db.prepare('SELECT u.username,w.best_ms FROM weekly_records w JOIN users u ON u.id=w.user_id WHERE w.week=? AND w.track=? ORDER BY w.best_ms ASC LIMIT 30').all(challenge.week, challenge.track);
    return json(response, 200, { challenge, rows });
  }
  if (path === '/api/ghost' && request.method === 'GET') {
    const track = String(new URL(request.url, 'http://localhost').searchParams.get('track') || '');
    const row = db.prepare('SELECT u.username,r.best_ms,r.build,r.frames FROM replays r JOIN users u ON u.id=r.user_id WHERE r.track=? ORDER BY r.best_ms ASC LIMIT 1').get(track);
    return json(response, 200, row ? { username: row.username, bestMs: row.best_ms, build: JSON.parse(row.build), frames: JSON.parse(row.frames) } : { frames: [] });
  }
  return json(response, 404, { error: 'Not found.' });
}

function serveStatic(request, response, path) {
  if(servePublicAsset(root,request,response,path))return;
  const dist = join(root, 'dist');
  if (!existsSync(dist)) return json(response, 404, { error: 'Build the client with npm run build, or use npm run dev.' });
  const name = path === '/' ? '/index.html' : path;
  const target = resolve(dist, `.${decodeURIComponent(name)}`);
  if (target !== dist && !target.startsWith(dist + sep)) return json(response, 403, { error: 'Forbidden' });
  const file = existsSync(target) ? target : join(dist, 'index.html');
  streamFile(request,response,file);
}

const tlsOptions = process.env.TLS_PFX_FILE ? { pfx: readFileSync(resolve(process.env.TLS_PFX_FILE)), passphrase: process.env.TLS_PFX_PASSWORD || '' } : null;
const server = (tlsOptions ? createSecureServer(tlsOptions) : createServer)(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path.startsWith('/api/')) await handleApi(request, response, path);
    else serveStatic(request, response, path);
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) { serverErrors++; console.error(JSON.stringify({ type: 'server-error', at: new Date().toISOString(), message: error.message })); }
    json(response, status, { error: status >= 500 ? 'Server error. Please try again.' : error.message });
  }
});

const wss = new WebSocketServer({ server, path: '/socket', maxPayload: 32_768 });
let sentBytes = 0;
let socketDisconnects = 0;
const tickDuration = new SampleWindow(2400);
const timerDelay = new SampleWindow(2400);
let serverErrors = 0, totalSentBytes = 0, simulationDroppedMs = 0, worstTickP95Ms = 0;
let peakPlayers = 0;
function currentMetrics() {
  const players = [...rooms.values()].reduce((count, room) => count + room.players.size, 0);
  peakPlayers = Math.max(peakPlayers, players);
  worstTickP95Ms = Math.max(worstTickP95Ms, tickDuration.percentile(0.95));
  return { type: 'server-metrics', at: new Date().toISOString(), uptimeSeconds: Math.floor(process.uptime()), rooms: rooms.size, players, peakPlayers,
    capacity: admission.view(), sockets: wss.clients.size, serverTick,
    tickP95Ms: Number(tickDuration.percentile(0.95).toFixed(2)), worstTickP95Ms: Number(worstTickP95Ms.toFixed(2)),
    timerDelayP95Ms: Number(timerDelay.percentile(0.95).toFixed(2)), simulationDroppedMs: Number(simulationDroppedMs.toFixed(2)),
    rssMb: Number((process.memoryUsage().rss / 1048576).toFixed(1)), sentMb: Number((sentBytes / 1048576).toFixed(2)),
    totalSentMb: Number((totalSentBytes / 1048576).toFixed(2)), socketDisconnects, serverErrors };
}
function sendRaw(socket, payload) {
  if (socket.readyState !== 1) return;
  if (socket.bufferedAmount > 1_048_576) { socket.close(1013, 'Connection too slow'); return; }
  socket.send(payload);
  sentBytes += Buffer.byteLength(payload);
  totalSentBytes += Buffer.byteLength(payload);
}
const send = (socket, message) => sendRaw(socket, JSON.stringify(message));

function roomView(room) {
  return { code: room.code, map: room.map.id, track: room.track.id, mode: room.mode, solo: room.solo, ranked: room.ranked, visibility: room.visibility, maxPlayers: room.maxPlayers, status: room.status, host: room.host, started: room.started, pausedAt: room.pausedAt || 0, countdown: room.countdown,startRequested:Boolean(room.startRequested),
    contentRevision: room.contentRevision, chat: room.chat.slice(-30), cup: room.mode === 'cup' ? { round: room.cupRound + 1, rounds: room.cupCourses.length, standings: cupStandings(room.cupScores, room.players.keys()) } : null,
    players: [...room.players.values()].map(item => ({ id: item.player.id, name: item.player.username, ready: item.ready, controllerReady: item.controllerReady, build: item.build, gate: item.gate, lap: item.lap, finishMs: item.finishMs, penaltyMs: item.penaltyMs || 0, score: item.score, combo: item.combo || 0, lastTrick: item.lastTrick || '' })) };
}

function broadcast(room, message) {
  const payload = JSON.stringify(message);
  for (const item of room.players.values()) sendRaw(item.socket, payload);
}
function notifyRoom(room) { broadcast(room, { type: 'room', room: roomView(room) }); }
function snapshot(room) {
  broadcast(room, { type: 'snapshot', serverTick: ++snapshotSequence, serverTime: Date.now(), players: [...room.players.values()].filter(item => item.state && item.finishMs === null).map(item => ({ id: item.player.id, state: item.state, resetId: item.resetId, failSafe: Boolean(item.failSafe), gate: item.gate, lap: item.lap, score: item.score, combo: item.combo || 0, lastTrick: item.lastTrick || '', finishMs: item.finishMs, seq: item.lastSeq })) });
}
let snapshotSequence = 0;

function makeRoom(player, socket, options) {
  if (draining) { send(socket, { type: 'error', error: 'A game update is starting. Please try again shortly.' }); return null; }
  const map = selectedMap(MAPS,options.map);
  const settings = normalizeRoomOptions(options);
  const track = sceneTrack(getTrack(map.id, options.track),courseEnabled({mode:options.solo?options.mode:settings.mode}));
  ensureCollision(map,track);
  const code = randomBytes(3).toString('hex').toUpperCase();
  const room = { code, map, track, obstacles: getTrackObstacles(map.id,track), freestyleObstacles: getTrackObstacles(map.id,track).filter(obstacle => obstacle.size), mode: options.solo ? options.mode : settings.mode, solo: Boolean(options.solo), ranked: Boolean(options.ranked), visibility: options.solo || options.ranked ? 'private' : settings.visibility, maxPlayers: options.solo ? 1 : settings.maxPlayers, week: options.mode === 'weekly' ? weekChallenge().week : null, status: 'lobby', host: player.id, players: new Map(), chat: [], started: 0, pausedAt: 0, countdown: 0 };
  if (room.mode === 'cup') { room.cupCourses = cupCourses(MAP_LIST, map.id, track.id); room.cupRound = 0; room.cupScores = new Map(); }
  rooms.set(code, room);
  room.contentRevision = customContent.revision;
  if (!joinRoom(room, player, socket)) { rooms.delete(code); return null; }
  return room;
}

function joinRoom(room, player, socket) {
  if (draining) return send(socket, { type: 'error', error: 'A game update is starting. Please try again shortly.' });
  if (sockets.get(socket) === room.code) return send(socket, { type: 'error', error: 'Already in this room.' });
  if ((room.solo && room.players.size) || room.players.size >= room.maxPlayers || room.status !== 'lobby' || room.cupRound > 0) return send(socket, { type: 'error', error: 'Room is full or already racing.' });
  if (room.players.has(player.id) && room.players.get(player.id).socket !== socket) return send(socket, { type: 'error', error: 'This pilot is already in the room.' });
  leaveRoom(socket);
  const queued = rankQueue.findIndex(entry => entry.socket === socket);
  if (queued !== -1) rankQueue.splice(queued, 1);
  const build = effectiveFlightBuild(safeBuild(player.build, player), room.ranked);
  room.players.set(player.id, { player, socket, build, spec: resolveBuild(build), controller: validateFlightController(DEFAULT_FLIGHT_CONTROLLER), resetId: 0, state: null, input: { throttle: 0, roll: 0, pitch: 0, yaw: 0 }, flightMode: 'acro', gate: 0, lap: 1, finishMs: null, penaltyMs: 0, score: 0, ready: false, lastSeq: 0, commands: [], tickCredit: 8, lastInputAt: Date.now(), flips: 0, replay: [], maxSpeed: 0 });
  if (room.mode === 'cup' && !room.cupScores.has(player.id)) room.cupScores.set(player.id, { name: player.username, points: 0, finishes: 0, totalMs: 0 });
  sockets.set(socket, room.code);
  room.players.get(player.id).controllerReady = false;
  for (const pilot of room.players.values()) pilot.ready = false;
  send(socket, { type: 'joined', code: room.code, id: player.id, build });
  notifyRoom(room);
  return true;
}

function leaveRoom(socket) {
  const code = sockets.get(socket);
  sockets.delete(socket);
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;
  for (const [id, item] of room.players) if (item.socket === socket) room.players.delete(id);
  if (!room.players.size) rooms.delete(code);
  else {
    if (!room.players.has(room.host)) room.host = room.players.keys().next().value;
    if (room.status === 'lobby') for (const pilot of room.players.values()) pilot.ready = false;
    notifyRoom(room);
  }
}

function startRoom(room) {
  if (draining) return broadcast(room, { type: 'error', error: 'A game update is starting. Please try again shortly.' });
  if (room.status !== 'lobby') return;
  if (room.mode === 'cup' && room.cupRound === 0 && room.players.size < 2) return broadcast(room, { type: 'error', error: 'A cup needs at least two pilots.' });
  // Authoritative weekly runs wait for preparation just like multiplayer runs.
  // The other legacy solo paths continue to start immediately.
  if((!room.solo || room.mode === 'weekly') && !canStartRoom(room)){room.startRequested=true;notifyRoom(room);return;}
  room.status = 'countdown';
  room.pausedAt = 0;
  room.countdown = Date.now() + 3500;
  const spawn = getSpawn(room.track);
  let index = 0;
  for (const item of room.players.values()) {
    const offset = (index++ - (room.players.size - 1) / 2) * 1.6;
    item.state = createDroneState([spawn.position[0] + Math.cos(spawn.yaw) * offset, spawn.position[1], spawn.position[2] - Math.sin(spawn.yaw) * offset], spawn.yaw);
    item.resetId++;
    resetCommandStream(item);
    item.gate = 0; item.lap = 1; item.finishMs = null; item.penaltyMs = 0; item.score = 0; item.replay = []; item.maxSpeed = 0;
    if (room.mode === 'freestyle') resetFreestyle(item);
  }
  notifyRoom(room);
  snapshot(room);
}

function finishPlayer(room, item) {
  item.finishMs = Date.now() - room.started + (room.mode === 'precision' ? item.penaltyMs : 0);
  if (item.player.guest) return;
  const id = item.player.id;
  const recordTrack = room.mode === 'precision' ? `precision-${room.track.id}` : room.track.id;
  const prior = db.prepare('SELECT best_ms FROM records WHERE user_id=? AND track=?').get(id, recordTrack);
  if (!prior || item.finishMs < prior.best_ms) db.prepare('INSERT INTO records (user_id,track,best_ms) VALUES (?,?,?) ON CONFLICT(user_id,track) DO UPDATE SET best_ms=excluded.best_ms').run(id, recordTrack, item.finishMs);
  if ((!prior || item.finishMs < prior.best_ms) && item.replay.length) {
    db.prepare('INSERT INTO replays (user_id,track,best_ms,build,frames) VALUES (?,?,?,?,?) ON CONFLICT(user_id,track) DO UPDATE SET best_ms=excluded.best_ms, build=excluded.build, frames=excluded.frames').run(id, recordTrack, item.finishMs, JSON.stringify(item.build), JSON.stringify(item.replay));
  }
  db.prepare('UPDATE users SET xp=xp+?, credits=credits+? WHERE id=?').run(50, 60, id);
  db.prepare('INSERT OR IGNORE INTO achievements (user_id,code) VALUES (?,?)').run(id, 'first-finish');
  if (item.maxSpeed >= 100) db.prepare('INSERT OR IGNORE INTO achievements (user_id,code) VALUES (?,?)').run(id, 'speed-100');
  if (room.mode === 'weekly') db.prepare('INSERT INTO weekly_records (user_id,week,track,best_ms) VALUES (?,?,?,?) ON CONFLICT(user_id,week,track) DO UPDATE SET best_ms=min(best_ms,excluded.best_ms)').run(id, room.week, room.track.id, item.finishMs);
  if (room.mode === 'career') {
    const mission = CAREER.find(entry => entry.track === room.track.id);
    if (mission) {
      const alreadyCompleted = db.prepare('SELECT 1 FROM career WHERE user_id=? AND mission=?').get(id, mission.id);
      const stars = item.finishMs / 1000 <= mission.target ? 3 : item.finishMs / 1000 <= mission.target * 1.25 ? 2 : 1;
      db.prepare('INSERT INTO career (user_id,mission,stars) VALUES (?,?,?) ON CONFLICT(user_id,mission) DO UPDATE SET stars=max(stars,excluded.stars)').run(id, mission.id, stars);
      if (!alreadyCompleted) db.prepare('UPDATE users SET credits=credits+? WHERE id=?').run(mission.reward, id);
      if (db.prepare('SELECT count(*) AS total FROM career WHERE user_id=? AND stars>0').get(id).total === CAREER.length) db.prepare('INSERT OR IGNORE INTO achievements (user_id,code) VALUES (?,?)').run(id, 'career-complete');
    }
  }
}

function saveFreestyleResult(player, map, score) {
  if (player.guest) return { saved: false, bestScore: null, rewards: { xp: 0, credits: 0 } };
  const rewards = { xp: Math.min(100, Math.floor(score / 10)), credits: Math.min(150, Math.floor(score / 8)) };
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO freestyle_scores (user_id,map,best_score) VALUES (?,?,?) ON CONFLICT(user_id,map) DO UPDATE SET best_score=max(best_score,excluded.best_score)').run(player.id, map, score);
    db.prepare('UPDATE users SET xp=xp+?, credits=credits+? WHERE id=?').run(rewards.xp, rewards.credits, player.id);
    if (score >= 300) db.prepare('INSERT OR IGNORE INTO achievements (user_id,code) VALUES (?,?)').run(player.id, 'freestyle-300');
    const bestScore = db.prepare('SELECT best_score FROM freestyle_scores WHERE user_id=? AND map=?').get(player.id, map).best_score;
    db.exec('COMMIT');
    return { saved: true, bestScore, rewards };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function endRoom(room) {
  if (room.mode === 'cup') {
    for (const award of cupRoundPoints([...room.players.values()])) {
      const entry = room.cupScores.get(award.id);
      entry.points += award.points; entry.finishes++; entry.totalMs += award.timeMs;
    }
    if (room.cupRound === room.cupCourses.length - 1) {
      const standings = cupStandings(room.cupScores, room.players.keys());
      standings.forEach((entry, place) => {
        const participant = room.players.get(entry.id);
        if (!participant || participant.player.guest || entry.finishes === 0) return;
        db.prepare('INSERT INTO cup_scores (user_id,wins,podiums,points) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET wins=wins+excluded.wins,podiums=podiums+excluded.podiums,points=points+excluded.points')
          .run(entry.id, place === 0 ? 1 : 0, place < 3 ? 1 : 0, entry.points);
      });
    }
  }
  if (room.ranked) {
    const ordered = [...room.players.values()].sort((a, b) => (a.finishMs ?? Infinity) - (b.finishMs ?? Infinity));
    ordered.forEach((item, index) => { if (!item.player.guest) db.prepare('UPDATE users SET rating=max(100, rating+?) WHERE id=?').run(index === 0 && item.finishMs !== null ? 16 : -10, item.player.id); });
  }
  if (room.mode === 'freestyle') for (const item of room.players.values()) saveFreestyleResult(item.player, room.map.id, item.score);
  room.status = 'ended';
  notifyRoom(room);
}

function advanceCupRound(room) {
  if (room.mode !== 'cup' || room.status !== 'ended' || room.cupRound >= room.cupCourses.length - 1) return;
  room.cupRound++;
  const course = room.cupCourses[room.cupRound];
  room.map = MAPS[course.map]; room.track = getTrack(course.map, course.track);
  ensureCollision(room.map,room.track);
  room.obstacles = getTrackObstacles(room.map.id,room.track);
  room.freestyleObstacles = room.obstacles.filter(obstacle => obstacle.size);
  room.status = 'lobby'; room.startRequested = false; room.started = 0; room.countdown = 0;
  for (const item of room.players.values()) { item.ready = false; item.controllerReady = false; item.state = null; item.finishMs = null; item.penaltyMs = 0; }
  notifyRoom(room);
}

function tick() {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.status === 'countdown' && now >= room.countdown) { room.status = 'running'; room.started = now; for (const item of room.players.values()) item.lastInputAt = now; notifyRoom(room); }
    if (room.status !== 'running') continue;
    room.frameCounter = (room.frameCounter || 0) + 1;
    for (const item of room.players.values()) {
      if (!item.state || item.finishMs !== null) continue;
      // Ranked builds and controllers were standardized when joining the room.
      const effective = item.spec;
      const wasFailSafe = item.failSafe;
      const commands = takeCommands(item, now);
      if (item.failSafe && !wasFailSafe) send(item.socket, { type: 'input-stalled', resetId: item.resetId });
      for (const command of commands) {
      const old = [...item.state.position];
      simulateCommand(item.state, command, effective, room.map, room.track, room.obstacles, item.controller);
      if (command.seq) item.lastSeq = command.seq;
      item.maxSpeed = Math.max(item.maxSpeed, Math.hypot(...item.state.velocity) * 3.6);
      if (room.frameCounter % 6 === 0 && item.replay.length < 6000) item.replay.push({ time: now - room.started, position: [...item.state.position], rotation: [...item.state.rotation] });
      const crashed = item.state.crashed;
      if (crashed) {
        if (room.mode === 'freestyle') resetFreestyle(item, true);
        if (room.mode === 'precision') item.penaltyMs += 5000;
        resetAtCheckpoint(item, room);
        if (room.mode !== 'training' && room.mode !== 'freestyle') item.score -= 5;
      }
      if (room.mode === 'freestyle') {
        if (!crashed) scoreFreestyle(item, old, room.track, room.freestyleObstacles, now, FIXED_DT);
      } else if (room.mode !== 'training') {
        const gate = room.track.gates[item.gate];
        if (!crashed && gate && gateCrossed(old, item.state.position, gate)) {
          broadcast(room, {type:'checkpoint',id:item.player.id,gate:item.gate,lap:item.lap});
          item.gate++;
          if (item.gate === room.track.gates.length) {
            item.gate = 0; item.lap++;
            if (item.lap > room.track.laps) {
              finishPlayer(room, item);
              broadcast(room, { type: 'finish', id: item.player.id, timeMs: item.finishMs, penaltyMs: item.penaltyMs });
              notifyRoom(room);
            }
          }
        }
      }
      if (crashed || item.finishMs !== null) break;
      }
    }
    if (room.mode === 'freestyle' && now - room.started > 180_000) {
      endRoom(room);
    } else if (room.mode !== 'training' && room.mode !== 'freestyle' && ([...room.players.values()].every(item => item.finishMs !== null) || now - room.started > 600_000)) endRoom(room);
  }
}

let broadcastTick = 0;
let lastPhysicsTime = performance.now();
let physicsAccumulator = 0;
let serverTick = 0;
setInterval(() => {
  const now = performance.now();
  timerDelay.add(Math.max(0, now - lastPhysicsTime - 1000 / 60));
  const advance = fixedSteps(physicsAccumulator, (now - lastPhysicsTime) / 1000, 0.25);
  simulationDroppedMs += Math.max(0, (physicsAccumulator + (now - lastPhysicsTime) / 1000 - advance.steps * FIXED_DT - advance.remainder) * 1000);
  physicsAccumulator = advance.remainder;
  lastPhysicsTime = now;
  for (let step = 0; step < advance.steps; step++) {
    const started = performance.now();
    tick();
    serverTick++;
    if (++broadcastTick % 3 === 0) {
      for (const room of rooms.values()) if (room.status === 'running') snapshot(room);
    }
    tickDuration.add(performance.now() - started);
  }
}, 1000 / 60);

setInterval(() => {
  console.log(JSON.stringify(currentMetrics()));
  sentBytes = 0; socketDisconnects = 0;
  tickDuration.clear(); timerDelay.clear();
}, 15_000).unref();

function attemptMatchmaking() {
  while (rankQueue.length >= 2) {
    const pair = rankQueue.splice(0, Math.min(8, rankQueue.length));
    const room = makeRoom(pair[0].player, pair[0].socket, { map: weekChallenge().map, track: weekChallenge().track, mode: 'race', ranked: true });
    for (const entry of pair.slice(1)) joinRoom(room, entry.player, entry.socket);
    if (room) startRoom(room);
  }
}

wss.on('connection', (socket, request) => {
  if (!socketLimit.allow(clientAddress(request, trustProxy)).allowed) return socket.close(1013, 'Too many connections');
  const authenticationTimeout = setTimeout(() => { if (!player) socket.close(1008, 'Sign in first'); }, 10_000);
  authenticationTimeout.unref();
  socket.on('close', () => { clearTimeout(authenticationTimeout); admission.release(socket); socketDisconnects++; });
  let player = null;
  socket.on('message', bytes => {
    try {
      const message = JSON.parse(String(bytes));
      if (message.type === 'auth') {
        if (player) return send(socket, { type: 'error', error: 'Already signed in on this connection.' });
        if (message.protocol !== NETWORK_PROTOCOL) return send(socket, { type: 'error', error: 'Game updated. Refresh this page.', updateRequired: true });
        const session = sessions.get(message.token);
        if (!session || session.expires < Date.now()) return send(socket, { type: 'error', error: 'Session expired.' });
        const reason = admission.acquire(socket, session.player.id);
        if (reason) {
          send(socket, { type: 'error', code: reason, error: reason === 'SERVER_FULL' ? 'Multiplayer is full. Please try again later; solo flight is available.' : 'This pilot is already online. Leave the other multiplayer session first.' });
          socket.close(1013, reason); return;
        }
        socket.sessionToken = message.token;
        player = session.player.guest ? session.player : loadUser(session.player.id);
        clearTimeout(authenticationTimeout);
        return send(socket, { type: 'authenticated', user: player });
      }
      if (socket.sessionToken && (!sessions.has(socket.sessionToken) || sessions.get(socket.sessionToken).expires < Date.now())) return socket.close(1008, 'Session expired');
      if (!player) return send(socket, { type: 'error', error: 'Sign in first.' });
      if (message.type === 'create') return makeRoom(player, socket, { map: message.map, track: message.track, mode: message.mode, visibility: message.visibility, maxPlayers: message.maxPlayers });
      if (message.type === 'solo') {
        const mode = ['race', 'time', 'freestyle', 'training', 'career', 'weekly'].includes(message.mode) ? message.mode : 'race';
        const course = mode === 'weekly' ? weekChallenge() : { map: message.map, track: message.track };
        const room = makeRoom(player, socket, { ...course, mode, solo: true });
        if (room) return startRoom(room);
        return;
      }
      if (message.type === 'join') {
        const room = rooms.get(String(message.code || '').toUpperCase());
        return room ? joinRoom(room, player, socket) : send(socket, { type: 'error', error: 'Room not found.' });
      }
      if (message.type === 'queue') {
        if (draining) return send(socket, { type: 'error', error: 'A game update is starting. Please try again shortly.' });
        if (player.guest) return send(socket, { type: 'error', error: 'Create a pilot account to enter ranked races.' });
        if (sockets.has(socket)) return send(socket, { type: 'error', error: 'Leave your current room before joining the ranked queue.' });
        if (rankQueue.some(entry => entry.player.id === player.id && entry.socket !== socket)) return send(socket, { type: 'error', error: 'This pilot is already queued.' });
        if (!rankQueue.some(entry => entry.socket === socket)) rankQueue.push({ player, socket });
        return attemptMatchmaking();
      }
      const room = rooms.get(sockets.get(socket));
      const item = room?.players.get(player.id);
      if (!item) return;
      if (message.type === 'chat') {
        const text = sanitizeChat(message.text);
        if (!text) return;
        if (!chatLimit.allow(`${room.code}:${player.id}`).allowed) return send(socket, { type: 'error', error: 'Chat is moving too fast. Wait a moment.' });
        const entry = { id: player.id, name: player.username, text, at: Date.now() };
        room.chat.push(entry); if (room.chat.length > 30) room.chat.shift();
        return broadcast(room, { type: 'chat', entry });
      }
      if (message.type === 'start' && room.host === player.id) return startRoom(room);
      if(message.type==='assets-ready'&&room.status==='lobby') {
        if(message.revision!==room.contentRevision || message.preparation!==roomPreparationKey(roomView(room))) return send(socket,{type:'error',error:'Content or room changed. Prepare the current room before starting.'});
        if(message.map!==room.map.id || message.track!==room.track.id || !item.controllerReady) return;
        item.ready=true;notifyRoom(room);if(room.startRequested)startRoom(room);return;
      }
      if (message.type === 'restart' && room.host === player.id && room.status === 'ended' && room.mode !== 'cup') { room.status = 'lobby'; return startRoom(room); }
      if (message.type === 'advance-cup' && room.host === player.id) return advanceCupRound(room);
      if (message.type === 'pause' && room.solo && room.players.size === 1 && ['running', 'countdown'].includes(room.status)) {
        room.resumeStatus = room.status; room.status = 'paused'; room.pausedAt = Date.now(); notifyRoom(room); return;
      }
      if (message.type === 'resume' && room.solo && room.status === 'paused') {
        const delay = Date.now() - room.pausedAt;
        room.started += delay; room.countdown += delay;
        room.pausedAt = 0; room.status = room.resumeStatus || 'running'; item.lastInputAt = Date.now(); notifyRoom(room); return;
      }
      if (message.type === 'restart-flight' && room.solo && ['running', 'paused'].includes(room.status)) {
        room.status = 'lobby'; return startRoom(room);
      }
      if (message.type === 'reset' && room.status === 'running') {
        if (item.finishMs !== null) return;
        resetAtCheckpoint(item, room);
        if (room.mode === 'freestyle') resetFreestyle(item, true);
        if (room.mode === 'precision') item.penaltyMs += 5000;
        if (room.mode !== 'training' && room.mode !== 'freestyle') item.score -= 5;
        snapshot(room); return;
      }
      if (message.type === 'controller' && room.status === 'lobby') {
        if(message.preparation!==roomPreparationKey(roomView(room))) return send(socket,{type:'error',error:'Room changed. Prepare the current room profile.'});
        item.controller = validateFlightController(room.ranked ? DEFAULT_FLIGHT_CONTROLLER : message.profile);
        item.controllerReady = true;
        send(socket, { type: 'controller-applied', preparation:message.preparation, profile: item.controller, slot: room.ranked ? 0 : Math.min(2, Math.max(0, Number(message.slot) || 0)), drone: item.build.drone });
        return;
      }
      if (['inputs','request-resync'].includes(message.type) && room.status === 'running' && item.finishMs === null && message.resetId === item.resetId) {
        if (message.type === 'request-resync' || enqueueCommands(item, message.frames) === 'resync') {
          item.resetId++; resetCommandStream(item); item.recovering = true;
          send(socket, {type:'input-resync', resetId:item.resetId, state:item.state, seq:0}); snapshot(room);
        }
      }
      if (message.type === 'leave') leaveRoom(socket);
    } catch (error) { send(socket, { type: 'error', error: error.message || 'Invalid message.' }); }
  });
  socket.on('close', () => {
    leaveRoom(socket);
    const index = rankQueue.findIndex(entry => entry.socket === socket);
    if (index !== -1) rankQueue.splice(index, 1);
  });
});

server.listen(port, bindHost, () => console.log(`${BRAND.name} — Singleplayer + Multiplayer: ${tlsOptions ? 'https' : 'http'}://localhost:${server.address().port}`));
