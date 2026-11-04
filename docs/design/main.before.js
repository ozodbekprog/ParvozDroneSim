import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import * as THREE from 'three';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import './style.css';
import { SoloSession } from './solo-session.js';
import { FrameStats } from './frame-stats.js';
import { DroneAudio } from './drone-audio.js';
import { TUTORIALS } from '../shared/catalog.js';
import { World } from './world.js';
import { flightTargets, projectFlightTarget } from './flight-navigation.js';
import { InputManager, deviceKey } from './input.js';
import { MAPS, CAREER, GAMEPLAY_OBSTACLES, getTrack, getSpawn } from '../shared/content.js';
import { DRONES, PARTS, defaultBuild, resolveBuild, stepDrone, resolveEnvironmentCollision, FIXED_DT, createDroneState } from '../shared/physics.js';
import { DEFAULT_FLIGHT_CONTROLLER, validateFlightController, rateDegrees } from '../shared/flight-controller.js';
import { initializeFlightProfiles, getFlightProfile, saveFlightProfile, selectFlightProfile, selectedSlot, deleteFlightProfile } from './flight-profiles.js';
import { simulateCommand } from '../shared/flight-session.js';
import { NETWORK_PROTOCOL, roomPreparationKey } from '../shared/network-flight.js';
import { PredictionHistory } from './prediction-history.js';
import { flightAssetURLs } from './asset-progress.js';
import { FlightLoading, nextPaint } from './flight-loading.js';
import { hasLoadedModel } from './asset-loader.js';
import { fixedSteps } from '../shared/timing.js';
import { cameraSettings, saveCameraSettings } from './camera-settings.js';
import { readGraphics, saveGraphics, selectGraphicsPreset, GRAPHICS_PRESETS } from './graphics-settings.js';
import { listReplays, getReplay, saveReplay, renameReplay, deleteReplay } from './replay-store.js';
import { createLocalBackup, restoreLocalBackup } from './local-backup.js';
import { applyCustomContent } from '../shared/custom-content.js';

const app = document.querySelector('#app');
app.innerHTML = `
  <div id="viewport"></div>
  <div class="ambient-vignette"></div>
  <div id="menu"></div>
  <div id="hud" class="hidden"></div>
  <div id="toast" class="toast hidden"></div>
  <output id="performance" class="performance hidden" aria-label="Performance"></output>
`;

const world = new World(document.querySelector('#viewport'));
const input = new InputManager();
initializeFlightProfiles(input);
const menu = document.querySelector('#menu');
const hud = document.querySelector('#hud');
const frameStats = new FrameStats();
let showPerformance = localStorage.getItem('liftoff-performance') === 'true';
let catalog = null, token = localStorage.getItem('liftoff-token'), user = null, account = null;
let solo = null, networkEnabled = false;
let socket = null, room = null, ownId = null, screen = 'loading', chosenMode = 'race', chosenMap = 'hangar', chosenTrack = 'hangar-circuit';
let flightMode = localStorage.getItem('liftoff-flight-mode') || 'acro', cameraMode = localStorage.getItem('liftoff-camera-mode') || 'fpv', latestInput = { throttle: 0, roll: 0, pitch: 0, yaw: 0 };
let localState = null, inputSeq = 0, lastTick = performance.now(), lastHud = 0, audio = null;
let physicsAccumulator = 0, lastSnapshotTick = -1, ownResetId = -1;
let connectionReady = false, outgoing = [];
const prediction = new PredictionHistory();
let activeFlightLoad = null, multiplayerPreparationKey = null, controllerPending = null, waitingResync = false;
let controllerDraft = null, controllerSlot = 0;
let activeFlightController = validateFlightController(DEFAULT_FLIGHT_CONTROLLER);
let serverClockOffset = 0;
let ghostFrames = [], ghostBuild = null, ghostIndex = 0, recorder = null, recordedChunks = [], clipBlob = null;
let flightGeneration = 0;
let statusMessage = '';
let pauseOpen = false, appliedControllerSlot = 0;
let replayBuffer = [], replayCaptureAt = 0, viewingReplay = null, replayPosition = 0, replayPlaying = false, replaySpeed = 1, replayLastFrame = 0;
let roomOptions = { visibility: 'private', maxPlayers: 8, mode: 'race' }, publicRoomsTimer = null;
const roomFilters = { mode: '', map: '', capacity: '', joinable: true };
let publicRoomEntries = null, publicRoomsRefresh = null;

const refreshControllerList = () => { if (screen === 'settings') renderSettings(); };
window.addEventListener('gamepadconnected', refreshControllerList);
window.addEventListener('gamepaddisconnected', refreshControllerList);
input.onDeviceChange = refreshControllerList;

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const fmtTime = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(Math.floor((ms % 1000) / 10)).padStart(2, '0')}`; };
const button = (label, action, extra = '') => `<button class="button ${extra}" data-action="${action}">${label}</button>`;
const multiplayerModes = { race: 'Race', precision: 'Precision Run', freestyle: 'Freestyle Session', cup: 'Championship · 3 rounds' };

function chatMessages(limit) {
  return (room?.chat || []).slice(-limit).map(entry => `<div><strong>${escapeHtml(entry.name)}</strong><span>${escapeHtml(entry.text)}</span></div>`).join('') || '<p class="empty">Room chat is empty.</p>';
}

function roomChatHTML(compact = false) {
  if (!room || room.solo) return '';
  return `<section class="room-chat ${compact ? 'flight-chat' : ''}"><div data-chat-log="${compact ? 4 : 8}" class="chat-messages">${chatMessages(compact ? 4 : 8)}</div><form data-chat-form class="chat-form ${compact ? 'hidden' : ''}" data-compact="${compact}"><input maxlength="180" aria-label="Room chat message" placeholder="Message this room…" autocomplete="off"/><button type="submit" class="mini-button">SEND</button></form>${compact ? '<button id="open-flight-chat" class="chat-open">CHAT · ENTER</button>' : ''}</section>`;
}

function refreshChatViews() {
  document.querySelectorAll('[data-chat-log]').forEach(element => { element.innerHTML = chatMessages(Number(element.dataset.chatLog)); element.scrollTop = element.scrollHeight; });
}

function openFlightChat() {
  const form = hud.querySelector('[data-chat-form]');
  if (!form) return;
  input.keys.clear(); form.classList.remove('hidden'); form.querySelector('input').focus();
}

function bindChatForms(root) {
  root.querySelectorAll('[data-chat-form]').forEach(form => {
    const field = form.querySelector('input');
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (field.value.trim()) send({ type: 'chat', text: field.value });
      field.value = '';
      if (form.dataset.compact === 'true') { field.blur(); form.classList.add('hidden'); }
    });
    field.addEventListener('keydown', event => {
      if (event.code !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); field.blur();
      if (form.dataset.compact === 'true') form.classList.add('hidden');
    });
  });
  root.querySelector('#open-flight-chat')?.addEventListener('click', openFlightChat);
}

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.classList.remove('hidden');
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => element.classList.add('hidden'), 4200);
}

async function api(path, method = 'GET', body) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function refreshAccount() {
  if (!token) return;
  account = await api('/me');
  user = account.user;
}

function connect() {
  networkEnabled = true;
  socket?.close();
  connectionReady = false;
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/socket`);
  const connection = socket;
  socket.addEventListener('open', () => connection.send(JSON.stringify({ type: 'auth', token, protocol: NETWORK_PROTOCOL })));
  socket.addEventListener('message', event => {
    if (!networkEnabled || solo || socket !== connection) return;
    const message = JSON.parse(event.data);
    if (message.type === 'error') { if(message.updateRequired) disconnectMultiplayer(); return toast(message.error); }
    if (message.type === 'authenticated') { connectionReady = true; outgoing.splice(0).forEach(send); return; }
    if (message.type === 'joined') {
      ownId = message.id;
      localState = null; ownResetId = -1; lastSnapshotTick = -1; physicsAccumulator = 0; inputSeq = 0; waitingResync=false; prediction.reset(null); multiplayerPreparationKey=null; input.throttle = 0; hud.dataset.layout = '';
      replayBuffer = []; replayCaptureAt = 0; ghostFrames = []; ghostIndex = 0; clipBlob = null; pauseOpen = false;
      activeFlightController = getFlightProfile(message.build?.drone || 'kestrel');
      appliedControllerSlot = selectedSlot(message.build?.drone || 'kestrel');
      return;
    }
    if (message.type === 'controller-applied') {
      activeFlightController = validateFlightController(message.profile);
      appliedControllerSlot = message.slot;
      if (controllerPending?.key === message.preparation) { controllerPending.resolve(); controllerPending=null; }
      return;
    }
    if (message.type === 'input-stalled') { requestResync(); return; }
    if (message.type === 'input-resync') {
      if (room?.players.find(item => item.id === ownId)?.finishMs != null) return;
      localState=structuredClone(message.state); ownResetId=message.resetId; inputSeq=0; physicsAccumulator=0; prediction.reset(localState); waitingResync=false;
      world.upsertDrone(ownId,resolveBuild(room.players.find(item=>item.id===ownId).build),localState,true);world.resetDroneVisual(ownId,localState);
      toast('Flight synchronized');return;
    }
    if (message.type === 'room') {
      const wasStatus = room?.status;
      room = message.room;
      if (room.status === 'countdown' && wasStatus !== 'countdown') {
        localState = null; ownResetId = -1; physicsAccumulator = 0; inputSeq=0; prediction.reset(null); waitingResync = false; world.predictionRemainder = 0; input.throttle = 0; hud.dataset.layout = '';
        replayBuffer = []; replayCaptureAt = 0;
        world.setCameraMode(cameraMode);
      }
      if (room.status === 'lobby') {
        const key=roomPreparationKey(room);
        if(key!==multiplayerPreparationKey) { multiplayerPreparationKey=key; prepareMultiplayer(room,key); }
        else if(!activeFlightLoad) { screen='lobby'; render(); }
      }
      else if (room.status === 'countdown' || room.status === 'running' || room.status === 'paused') {
        if (!pauseOpen) {
          screen = 'flight';
          menu.classList.add('hidden');
          hud.classList.remove('hidden');
        }
        if (wasStatus !== 'running' && room.status === 'running') startAudio();
      } else if (room.status === 'ended') { stopVideo(); pauseOpen = false; screen = 'results'; render(); refreshAccount().catch(() => {}); }
      refreshChatViews();
      if (pauseOpen && screen === 'pause') renderPause();
      return;
    }
    if (message.type === 'snapshot') {
      if (!room) return;
      if (message.serverTick <= lastSnapshotTick) return;
      lastSnapshotTick = message.serverTick;
      serverClockOffset = Date.now() - message.serverTime;
      if (room.status === 'running' && message.serverTime - replayCaptureAt >= 45 && replayBuffer.length < 36000) {
        replayCaptureAt = message.serverTime;
        replayBuffer.push({ time: Math.max(0, message.serverTime - room.started), players: message.players.filter(player => player.state).map(player => ({ id: player.id, state: { position: player.state.position, rotation: player.state.rotation, motors:player.state.motors, motorRpm:player.state.motorRpm }, resetId: player.resetId })) });
      }
      const ids = message.players.map(player => player.id);
      if (ghostFrames.length) ids.push('ghost');
      for (const player of message.players) {
        if (!player.state) continue;
        const info = room.players.find(item => item.id === player.id);
        if (player.id === ownId) {
          const reset = ownResetId !== player.resetId || !localState;
          const build = room.ranked ? defaultBuild() : info?.build || user.build;
          const previous = localState;
          let corrected = false;
          if (player.failSafe) { requestResync(); continue; }
          if (reset) { localState=structuredClone(player.state); inputSeq=player.seq; prediction.reset(localState,player.seq); waitingResync=false; }
          else {
            const result=prediction.accept(player.state,player.seq,localState,(state,command)=>simulateCommand(state,command,resolveBuild(build),MAPS[room.map],getTrack(room.map,room.track),GAMEPLAY_OBSTACLES[room.map],activeFlightController));
            localState=result.state;corrected=result.corrected;
          }
          ownResetId = player.resetId;
          world.upsertDrone(player.id, resolveBuild(info?.build || user?.build), localState, true);
          if (reset) { physicsAccumulator = 0; input.throttle = 0; world.resetDroneVisual(player.id, localState); }
          else if (corrected && previous) world.correctDroneVisual(player.id, previous, localState);
          world.setActiveGate(player.gate);
        } else world.upsertDrone(player.id, resolveBuild(info?.build), player.state, false, false, true, player.resetId);
        if (info) { info.gate = player.gate; info.lap = player.lap; info.score = player.score; info.combo = player.combo; info.lastTrick = player.lastTrick; info.finishMs = player.finishMs; }
      }
      world.removeMissing(ids);
      if (room.players.find(item => item.id === ownId)?.finishMs != null && room.status === 'running') {
        if (!ids.includes(world.activeDroneId)) world.activeDroneId = ids.find(id => id !== ownId && id !== 'ghost') || null;
        world.setCameraMode('chase');
      }
      return;
    }
    if (message.type === 'chat') {
      if (!room) return;
      room.chat ||= [];
      room.chat.push(message.entry);
      if (room.chat.length > 30) room.chat.shift();
      refreshChatViews();
      return;
    }
    if (message.type === 'finish') {
      const player = room?.players.find(item => item.id === message.id);
      if (player) { player.finishMs = message.timeMs; player.penaltyMs = message.penaltyMs || 0; }
      if (message.id === ownId) {
        localState = null; physicsAccumulator = 0; world.predictionRemainder = 0; prediction.reset(null); hud.dataset.layout = '';
        world.removeMissing([...world.drones.keys()].filter(id => id !== ownId && id !== 'ghost'));
        world.activeDroneId = room.players.find(item => item.id !== ownId && item.finishMs === null)?.id || null;
        world.setCameraMode('chase');
      }
      toast(`${player?.name || 'Pilot'} finished in ${fmtTime(message.timeMs)}`);
    }
  });
  socket.addEventListener('close', () => {
    if (!networkEnabled || solo || socket !== connection) return;
    connectionReady = false;
    if (room) { cancelFlightLoading(); toast('Connection lost. Returned to the menu.'); pauseOpen = false; screen = 'home'; room = null; world.removeMissing([]); render(); }
    if (token && networkEnabled) setTimeout(() => { if (networkEnabled && socket?.readyState === WebSocket.CLOSED) connect(); }, 1500);
  });
}

function disconnectMultiplayer() {
  networkEnabled = false; connectionReady = false; outgoing = []; socket?.close(); socket = null;
}
function requestResync() {
  if(waitingResync || ownResetId<0 || room?.players.find(item => item.id === ownId)?.finishMs != null)return;
  waitingResync=true; send({type:'request-resync',resetId:ownResetId});
}
function send(message) {
  if (solo) {
    if (message.type === 'pause') solo.pause();
    if (message.type === 'resume') solo.resume();
    if (message.type === 'reset') { solo.reset(); input.throttle = 0; }
    if (['restart','restart-flight'].includes(message.type)) { solo.restart(); pauseOpen = false; screen = 'flight'; menu.classList.add('hidden'); hud.classList.remove('hidden'); }
    if (['reset','restart','restart-flight'].includes(message.type)) { localState = solo.state; world.resetDroneVisual(ownId, localState); }
    return;
  }
  if (!networkEnabled && ['join','create','queue'].includes(message.type)) connect();
  if (connectionReady && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  else if (message.type !== 'inputs' && outgoing.length < 8) outgoing.push(message);
}

function cancelFlightLoading() {
  flightGeneration++; activeFlightLoad?.cancel(); activeFlightLoad=null;
}

function loadingFlight(urls, title, cancel, retry) {
  screen='loading-flight';menu.classList.add('hidden');hud.classList.add('hidden');
  const session=new FlightLoading(urls,catalog.assets||[],{cached:hasLoadedModel,title,onCancel:cancel,onRetry:retry});
  activeFlightLoad=session; return session;
}

async function prepareMultiplayer(preparingRoom,key) {
  cancelFlightLoading(); multiplayerPreparationKey=key;
  const roomCode=preparingRoom.code;
  const specs=preparingRoom.players.map(player=>resolveBuild(player.build));
  const session=loadingFlight(flightAssetURLs(MAPS[preparingRoom.map],specs),'Preparing multiplayer',()=>{
    cancelFlightLoading();send({type:'leave'});room=null;disconnectMultiplayer();world.removeMissing([]);screen='home';render();
  },()=>prepareMultiplayer(room,roomPreparationKey(room)));
  const current=()=>activeFlightLoad===session && room?.code===roomCode && roomPreparationKey(room)===key;
  try {
    if(preparingRoom.contentRevision!==catalog.revision)throw new Error('Content updated. Cancel, refresh the page and rejoin the room.');
    const build=preparingRoom.players.find(player=>player.id===ownId).build;
    const controllerReady=new Promise((resolve,reject)=>{
      controllerPending={key,resolve};
      session.abort.signal.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});
    });
    controllerReady.catch(()=>{});
    send({type:'controller',profile:getFlightProfile(build.drone),slot:selectedSlot(build.drone),preparation:key});
    await session.download();session.stage('Processing models');await nextPaint();session.check();
    world.removeMissing([]);
    await world.load(preparingRoom.map,preparingRoom.track);session.check();
    const spawn=getSpawn(getTrack(preparingRoom.map,preparingRoom.track));
    const models=preparingRoom.players.map((player,index)=>world.upsertDrone(player.id,specs[index],createDroneState(spawn.position,spawn.yaw)));
    await Promise.all(models.map(item=>item.mesh.assetsReady));await controllerReady;session.check();
    applyCameraSettings();world.setCameraMode(cameraMode);
    session.stage('Preparing graphics');await nextPaint();session.check();await world.prepareGraphics();session.check();
    if(!current())return;
    session.finish();activeFlightLoad=null;screen='lobby';render();
    send({type:'assets-ready',map:preparingRoom.map,track:preparingRoom.track,revision:preparingRoom.contentRevision,preparation:key});
  } catch(error) { if(current() && error.name!=='AbortError') {world.removeMissing([]);world.map=null;world.load('hangar','hangar-circuit');session.error(error);} }
}

function askReplay(title, initialValue, confirmLabel = 'SAVE') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'help-overlay replay-dialog';
    overlay.innerHTML = `<form class="help-card" role="dialog" aria-modal="true"><h2>${escapeHtml(title)}</h2>${initialValue === null ? '' : `<label>NAME<input id="replay-name" maxlength="80" value="${escapeHtml(initialValue)}" required /></label>`}<div class="panel-actions"><button class="button ghost" type="button" id="dialog-cancel">CANCEL</button><button class="button primary" type="submit">${escapeHtml(confirmLabel)}</button></div></form>`;
    app.appendChild(overlay);
    const close = value => { overlay.remove(); resolve(value); };
    overlay.querySelector('#dialog-cancel').addEventListener('click', () => close(null));
    overlay.querySelector('form').addEventListener('submit', event => { event.preventDefault(); close(initialValue === null ? true : overlay.querySelector('#replay-name').value.trim()); });
    overlay.addEventListener('keydown', event => { if (event.code === 'Escape') { event.stopPropagation(); close(null); } });
    overlay.querySelector('input')?.focus();
  });
}

function applyCameraSettings() {
  const activeBuild = room?.players?.find(player => player.id === ownId)?.build || user?.build || defaultBuild();
  const settings = cameraSettings(activeBuild);
  world.setFov(settings.fov);
  world.setFpvTilt(settings.tilt);
}

function shell(title, kicker, content, actions = '') {
  if (!['hangar', 'home', 'auth'].includes(screen) && world.hangarPreview) {
    world.hangarPreview = false;
    world.removeMissing([]);
    applyCameraSettings();
  }
  menu.classList.remove('hidden');
  menu.className = `menu-${screen}`;
  menu.classList.toggle('hero', screen === 'auth' || screen === 'home');
  hud.classList.add('hidden');
  menu.innerHTML = `
    <header class="topbar"><div class="brand"><span class="brand-mark">◢</span><span>DRONE<span class="brand-light">LIFTOFF</span></span></div><span class="top-meta">FPV FLIGHT SIMULATOR</span><button class="account-button" data-action="profile" aria-label="Pilot profile"><span class="account-avatar">${user ? escapeHtml(user.username.slice(0, 1).toUpperCase()) : '◉'}</span><span class="account-name">${user ? escapeHtml(user.username) : 'PILOT OFFLINE'}</span>${user && !user.guest ? `<span class="account-credits">${user.credits} CR</span>` : ''}</button><button class="help-button" data-action="help" aria-label="Controls help">?</button></header>
    <main class="menu-layout"><section class="menu-panel"><div class="eyebrow">${kicker}</div><h1>${title}</h1>${content}<div class="panel-actions">${actions}</div></section>${['hangar','home','auth'].includes(screen) ? '<div class="hangar-stage" aria-label="Drag to rotate drone"><span>DRAG TO ROTATE</span></div>' : ''}</main>
  `;
  menu.querySelectorAll('[data-action]').forEach(element => element.addEventListener('click', () => onAction(element.dataset.action, element)));
}

function render() {
  if (screen !== 'multiplayer' && publicRoomsTimer) { clearInterval(publicRoomsTimer); publicRoomsTimer = null; }
  if (screen === 'loading') return shell('Preparing flight', 'INITIALIZING', '<p>Connecting to the local flight server…</p>');
  if (screen === 'auth') return renderAuth();
  if (screen === 'home') return renderHome();
  if (screen === 'maps') return renderMaps();
  if (screen === 'hangar') return renderHangar();
  if (screen === 'career') return renderCareer();
  if (screen === 'multiplayer') return renderMultiplayer();
  if (screen === 'lobby') return renderLobby();
  if (screen === 'results') return renderResults();
  if (screen === 'profile') return renderProfile();
  if (screen === 'weekly') return renderWeekly();
  if (screen === 'settings') return renderSettings();
  if (screen === 'flight-controller') return renderFlightController();
  if (screen === 'pause') return renderPause();
  if (screen === 'graphics') return renderGraphics();
  if (screen === 'replays') return renderReplays();
  if (screen === 'replay-viewer') return renderReplayViewer();
}

function renderAuth() {
  shell('Every great flight starts here.', 'PILOT ACCESS', `
    <p class="lead">Create a pilot account to save builds, lap records, achievements and ranking on this game server.</p>
    <div class="auth-grid"><label>CALLSIGN<input id="auth-name" autocomplete="username" maxlength="20" placeholder="Your pilot name" /></label><label>PASSWORD<input id="auth-password" type="password" autocomplete="current-password" placeholder="At least 8 characters" /></label></div>
    <div class="auth-note">Guest flight is available. Guest progress is not saved.</div>
  `, `${button('SIGN IN', 'login', 'primary')}${button('CREATE ACCOUNT', 'register')}${button('FLY AS GUEST', 'guest', 'ghost')}`);
}

function renderHome() {
  world.load('hangar', 'hangar-circuit');
  world.removeMissing([]);
  shell('Own the sky.', 'FLIGHT COMMAND', `
    <p class="lead">Real quadcopter feel, breathtaking places, and split-second racing. Choose your next line.</p>
    <div class="mode-grid">
      <button class="mode-card" data-action="mode-race"><span class="mode-icon">◈</span><strong>RACE</strong><small>Precision gates. Fast laps.</small></button>
      <button class="mode-card" data-action="mode-time"><span class="mode-icon">◷</span><strong>TIME TRIAL</strong><small>Beat your personal record.</small></button>
      <button class="mode-card" data-action="mode-freestyle"><span class="mode-icon">✧</span><strong>FREESTYLE</strong><small>Fly your own way.</small></button>
      <button class="mode-card" data-action="mode-training"><span class="mode-icon">✦</span><strong>TRAINING</strong><small>No pressure. Just flight.</small></button>
      <button class="mode-card" data-action="career"><span class="mode-icon">◉</span><strong>CAREER</strong><small>Courses and challenges.</small></button>
      <button class="mode-card" data-action="multiplayer"><span class="mode-icon">⌁</span><strong>MULTIPLAYER</strong><small>Host or join a room.</small></button>
      <button class="mode-card" data-action="weekly"><span class="mode-icon">◇</span><strong>WEEKLY EVENT</strong><small>One course. Seven days.</small></button>
    </div>
    <div class="quick-links">${button('DRONE HANGAR', 'hangar')}${button('CONTROLS', 'settings')}${button('GRAPHICS', 'graphics')}${button('FLIGHT SCHOOL', 'tutorials')}${button('REPLAYS', 'replays')}</div>
  `);
  setupWorkbench();
  if (!localStorage.getItem('liftoff-controls-seen')) showHelp();
}

function showHelp() {
  menu.querySelector('.help-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'help-overlay';
  overlay.innerHTML = `<div class="help-card" role="dialog" aria-modal="true" aria-label="Flight controls"><h2>Flight controls</h2><p>WASD · pitch and roll<br>Q / E · yaw<br>Left Shift / F · throttle<br>R · reset &nbsp; Esc · pause<br>C · camera &nbsp; M · flight mode</p><p>Connect a radio in Controls to calibrate it.</p><button class="button primary" id="close-help">GOT IT</button></div>`;
  menu.appendChild(overlay);
  overlay.querySelector('#close-help').addEventListener('click', () => { localStorage.setItem('liftoff-controls-seen', '1'); overlay.remove(); });
}

function renderMaps() {
  const cards = catalog.maps.map(map => `<button class="map-card ${chosenMap === map.id ? 'selected' : ''}" data-map="${map.id}"><img class="map-art" data-map-preview="${map.id}" alt="${escapeHtml(map.name)} — 3D map preview" /><span class="map-text"><small>${escapeHtml(map.region)}</small><strong>${escapeHtml(map.name)}</strong><em>${escapeHtml(map.description)}</em></span></button>`).join('');
  const map = MAPS[chosenMap];
  shell(chosenMode === 'multiplayer' ? 'Choose the arena.' : 'Choose your flight.', chosenMode.toUpperCase().replace('-', ' '), `
    <div class="map-grid">${cards}</div>
    <div class="track-row"><label>COURSE<select id="track-select">${map.tracks.map(track => `<option value="${track.id}" ${track.id === chosenTrack ? 'selected' : ''}>${escapeHtml(track.name)} · ${track.laps} ${track.laps === 1 ? 'lap' : 'laps'}</option>`).join('')}</select></label><div class="map-weather">WIND <strong>${Math.hypot(...map.wind).toFixed(1)} m/s</strong></div></div>
    ${chosenMode === 'multiplayer' ? `<p class="auth-note">${roomOptions.visibility.toUpperCase()} · ${roomOptions.maxPlayers} PILOTS MAX · ${multiplayerModes[roomOptions.mode]}${roomOptions.mode === 'cup' ? ' · two further locations follow this course' : ''}</p>` : ''}
  `, `${button('BACK', chosenMode === 'multiplayer' ? 'room-options' : 'home', 'ghost')}${button(chosenMode === 'multiplayer' ? 'CREATE ROOM' : 'START FLIGHT', 'launch', 'primary')}`);
  menu.querySelectorAll('[data-map]').forEach(element => element.addEventListener('click', () => {
    chosenMap = element.dataset.map; chosenTrack = MAPS[chosenMap].tracks[0].id; renderMaps();
  }));
  menu.querySelector('#track-select').addEventListener('change', event => { chosenTrack = event.target.value; });
  world.populateMapPreviews(menu.querySelectorAll('[data-map-preview]'));
}

function renderMultiplayer() {
  shell('Multiplayer', 'PUBLIC & PRIVATE ROOMS', `
    <div class="multiplayer-columns"><section><div class="section-heading"><h3>PUBLIC ROOMS <span id="room-count" class="room-count"></span></h3><button class="mini-button" id="refresh-rooms">REFRESH</button></div>
    <div class="room-filters"><label>MODE<select id="filter-room-mode"><option value="">All modes</option>${Object.entries(multiplayerModes).map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select></label><label>MAP<select id="filter-room-map"><option value="">All maps</option>${catalog.maps.map(map => `<option value="${escapeHtml(map.id)}">${escapeHtml(map.name)}</option>`).join('')}</select></label><label>MAXIMUM PILOTS<select id="filter-room-capacity"><option value="">Any capacity</option>${[2,3,4,5,6,7,8].map(count => `<option value="${count}">${count} pilots</option>`).join('')}</select></label><label class="room-joinable"><input id="filter-room-joinable" type="checkbox"/>Joinable only</label></div>
    <div id="public-rooms" class="public-rooms" aria-live="polite"><p class="empty">Finding rooms…</p></div>
    <h3>PRIVATE ROOM</h3><div class="join-row"><input id="join-code" maxlength="6" placeholder="ROOM CODE" aria-label="Private room code"/><button class="button" data-action="join-room">JOIN</button></div></section>
    <section class="multiplayer-sidebar"><h3>CUP LEADERBOARD</h3><div id="cup-leaderboard" class="cup-leaderboard"><p class="empty">Loading…</p></div><p class="auth-note">Host a public room for everyone to find, or share a private room code with friends.</p></section></div>
  `, `${button('BACK', 'home', 'ghost')}${button('CREATE ROOM', 'create-room', 'primary')}${button('RANKED MATCH', 'ranked')}`);
  for (const [id, key] of [['filter-room-mode','mode'],['filter-room-map','map'],['filter-room-capacity','capacity'],['filter-room-joinable','joinable']]) {
    const element = menu.querySelector(`#${id}`);
    if (key === 'joinable') element.checked = roomFilters.joinable;
    else element.value = roomFilters[key];
    element.addEventListener('change', () => { roomFilters[key] = key === 'joinable' ? element.checked : element.value; renderPublicRoomList(); });
  }
  menu.querySelector('#refresh-rooms').addEventListener('click', refreshPublicRooms);
  menu.querySelector('#join-code').addEventListener('keydown', event => { if (event.code === 'Enter') { event.preventDefault(); onAction('join-room'); } });
  renderPublicRoomList(); refreshPublicRooms();
  clearInterval(publicRoomsTimer); publicRoomsTimer = setInterval(refreshPublicRooms, 5000);
}

function showCreateRoomDialog() {
  if (screen !== 'multiplayer') return;
  const existing = menu.querySelector('.room-create-dialog');
  if (existing) return existing.focus();
  const dialog = document.createElement('dialog');
  dialog.className = 'room-create-dialog';
  dialog.setAttribute('aria-labelledby', 'room-create-title');
  dialog.innerHTML = `<form><div class="eyebrow">HOST A SESSION</div><h2 id="room-create-title">Create room</h2><div class="room-options"><label>VISIBILITY<select id="room-visibility"><option value="public">Public · listed in room browser</option><option value="private">Private · invite by code</option></select></label><label>MAXIMUM PILOTS<select id="room-capacity">${[2,3,4,5,6,7,8].map(count => `<option value="${count}">${count} pilots</option>`).join('')}</select></label><label>MODE<select id="room-mode">${Object.entries(multiplayerModes).map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select></label></div><p id="room-mode-description" class="auth-note"></p><div class="panel-actions"><button type="button" class="button ghost" id="cancel-room-create">CANCEL</button><button type="submit" class="button primary">SELECT MAP & COURSE</button></div></form>`;
  menu.appendChild(dialog);
  for (const [id, key] of [['room-visibility','visibility'],['room-capacity','maxPlayers'],['room-mode','mode']]) {
    const element = dialog.querySelector(`#${id}`); element.value = roomOptions[key];
    element.addEventListener('change', () => { roomOptions[key] = key === 'maxPlayers' ? Number(element.value) : element.value; updateRoomModeDescription(); });
  }
  dialog.querySelector('#cancel-room-create').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { dialog.remove(); menu.querySelector('[data-action="create-room"]')?.focus(); });
  dialog.addEventListener('keydown', event => { if (event.code === 'Escape') event.stopPropagation(); });
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault(); dialog.close();
    chosenMode = 'multiplayer';
    if (!MAPS[chosenMap]) chosenMap = 'hangar';
    if (!MAPS[chosenMap].tracks.some(track => track.id === chosenTrack)) chosenTrack = MAPS[chosenMap].tracks[0].id;
    screen = 'maps'; render();
  });
  updateRoomModeDescription(); dialog.showModal();
}

function updateRoomModeDescription() {
  const text = { race: 'Complete the course before the other pilots.', precision: 'Each crash or manual reset adds five seconds.', freestyle: 'Three minutes to score gates, dives, flips and close passes.', cup: 'Three races on different maps. Placement points decide the champion.' };
  const element = menu.querySelector('#room-mode-description'); if (element) element.textContent = text[roomOptions.mode];
}

function filteredPublicRooms(entries, filters = roomFilters) {
  return entries.filter(entry => (!filters.mode || entry.mode === filters.mode)
    && (!filters.map || entry.map === filters.map)
    && (!filters.capacity || Number(entry.maxPlayers) === Number(filters.capacity))
    && (!filters.joinable || entry.joinable));
}

function renderPublicRoomList() {
  const list = menu.querySelector('#public-rooms');
  if (!list) return;
  if (publicRoomEntries === null) { list.innerHTML = '<p class="empty">Finding rooms…</p>'; return; }
  const entries = filteredPublicRooms(publicRoomEntries);
  menu.querySelector('#room-count').textContent = `${entries.length} / ${publicRoomEntries.length}`;
  list.innerHTML = entries.map(entry => `<div class="public-room"><div><strong>${escapeHtml(MAPS[entry.map]?.name || entry.map)}</strong><small>${escapeHtml(MAPS[entry.map]?.tracks.find(track => track.id === entry.track)?.name || entry.track)} · ${multiplayerModes[entry.mode] || 'Race'}</small></div><span>${entry.players}/${entry.maxPlayers}</span><button class="mini-button" data-public-room="${escapeHtml(entry.code)}" ${entry.joinable ? '' : 'disabled'}>${entry.joinable ? 'JOIN' : entry.players >= entry.maxPlayers ? 'FULL' : 'IN PROGRESS'}</button></div>`).join('') || `<p class="empty">${publicRoomEntries.length ? 'No rooms match these filters.' : 'No public rooms. Create one for other pilots to find.'}</p>`;
  list.querySelectorAll('[data-public-room]').forEach(element => element.addEventListener('click', () => send({ type: 'join', code: element.dataset.publicRoom })));
}

async function refreshPublicRooms() {
  if (screen !== 'multiplayer' || publicRoomsRefresh) return;
  const request = {};
  publicRoomsRefresh = request;
  try {
    const [listing, leaderboard] = await Promise.all([api('/rooms'), api('/cup-leaderboard')]);
    if (screen !== 'multiplayer') return;
    publicRoomEntries = listing.rooms;
    renderPublicRoomList();
    menu.querySelector('#cup-leaderboard').innerHTML = leaderboard.rows.slice(0, 5).map((entry,index) => `<div class="record"><span>${index + 1}. ${escapeHtml(entry.username)}</span><strong>${entry.wins} W · ${entry.points} PTS</strong></div>`).join('') || '<p class="empty">Finish a three-round cup to enter this table. Guests can play; accounts keep their results.</p>';
  } catch (error) { if (screen === 'multiplayer') menu.querySelector('#public-rooms').textContent = error.message; }
  finally { if (publicRoomsRefresh === request) publicRoomsRefresh = null; }
}

function setupWorkbench() {
  const preview = createDroneState([3, 1.72, 7], 0);
  const item = world.replaceDrone('preview', resolveBuild(user?.build || defaultBuild()), preview);
  item.mesh.scale.multiplyScalar(1.6);
  world.hangarPreview = true;
  world.prepareHangarPreview();
  world.setFov(55);
  const stage = menu.querySelector('.hangar-stage');
  if (!stage) return;
  let lastX = 0, yaw = 0;
  stage.addEventListener('pointerdown', event => { lastX = event.clientX; stage.setPointerCapture(event.pointerId); });
  stage.addEventListener('pointermove', event => {
    if (!stage.hasPointerCapture(event.pointerId)) return;
    yaw += (event.clientX - lastX) * 0.012; lastX = event.clientX;
    preview.rotation = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  });
  stage.addEventListener('pointerup', event => stage.releasePointerCapture(event.pointerId));
}

function renderHangar() {
  const build = user?.build || defaultBuild();
  const owned = account?.ownedParts || Object.fromEntries(Object.entries(PARTS).map(([key, options]) => [key, options.map(option => option.id)]));
  const pendingPart = Object.entries(PARTS).map(([category, items]) => ({ category, part: items.find(item => item.id === build[category]) })).find(entry => entry.part && !owned[entry.category]?.includes(entry.part.id));
  world.load('hangar', 'hangar-circuit');
  const select = (key, options) => `<label>${key.toUpperCase()}<select data-build="${key}">${options.map(item => `<option value="${item.id}" ${build[key] === item.id ? 'selected' : ''}>${escapeHtml(item.name)}${!owned[key]?.includes(item.id) ? ` · ${item.cost} CR` : ''}</option>`).join('')}</select></label>`;
  const spec = resolveBuild(build);
  shell('Drone hangar', 'YOUR AIRCRAFT', `
    <div class="drone-choices">${Object.values(DRONES).map(drone => `<button class="drone-choice ${build.drone === drone.id ? 'selected' : ''}" data-drone="${drone.id}" ${!account?.unlocks.includes(drone.id) ? 'disabled' : ''}><strong>${escapeHtml(drone.name)}</strong><small>${!account?.unlocks.includes(drone.id) ? 'CAREER LOCK' : drone.class === 'three' ? 'AGILE 3″' : drone.class === 'seven' ? 'ENDURANCE 7″' : 'FREESTYLE 5″'}</small></button>`).join('')}</div>
    <h3>PARTS & LOOK</h3><div class="build-grid">${Object.entries(PARTS).map(([key, items]) => select(key, items)).join('')}<label>BODY COLOR<input data-build="color" type="color" value="${build.color}" /></label><label>LED COLOR<input data-build="led" type="color" value="${build.led}" /></label></div>
    <div class="stat-grid"><span>WEIGHT <strong>${spec.mass.toFixed(2)} KG</strong></span><span>THRUST / WEIGHT <strong>${spec.thrustToWeight.toFixed(1)}×</strong></span><span>FLIGHT TIME <strong>${Math.round(spec.batterySeconds / 60)} MIN</strong></span><span>CAMERA <strong>${spec.fov}°</strong></span></div>
    ${pendingPart ? `<p class="auth-note">${escapeHtml(pendingPart.part.name)} · ${pendingPart.part.cost} CR</p>` : ''}
  `, `${button('BACK', 'home', 'ghost')}${pendingPart ? button(`BUY ${escapeHtml(pendingPart.part.name)} · ${pendingPart.part.cost} CR`, 'buy-part', 'primary') : button('SAVE BUILD', 'save-build', 'primary')}`);
  menu.querySelectorAll('[data-drone]').forEach(element => element.addEventListener('click', () => {
    user.build = { ...user.build, drone: element.dataset.drone };
    renderHangar();
  }));
  menu.querySelectorAll('[data-build]').forEach(element => element.addEventListener('change', event => {
    const next = { ...user.build, [event.target.dataset.build]: event.target.value };
    user.build = next;
    renderHangar();
  }));
  setupWorkbench();
}

function renderCareer() {
  const completed = new Map((account?.career || []).map(item => [item.mission, item.stars]));
  shell('Become the pilot.', 'CAREER MISSIONS', `
    <p class="lead">Complete missions and unlock the Viper R.</p>
    <div class="mission-list">${CAREER.map((mission, index) => `<button class="mission" data-mission="${mission.id}"><span class="mission-index">${String(index + 1).padStart(2, '0')}</span><span><strong>${escapeHtml(mission.name)}</strong><small>${escapeHtml(MAPS[mission.map].region)} · Target ${fmtTime(mission.target * 1000)}</small></span><span class="stars">${'★'.repeat(completed.get(mission.id) || 0)}${'☆'.repeat(3 - (completed.get(mission.id) || 0))}</span></button>`).join('')}</div>
  `, button('BACK', 'home', 'ghost'));
  menu.querySelectorAll('[data-mission]').forEach(element => element.addEventListener('click', () => {
    const mission = CAREER.find(entry => entry.id === element.dataset.mission);
    chosenMode = 'career'; chosenMap = mission.map; chosenTrack = mission.track; launch.challenge = mission; launch();
  }));
}

function renderLobby() {
  if (!room) return;
  const players = room.players.map(item => `<div class="lobby-player"><span class="status-dot"></span><strong>${escapeHtml(item.name)}</strong><small>${item.ready?'READY':'LOADING ASSETS'} · ${escapeHtml(DRONES[item.build.drone]?.name || 'Drone')}</small></div>`).join('');
  shell('Ready for takeoff.', 'MULTIPLAYER ROOM', `
    <p class="lead">${room.visibility === 'public' ? 'This room is visible in the public room list.' : 'Share the code with the pilots you want to invite.'}</p>
    <div class="room-code">${escapeHtml(room.code)}</div>
    <div class="lobby-count">${room.players.length} / ${room.maxPlayers || 8} PILOTS · ${multiplayerModes[room.mode] || 'Race'}${room.cup ? ` · ROUND ${room.cup.round}/${room.cup.rounds}` : ''}</div><div class="lobby-list">${players}</div>${room.players.some(item=>!item.ready)?'<p id="asset-progress" class="auth-note">Waiting for selected assets to load…</p>':''}
    <div class="auth-note">${escapeHtml(MAPS[room.map].name)} · ${escapeHtml(getTrack(room.map, room.track).name)}</div>${roomChatHTML()}
  `, `${button('LEAVE ROOM', 'leave', 'ghost')}${room.host === ownId ? button('START SESSION', 'start-room', 'primary') : '<span class="waiting">WAITING FOR HOST…</span>'}`);
  bindChatForms(menu);
}

function renderResults() {
  const sorted = [...room.players].sort((a, b) => (a.finishMs ?? Infinity) - (b.finishMs ?? Infinity));
  const finalCup = room.cup && room.cup.round === room.cup.rounds;
  shell(finalCup ? 'Championship complete' : 'Flight complete', room.cup ? `CUP · ROUND ${room.cup.round}/${room.cup.rounds}` : room.mode === 'freestyle' ? 'FREESTYLE SESSION' : 'RACE RESULTS', `
    <div class="result-list">${sorted.map((item, index) => `<div class="result-row"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(item.name)}${item.penaltyMs ? `<small>+${item.penaltyMs / 1000}s penalties</small>` : ''}</strong><em>${room.mode === 'freestyle' ? `${item.score} PTS` : item.finishMs === null ? 'DNF' : fmtTime(item.finishMs)}</em></div>`).join('')}</div>
    ${room.cup ? `<h3>CHAMPIONSHIP STANDINGS</h3><div class="cup-standings">${room.cup.standings.map((item,index) => `<div class="record"><span>${index + 1}. ${escapeHtml(item.name)}</span><strong>${item.points} PTS</strong></div>`).join('')}</div>` : ''}
    <p class="auth-note">${room.ranked ? 'Your server rating has been updated.' : room.cup ? 'Points: 10, 6, 4, 3, 2, 1. Ties use finishes, then combined time.' : 'Completed flights sync to your pilot profile. Replays save only when you choose Save.'}</p>
    ${roomChatHTML()}
  `, `${button('MAIN MENU', 'leave', 'ghost')}${replayBuffer.length ? button('SAVE REPLAY', 'save-replay') : ''}${clipBlob ? button('DOWNLOAD CLIP', 'download-clip') : ''}${room.host === ownId ? room.cup ? finalCup ? '' : button('NEXT ROUND', 'advance-cup', 'primary') : button('FLY AGAIN', 'restart', 'primary') : ''}`);
  bindChatForms(menu);
}

async function renderWeekly() {
  const data = await api('/weekly');
  catalog.weekly = data.challenge;
  const map = MAPS[data.challenge.map];
  shell('The weekly line.', 'WEEKLY CHALLENGE', `
    <p class="lead">Every pilot on this server races the same course this week. Set the fastest clean time before the event changes.</p>
    <div class="weekly-feature"><small>THIS WEEK'S COURSE</small><strong>${escapeHtml(map.region)} · ${escapeHtml(getTrack(map.id, data.challenge.track).name)}</strong></div>
    <h3>WEEKLY LEADERBOARD</h3><div class="result-list">${data.rows.map((entry, index) => `<div class="result-row"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(entry.username)}</strong><em>${fmtTime(entry.best_ms)}</em></div>`).join('') || '<p class="empty">No times posted yet. Take the first flight.</p>'}</div>
  `, `${button('BACK', 'home', 'ghost')}${button('RACE THIS WEEK', 'weekly-start', 'primary')}`);
}

async function renderProfile() {
  const data = account || { user, records: [], career: [], achievements: [] };
  const rows = data.records.map(record => `<div class="record"><span>${escapeHtml(record.track.replaceAll('-', ' ').toUpperCase())}</span><strong>${fmtTime(record.best_ms)}</strong></div>`).join('') || '<p class="empty">No recorded laps yet.</p>';
  const ranking = await api('/rankings').catch(() => ({ rows: [] }));
  shell('Pilot logbook.', 'PROFILE & RECORDS', `
    <div class="profile-top"><div class="avatar">${escapeHtml(user.username.slice(0, 1).toUpperCase())}</div><div><h2>${escapeHtml(user.username)}</h2><span>${user.guest ? 'GUEST PILOT' : `LEVEL ${Math.floor(user.xp / 500) + 1} · ${user.xp} XP · ${user.credits} CREDITS`}</span></div><div class="rating">RATING<strong>${user.rating}</strong></div></div>
    <div class="profile-columns"><div><h3>PERSONAL RECORDS</h3>${rows}<h3>ACHIEVEMENTS</h3><div class="achievement ${data.achievements.includes('first-finish') ? 'earned' : ''}">✦ First Finish <small>Complete a race</small></div><div class="achievement ${data.achievements.includes('speed-100') ? 'earned' : ''}">◈ Velocity <small>Reach 100 km/h</small></div><div class="achievement ${data.achievements.includes('freestyle-300') ? 'earned' : ''}">✧ Flow State <small>Score 300 freestyle points</small></div><div class="achievement ${data.achievements.includes('career-complete') ? 'earned' : ''}">★ Champion <small>Finish all career missions</small></div></div><div><h3>SERVER RANKINGS</h3>${ranking.rows.map((entry, index) => `<div class="record"><span>${String(index + 1).padStart(2, '0')} · ${escapeHtml(entry.username)}</span><strong>${entry.rating}</strong></div>`).join('') || '<p class="empty">No pilots ranked yet.</p>'}</div></div>
  `, `${button('BACK', 'home', 'ghost')}${button('EXPORT LOCAL DATA', 'export-local')}${button('IMPORT LOCAL DATA', 'import-local')}${button('SIGN OUT', 'logout')}`);
}

function renderSettings() {
  const devices = input.devices();
  const profile = input.profile();
  const camera = cameraSettings(user?.build || defaultBuild());
  shell('Controls', 'RADIO & SETTINGS', `
    <div class="controls-form">
      <div class="compact-row"><label>FLIGHT MODE<select id="flight-mode"><option value="angle">Angle</option><option value="horizon">Horizon</option><option value="acro">Acro</option></select></label><label>CAMERA<select id="camera-mode"><option value="fpv">FPV</option><option value="chase">Chase</option></select></label></div>
      <div class="compact-row"><label>FPV TILT <strong id="tilt-value">${camera.tilt}°</strong><input id="fpv-tilt" type="range" min="0" max="60" value="${camera.tilt}" /></label><label>FPV FOV <strong id="fov-value">${camera.fov}°</strong><input id="fpv-fov" type="range" min="75" max="125" value="${camera.fov}" /></label></div>
      <button class="button tuning-link" data-action="flight-controller">FLIGHT CONTROLLER TUNING →</button>
      <h3>RADIO CALIBRATION</h3><label>DEVICE<select id="device-select"><option value="">Auto select</option><option value="keyboard">Keyboard only</option>${devices.map(device => `<option value="${escapeHtml(deviceKey(device))}">${escapeHtml(device.id.slice(0, 60))}</option>`).join('')}</select></label>
      <label>THROTTLE STICK<select id="throttle-mode"><option value="full">Full travel · RC radio</option><option value="centered">Centered · gamepad</option></select></label>
      <button class="mini-button calibrate-button" id="connect-hid">CONNECT WEBHID RADIO</button>
      <div id="axis-list">${['throttle', 'yaw', 'pitch', 'roll'].map(name => `<div class="axis-row"><span>${name.toUpperCase()}</span><button class="mini-button" data-capture="${name}">AXIS ${profile.axis[name]} · REMAP</button><label class="check"><input type="checkbox" data-invert="${name}" ${profile.invert[name] ? 'checked' : ''}/> INVERT</label></div>`).join('')}</div>
      <button class="mini-button calibrate-button" id="calibrate-endpoints">CALIBRATE ENDPOINTS · 9 SEC</button>
      <label>DEAD ZONE <strong id="deadzone-value">${Math.round(profile.deadzone * 100)}%</strong><input id="deadzone" type="range" min="0" max="20" value="${profile.deadzone * 100}" /></label>
    </div>
  `, button('BACK', 'settings-back', 'ghost'));
  menu.querySelector('.menu-layout').insertAdjacentHTML('beforeend', '<section class="virtual-radio"><h2>LIVE RADIO</h2><div class="radio-device"><div class="radio-grip"><div class="radio-gimbal"><i id="radio-left"></i></div><small>YAW · THROTTLE</small></div><div class="radio-center">◢</div><div class="radio-grip"><div class="radio-gimbal"><i id="radio-right"></i></div><small>ROLL · PITCH</small></div></div><div id="radio-readout">Connect your selected radio or choose Keyboard only.</div><small class="radio-note">The calibrated values drive flight directly. Pitch up = nose down; roll and yaw right = turn right.</small></section>');
  menu.querySelector('#flight-mode').value = flightMode;
  menu.querySelector('#camera-mode').value = cameraMode;
  menu.querySelector('#device-select').value = input.selected || '';
  menu.querySelector('#throttle-mode').value = profile.throttleMode;
  menu.querySelector('#flight-mode').addEventListener('change', event => { flightMode = event.target.value; localStorage.setItem('liftoff-flight-mode', flightMode); });
  menu.querySelector('#camera-mode').addEventListener('change', event => { cameraMode = event.target.value; world.setCameraMode(cameraMode); localStorage.setItem('liftoff-camera-mode', cameraMode); });
  for (const [id, key, valueId] of [['fpv-tilt', 'tilt', 'tilt-value'], ['fpv-fov', 'fov', 'fov-value']]) {
    menu.querySelector(`#${id}`).addEventListener('input', event => {
      saveCameraSettings(user?.build || defaultBuild(), { [key]: Number(event.target.value) });
      menu.querySelector(`#${valueId}`).textContent = `${event.target.value}°`;
      applyCameraSettings();
    });
  }
  menu.querySelector('#device-select').addEventListener('change', event => { input.selectDevice(event.target.value); renderSettings(); });
  menu.querySelector('#throttle-mode').addEventListener('change', event => { const next = input.profile(); next.throttleMode = event.target.value; input.saveProfile(next); });
  menu.querySelector('#connect-hid').addEventListener('click', async () => { try { if (await input.connectHid()) renderSettings(); } catch (error) { toast(error.message); } });
  menu.querySelectorAll('[data-capture]').forEach(element => element.addEventListener('click', () => { element.textContent = 'MOVE THAT STICK…'; input.beginCapture(element.dataset.capture, axis => { element.textContent = `AXIS ${axis} · REMAP`; toast(`${element.dataset.capture.toUpperCase()} mapped to axis ${axis}`); }); }));
  menu.querySelectorAll('[data-invert]').forEach(element => element.addEventListener('change', () => { const next = input.profile(); next.invert[element.dataset.invert] = element.checked; input.saveProfile(next); }));
  menu.querySelector('#calibrate-endpoints').addEventListener('click', () => { const started = input.beginCalibration(() => toast('Stick endpoints saved.')); toast(started ? 'Move every stick fully through its range for nine seconds.' : 'Connect and select a controller first.'); });
  menu.querySelector('#deadzone').addEventListener('input', event => { const next = input.profile(); next.deadzone = Number(event.target.value) / 100; input.saveProfile(next); menu.querySelector('#deadzone-value').textContent = `${event.target.value}%`; });
}

function renderPause() {
  shell('Flight paused', room?.solo ? 'SOLO · SIMULATION STOPPED' : 'MULTIPLAYER · FLIGHT CONTINUES', `
    <p class="lead">${room?.solo ? 'Your drone and timer are frozen.' : room?.players.find(player => player.id === ownId)?.finishMs != null ? 'You have finished. Remaining pilots keep flying.' : 'Other pilots and your drone keep flying while this menu is open.'}</p>
    <div class="pause-stats">${escapeHtml(DRONES[room?.players.find(player => player.id === ownId)?.build?.drone]?.name || 'Drone')} · Profile ${appliedControllerSlot + 1} · ${flightMode.toUpperCase()}</div>
    ${room && !room.solo ? `<h3>PILOTS IN THIS ROOM</h3><div class="pause-roster">${room.players.map(player => `<div class="record"><span>${escapeHtml(player.name)}${player.id === ownId ? ' · YOU' : ''}</span><strong>${player.finishMs == null ? 'FLYING' : fmtTime(player.finishMs)}</strong></div>`).join('')}</div>${roomChatHTML()}` : ''}
  `, `${button('CONTINUE', 'continue-flight', 'primary')}${room?.solo ? button('RESTART', 'restart-flight') : ''}${replayBuffer.length ? button('SAVE REPLAY', 'save-replay') : ''}${button('CONTROLS', 'settings')}${button('GRAPHICS', 'graphics')}${button('EXIT', 'leave', 'ghost')}`);
  bindChatForms(menu);
}

function renderGraphics() {
  const settings = readGraphics();
  const toggles = [['adaptiveResolution','ADAPTIVE RESOLUTION'], ['shadows', 'SHADOWS'], ['antialiasing', 'ANTIALIASING'], ['ambientOcclusion', 'AMBIENT OCCLUSION'], ['bloom', 'BLOOM'], ['sunShafts', 'SUN SHAFTS / GLOW'], ['clouds', 'CLOUDS'], ['motionBlur', 'MOTION BLUR']];
  shell('Graphics', 'DISPLAY & EFFECTS', `
    <div class="graphics-grid"><label>QUALITY<select id="graphics-preset">${['auto', ...Object.keys(GRAPHICS_PRESETS), 'custom'].map(name => `<option value="${name}">${name.toUpperCase()}</option>`).join('')}</select></label><label>RENDER SCALE <strong id="resolution-value">${Math.round(settings.resolution * 100)}%</strong><input id="graphics-resolution" type="range" min="50" max="125" value="${Math.round(settings.resolution * 100)}" /></label><label>EXPOSURE <strong id="exposure-value">${settings.exposure.toFixed(2)}</strong><input id="graphics-exposure" type="range" min="70" max="180" value="${Math.round(settings.exposure * 100)}" /></label></div>
    <div class="graphics-switches">${toggles.map(([key, label]) => `<label class="check"><input data-graphic="${key}" type="checkbox" ${settings[key] ? 'checked' : ''}/>${label}</label>`).join('')}</div>
    <p class="auth-note">Renderer: ${world.renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2 fallback'}. Settings are saved automatically in this browser.</p><output id="graphics-performance" class="auth-note"></output><p id="graphics-warning" class="auth-note" role="status"></p><p class="auth-note">F3 shows performance during flight.</p>
  `, button('BACK', 'graphics-back', 'ghost'));
  menu.querySelector('#graphics-preset').value = settings.quality;
  menu.querySelector('#graphics-preset').addEventListener('change', event => { world.setGraphics(selectGraphicsPreset(event.target.value)); renderGraphics(); });
  menu.querySelectorAll('[data-graphic]').forEach(element => element.addEventListener('change', () => { world.setGraphics(saveGraphics({ [element.dataset.graphic]: element.checked, quality: 'custom' })); menu.querySelector('#graphics-preset').value = 'custom'; }));
  for (const [id, key, display, divisor] of [['graphics-resolution', 'resolution', 'resolution-value', 100], ['graphics-exposure', 'exposure', 'exposure-value', 100]]) {
    menu.querySelector(`#${id}`).addEventListener('input', event => {
      const value = Number(event.target.value) / divisor;
      world.setGraphics(saveGraphics({ [key]: value, quality: 'custom' }));
      menu.querySelector(`#${display}`).textContent = key === 'resolution' ? `${event.target.value}%` : value.toFixed(2);
      menu.querySelector('#graphics-preset').value = 'custom';
    });
  }
}

async function renderReplays() {
  let records;
  try { records = await listReplays(); } catch (error) { toast(`Cannot open replay storage: ${error.message}`); records = []; }
  shell('Replays', 'LOCAL FLIGHT LIBRARY', `
    <p class="lead">Saved flights stay in this browser.</p>
    <div class="replay-list">${records.map(record => `<div class="replay-row"><div><strong>${escapeHtml(record.name)}</strong><small>${escapeHtml(MAPS[record.map]?.name || record.map)} · ${new Date(record.createdAt).toLocaleDateString()} · ${fmtTime(record.duration)}</small></div><button class="mini-button" data-watch="${record.id}">WATCH</button><button class="mini-button" data-rename="${record.id}">RENAME</button><button class="mini-button" data-delete="${record.id}">DELETE</button></div>`).join('') || '<p class="empty">No saved flights yet. Use Save Replay after flying.</p>'}</div>
  `, `${button('BACK', 'home', 'ghost')}${button('EXPORT LOCAL DATA', 'export-local')}${button('IMPORT LOCAL DATA', 'import-local')}`);
  menu.querySelectorAll('[data-watch]').forEach(element => element.addEventListener('click', async () => { viewingReplay = await getReplay(element.dataset.watch); replayPosition = 0; replayPlaying = true; replaySpeed = 1; screen = 'replay-viewer'; render(); }));
  menu.querySelectorAll('[data-rename]').forEach(element => element.addEventListener('click', async () => { const record = await getReplay(element.dataset.rename); const name = await askReplay('Rename replay', record.name, 'RENAME'); if (name !== null) { await renameReplay(record.id, name); renderReplays(); } }));
  menu.querySelectorAll('[data-delete]').forEach(element => element.addEventListener('click', async () => { if (await askReplay('Delete this replay?', null, 'DELETE')) { await deleteReplay(element.dataset.delete); renderReplays(); } }));
}

function renderReplayViewer() {
  if (!viewingReplay?.frames?.length) { screen = 'replays'; return renderReplays(); }
  world.load(viewingReplay.map, viewingReplay.track);
  world.removeMissing([]);
  world.setCameraMode(cameraMode); localStorage.setItem('liftoff-camera-mode', cameraMode);
  applyCameraSettings();
  shell('Replay', escapeHtml(viewingReplay.name), `
    <div class="replay-controls"><button class="button" id="replay-play">PAUSE</button><label>TIME<input id="replay-seek" type="range" min="0" max="${Math.round(viewingReplay.duration)}" value="0" /></label><span id="replay-clock">00:00.00</span><label>SPEED<select id="replay-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><button class="button" id="replay-camera">CAMERA</button></div>
  `, button('BACK', 'replays', 'ghost'));
  menu.querySelector('#replay-play').addEventListener('click', event => { if (!replayPlaying && replayPosition >= viewingReplay.duration) replayPosition = 0; replayPlaying = !replayPlaying; event.target.textContent = replayPlaying ? 'PAUSE' : 'PLAY'; });
  menu.querySelector('#replay-seek').addEventListener('input', event => { replayPosition = Number(event.target.value); updateReplayWorld(); });
  menu.querySelector('#replay-speed').addEventListener('change', event => { replaySpeed = Number(event.target.value); });
  menu.querySelector('#replay-camera').addEventListener('click', () => { cameraMode = cameraMode === 'fpv' ? 'chase' : 'fpv'; world.setCameraMode(cameraMode); localStorage.setItem('liftoff-camera-mode', cameraMode); });
}

function updateReplayWorld() {
  if (!viewingReplay?.frames?.length) return;
  const frames = viewingReplay.frames;
  let low = 0, high = frames.length - 1;
  while (low < high) { const mid = (low + high + 1) >> 1; if (frames[mid].time <= replayPosition) low = mid; else high = mid - 1; }
  const first = frames[low], next = frames[Math.min(low + 1, frames.length - 1)];
  const blend = next.time > first.time ? Math.min(1, Math.max(0, (replayPosition - first.time) / (next.time - first.time))) : 0;
  const ids = [];
  for (const player of first.players) {
    const later = next.players.find(item => item.id === player.id);
    const state = structuredClone(player.state);
    if (later && later.resetId === player.resetId) {
      state.position = state.position.map((value, index) => value + (later.state.position[index] - value) * blend);
      const a = new THREE.Quaternion(...state.rotation), b = new THREE.Quaternion(...later.state.rotation);
      state.rotation = a.slerp(b, blend).toArray();
    }
    const build = viewingReplay.builds?.[player.id] || viewingReplay.build;
    world.upsertDrone(player.id, resolveBuild(build || defaultBuild()), state, player.id === viewingReplay.ownId);
    ids.push(player.id);
  }
  world.removeMissing(ids);
  menu.querySelector('#replay-clock').textContent = fmtTime(replayPosition);
  menu.querySelector('#replay-seek').value = Math.round(replayPosition);
}

function numericTune(path, label, value, min, max, step = 1) {
  return `<label>${label}<input type="number" data-tune="${path}" min="${min}" max="${max}" step="${step}" value="${value}" /></label>`;
}

function updateRateGraph() {
  const svg = menu.querySelector('#rate-graph');
  if (!svg) return;
  const profile = validateFlightController(controllerDraft);
  for (const [axis, color] of [['roll', '#ff795c'], ['pitch', '#55e686'], ['yaw', '#5da8ff']]) {
    const points = Array.from({ length: 65 }, (_, index) => {
      const stick = index / 32 - 1;
      return `${15 + index * 4.53},${90 - Math.max(-800, Math.min(800, rateDegrees(stick, profile.rates[axis]))) * 0.09}`;
    });
    svg.querySelector(`#curve-${axis}`).setAttribute('points', points.join(' '));
    svg.querySelector(`#curve-${axis}`).setAttribute('stroke', color);
    menu.querySelector(`#velocity-${axis}`).textContent = `${Math.round(rateDegrees(1, profile.rates[axis]))}°/s`;
  }
}

function renderFlightController() {
  const drone = user?.build?.drone || 'kestrel';
  controllerDraft ||= getFlightProfile(drone);
  const profile = controllerDraft;
  shell('Flight controller', `${DRONES[drone]?.name || 'DRONE'} · TUNING`, `
    <div class="tune-top"><label>PROFILE<select id="tune-slot">${[0, 1, 2].map(index => `<option value="${index}" ${index === controllerSlot ? 'selected' : ''}>Profile ${index + 1}</option>`).join('')}</select></label><button class="mini-button" id="delete-tune">DELETE PROFILE</button></div>
    <div class="tune-layout"><section class="tune-card rates-card"><h3>BETAFLIGHT RATES</h3><div class="tune-rate-head"><span></span><span>RC RATE</span><span>RATE</span><span>RC EXPO</span><span>MAX</span></div>${['roll', 'pitch', 'yaw'].map(axis => `<div class="tune-rate-row"><strong>${axis.toUpperCase()}</strong>${numericTune(`rates.${axis}.rcRate`, '', profile.rates[axis].rcRate, 0.1, 2.5, 0.01)}${numericTune(`rates.${axis}.superRate`, '', profile.rates[axis].superRate, 0, 0.95, 0.01)}${numericTune(`rates.${axis}.expo`, '', profile.rates[axis].expo, 0, 1, 0.01)}<span id="velocity-${axis}"></span></div>`).join('')}<svg id="rate-graph" viewBox="0 0 320 180" role="img" aria-label="Live roll pitch yaw rate curves"><path d="M15 90 H305 M160 10 V170" stroke="#55707a" fill="none"/><polyline id="curve-roll" fill="none" stroke-width="2"/><polyline id="curve-pitch" fill="none" stroke-width="2"/><polyline id="curve-yaw" fill="none" stroke-width="2"/></svg></section>
    <section class="tune-card"><h3>PID CONTROLLER</h3><div class="tune-rate-head pid-head"><span></span><span>P</span><span>I</span><span>D</span></div>${['roll', 'pitch', 'yaw'].map(axis => `<div class="pid-row"><strong>${axis.toUpperCase()}</strong>${numericTune(`pid.${axis}.p`, '', profile.pid[axis].p, 0, 100)}${numericTune(`pid.${axis}.i`, '', profile.pid[axis].i, 0, 100)}${axis === 'yaw' ? '<span>—</span>' : numericTune(`pid.${axis}.d`, '', profile.pid[axis].d, 0, 100)}</div>`).join('')}</section>
    <section class="tune-card"><h3>LEVEL MODE</h3><div class="tune-fields">${numericTune('level.angleLimit', 'ANGLE LIMIT °', profile.level.angleLimit, 10, 85)}${numericTune('level.angleStrength', 'ANGLE STRENGTH', profile.level.angleStrength, 0, 100)}${numericTune('level.horizonStrength', 'HORIZON STRENGTH', profile.level.horizonStrength, 0, 100)}</div></section>
    <section class="tune-card"><h3>THROTTLE</h3><div class="tune-fields">${numericTune('throttle.start', 'START %', profile.throttle.start, 0, 50)}${numericTune('throttle.end', 'END %', profile.throttle.end, 50, 100)}${numericTune('throttle.mid', 'MID %', profile.throttle.mid, 10, 90)}${numericTune('throttle.expo', 'EXPO %', profile.throttle.expo, 0, 100)}${numericTune('throttle.idle', 'IDLE %', profile.throttle.idle, 0, 15)}</div><label class="check launch-check"><input type="checkbox" id="launch-control" ${profile.launchControl ? 'checked' : ''}/> LAUNCH CONTROL</label></section></div>
  `, `${button('BACK', 'settings', 'ghost')}<button class="button" id="undo-tune">UNDO</button><button class="button" id="default-tune">DEFAULTS</button><button class="button primary" id="save-tune">SAVE PROFILE</button>`);
  updateRateGraph();
  menu.querySelector('#tune-slot').addEventListener('change', event => { controllerSlot = Number(event.target.value); controllerDraft = selectFlightProfile(drone, controllerSlot); renderFlightController(); });
  menu.querySelectorAll('[data-tune]').forEach(element => element.addEventListener('input', () => { const [section, axis, field] = element.dataset.tune.split('.'); if (field) controllerDraft[section][axis][field] = Number(element.value); else controllerDraft[section][axis] = Number(element.value); updateRateGraph(); }));
  menu.querySelector('#launch-control').addEventListener('change', event => { controllerDraft.launchControl = event.target.checked; });
  menu.querySelector('#save-tune').addEventListener('click', () => { controllerDraft = saveFlightProfile(drone, controllerSlot, controllerDraft); toast('Flight profile saved.'); renderFlightController(); });
  menu.querySelector('#undo-tune').addEventListener('click', () => { controllerDraft = getFlightProfile(drone, controllerSlot); renderFlightController(); });
  menu.querySelector('#default-tune').addEventListener('click', () => { controllerDraft = structuredClone(DEFAULT_FLIGHT_CONTROLLER); renderFlightController(); });
  menu.querySelector('#delete-tune').addEventListener('click', () => { deleteFlightProfile(drone, controllerSlot); controllerDraft = getFlightProfile(drone, controllerSlot); renderFlightController(); });
}

async function onAction(action) {
  try {
    if (action === 'export-local') {
      const backup = await createLocalBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = `drone-liftoff-local-${Date.now()}.json`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      return toast('Local settings and replays exported. Account progress stays on the server.');
    }
    if (action === 'import-local') {
      const picker = document.createElement('input');
      picker.type = 'file'; picker.accept = '.json,application/json'; picker.hidden = true;
      document.body.appendChild(picker);
      picker.addEventListener('change', async () => {
        try {
          const file = picker.files?.[0];
          if (!file) return;
          if (file.size > 100 * 1024 * 1024) throw new Error('Backup is larger than 100 MB.');
          const count = await restoreLocalBackup(JSON.parse(await file.text()));
          toast(`Imported settings and ${count} replays. Reloading…`);
          setTimeout(() => location.reload(), 1100);
        } catch (error) { toast(`Import failed: ${error.message}`); }
        finally { picker.remove(); }
      }, { once: true });
      picker.click();
      return;
    }
    if (action === 'logout') {
      try { await api('/logout', 'POST'); } catch (error) { toast(`Server sign-out failed: ${error.message}`); }
      token = null; localStorage.removeItem('liftoff-token');
      stopVideo(); pauseOpen = false; solo = null; disconnectMultiplayer(); room = null; account = null; user = null;
      world.removeMissing([]); screen = 'auth'; return render();
    }
    if (action === 'tutorials') {
      screen = 'tutorials'; shell('Flight school', 'LEARN', '<div class="mission-list">'+TUTORIALS.map(item=>'<button class="mission" data-action="tutorial-'+item.id+'">'+escapeHtml(item.name)+'</button>').join('')+'</div>',button('BACK','home','ghost')); return;
    }
    if (action.startsWith('tutorial-')) { const lesson = TUTORIALS.find(item=>item.id===action.slice(9)); if (!lesson) return; launch.tutorial = lesson; chosenMode = 'training'; chosenMap = lesson.map; chosenTrack = lesson.track; return launch(); }
    if (action === 'help') return showHelp();
    if (action === 'continue-flight') {
      if (room?.solo && room.status === 'paused') send({ type: 'resume' });
      pauseOpen = false; screen = 'flight'; menu.classList.add('hidden'); hud.classList.remove('hidden'); return;
    }
    if (action === 'restart-flight') {
      replayBuffer = []; replayCaptureAt = 0; pauseOpen = false;
      send({ type: 'restart-flight' }); screen = 'flight'; menu.classList.add('hidden'); hud.classList.remove('hidden'); return;
    }
    if (action === 'settings-back' || action === 'graphics-back') { screen = pauseOpen ? 'pause' : 'home'; return render(); }
    if (action === 'save-replay') return saveCurrentReplay();
    if (action === 'replays') { screen = 'replays'; return render(); }
    if (action === 'graphics') { screen = 'graphics'; return render(); }
    if (action === 'flight-controller') { controllerSlot = selectedSlot(user?.build?.drone || 'kestrel'); controllerDraft = getFlightProfile(user?.build?.drone || 'kestrel'); screen = 'flight-controller'; return render(); }
    if (action === 'login' || action === 'register') {
      const username = menu.querySelector('#auth-name').value;
      const password = menu.querySelector('#auth-password').value;
      const result = await api(action === 'login' ? '/login' : '/register', 'POST', { username, password });
      token = result.token; localStorage.setItem('liftoff-token', token); user = result.user;
      await refreshAccount(); screen = 'home'; return render();
    }
    if (action === 'guest') {
      const result = await api('/guest', 'POST');
      token = result.token; localStorage.setItem('liftoff-token', token); user = result.user;
      await refreshAccount(); screen = 'home'; return render();
    }
    if (action.startsWith('mode-')) {
      chosenMode = action.slice(5); chosenMap = 'hangar'; chosenTrack = MAPS.hangar.tracks[0].id; screen = 'maps'; return render();
    }
    if (action === 'home') { screen = 'home'; return render(); }
    if (action === 'career') { screen = 'career'; return render(); }
    if (action === 'weekly') { screen = 'weekly'; return render(); }
    if (action === 'weekly-start') { chosenMode = 'weekly'; chosenMap = catalog.weekly.map; chosenTrack = catalog.weekly.track; return launch(); }
    if (action === 'hangar') { screen = 'hangar'; return render(); }
    if (action === 'profile') { if (!token) { screen = 'auth'; return render(); } await refreshAccount(); screen = 'profile'; return render(); }
    if (action === 'settings') { screen = 'settings'; return render(); }
    if (action === 'save-build') {
      const result = await api('/build', 'POST', { build: user.build });
      user.build = result.build; await refreshAccount(); toast('Build saved to your pilot profile.'); return renderHangar();
    }
    if (action === 'buy-part') {
      const draft = { ...user.build };
      const pending = Object.entries(PARTS).map(([category, items]) => ({ category, part: items.find(item => item.id === draft[category]) })).find(entry => entry.part && !account.ownedParts[entry.category]?.includes(entry.part.id));
      if (!pending) return;
      await api('/buy-part', 'POST', { category: pending.category, id: pending.part.id });
      await refreshAccount(); user.build = draft;
      toast(`${pending.part.name} added to your workshop.`); return renderHangar();
    }
    if (action === 'launch') return launch();
    if (action === 'start-room') return send({ type: 'start' });
    if (action === 'restart') { replayBuffer = []; replayCaptureAt = 0; return send({ type: 'restart' }); }
    if (action === 'advance-cup') { replayBuffer = []; replayCaptureAt = 0; return send({ type: 'advance-cup' }); }
    if (action === 'leave') { stopVideo(); pauseOpen = false; send({ type: 'leave' }); solo = null; disconnectMultiplayer(); room = null; ghostFrames = []; world.removeMissing([]); screen = 'home'; return render(); }
    if (action === 'download-clip') return downloadClip();
    if (action === 'multiplayer') {
      screen = 'multiplayer'; return render();
    }
    if (action === 'create-room') return showCreateRoomDialog();
    if (action === 'room-options') { screen = 'multiplayer'; render(); return showCreateRoomDialog(); }
    if (action === 'join-room') return send({ type: 'join', code: menu.querySelector('#join-code').value.trim() });
    if (action === 'ranked') { send({ type: 'queue' }); return toast('Waiting for another pilot in the ranked queue…'); }
  } catch (error) { toast(error.message); }
}

async function launch() {
  cancelFlightLoading();
  const generation = ++flightGeneration;
  world.cancelMapPreviews();
  input.throttle = 0; input.keys.clear();
  ghostFrames = []; ghostBuild = null; ghostIndex = 0; clipBlob = null;
  replayBuffer = []; replayCaptureAt = 0; pauseOpen = false;
  if (chosenMode === 'multiplayer') return send({ type: 'create', map: chosenMap, track: chosenTrack, ...roomOptions });
  if (['race', 'time', 'weekly'].includes(chosenMode)) {
    api(`/ghost?track=${encodeURIComponent(chosenTrack)}`).then(ghost => {
      if (generation === flightGeneration && solo) { ghostFrames = ghost.frames || []; ghostBuild = ghost.build; ghostIndex = 0; }
    }).catch(() => { /* A prior ghost is optional. */ });
  }
  disconnectMultiplayer();
  const lesson = launch.tutorial;
  const mission = launch.challenge || (chosenMode === 'career' ? CAREER.find(item => item.map === chosenMap && item.track === chosenTrack) : null);
  const objects=[...(lesson?.objects||[]),...(mission?.objects||[])];
  const spec=resolveBuild(user.build);
  const session=loadingFlight(flightAssetURLs(MAPS[chosenMap],[spec],objects),'Preparing flight',()=>{
    cancelFlightLoading();solo=null;room=null;localState=null;world.removeMissing([]);world.map=null;world.load('hangar','hangar-circuit');screen='maps';render();
  },()=>launch());
  try {
    await session.download();session.stage('Processing models');await nextPaint();session.check();
    world.removeMissing([]);await world.load(chosenMap,chosenTrack);session.check();
    activeFlightController=getFlightProfile(user.build.drone);appliedControllerSlot=selectedSlot(user.build.drone);
    solo=new SoloSession({map:chosenMap,track:chosenTrack,mode:chosenMode,user,profile:activeFlightController,tutorial:lesson,challenge:mission});
    room=solo.room;ownId=user.id;localState=solo.state;serverClockOffset=0;
    applyCameraSettings();world.setCameraMode(cameraMode);
    const drone=world.upsertDrone(ownId,solo.spec,localState,true);world.resetDroneVisual(ownId,localState);
    await Promise.all([drone.mesh.assetsReady,world.addContentObjects(objects)]);session.check();
    session.stage('Preparing graphics');await nextPaint();session.check();await world.prepareGraphics();session.check();
    if(generation!==flightGeneration)return;
    launch.tutorial=null;launch.challenge=null;
    solo.restart();localState=solo.state;world.upsertDrone(ownId,solo.spec,localState,true);world.resetDroneVisual(ownId,localState);
    session.finish();activeFlightLoad=null;
    hud.dataset.layout='';screen='flight';menu.classList.add('hidden');hud.classList.remove('hidden');startAudio();
  } catch(error) {
    if(activeFlightLoad===session && error.name!=='AbortError') {solo=null;room=null;world.removeMissing([]);world.map=null;world.load('hangar','hangar-circuit');session.error(error);}
  }
}

async function saveCurrentReplay() {
  if (!room || replayBuffer.length < 2) return toast('Fly a little longer before saving a replay.');
  const record = { map: room.map, track: room.track, mode: room.mode, ownId, build: room.players.find(player => player.id === ownId)?.build || user?.build || defaultBuild(), builds: Object.fromEntries(room.players.map(player => [player.id, player.build])), duration: replayBuffer.at(-1).time, frames: structuredClone(replayBuffer) };
  const name = await askReplay('Save replay', `${MAPS[room.map]?.name || room.map} · ${new Date().toLocaleString()}`);
  if (name === null) return;
  try {
    await saveReplay({ ...record, name });
    toast('Replay saved in this browser.');
  } catch (error) { toast(`Could not save replay: ${error?.name === 'QuotaExceededError' ? 'browser storage is full' : error.message}`); }
}

function updateHud(now) {
  if (screen !== 'flight' || !room || now - lastHud < 80) return;
  lastHud = now;
  if (room.status === 'countdown') {
    const seconds = Math.max(1, Math.ceil((room.countdown - (Date.now() - serverClockOffset)) / 1000));
    if (hud.dataset.layout !== 'countdown') {
      hud.innerHTML = '<div class="hud-countdown"><small>PREPARE TO FLY</small><strong id="countdown-value"></strong></div>';
      hud.dataset.layout = 'countdown';
    }
    hud.querySelector('#countdown-value').textContent = seconds;
    return;
  }
  const me = room.players.find(item => item.id === ownId);
  if (!room.solo && me?.finishMs != null) {
    if (hud.dataset.layout !== 'finished') {
      hud.innerHTML = `<div class="finish-waiting"><small>FINISHED · WAITING FOR OTHER PILOTS</small><strong>${fmtTime(me.finishMs)}</strong><p id="spectator-label"></p><div id="waiting-standings"></div><div class="panel-actions"><button class="button" id="next-spectator">NEXT PILOT</button><button class="button" id="finished-save">SAVE REPLAY</button><button class="button ghost" id="finished-pause">PAUSE · ESC</button></div></div>${roomChatHTML(true)}`;
      hud.dataset.layout = 'finished';
      hud.querySelector('#finished-save').addEventListener('click', saveCurrentReplay);
      hud.querySelector('#finished-pause').addEventListener('click', pauseFlight);
      hud.querySelector('#next-spectator').addEventListener('click', () => {
        const active = room.players.filter(item => item.finishMs === null && world.drones.has(item.id));
        if (active.length) world.activeDroneId = active[(active.findIndex(item => item.id === world.activeDroneId) + 1) % active.length].id;
      });
      bindChatForms(hud);
    }
    const watched = room.players.find(item => item.id === world.activeDroneId);
    hud.querySelector('#spectator-label').textContent = watched ? `SPECTATING ${watched.name}` : 'Preparing final results…';
    hud.querySelector('#waiting-standings').innerHTML = room.players.map(item => `<div class="record"><span>${escapeHtml(item.name)}</span><strong>${item.finishMs == null ? 'RACING' : fmtTime(item.finishMs)}</strong></div>`).join('');
    return;
  }
  if (!localState) return;
  const velocity = localState.velocity || [0, 0, 0];
  const speed = Math.round(Math.hypot(...velocity) * 3.6);
  const elapsed = solo ? solo.elapsed : ['running', 'paused'].includes(room.status) ? (room.pausedAt || Date.now() - serverClockOffset) - room.started : 0;
  if (hud.dataset.layout !== 'flight') {
    hud.innerHTML = `
    <div class="hud-top"><div class="hud-mode" id="hud-mode"></div></div>
    <div class="hud-center"><span class="crosshair"></span></div>
    <div class="flight-navigation" aria-label="Flight targets"><div class="target-marker hidden"><i>◇</i><small></small></div><div class="target-marker secondary hidden"><i>◇</i><small></small></div></div>
    <div class="hud-mission hidden" id="hud-mission"></div>
    <div class="hud-left"><div class="hud-label">${room.mode === 'freestyle' ? 'SCORE' : room.mode === 'training' ? 'FLIGHT TIME' : 'LAP TIME'}</div><strong id="hud-main"></strong><div class="hud-sub" id="hud-progress"></div></div>
    <div class="hud-right"><div class="speed"><strong id="hud-speed"></strong><span>KM/H</span></div><div class="hud-readout">ALTITUDE <strong id="hud-altitude"></strong></div><div class="hud-readout">BATTERY <strong id="hud-battery"></strong></div><div class="battery-track"><i id="hud-battery-bar"></i></div></div>
    <div class="hud-bottom"><span id="hud-throttle"></span><span>${ghostFrames.length ? '◇ BEST-RUN GHOST' : '◈ NEXT GATE'}</span><span>${solo?.tutorial ? '<button id="lesson-next" class="hidden">NEXT STEP</button>' : ''}<button id="reset-flight">RESET</button><button id="save-flight">SAVE REPLAY</button><button id="pause-flight">PAUSE · ESC</button></span></div>${roomChatHTML(true)}`;
    hud.dataset.layout = 'flight';
    hud.querySelector('#reset-flight').addEventListener('click', () => send({ type: 'reset' }));
    hud.querySelector('#lesson-next')?.addEventListener('click', () => { solo?.advanceManual(); if (solo?.room.status === 'ended') { screen = 'results'; render(); } });
    hud.querySelector('#pause-flight').addEventListener('click', pauseFlight);
    hud.querySelector('#save-flight').addEventListener('click', saveCurrentReplay);
    bindChatForms(hud);
  }
  const progress = room.mode === 'training' ? (solo?.tutorial?.steps[solo.stepIndex]?.text || 'FREE FLIGHT') : room.mode === 'freestyle' ? (me?.lastTrick || 'THREAD GATES · PASS CLOSE · DIVE · FLIP') : `LAP ${Math.min(me?.lap || 1, getTrack(room.map, room.track).laps)} / ${getTrack(room.map, room.track).laps} · GATE ${(me?.gate || 0) + 1} / ${getTrack(room.map, room.track).gates.length}`;
  hud.querySelector('#hud-mode').textContent = `${flightMode.toUpperCase()} · ${cameraMode.toUpperCase()}`;
  hud.querySelector('#hud-main').textContent = room.mode === 'freestyle' ? (me?.score || 0).toLocaleString() : fmtTime(elapsed);
  hud.querySelector('#hud-progress').textContent = progress;
  hud.querySelector('#lesson-next')?.classList.toggle('hidden', solo?.tutorial?.steps[solo.stepIndex]?.objective !== 'manual');
  hud.querySelector('#hud-speed').textContent = speed;
  hud.querySelector('#hud-altitude').textContent = `${localState.position[1].toFixed(1)} M`;
  hud.querySelector('#hud-battery').textContent = `${Math.round(localState.battery * 100)}%`;
  hud.querySelector('#hud-battery-bar').style.width = `${Math.round(localState.battery * 100)}%`;
  hud.querySelector('#hud-throttle').textContent = `THROTTLE ${Math.round(latestInput.throttle * 100)}%`;
  const hint = solo?.challenge?.hints?.filter(hint => (me?.lap || 1) >= (hint.lap || 1) && (me?.gate || 0) >= (hint.afterGate || 0)).at(-1);
  hud.querySelector('#hud-mission').textContent = hint?.text || '';
  hud.querySelector('#hud-mission').classList.toggle('hidden', !hint);
}

function updateNavigation() {
  const markers = hud.querySelectorAll('.target-marker');
  if (!markers.length || !room || !localState || screen !== 'flight') return;
  const player = room.players.find(item => item.id === ownId);
  const targets = flightTargets(getTrack(room.map, room.track), player, room.mode, solo?.tutorial?.steps[solo.stepIndex]);
  const bounds = world.container.getBoundingClientRect();
  markers.forEach((marker, index) => {
    const target = targets[index]; marker.classList.toggle('hidden', !target);
    if (!target) return;
    const position = projectFlightTarget(target, world.camera, bounds.width, bounds.height);
    marker.style.left = `${position.x}px`; marker.style.top = `${position.y}px`;
    marker.classList.toggle('offscreen', !position.visible);
    const icon = marker.querySelector('i'); icon.textContent = position.visible ? '◇' : '↑';
    icon.style.transform = position.visible ? '' : `rotate(${position.bearing}deg)`;
    marker.querySelector('small').textContent = `${target.label} · ${Math.round(position.distance)} m`;
  });
}

function toggleVideo() {
  if (recorder?.state === 'recording') return stopVideo();
  if (!window.MediaRecorder || !world.renderer.domElement.captureStream) return toast('Video capture is unavailable in this browser.');
  try {
    recordedChunks = [];
    recorder = new MediaRecorder(world.renderer.domElement.captureStream(30), { mimeType: 'video/webm' });
    recorder.ondataavailable = event => { if (event.data.size) recordedChunks.push(event.data); };
    recorder.onstop = () => { clipBlob = new Blob(recordedChunks, { type: 'video/webm' }); toast('Clip ready in race results.'); if (screen === 'results') renderResults(); };
    recorder.start(1000);
    toast('Recording flight clip.');
  } catch (error) { toast(`Recording failed: ${error.message}`); }
}

function stopVideo() { if (recorder?.state === 'recording') recorder.stop(); }
function downloadClip() {
  if (!clipBlob) return;
  const url = URL.createObjectURL(clipBlob);
  const link = document.createElement('a'); link.href = url; link.download = `drone-liftoff-${Date.now()}.webm`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function startAudio() {
  try {
    audio ||= new DroneAudio();
    audio.resume();
  } catch { /* Audio is optional when browser autoplay is restricted. */ }
}

function frame(now) {
  const cpuStart = performance.now();
  const dt = Math.min(0.1, Math.max(0, (now - lastTick) / 1000)); lastTick = now;
  const ownFinished = !solo && room?.players.find(item => item.id === ownId)?.finishMs != null;
  latestInput = input.read(screen === 'flight' && room?.status === 'running' && !ownFinished ? dt : 0);
  if (solo && room && !activeFlightLoad) {
    const previous = room.status;
    solo.update(dt, latestInput, flightMode);
    localState = solo.state;
    world.upsertDrone(ownId, solo.spec, localState, true); world.setActiveGate(solo.item.gate);
    world.predictionRemainder = room.status === 'running' ? solo.accumulator : 0;
    if (ownResetId !== solo.item.resetId) { ownResetId = solo.item.resetId; world.resetDroneVisual(ownId,localState); input.throttle = 0; }
    if (room.status === 'running' && solo.elapsed - replayCaptureAt >= 45 && replayBuffer.length < 36000) {
      replayCaptureAt = solo.elapsed;
      replayBuffer.push({time: solo.elapsed, players: [{id:ownId, state:{position:[...localState.position],rotation:[...localState.rotation],motors:[...localState.motors],motorRpm:[...localState.motorRpm]},resetId:solo.item.resetId}]});
    }
    if (room.status === 'ended' && previous !== 'ended') {
      if (solo.item.finishMs !== null && room.mode !== 'training') api('/solo-result','POST',{map:room.map,track:room.track,mode:room.mode,timeMs:solo.item.finishMs}).then(refreshAccount).catch(error=>toast('Result could not sync: '+error.message));
      screen = 'results'; render();
    }
  }

  if (['flight', 'pause', 'settings', 'graphics', 'flight-controller'].includes(screen) && room?.status === 'running') {
    if (localState && !solo && !waitingResync && !ownFinished) {
      const build = room.ranked ? defaultBuild() : room.players.find(item => item.id === ownId)?.build || user.build;
      const advance = fixedSteps(physicsAccumulator, dt);
      physicsAccumulator = advance.remainder;
      const commands = [];
      for (let step = 0; step < advance.steps; step++) {
        if(prediction.entries.length>=240) {requestResync();break;}
        const command = { seq: ++inputSeq, input: { ...latestInput }, flightMode };
        commands.push(command);
        simulateCommand(localState, command, resolveBuild(build), MAPS[room.map], getTrack(room.map, room.track), GAMEPLAY_OBSTACLES[room.map], activeFlightController);
        prediction.record(command,localState);
      }
      if (commands.length) send({ type: 'inputs', resetId: ownResetId, frames: commands });
      world.predictionRemainder = physicsAccumulator;
    }
    if (ghostFrames.length) {
      const elapsed = Date.now() - serverClockOffset - room.started;
      while (ghostIndex < ghostFrames.length - 1 && ghostFrames[ghostIndex + 1].time < elapsed) ghostIndex++;
      const ghostState = ghostFrames[ghostIndex];
      if (ghostState) world.upsertDrone('ghost', resolveBuild(ghostBuild || defaultBuild()), ghostState, false, true);
    }
  }
  if (audio) audio.update(localState, solo?.spec || world.drones.get(ownId)?.spec, screen==='flight' && room?.status==='running' && !ownFinished);
  if (screen === 'settings') {
    const raw = input.rawChannels();
    const readout = menu.querySelector('#radio-readout');
    if (readout) {
      const left = menu.querySelector('#radio-left');
      const right = menu.querySelector('#radio-right');
      left.style.left = `${50 + latestInput.yaw * 40}%`;
      left.style.top = `${90 - latestInput.throttle * 80}%`;
      right.style.left = `${50 + latestInput.roll * 40}%`;
      right.style.top = `${50 - latestInput.pitch * 40}%`;
      readout.textContent = ['throttle', 'yaw', 'pitch', 'roll'].map(name => `${name.toUpperCase()} ${raw ? Math.round(raw[name] * 100) : '—'} → ${Math.round(latestInput[name] * 100)}%`).join('  ·  ');
    }
  }
  if (screen === 'replay-viewer' && viewingReplay) {
    if (replayPlaying) replayPosition = Math.min(viewingReplay.duration, replayPosition + Math.min(50, now - replayLastFrame) * replaySpeed);
    if (replayPosition >= viewingReplay.duration) replayPlaying = false;
    updateReplayWorld();
    const playButton = menu.querySelector('#replay-play');
    if (playButton) playButton.textContent = replayPlaying ? 'PAUSE' : 'PLAY';
  }
  replayLastFrame = now;
  updateHud(now);
  world.render(now);
  updateNavigation();
  frameStats.update(now, performance.now() - cpuStart);
  if (Math.floor(now / 500) !== frame.lastStats) {
    frame.lastStats = Math.floor(now / 500);
    world.adjustPerformance(frameStats.fps);
    const label = `${frameStats.fps} FPS · ${frameStats.frameMs.toFixed(1)} ms/frame · CPU ${frameStats.cpuMs.toFixed(1)} ms · ${world.renderer.info.render.drawCalls ?? world.renderer.info.render.calls} draws · ${world.renderer.domElement.width}×${world.renderer.domElement.height}`;
    const overlay = document.querySelector('#performance');
    overlay.classList.toggle('hidden', !showPerformance); overlay.textContent = label;
    const readout = document.querySelector('#graphics-performance'); if (readout) readout.textContent = label;
    const warning=document.querySelector('#graphics-warning'); if(warning) warning.textContent=world.renderWarning || '';
  }
}

function pauseFlight() {
  if (screen !== 'flight' || !room || !['running', 'countdown'].includes(room.status)) return;
  input.keys.clear();
  pauseOpen = true;
  if (room.solo) send({ type: 'pause' });
  screen = 'pause'; renderPause();
}
window.addEventListener('blur', () => { if (room?.solo && screen === 'flight') pauseFlight(); });

window.addEventListener('keydown', event => {
  if (event.code === 'F3') { event.preventDefault(); showPerformance = !showPerformance; localStorage.setItem('liftoff-performance', String(showPerformance)); return; }
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (event.code === 'Enter' && screen === 'flight' && room && !room.solo) { event.preventDefault(); openFlightChat(); return; }
  if (event.code === 'Escape') {
    event.preventDefault();
    if (screen === 'flight' && room?.status === 'running') {
      pauseFlight(); return;
    }
    if (pauseOpen && ['pause', 'settings', 'graphics', 'flight-controller'].includes(screen)) { onAction('continue-flight'); return; }
    if (screen === 'replay-viewer') { screen = 'replays'; render(); return; }
  }
  if (event.code === 'KeyR' && !event.repeat && screen === 'flight' && room?.status === 'running') { send({ type: 'reset' }); return; }
  if (event.code === 'KeyC' && screen === 'flight') { cameraMode = cameraMode === 'fpv' ? 'chase' : 'fpv'; world.setCameraMode(cameraMode); localStorage.setItem('liftoff-camera-mode', cameraMode); }
  if (event.code === 'KeyM' && screen === 'flight') { flightMode = { angle: 'horizon', horizon: 'acro', acro: 'angle' }[flightMode]; localStorage.setItem('liftoff-flight-mode', flightMode); toast(`FLIGHT MODE: ${flightMode.toUpperCase()}`); }
});

async function boot() {
  render();
  try {
    await world.ready;
    world.setCameraMode(cameraMode);
    world.setGraphics(readGraphics());
    catalog = await api('/catalog');
    if (catalog.protocol !== NETWORK_PROTOCOL) { screen = 'loading'; shell('Restart the game server', 'UPDATE REQUIRED', '<p>The server is running an older version. Stop its terminal with Ctrl+C, then run <strong>npm start</strong> and refresh this page.</p>'); return; }
    if (catalog.customContent) applyCustomContent(catalog.customContent);
    world.load('hangar', 'hangar-circuit');
    if (token) { try { await refreshAccount(); screen = 'home'; } catch { token = null; localStorage.removeItem('liftoff-token'); screen = 'auth'; } }
    else screen = 'auth';
  } catch (error) { screen = 'auth'; statusMessage = error.message; toast(`LAN server unavailable: ${error.message}`); }
  render();
  world.startAnimation(frame);
}

boot();
setInterval(async()=>{
  if(!catalog || !['home','maps','hangar'].includes(screen))return;
  try {const revision=await api('/content-revision');if(revision.revision&&revision.revision!==catalog.revision){catalog=await api('/catalog');applyCustomContent(catalog.customContent);await refreshAccount();world.map=null;render();toast('Content updated from developer folders.');}}catch{/* No active flight depends on catalog polling. */}
},5000);
