import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import * as THREE from 'three';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import './sunset.css';
import './game-ui.css';
import { populateDroneThumbnails, restoreDroneThumbnails, cancelDroneThumbnails } from './drone-thumbnails.js';
import './settings-ui.css';
import './menus-ui.css';
import './pilot-menu-ui.css';
import './menu-refinement.css';
import './multiplayer-ui.css';
import './interface-polish.css';
import './download-ui.css';
import './account-ui.css';
import './compact-ui.css';
import './loading-ui.css';
import './language-ui.css';
import './practice-ui.css';
import './workshop-ui.css';
import './secondary-ui.css';
import './product-help.css';
import {showDiagnostics,latestCapture} from './diagnostics-ui.js';
import {showTuningGuide} from './tuning-guide.js';
import {characteristicsHTML,partSpecifications} from './drone-characteristics.js';
import {graphicsPanel} from './graphics-layout.js';
import {replayLibrary} from './replay-layout.js';
import {editionFromURL,assignmentFromURL,nextLesson,PracticeJournal,practiceCSV} from './practice-editions.js';
import {practiceLayout} from './practice-layout.js';
import {PracticeClassroom,practiceReport,classroomCSV} from './practice-classroom.js';
import {bindClassroom} from './practice-classroom-ui.js';
import {chooseInitialLanguage,observeLanguage,currentLanguage,setLanguage,LOCALES,localizedText,translate} from './i18n.js';
import { authPanelHTML, bindAuthPanel } from './auth-panel.js';
import { pilotProfileLayout, hostSessionLayout, flightMenuLayout } from './pilot-menu-layouts.js';
import { SCREEN_TITLES, readableLabel, icon, flightHudHTML } from './ui-design.js';
import { visibleFleetSelection, workbenchHasChanges, sortFlightResults, flightActivityLabel, pageEntries } from './ui-flow.js';
import { sectionHeader, pagination, collectionLayout, weeklyLayout, championshipLayout, settingsLayout, flightSetupLayout } from './menu-layouts.js';
import { bindPreviewControls } from './preview-controls.js';
import {captureMenuFocus,restoreMenuFocus} from './menu-focus.js';
import { spectatorPilotId } from './flight-spectator.js';
import { SoloSession } from './solo-session.js';
import { FrameStats } from './frame-stats.js';
import { DroneAudio } from './drone-audio.js';
import { TUTORIALS, MAP_LIST, installedRevision, installedAssets } from '../shared/catalog.js';
import { World } from './world.js';
import { defaultMap, selectedMap } from '../shared/map-selection.js';
import { PreviewRequest, inspectionBuild, previewFrameKey } from './drone-preview.js';
import { preparePreviewModel } from './preview-model.js';
import { createDrone, updateDroneParts, disposeObject } from '../public/content/recipes.js';
import { applyDroneColors } from './model-materials.js';
import { flightAttitude, projectFlightHorizon } from './flight-attitude.js';
import { workbenchParts, partAppearanceNote } from './workbench-parts.js';
import { PilotMarkers } from './pilot-markers.js';
import menuBackdrop from './assets/loading/minus-two.jpg';
import { BRAND } from '../shared/brand.js';
import brandMark from './assets/parvoz-mark.svg';
import { accountAccessDialog } from './account-access.js';
import { SingleAction, requestJSON } from './client-request.js';
import { PerformanceCapture } from './performance-capture.js';
import { StutterCapture } from './stutter-capture.js';
import { flightTargets, projectFlightTarget, lessonFeedback } from './flight-navigation.js';
import { InputManager, deviceKey } from './input.js';
import { MAPS, CAREER, GAMEPLAY_OBSTACLES, getTrack, getSpawn, getTrackObstacles } from '../shared/content.js';
import { DRONES, PARTS, defaultBuild, resolveBuild, stepDrone, resolveEnvironmentCollision, FIXED_DT, createDroneState } from '../shared/physics.js';
import { DEFAULT_FLIGHT_CONTROLLER, validateFlightController, rateDegrees } from '../shared/flight-controller.js';
import { initializeFlightProfiles, getFlightProfile } from './flight-profiles.js';
import { readDroneFleet, hasStoredFleet, listFleetDrones, createDroneCopy, updateDroneCopy, selectFleetDrone, deleteDroneCopy, saveDroneFleet } from './drone-fleet.js';
import { FleetSync } from './fleet-sync.js';
import { simulateCommand } from '../shared/flight-session.js';
import { NETWORK_PROTOCOL, roomPreparationKey } from '../shared/network-flight.js';
import { PredictionHistory } from './prediction-history.js';
import { flightAssetURLs } from './asset-progress.js';
import { FlightLoading, nextPaint } from './flight-loading.js';
import {StartupLoading, prepareStartup} from './startup-loading.js';
import {loadStartupCatalog} from './startup-catalog.js';
import {startupAssetURLs} from './startup-assets.js';
import {menuPresentation} from './menu-presentation.js';
import {MapDownloadManager} from './download-manager.js';
import {DownloadPanel,mapDownloadHTML} from './download-ui.js';
import {createFullscreenController} from './fullscreen.js';
import { hasLoadedModel } from './asset-loader.js';
import {normalizeCameraMode,nextCameraMode,cameraModeLabel} from './rigid-camera.js';
import {sceneRenderDue} from './render-scheduling.js';
import {courseEnabled,sceneTrack} from '../shared/scene-content.js';
import { fixedSteps } from '../shared/timing.js';
import { cameraSettings, saveCameraSettings, cameraKeyPatch } from './camera-settings.js';
import { readGraphics, saveGraphics, selectGraphicsPreset, selectRenderResolution, initializeAutomaticGraphics } from './graphics-settings.js';
import { listReplaySummaries as listReplays, getReplay, saveReplay, renameReplay, deleteReplay } from './replay-store.js';
import { createLocalBackup, restoreLocalBackup } from './local-backup.js';
import { applyCustomContent } from '../shared/custom-content.js';
import {canUseActionCamera} from '../shared/part-compatibility.js';

const app = document.querySelector('#app');
document.title=BRAND.name;
app.innerHTML = `
  <div id="viewport"></div>
  <img class="menu-backdrop" src="${menuBackdrop}" alt=""/><div class="ambient-vignette"></div>
  <div id="menu"></div>
  <div id="hud" class="hidden"></div>
  <div id="toast" class="toast hidden" role="status" aria-live="polite"></div>
  <output id="performance" class="performance hidden" aria-label="Performance"></output>
`;

const world = new World(document.querySelector('#viewport'));
world.onMenuFrame=scene=>{if(world.menuScene===scene&&app.dataset.scene==='menu'&&app.dataset.menuScene!=='ready')app.dataset.menuScene='ready';};
world.onSceneStatus=updateMenuSceneStatus;
world.onRenderFailure=error=>{app.dataset.menuScene='fallback';app.dataset.renderError=error.message;if(screen==='flight')pauseFlight();};
world.onRendererRecovery=(phase,error)=>{app.dataset.rendererRecovery=phase;if(error)app.dataset.renderError=error;};
const input = new InputManager();
initializeFlightProfiles(input);
const menu = document.querySelector('#menu');
const hud = document.querySelector('#hud');
const pilotMarkers=new PilotMarkers(document.querySelector('#app'));
const frameStats = new FrameStats();
let showPerformance = localStorage.getItem('liftoff-performance') === 'true';
let performanceCapture;
let stutterCapture;
let catalog = null, token = localStorage.getItem('liftoff-token'), user = null, account = null;
let solo = null, networkEnabled = false;
let socket = null, room = null, ownId = null, screen = 'loading', chosenMode = 'training', chosenMap = defaultMap(MAPS).id, chosenTrack = defaultMap(MAPS).tracks[0].id;
let homeMode = 'training';
let flightMode = localStorage.getItem('liftoff-flight-mode') || 'acro', cameraMode = normalizeCameraMode(localStorage.getItem('liftoff-camera-mode')), latestInput = { throttle: 0, roll: 0, pitch: 0, yaw: 0 };
let localState = null, inputSeq = 0, lastTick = performance.now(), lastHud = 0, audio = null;
let physicsAccumulator = 0, lastSnapshotTick = -1, ownResetId = -1;
let connectionReady = false, outgoing = [];
const prediction = new PredictionHistory();
let activeFlightLoad = null, multiplayerPreparationKey = null, controllerPending = null, waitingResync = false;
let controllerDraft = null, fleet = null, fleetOwner = null, selectedDroneId = null, fleetFilter = 'all', workbenchDraft = null, workbenchTab = 'parts', partCategory = 'frame', fleetBusy = false;
let fleetSync=null;
let workbenchConflict=false;
const homeDroneRequest=new PreviewRequest();
let workbenchExitPending = false, rankedQueue = false;
let hangarReturn = 'home';
let settingsReturn = 'home';
let multiplayerPending = false;
let animationStarted = false;
const accountAction = new SingleAction();
const fullscreen=createFullscreenController();
let mapDownloads=null,downloadPanel=null,startupLoading=null;
let activeFlightController = validateFlightController(DEFAULT_FLIGHT_CONTROLLER);
let serverClockOffset = 0;
let ghostFrames = [], ghostBuild = null, ghostIndex = 0, recorder = null, recordedChunks = [], clipBlob = null;
let flightGeneration = 0;
let statusMessage = '';
let pauseOpen = false, appliedControllerSlot = 0;
let replayBuffer = [], replayCaptureAt = 0, viewingReplay = null, replayPosition = 0, replayPlaying = false, replaySpeed = 1, replayLastFrame = 0;
let replayCameraMode = cameraMode;
let roomOptions = { visibility: 'private', maxPlayers: 8, mode: 'race' }, publicRoomsTimer = null;
const roomFilters = { mode: '', map: '', capacity: '', joinable: true };
let publicRoomEntries = null, publicRoomsRefresh = null;
let publicCapacity = null, roomsPage = 0, mapsPage = 0, careerPage = 0;
let selectedMissionId = null, selectedLessonId = null, lessonsPage = 0, weeklyPage = 0, championshipPage = 0;
let weeklyData = null, championshipData = null, previewFocusKey = null;
let replaysPage = 0;
let profileTab = 'records';
const profilePages = { records: 0, freestyle: 0, rankings: 0 };
let profileRankings = null;
let rankingsRequest = null;
const previewRequest = new PreviewRequest();
let previewBuildKey = null;
let partComparisonBuild = null;
let practiceEdition = editionFromURL(location.href), practiceSelectedId = null, practiceJournal = null, practiceOwner = null, practiceClassroom = null;
function currentPracticeJournal() {
  const owner = String(user?.id ?? 'unassigned');
  if (practiceOwner !== owner) {
    let storage; try { storage = globalThis.localStorage; } catch { /* Session-only records. */ }
    practiceJournal = new PracticeJournal(owner,storage); practiceOwner = owner;
    practiceClassroom = new PracticeClassroom(owner,storage,TUTORIALS);
  }
  return practiceJournal;
}
function downloadPracticeFile(contents, type, filename) {
  const url=URL.createObjectURL(new Blob([contents],{type}));
  const link=document.createElement('a'); link.href=url; link.download=filename; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function setPracticeEdition(edition) {
  practiceEdition = edition;
  const url = new URL(location.href);
  if (edition === 'standard') { url.searchParams.delete('edition'); url.searchParams.delete('lesson'); }
  else url.searchParams.set('edition',edition);
  history.replaceState(null,'',url);
  screen = 'home'; render();
}

const refreshControllerList = () => {
  if (['settings', 'controls'].includes(screen)) renderControls();
  else if (solo && screen === 'flight' && input.selected && input.selected !== 'keyboard' && !input.selectedDevice()) {
    pauseFlight(); toast('Controller disconnected. Reconnect it or choose Keyboard only in Settings.');
  }
};
window.addEventListener('gamepadconnected', refreshControllerList);
window.addEventListener('gamepaddisconnected', refreshControllerList);
input.onDeviceChange = refreshControllerList;

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const fmtTime = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(Math.floor((ms % 1000) / 10)).padStart(2, '0')}`; };
const button = (label, action, extra = '') => `<button class="button ${extra}${/^back\b/i.test(label) ? ' back-button' : ''}" data-action="${action}">${readableLabel(label)}</button>`;
const multiplayerModes = { race: 'Race', precision: 'Precision Run', freestyle: 'Freestyle Session', cup: 'Championship · 3 rounds' };

function chatMessages(limit) {
  return (room?.chat || []).slice(-limit).map(entry => `<div><strong translate="no">${escapeHtml(entry.name)}</strong><span>${escapeHtml(entry.text)}</span></div>`).join('') || `<p class="empty">${escapeHtml(translate('Room chat is empty.'))}</p>`;
}
let chatVisibleUntil=0;

function roomChatHTML(compact = false) {
  if (!room || room.solo) return '';
  return `<section class="room-chat ${compact ? 'flight-chat' : ''}" aria-label="Room chat" data-open="false"><div data-chat-log="${compact ? 4 : 8}" class="chat-messages" role="log" aria-live="polite">${chatMessages(compact ? 4 : 8)}</div><form data-chat-form class="chat-form ${compact ? 'hidden' : ''}" data-compact="${compact}"><input maxlength="180" aria-label="Room chat message" placeholder="Message this room…" autocomplete="off"/><button type="submit" class="mini-button">Send</button></form>${compact ? '<button id="open-flight-chat" class="chat-open" aria-expanded="false">Chat <kbd>Enter</kbd></button><small class="chat-help">Enter to send · Esc to close · Flight continues</small>' : ''}</section>`;
}

function refreshChatViews() {
  document.querySelectorAll('[data-chat-log]').forEach(element => { element.innerHTML = chatMessages(Number(element.dataset.chatLog)); element.scrollTop = element.scrollHeight; });
  chatVisibleUntil=performance.now()+8000;
}

function closeFlightChat(){
  const root=hud.querySelector('.flight-chat');if(!root)return;
  root.dataset.open='false';root.querySelector('form').classList.add('hidden');root.querySelector('input').blur();
  root.querySelector('.chat-open').setAttribute('aria-expanded','false');
}

function updateFlightChat(now){
  const root=hud.querySelector('.flight-chat');if(root)root.dataset.recent=String(Boolean(room?.chat?.length)&&now<chatVisibleUntil);
}

function openFlightChat() {
  const form = hud.querySelector('[data-chat-form]');
  if (!form) return;
  const root=form.closest('.flight-chat');
  if(root.dataset.open==='true'){closeFlightChat();return;}
  root.dataset.open='true';root.querySelector('.chat-open').setAttribute('aria-expanded','true');
  input.keys.clear(); form.classList.remove('hidden'); form.querySelector('input').focus();
}

function bindChatForms(root) {
  root.querySelectorAll('[data-chat-form]').forEach(form => {
    const field = form.querySelector('input');
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (field.value.trim()) send({ type: 'chat', text: field.value });
      field.value = '';
      if (form.dataset.compact === 'true') closeFlightChat();
    });
    field.addEventListener('keydown', event => {
      if (event.code !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); field.blur();
      if (form.dataset.compact === 'true') closeFlightChat();
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

async function api(path, method = 'GET', body, pilotToken = token) {
  return requestJSON(`/api${path}`, {
    method,
    headers: { ...(pilotToken ? { Authorization: `Bearer ${pilotToken}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
}

async function refreshAccount() {
  if (!token) return;
  const pilotToken=token,pilotApi=(path,method,body)=>api(path,method,body,pilotToken);
  const nextAccount=await pilotApi('/me');
  if(token!==pilotToken)return;
  const nextUser=nextAccount.user,owner = String(nextUser.id);
  if (fleetOwner !== owner || !fleet) {
    const hasLocalFleet=hasStoredFleet(owner);
    const local=readDroneFleet(owner, nextUser.build, getFlightProfile(nextUser.build?.drone || 'kestrel'),{initialize:nextUser.guest});
    const sync=nextUser.guest?null:new FleetSync(pilotApi,owner);
    let nextFleet=local;
    if(sync)try{nextFleet=await sync.load(local,{hasLocalFleet});}catch(error){if(token===pilotToken)toast('Hangar sync: '+error.message);}
    if(token!==pilotToken)return;
    fleetSync=sync;fleet=nextFleet;
    fleetOwner = owner;
    selectedDroneId = fleet.selectedId;
    workbenchDraft = null;
  } else if(fleetSync && !workbenchDraft && !fleetBusy){
    const sync=fleetSync,previousFleet=fleet,nextFleet=await sync.load(fleet);
    if(token!==pilotToken||sync!==fleetSync)return;
    // A background refresh must not replace a fleet the player is editing/saving.
    if(fleet===previousFleet&&!workbenchDraft&&!fleetBusy)fleet=nextFleet;
    if(!listFleetDrones(fleet).some(entry=>entry.id===selectedDroneId))selectedDroneId=fleet.selectedId;
  }
  account=nextAccount;user=nextUser;
  const entry = activeDrone();
  if (entry) user.build = structuredClone(entry.build);
}

function activeDrone() {
  return fleet && listFleetDrones(fleet).find(entry => entry.id === fleet.selectedId);
}

function selectedDrone() {
  return fleet && listFleetDrones(fleet).find(entry => entry.id === selectedDroneId) || activeDrone();
}

function flightControllerFor(build) {
  const active = activeDrone();
  return validateFlightController(active?.baseDrone === build?.drone ? active.controller : DEFAULT_FLIGHT_CONTROLLER);
}

async function storeFleet(next) {
  const sync=fleetSync,owner=fleetOwner,pilotToken=token;
  const saved=sync ? await sync.save(next) : saveDroneFleet(owner,next);
  if(token!==pilotToken||owner!==fleetOwner||sync!==fleetSync)throw new Error('Pilot changed while saving. Reopen Hangar for the current account.');
  fleet=saved;
  user.build = structuredClone(activeDrone().build);
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
    if (message.type === 'error') {
      if (rankedQueue || multiplayerPending) { disconnectMultiplayer(); render(); }
      if (message.updateRequired) disconnectMultiplayer();
      return toast(message.error);
    }
    if (message.type === 'authenticated') { connectionReady = true; outgoing.splice(0).forEach(send); return; }
    if (message.type === 'joined') {
      rankedQueue = false; multiplayerPending = false;
      ownId = message.id;
      localState = null; ownResetId = -1; lastSnapshotTick = -1; physicsAccumulator = 0; inputSeq = 0; waitingResync=false; prediction.reset(null); multiplayerPreparationKey=null; input.reset(); hud.dataset.layout = '';
      replayBuffer = []; replayCaptureAt = 0; ghostFrames = []; ghostIndex = 0; clipBlob = null; pauseOpen = false;
      activeFlightController = flightControllerFor(message.build);
      appliedControllerSlot = 0;
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
        localState = null; ownResetId = -1; physicsAccumulator = 0; inputSeq=0; prediction.reset(null); waitingResync = false; world.predictionRemainder = 0; input.reset(); hud.dataset.layout = '';
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
        if (player.id === ownId && player.finishMs != null) {
          localState = null; physicsAccumulator = 0; world.predictionRemainder = 0; prediction.reset(null);
          world.upsertDrone(player.id, resolveBuild(room.ranked ? defaultBuild() : info?.build || user.build), player.state, false, false, true, player.resetId);
        } else if (player.id === ownId) {
          const reset = ownResetId !== player.resetId || !localState;
          const build = room.ranked ? defaultBuild() : info?.build || user.build;
          const previous = localState;
          let corrected = false;
          if (player.failSafe) { requestResync(); continue; }
          if (reset) { localState=structuredClone(player.state); inputSeq=player.seq; prediction.reset(localState,player.seq); waitingResync=false; }
          else {
            const result=prediction.accept(player.state,player.seq,localState,(state,command)=>simulateCommand(state,command,resolveBuild(build),MAPS[room.map],sceneTrack(getTrack(room.map,room.track),courseEnabled(room)),getTrackObstacles(room.map,room.track,{course:courseEnabled(room)}),activeFlightController));
            localState=result.state;corrected=result.corrected;
          }
          ownResetId = player.resetId;
          world.upsertDrone(player.id, resolveBuild(info?.build || user?.build), localState, true);
          if (reset) { physicsAccumulator = 0; input.reset(); world.resetDroneVisual(player.id, localState); }
          else if (corrected && previous) world.correctDroneVisual(player.id, previous, localState);
          world.setActiveGate(player.gate);
        } else world.upsertDrone(player.id, resolveBuild(info?.build), player.state, false, false, true, player.resetId);
        if (info) { info.gate = player.gate; info.lap = player.lap; info.score = player.score; info.combo = player.combo; info.lastTrick = player.lastTrick; info.finishMs = player.finishMs; }
      }
      world.removeMissing(ids);
      if (room.players.find(item => item.id === ownId)?.finishMs != null && room.status === 'running') {
        world.activeDroneId = spectatorPilotId(room.players, ownId, world.activeDroneId, ids);
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
    if (message.type === 'checkpoint' && message.id===ownId && screen==='flight') audio?.checkpoint();
    if (message.type === 'finish') {
      const player = room?.players.find(item => item.id === message.id);
      if (player) { player.finishMs = message.timeMs; player.penaltyMs = message.penaltyMs || 0; }
      if (message.id === ownId) {
        localState = null; physicsAccumulator = 0; world.predictionRemainder = 0; prediction.reset(null); hud.dataset.layout = '';
        world.removeMissing([...world.drones.keys()].filter(id => id !== ownId && id !== 'ghost'));
        world.activeDroneId = spectatorPilotId(room.players, ownId, world.activeDroneId, [...world.drones.keys()]);
        input.reset();
        world.setCameraMode('chase');
      }
      toast(`${player?.name || 'Pilot'} finished in ${fmtTime(message.timeMs)}`);
    }
  });
  socket.addEventListener('close', () => {
    if (!networkEnabled || solo || socket !== connection) return;
    connectionReady = false;
    if (multiplayerPending) { disconnectMultiplayer(); toast('Connection lost. Try joining again.'); render(); return; }
    if (rankedQueue) { disconnectMultiplayer(); toast('Matchmaking disconnected. Try again.'); if (screen === 'multiplayer') renderMultiplayer(); return; }
    if (room) { cancelFlightLoading(); toast('Connection lost. Returned to the menu.'); pauseOpen = false; screen = 'home'; room = null; world.removeMissing([]); render(); }
    if (token && networkEnabled) setTimeout(() => { if (networkEnabled && socket?.readyState === WebSocket.CLOSED) connect(); }, 1500);
  });
}

function disconnectMultiplayer() {
  rankedQueue = false; multiplayerPending = false; networkEnabled = false; connectionReady = false; outgoing = []; socket?.close(); socket = null;
}
function requestResync() {
  if(waitingResync || ownResetId<0 || room?.players.find(item => item.id === ownId)?.finishMs != null)return;
  waitingResync=true; send({type:'request-resync',resetId:ownResetId});
}
function send(message) {
  if (['reset','restart','restart-flight'].includes(message.type)) input.reset();
  if (solo) {
    if (message.type === 'pause') solo.pause();
    if (message.type === 'resume') solo.resume();
    if (message.type === 'reset') solo.reset();
    if (['restart','restart-flight'].includes(message.type)) { solo.restart(); currentPracticeJournal().begin(solo); pauseOpen = false; screen = 'flight'; menu.classList.add('hidden'); hud.classList.remove('hidden'); }
    if (['reset','restart','restart-flight'].includes(message.type)) { localState = solo.state; world.resetDroneVisual(ownId, localState); }
    return;
  }
  if (!networkEnabled && ['join','create','queue','solo'].includes(message.type)) connect();
  if (connectionReady && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  else if (message.type !== 'inputs' && outgoing.length < 8) outgoing.push(message);
}

function cancelFlightLoading() {
  flightGeneration++; activeFlightLoad?.cancel(); activeFlightLoad=null;
}

function loadingFlight(urls, title, cancel, retry) {
  screen='loading-flight';menu.classList.add('hidden');hud.classList.add('hidden');
  const session=new FlightLoading(urls,catalog.assets||[],{cached:hasLoadedModel,title,onCancel:cancel,onRetry:retry,
    timingKey:JSON.stringify([catalog.revision,room?.mode||chosenMode,world.graphics,world.renderer.backend?.isWebGPUBackend?'WebGPU':'WebGL2'])});
  session.setSlides(Object.values(MAPS));
  activeFlightLoad=session; return session;
}

async function prepareMultiplayer(preparingRoom,key) {
  cancelFlightLoading(); multiplayerPreparationKey=key;
  const roomCode=preparingRoom.code;
  const specs=preparingRoom.players.map(player=>resolveBuild(player.build));
  const session=loadingFlight(flightAssetURLs(MAPS[preparingRoom.map],specs,[],getTrack(preparingRoom.map,preparingRoom.track),{course:courseEnabled(preparingRoom)}),'Preparing multiplayer',()=>{
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
    send({type:'controller',profile:preparingRoom.ranked ? DEFAULT_FLIGHT_CONTROLLER : flightControllerFor(build),slot:0,preparation:key});
    await session.download();mapDownloads?.refresh().catch(()=>{});session.stage('Processing models');await nextPaint();session.check();
    world.removeMissing([]);
    await world.load(preparingRoom.map,preparingRoom.track,{course:courseEnabled(preparingRoom),signal:session.abort.signal});session.check();
    const spawn=getSpawn(getTrack(preparingRoom.map,preparingRoom.track));
    const models=preparingRoom.players.map((player,index)=>world.upsertDrone(player.id,specs[index],createDroneState(spawn.position,spawn.yaw)));
    await Promise.all(models.map(item=>item.mesh.assetsReady));await controllerReady;session.check();
    applyCameraSettings();world.setCameraMode(cameraMode);
    session.stage('Preparing graphics');await nextPaint();session.check();await world.prepareGraphics();session.check();
    if(!current())return;
    session.finish();activeFlightLoad=null;screen='lobby';render();
    send({type:'assets-ready',map:preparingRoom.map,track:preparingRoom.track,revision:preparingRoom.contentRevision,preparation:key});
  } catch(error) { if(current() && error.name!=='AbortError') {world.removeMissing([]);world.invalidateEnvironment();world.setMenuScene(true, {mapId: chosenMap, trackId: chosenTrack}).catch(() => {});session.error(error);} }
}

function askReplay(title, initialValue, confirmLabel = 'Save', description = '') {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'flow-dialog';
    dialog.setAttribute('aria-label', title);
    dialog.innerHTML = `<form><h2>${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ''}${initialValue === null ? '' : `<label>Name<input id="replay-name" maxlength="80" value="${escapeHtml(initialValue)}" required /></label>`}<div class="panel-actions"><button class="button ghost" type="button" id="dialog-cancel">Cancel</button><button class="button primary" type="submit">${escapeHtml(confirmLabel)}</button></div></form>`;
    app.appendChild(dialog);
    const close = value => { dialog.close(); dialog.remove(); resolve(value); };
    dialog.querySelector('#dialog-cancel').addEventListener('click', () => close(null));
    dialog.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const value = initialValue === null ? true : dialog.querySelector('#replay-name').value.trim();
      if (value === '') return;
      close(value);
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(null); });
    dialog.addEventListener('keydown', event => event.stopPropagation());
    dialog.showModal();
    dialog.querySelector('input')?.select();
  });
}

function applyCameraSettings(build) {
  const activeBuild = build || room?.players?.find(player => player.id === ownId)?.build || user?.build || defaultBuild();
  const settings = cameraSettings(activeBuild);
  world.setFov(settings.fov);
  world.setFpvTilt(settings.tilt);
}

function menuBackdropMap(){return selectedMap(MAPS,world.map?.id||world.sceneTransition?.pending?.key.split(':')[1]||chosenMap);}
function hangarBackdropMap(){
  if(world.workbench&&MAPS[world.workbench]?.garage&&(world.map?.id===world.workbench||world.sceneTransition?.pending?.key==='preview:'+world.workbench))return MAPS[world.workbench];
  if(world.canReuseEnvironment(world.map?.id)&&MAPS[world.map.id]?.garage)return world.map;
  return defaultMap(MAPS);
}

function shell(title, kicker, content, actions = '', composition = '') {
  const previousScreen=app.dataset.screen,renderedScreen=screen,focusKey=captureMenuFocus(menu);
  if(screen!=='home')homeDroneRequest.cancel();
  if (screen !== 'hangar') cancelDroneThumbnails();
  if (!['hangar', 'workbench'].includes(screen) && (world.hangarPreview||['hangar','workbench'].includes(app.dataset.screen))) {
    previewRequest.cancel();
    world.leaveHangarPreview();
    applyCameraSettings();
  }
  menu.classList.remove('hidden');
  menu.className = `menu-${screen}`;
  menu.classList.toggle('hero', screen === 'auth' || screen === 'home');
  hud.classList.add('hidden');
  app.dataset.screen = screen;
  const preview = ['hangar', 'workbench'].includes(screen);
  const live = screen === 'pause' || screen === 'replay-viewer' || pauseOpen || !!room;
  downloadPanel?.setVisible(screen==='home'&&!live);
  app.dataset.scene = preview ? 'preview' : live ? 'live' : 'menu';
  const canNavigate = user && !room && !['replay-viewer','loading','connection-error'].includes(screen);
  const nav = '<div></div>';
  menu.innerHTML = `
    ${['home','auth'].includes(screen) ? `<header class="topbar"><div class="brand"><span class="brand-mark"><img src="${brandMark}" alt=""/></span><span>${BRAND.wordmark}<span class="brand-light">${BRAND.tagline}</span></span></div>${nav}<div class="top-tools">${canNavigate ? `<button class="account-button" data-action="profile" aria-label="Pilot profile"><span class="account-avatar">${escapeHtml(user.username.slice(0, 1).toUpperCase())}</span><span class="account-name" translate="no">${escapeHtml(user.username)}</span>${!user.guest ? `<span class="account-credits">${user.credits} cr</span>` : ''}</button>` : ''}</div></header>` : ''}
    <main class="menu-layout ${composition ? 'composed-layout' : ''}">${composition || `<section class="menu-panel"><div class="menu-heading"><div class="eyebrow">${readableLabel(kicker)}</div><h1>${SCREEN_TITLES[screen] || title}</h1></div><div class="menu-content">${content}</div><div class="panel-actions">${actions}</div></section>${preview ? '<div class="hangar-stage" aria-label="Orbit camera around drone"></div>' : ''}`}</main>
  `;
  menu.querySelectorAll('[data-action]').forEach(element => element.addEventListener('click', () => onAction(element.dataset.action, element)));
  queueMicrotask(()=>{if(app.dataset.screen===renderedScreen)restoreMenuFocus(menu,focusKey,previousScreen===renderedScreen);});
  downloadPanel?.bindMapCards(menu);
  if (menu.querySelector('[data-download-map]')) mapDownloads?.refresh().catch(()=>{});
  if (fleetBusy && ['hangar', 'workbench'].includes(screen)) menu.querySelectorAll('button,input,select').forEach(element => { element.disabled = true; });
  if (!preview && !live && !['loading','connection-error'].includes(screen)) {
    const showcase=menuBackdropMap();
    if(menuPresentation(world,showcase.id)==='poster'){
      world.setMenuScene(false);app.dataset.menuScene='poster';
      const caption=menu.querySelector('.home-scene-caption');if(caption)caption.hidden=true;
      return;
    }
    const ready=world.setMenuScene(true, { mapId: showcase.id, trackId: getTrack(showcase.id,world.track?.id).id, kind: screen === 'home' ? 'home' : 'menu',course:false });
    app.dataset.menuScene=world.menuScene?.rendered ? 'ready' : 'loading';
    updateMenuSceneStatus({status:world.sceneTransition?.pending?'loading':'ready',mapId:showcase.id});
    ready.then(()=>mapDownloads?.refresh().catch(()=>{})).catch(error=>console.warn('Menu scene assets:',error.message));
  } else if(!preview)world.setMenuScene(false);
}

function updateMenuSceneStatus({status,mapId,error}){
  if(app.dataset.scene!=='menu')return;
  app.dataset.menuScene=status==='ready'&&world.menuScene?.rendered?'ready':status==='error'?'fallback':'loading';
  let output=menu.querySelector('#menu-scene-status');
  if(!output){output=document.createElement('div');output.id='menu-scene-status';output.className='menu-scene-status';output.setAttribute('role','status');menu.append(output);}
  output.replaceChildren();
  if(status==='loading')output.textContent='Loading '+(MAPS[mapId]?.name||'map')+'…';
  if(status==='error'){
    output.textContent='Map could not load. ';
    const retry=document.createElement('button');retry.className='text-link';retry.textContent='Retry';
    retry.addEventListener('click',()=>world.setMenuScene(true,{mapId:chosenMap,trackId:chosenTrack,kind:screen==='home'?'home':'menu',course:courseEnabled({mode:chosenMode})}).catch(()=>{}));output.append(retry);output.title=error||'';
  }
  output.hidden=status==='ready';
  const caption=menu.querySelector('.home-scene-caption span'),visible=world.map;
  if(caption&&visible)caption.innerHTML=escapeHtml(visible.name)+'<small>'+escapeHtml(visible.region||'')+'</small>';
}

function render() {
  if (screen !== 'multiplayer' && publicRoomsTimer) { clearInterval(publicRoomsTimer); publicRoomsTimer = null; }
  if (screen === 'loading') return shell('Preparing flight', 'INITIALIZING', '<p role="status">Connecting to the flight server…</p>');
  if (screen === 'update-required') return shell('Game update available', 'UPDATE REQUIRED', '<p class="lead">This page and the game server use different versions.</p><p>Reload to get the latest game. If this message remains, the server is still updating; try again shortly.</p>', button('Reload game', 'reload-game', 'primary'));
  if (screen === 'connection-error') return shell('Connection unavailable', 'GAME SERVER', `<p class="lead" role="alert">${escapeHtml(statusMessage)}</p><p class="auth-note">Your saved sign-in is kept. Check that the game server is running, then reconnect.</p>`, button('Reconnect', 'retry-connection', 'primary'));
  if (screen === 'auth') return renderAuth();
  if (screen === 'home') return renderHome();
  if (screen === 'maps') return renderMaps();
  if (screen === 'hangar') return renderHangar();
  if (screen === 'workbench') return renderWorkbench();
  if (screen === 'career') return renderCareer();
  if (screen === 'multiplayer') return renderMultiplayer();
  if (screen === 'championship') return renderRemoteScreen(renderChampionship);
  if (screen === 'lobby') return renderLobby();
  if (screen === 'results') return renderResults();
  if (screen === 'profile') return renderProfile();
  if (screen === 'weekly') return renderRemoteScreen(renderWeekly);
  if (screen === 'settings') return renderSettings();
  if (['settings', 'controls'].includes(screen)) return renderControls();
  if (screen === 'camera') return renderCamera();
  if (screen === 'flight-controller') return renderFlightController();
  if (screen === 'pause') return renderPause();
  if (screen === 'graphics') return renderGraphics();
  if (screen === 'language') return renderLanguage();
  if (screen === 'replays') return renderRemoteScreen(renderReplays);
  if (screen === 'replay-viewer') return renderReplayViewer();
  if (screen === 'tutorials') return renderTutorials();
}

function renderRemoteScreen(renderer) {
  const requestedScreen = screen;
  shell('Loading', 'PLEASE WAIT', '<p class="empty" role="status">Loading…</p>', button('Back', 'home', 'ghost'));
  return Promise.resolve(renderer()).catch(error => {
    if (screen !== requestedScreen) return;
    shell('Could not load this screen', 'CONNECTION', `<p class="empty" role="alert">${escapeHtml(error.message)}</p>`, `${button('Back', 'home', 'ghost')}${button('Try again', 'retry-screen', 'primary')}`);
  });
}

function renderAuth() {
  shell('Sign in', '', '', '', authPanelHTML());
  bindAuthPanel(menu, action => onAction(action));
}

function renderHome() {
  world.removeMissing(['preview','home-drone']);
  app.dataset.edition = practiceEdition;
  if (practiceEdition !== 'standard') {
    const journal = currentPracticeJournal(), assignment = assignmentFromURL(location.href,TUTORIALS);
    shell('Practice', '', '', '', practiceLayout({edition:practiceEdition,lessons:TUTORIALS,records:journal.records,completedIds:journal.completedIds,
      selectedId:practiceSelectedId,assigned:assignment.lesson,invalid:assignment.invalid,persistent:journal.persistent,base:location.href,classroom:practiceClassroom}));
    const classroomSection=menu.querySelector('[data-classroom-lesson]'), classroom=practiceClassroom;
    if(classroomSection) bindClassroom(menu,{classroom,refresh:renderHome,translate,
      isCurrent:()=>screen==='home'&&practiceEdition==='class'&&currentPracticeJournal()===journal&&menu.contains(classroomSection),
      download:()=>downloadPracticeFile(classroomCSV(classroom,classroomSection.dataset.classroomLesson),'text/csv;charset=utf-8',`parvoz-group-${classroom.date}.csv`)});
    menu.querySelectorAll('[data-practice-lesson]').forEach(element=>element.addEventListener('click',()=>{
      practiceSelectedId=element.dataset.practiceLesson; renderHome();
      menu.querySelector(`[data-practice-lesson="${CSS.escape(practiceSelectedId)}"]`)?.focus({preventScroll:true});
    }));
    return;
  }
  const map = defaultMap(MAPS);
  shell('Flight deck', '', '', '', `
    <section class="home-command home-main-menu game-panel">
      <button class="button primary launch-button" data-action="home-fly">${icon('play')} Fly ${icon('arrow')}</button>
      <nav class="home-destinations" aria-label="Game modes">
        <button data-action="multiplayer">${icon('users')}<span>Multiplayer</span>${icon('arrow')}</button>
        <button data-action="hangar">${icon('drone')}<span>Hangar</span>${icon('arrow')}</button>
        <button data-action="career">${icon('trophy')}<span>Career</span>${icon('arrow')}</button>
        <button data-action="tutorials">${icon('school')}<span>Flight school</span>${icon('arrow')}</button>
        <button data-action="weekly" class="home-weekly">${icon('flag')}<span>Weekly challenge</span>${icon('arrow')}</button>
        <button data-action="replays">${icon('clock')}<span>Replays</span>${icon('arrow')}</button>
        <button data-action="settings">${icon('settings')}<span>Settings</span>${icon('arrow')}</button>
      </nav>
      <div class="practice-edition-links"><button class="button" data-action="edition-start" translate="no">Parvoz Start</button><button class="button" data-action="edition-class" translate="no">Parvoz Class</button></div>
    </section>
    <div class="menu-world-stage" aria-hidden="true"></div>
    <div class="home-scene-caption" aria-hidden="true">${icon('location')}<span>${escapeHtml(map.name)}<small>${escapeHtml(map.region)}</small></span></div>`);
  const spec=resolveBuild(activeDrone()?.build||user?.build||defaultBuild());
  if(app.dataset.menuScene!=='poster'&&hasLoadedModel(inspectionBuild(spec).model))loadHomeDrone();
}

async function loadHomeDrone({startup=false,build=activeDrone()?.build||user?.build||defaultBuild()}={}){
  const spec=resolveBuild(build),key=JSON.stringify([catalog?.revision,build]);
  const existing=world.drones.get('home-drone');
  if(existing?.key===key)return;
  try{
    await homeDroneRequest.run(async()=>{
      await world.mapReady;
      const mesh=createDrone(inspectionBuild(spec));
      try{await mesh.assetsReady;return mesh;}catch(error){disposeObject(mesh);throw error;}
    },mesh=>{
      if(screen!=='home'&&!(startup&&['loading','auth'].includes(screen))){disposeObject(mesh);return;}
      world.installHomeDrone(mesh,spec,key);
      if(!startup&&world.ready&&world.renderer?.compileAsync)world.compileGraphics({blockRender:true}).catch(()=>{});
    },disposeObject);
  }catch(error){if(startup)throw error;console.warn('Home aircraft:',error.message);}
}

function renderTutorials() {
  const lessons = [...TUTORIALS].sort((a,b)=>(a.order??100)-(b.order??100)||a.name.localeCompare(b.name));
  const slice = pageEntries(lessons,lessonsPage,4); lessonsPage = slice.page;
  if (!slice.entries.some(lesson => lesson.id === selectedLessonId)) selectedLessonId = slice.entries[0]?.id;
  shell('Flight school', '', '', '', collectionLayout({ kind: 'tutorials', entries: lessons, selectedId: selectedLessonId, requestedPage: lessonsPage, maps: MAPS }));
  menu.querySelectorAll('[data-learn-entry]').forEach(element => element.addEventListener('click', () => {
    selectedLessonId = element.dataset.learnEntry; renderTutorials();
    menu.querySelector(`[data-learn-entry="${selectedLessonId}"]`)?.focus({ preventScroll: true });
  }));
  world.populateMapPreviews(menu.querySelectorAll('[data-map-preview]'));
}

function showHelp() {
  if (app.querySelector('dialog[open]')) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'flow-dialog';
  dialog.setAttribute('aria-label', 'Flight controls');
  dialog.innerHTML = `<h2>Flight controls</h2><dl class="control-reference">${[
    ['W A S D','Pitch and roll'],['Q / E','Yaw'],['Left Shift / F','Throttle'],
    ['R / Esc','Reset / flight menu'],['C / M','Camera / flight mode'],['↑ ↓ / ← →','FPV tilt / field of view']
  ].map(([keys,label])=>`<div><dt><kbd>${keys}</kbd></dt><dd>${label}</dd></div>`).join('')}</dl><p>Connect and calibrate a radio in Settings → Controls.</p><details class="asset-credits"><summary>Model credits &amp; licenses</summary>${Object.values(DRONES).filter(drone=>drone.attributionFile).map(drone=>`<p><a href="${escapeHtml(drone.assetSource)}" target="_blank" rel="noopener">${escapeHtml(drone.assetCredit)}</a> · <a href="${escapeHtml(drone.assetLicenseURL)}" target="_blank" rel="noopener">${escapeHtml(drone.assetLicense)}</a><br>${escapeHtml(drone.assetChanges)}<br><a href="${escapeHtml(drone.attributionFile)}" target="_blank" rel="noopener">Source and attribution</a></p>`).join('')}</details><button class="button primary" id="close-help">Got it</button>`;
  app.appendChild(dialog);
  dialog.querySelector('#close-help').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { localStorage.setItem('liftoff-controls-seen', '1'); dialog.remove(); });
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.showModal();
}

function renderMaps() {
  mapsPage = Math.floor(Math.max(0, catalog.maps.findIndex(map => map.id === chosenMap)) / 6);
  const map = MAPS[chosenMap];
  if (!map.tracks.some(track => track.id === chosenTrack)) chosenTrack = map.tracks[0].id;
  shell('Flight setup', '', '', '', flightSetupLayout({ maps: catalog.maps, selectedMap: map, selectedTrack: chosenTrack, mode: chosenMode, page: mapsPage, droneName: activeDrone()?.name || 'Drone', roomOptions, modeLabel: chosenMode === 'multiplayer' ? multiplayerModes[roomOptions.mode] : flightActivityLabel(chosenMode) }));
  menu.querySelectorAll('[data-map]').forEach(element => element.addEventListener('click', () => {
    chosenMap = element.dataset.map; chosenTrack = MAPS[chosenMap].tracks[0].id; renderMaps();
  }));
  menu.querySelector('#track-select')?.addEventListener('change', event => { chosenTrack = event.target.value; renderMaps(); });
  downloadPanel?.bindMapCards(menu);
  mapDownloads?.refresh().catch(()=>{});
  world.populateMapPreviews(menu.querySelectorAll('[data-map-preview]'));
}

function renderMultiplayer() {
  shell('Multiplayer', '', '', '', `
    ${sectionHeader('Multiplayer', 'home', `<button class="button" data-action="championship">${icon('trophy')} Championship</button><button class="button primary" data-action="create-room">${icon('users')} Create room ${icon('arrow')}</button>`, 'ONLINE FLIGHT')}
    <div class="online-layout">
      <section class="game-panel room-browser"><div class="panel-header"><h2>Public rooms <span id="room-count" class="room-count"></span></h2><button class="mini-button" id="refresh-rooms">${icon('reset')} Refresh</button></div>
        <div class="room-filters"><label>Mode<select id="filter-room-mode"><option value="">All modes</option>${Object.entries(multiplayerModes).map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select></label><label>Location<select id="filter-room-map"><option value="">All maps</option>${catalog.maps.map(map => `<option value="${escapeHtml(map.id)}">${escapeHtml(map.name)}</option>`).join('')}</select></label><label>Pilots<select id="filter-room-capacity"><option value="">Any capacity</option>${[2,3,4,5,6,7,8].map(count => `<option value="${count}">${count} pilots</option>`).join('')}</select></label><label class="room-joinable"><input id="filter-room-joinable" type="checkbox"/>Joinable only</label></div>
        <div id="public-rooms" class="public-rooms" aria-live="polite"><p class="empty">Finding rooms…</p></div>
      </section>
      <aside class="online-sidebar">
        <section class="game-panel invite-panel"><div class="panel-label">${icon('users')} JOIN YOUR FRIENDS</div><h2>Have an invite?</h2><label for="join-code">Room code</label><div class="join-row"><input id="join-code" maxlength="6" placeholder="ABC123" aria-label="Private room code"/><button class="button" data-action="join-room">Join</button></div><small>Use the six-character code from your friend’s lobby.</small></section>
        <section class="game-panel ranked-panel"><div class="panel-label">${icon('flag')} RANKED RACING</div><h2>${rankedQueue ? 'Finding opponent…' : 'Race an opponent'}</h2><p>Standard Kestrel 5 · default tuning</p>${rankedQueue ? '<div class="queue-indicator" role="status"><i></i>Searching for a pilot</div><button class="button" data-action="cancel-ranked">Cancel matchmaking</button>' : `<button class="button" data-action="ranked" ${user.guest ? 'disabled' : ''}>Find ranked match ${icon('arrow')}</button>${user.guest ? '<small class="ranked-account-note">Pilot account required</small>' : ''}`}</section>
      </aside>
    </div>`);
  for (const [id, key] of [['filter-room-mode','mode'],['filter-room-map','map'],['filter-room-capacity','capacity'],['filter-room-joinable','joinable']]) {
    const element = menu.querySelector(`#${id}`);
    if (key === 'joinable') element.checked = roomFilters.joinable;
    else element.value = roomFilters[key];
    element.addEventListener('change', () => { roomFilters[key] = key === 'joinable' ? element.checked : element.value; roomsPage = 0; renderPublicRoomList(); });
  }
  menu.querySelector('#refresh-rooms').addEventListener('click', refreshPublicRooms);
  menu.querySelector('#join-code').addEventListener('keydown', event => { if (event.code === 'Enter') { event.preventDefault(); onAction('join-room'); } });
  renderPublicRoomList(); refreshPublicRooms();
  if (rankedQueue) menu.querySelectorAll('[data-public-room],[data-action="create-room"],[data-action="join-room"]').forEach(element => { element.disabled = true; });
  clearInterval(publicRoomsTimer); publicRoomsTimer = setInterval(refreshPublicRooms, 5000);
}

function showCreateRoomDialog() {
  if (screen !== 'multiplayer') return;
  const existing = menu.querySelector('.room-create-dialog');
  if (existing) return existing.focus();
  const dialog = document.createElement('dialog');
  dialog.className = 'room-create-dialog';
  dialog.setAttribute('aria-labelledby', 'room-create-title');
  dialog.innerHTML = hostSessionLayout({ options: roomOptions, map: selectedMap(MAPS, chosenMap), modes: multiplayerModes });
  menu.appendChild(dialog);
  const update = () => {
    for (const [attribute, key] of [['roomVisibility', 'visibility'], ['roomMode', 'mode']]) {
      dialog.querySelectorAll(`[data-${attribute === 'roomVisibility' ? 'room-visibility' : 'room-mode'}]`).forEach(element => {
        const selected = element.dataset[attribute] === roomOptions[key];
        element.classList.toggle('selected', selected);
        element.setAttribute('aria-pressed', String(selected));
      });
    }
    dialog.querySelector('#room-summary-visibility').textContent = roomOptions.visibility === 'public' ? 'Public' : 'Private';
    dialog.querySelector('#room-summary-capacity').textContent = roomOptions.maxPlayers;
    dialog.querySelector('#room-summary-mode').textContent = multiplayerModes[roomOptions.mode];
  };
  dialog.querySelectorAll('[data-room-visibility]').forEach(element => element.addEventListener('click', () => { roomOptions.visibility = element.dataset.roomVisibility; update(); }));
  dialog.querySelectorAll('[data-room-mode]').forEach(element => element.addEventListener('click', () => { roomOptions.mode = element.dataset.roomMode; update(); }));
  dialog.querySelector('#room-capacity').addEventListener('change', event => { roomOptions.maxPlayers = Number(event.target.value); update(); });
  dialog.querySelector('#cancel-room-create').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { dialog.remove(); menu.querySelector('[data-action="create-room"]')?.focus(); });
  dialog.addEventListener('keydown', event => { if (event.code === 'Escape') event.stopPropagation(); });
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault(); dialog.close();
    chosenMode = 'multiplayer';
    if (!MAPS[chosenMap]) chosenMap = defaultMap(MAPS).id;
    if (!MAPS[chosenMap].tracks.some(track => track.id === chosenTrack)) chosenTrack = MAPS[chosenMap].tracks[0].id;
    screen = 'maps'; render();
  });
  world.populateMapPreviews(dialog.querySelectorAll('[data-map-preview]'));
  dialog.showModal();
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
  const slice = pageEntries(entries, roomsPage, 4); roomsPage = slice.page;
  localizedText(menu.querySelector('#room-count'),`${entries.length} rooms${publicCapacity ? ` · ${publicCapacity.online}/${publicCapacity.limit} online${publicCapacity.available ? '' : ' · Server full'}` : ''}`);
  list.innerHTML = `<div class="room-page">${slice.entries.map(entry => `<div class="public-room"><div><strong>${escapeHtml(MAPS[entry.map]?.name || entry.map)}</strong><small>${escapeHtml(MAPS[entry.map]?.tracks.find(track => track.id === entry.track)?.name || entry.track)} · ${multiplayerModes[entry.mode] || 'Race'}</small></div><span>${entry.players}/${entry.maxPlayers}</span><button class="mini-button" data-public-room="${escapeHtml(entry.code)}" ${entry.joinable ? '' : 'disabled'}>${entry.joinable ? 'Join' : entry.players >= entry.maxPlayers ? 'Full' : 'In progress'}</button></div>`).join('') || `<div class="rooms-empty">${icon('users')}<h3>${publicRoomEntries.length ? 'No matching rooms' : 'Start the first session'}</h3><p>${publicRoomEntries.length ? 'Try another mode, location or capacity.' : 'Create a public room for pilots to join, or invite friends by code.'}</p></div>`}</div>${pagination(slice.page, slice.pages, 'rooms', 'Room pages')}`;
  list.querySelectorAll('[data-public-room]').forEach(element => { if (rankedQueue) element.disabled = true; element.addEventListener('click', () => enterMultiplayer({ type: 'join', code: element.dataset.publicRoom })); });
  list.querySelectorAll('[data-action]').forEach(element => element.addEventListener('click', () => onAction(element.dataset.action)));
}

async function refreshPublicRooms() {
  if (screen !== 'multiplayer' || publicRoomsRefresh) return;
  const request = {}; publicRoomsRefresh = request;
  try {
    const listing = await api('/rooms');
    if (screen !== 'multiplayer') return;
    publicRoomEntries = listing.rooms; publicCapacity = listing.capacity;
    renderPublicRoomList();
  } catch (error) { if (screen === 'multiplayer') menu.querySelector('#public-rooms').textContent = error.message; }
  finally { if (publicRoomsRefresh === request) publicRoomsRefresh = null; }
}

function setupWorkbench() {
  world.prepareHangarPreview(screen === 'workbench' ? 'workbench' : 'selection',hangarBackdropMap().id);
  const stage=menu.querySelector('.hangar-stage');
  bindPreviewControls(stage, world);
  if(stage&&!stage.querySelector('.preview-reset')){
    const controls=document.createElement('div');controls.className='preview-camera-controls';
    controls.addEventListener('pointerdown',event=>event.stopPropagation());
    for(const [label,text,amount] of [['Zoom out from drone','−',240],['Zoom in on drone','+',-240]]){
      const button=document.createElement('button');button.className='preview-zoom';button.textContent=text;button.setAttribute('aria-label',label);
      button.addEventListener('click',()=>world.zoomHangarPreview(amount));controls.append(button);
    }
    const reset=document.createElement('button');reset.className='preview-reset';reset.textContent='Reset view';reset.setAttribute('aria-label','Reset drone view');
    reset.addEventListener('click',()=>world.resetHangarPreview());controls.append(reset);stage.append(controls);
  }
}

async function loadHangarPreview(build,{startup=false,mapId=chosenMap,onGraphics=()=>{}}={}) {
  if(startup)world.prepareHangarPreview('selection',mapId);
  else setupWorkbench();
  const spec=resolveBuild(build),inspection=inspectionBuild(spec),frameKey=previewFrameKey(inspection),key=JSON.stringify([build.drone,...Object.keys(PARTS).map(category=>build[category]),build.actionCamera,spec.model,spec.modelLods,spec.visualDetails,spec.accessories,spec.colorBindings,spec.colorBindings?null:[spec.color,spec.led]]);
  const prepareStartupGraphics=async()=>{
    await loadHomeDrone({startup:true,build});
    onGraphics();await world.prepareGraphics();
    if(world.renderFatal||world.recovering)throw new Error(world.renderWarning||'Graphics preparation failed. Retry when the renderer is ready.');
  };
  const existing=world.drones.get('preview');
  if(existing && previewBuildKey===key && world.workbench===world.map?.id && !world.sceneTransition?.pending) {
    previewRequest.cancel();if(existing.needsPlacement)world.installDronePreview(existing.mesh,spec,createDroneState([0,0,0],0));existing.mesh.visible=true;applyDroneColors(existing.mesh,spec);
    if(startup)await prepareStartupGraphics();else world.render(performance.now());
    return;
  }
  const stage=menu.querySelector('.hangar-stage'),sequence=previewRequest.sequence+1;
  stage?.querySelector('.preview-load-error')?.remove();stage?.setAttribute('aria-busy','true');
  try {
    const installed=await previewRequest.run(async signal=>{
      const prior=world.drones.get('preview');
      if(prior&&previewBuildKey===key){
        await world.mapReady;
        if(previewRequest.sequence!==sequence)return {mesh:null,reused:true};
        return {mesh:prior.mesh,reused:true,unchanged:true};
      }
      if(prior?.mesh.userData.previewFrameKey===frameKey){
        await world.mapReady;
        if(previewRequest.sequence!==sequence)return {mesh:null,reused:true};
        if(await updateDroneParts(prior.mesh,inspection,{isCurrent:()=>previewRequest.sequence===sequence}))return {mesh:prior.mesh,reused:true};
      }
      if(previewRequest.sequence!==sequence)return {mesh:null,reused:true};
      const mesh=await preparePreviewModel(world.mapReady,()=>{
        const model=createDrone(inspection);model.userData.previewFrameKey=frameKey;return model;
      },disposeObject,{signal});
      return {mesh,reused:false};
    },({mesh,reused,unchanged})=>{
      if(!mesh)return;
      if(!['hangar','workbench'].includes(screen)&&!(startup&&['loading','auth'].includes(screen))) { if(!reused)disposeObject(mesh); return; }
      if(!unchanged||world.drones.get('preview')?.needsPlacement||mesh.parent!==world.scene)world.installDronePreview(mesh,spec,createDroneState([0,0,0],0));
      else mesh.visible=true;
      applyDroneColors(mesh,resolveBuild(startup?build:screen==='workbench'?workbenchDraft.build:selectedDrone().build));
      if(previewBuildKey?.split('"')[1]!==build.drone || existing?.spec.model!==spec.model)world.hangarOrbit.fitKey=null;
      previewBuildKey=key;
    },({mesh,reused})=>{if(mesh&&!reused)disposeObject(mesh);});
    if(installed && previewRequest.sequence===sequence){
      if(startup)await prepareStartupGraphics();
      else{await world.compileGraphics({blockRender:true});if(previewRequest.sequence===sequence)world.render(performance.now());}
    }
  } catch(error) {
    if(startup)throw error;
    if(['hangar','workbench'].includes(screen)&&stage===menu.querySelector('.hangar-stage')){
      const output=document.createElement('div');output.className='preview-load-error';output.setAttribute('role','status');output.textContent='Workshop could not load. ';output.title=error.message;
      const retry=document.createElement('button');retry.className='text-link';retry.textContent='Retry';retry.setAttribute('aria-label','Retry workshop loading');
      retry.addEventListener('pointerdown',event=>event.stopPropagation());
      retry.addEventListener('click',()=>loadHangarPreview(screen==='workbench'?workbenchDraft.build:selectedDrone().build));output.append(retry);stage.append(output);
    }
  }
  finally {if(previewRequest.sequence===sequence)stage?.removeAttribute('aria-busy');}
}

function renderHangar() {
  const all = listFleetDrones(fleet);
  const { entries, selected } = visibleFleetSelection(all, fleetFilter, selectedDroneId, fleet.selectedId);
  selectedDroneId = selected?.id || null;
  const unlocked = account?.unlocks || [];
  const available = unlocked.includes(selected?.baseDrone);
  const isActive = fleet.selectedId === selected?.id;
  // Selection changes do not invalidate the roster's DOM, decoded images,
  // scroll position or in-flight thumbnail work. Changes to its contents do.
  const rosterKey = JSON.stringify([catalog.revision,fleetOwner,fleetFilter,fleet.selectedId,unlocked,entries]);
  const oldRoster = menu.querySelector('.aircraft-roster');
  const retainedRoster = oldRoster?.rosterKey === rosterKey ? oldRoster : null;
  const rosterFocus = retainedRoster?.contains(document.activeElement) ? document.activeElement : null;
  const aircraftClass = entry => DRONES[entry.baseDrone]?.flightRole==='racing' ? '5″ · Racing' : DRONES[entry.baseDrone]?.class === 'three' ? '3″ · Agile' : DRONES[entry.baseDrone]?.class === 'seven' ? '7″ · Endurance' : '5″ · Freestyle';
  const cards = entries.map(entry => `<button class="aircraft-card ${entry.id === selected?.id ? 'selected' : ''}" data-fleet-drone="${escapeHtml(entry.id)}" aria-pressed="${entry.id === selected?.id}">
    <span class="aircraft-art">${icon('drone')}<img data-drone-preview="${escapeHtml(entry.id)}" ${DRONES[entry.baseDrone]?.thumbnail ? `src="${escapeHtml(DRONES[entry.baseDrone].thumbnail)}"` : ''} decoding="async" alt=""/><span class="aircraft-badge ${!unlocked.includes(entry.baseDrone) ? 'locked' : ''}">${!unlocked.includes(entry.baseDrone) ? 'Career lock' : fleet.selectedId === entry.id ? 'In use' : ''}</span></span>
    <strong translate="no">${escapeHtml(entry.name)}</strong><small>${entry.kind === 'original' ? 'Original' : 'Modified'} · ${aircraftClass(entry)}</small>
  </button>`).join('');
  shell('Drone Selection', 'Hangar', '', '', `
    <header class="selection-header"><div><div class="panel-label">Hangar</div><h1>Drone Selection</h1></div>${button(hangarReturn === 'maps' ? 'Back to flight setup' : 'Back to main menu', 'fleet-back', 'ghost')}</header>
    <div class="selection-showcase">
      <div class="hangar-stage selection-stage ${selected ? '' : 'hidden'}" aria-label="Orbit camera around drone"></div>
      ${selected ? `<aside class="selection-info game-panel"><div class="selection-data"><div><span class="panel-label">${selected.kind === 'original' ? 'Original' : 'Modified'}</span><h2 translate="no">${escapeHtml(selected.name)}</h2><p class="aircraft-class">${aircraftClass(selected)}</p>${selected.kind === 'modified' ? `<p class="aircraft-origin">Based on ${escapeHtml(DRONES[selected.baseDrone]?.name || selected.baseDrone)}</p>` : ''}</div>
        ${characteristicsHTML(selected.build)}
        ${!available ? '<p class="auth-note">Complete career missions to unlock this aircraft.</p>' : ''}</div>
        <div class="selection-actions"><button class="button primary" id="use-drone" ${!available || isActive && hangarReturn !== 'maps' ? 'disabled' : ''}>${hangarReturn === 'maps' ? 'Select & continue' : isActive ? 'Selected for flight' : 'Use drone'} ${icon('arrow')}</button><button class="button" id="open-workbench" ${available ? '' : 'disabled'}>${selected.kind === 'original' ? 'Customize a copy' : 'Open Workbench'}</button>${selected.kind === 'modified' ? '<button class="text-link danger" id="delete-drone">Delete copy</button>' : ''}</div>
      </aside>` : '<section class="selection-empty game-panel"><h2>No modified drones yet</h2><p>Select an original to create your own build.</p><button class="button" id="show-originals">View originals</button></section>'}
    </div>
    <section class="aircraft-roster game-panel"><div class="roster-header"><div class="fleet-filters" role="group" aria-label="Drone filter">${[['all','All'],['original','Original'],['modified','Modified']].map(([value,label]) => `<button class="fleet-filter ${fleetFilter === value ? 'selected' : ''}" data-fleet-filter="${value}" aria-pressed="${fleetFilter === value}">${label}<span>${value === 'all' ? all.length : all.filter(entry => entry.kind === value).length}</span></button>`).join('')}</div><span class="roster-count">${entries.length} ${entries.length === 1 ? 'drone' : 'drones'}<span class="roster-controls"><button id="roster-prev" class="mini-button" aria-label="Previous drones">‹</button><button id="roster-next" class="mini-button" aria-label="Next drones">›</button></span></span></div>
      <div class="aircraft-strip" role="group" aria-label="Drone Selection">${cards || '<p class="empty">Your modified drones will appear here.</p>'}</div>
    </section>`);
  if (retainedRoster) menu.querySelector('.aircraft-roster').replaceWith(retainedRoster);
  const roster = menu.querySelector('.aircraft-roster');
  roster.rosterKey = rosterKey;
  if (!retainedRoster) {
    menu.querySelectorAll('[data-fleet-filter]').forEach(element => element.addEventListener('click', () => { fleetFilter = element.dataset.fleetFilter; renderHangar(); }));
    menu.querySelectorAll('[data-fleet-drone]').forEach(element => element.addEventListener('click', () => { selectedDroneId = element.dataset.fleetDrone; renderHangar(); }));
  }
  roster.querySelectorAll('[data-fleet-drone]').forEach(card => {
    const chosen = card.dataset.fleetDrone === selected?.id;
    card.classList.toggle('selected',chosen);card.setAttribute('aria-pressed',String(chosen));
  });
  rosterFocus?.focus({preventScroll:true});
  menu.querySelector('#show-originals')?.addEventListener('click', () => { fleetFilter = 'original'; renderHangar(); });
  menu.querySelector('#open-workbench')?.addEventListener('click', () => openWorkbench());
  menu.querySelector('#use-drone')?.addEventListener('click', async () => {
    if (!isActive) await useFleetDrone(selected.id);
    if (hangarReturn === 'maps' && screen === 'hangar' && fleet.selectedId === selected.id && !fleetBusy) { screen = 'maps'; render(); }
  });
  menu.querySelector('#delete-drone')?.addEventListener('click', () => removeFleetDrone(selected.id));
  const previewReady=selected?loadHangarPreview(selected.build):Promise.resolve();
  if (!selected) { world.hangarPreview = false; world.removeMissing([]); world.setMenuScene(true, { mapId: chosenMap, trackId: chosenTrack }).catch(() => {}); }
  const strip = menu.querySelector('.aircraft-strip');
  if (!retainedRoster) {
    menu.querySelector('#roster-prev').addEventListener('click', () => strip.scrollBy({ left: -strip.clientWidth * .7, behavior: 'smooth' }));
    menu.querySelector('#roster-next').addEventListener('click', () => strip.scrollBy({ left: strip.clientWidth * .7, behavior: 'smooth' }));
  }
  const updateArrows = () => {
    roster.querySelector('#roster-prev').disabled = strip.scrollLeft <= 1;
    roster.querySelector('#roster-next').disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
  };
  if (!retainedRoster) strip.addEventListener('scroll', updateArrows);
  updateArrows();
  strip.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const thumbnailImages=[...menu.querySelectorAll('[data-drone-preview]')];
  restoreDroneThumbnails(thumbnailImages,entries,catalog.revision);
  if (!retainedRoster) previewReady.then(()=>requestAnimationFrame(()=>{if(screen==='hangar'&&roster.isConnected)populateDroneThumbnails(thumbnailImages,entries,catalog.revision);}));
}

async function useFleetDrone(id) {
  if (fleetBusy) return;
  fleetBusy = true;
  menu.querySelector('#use-drone')?.setAttribute('disabled', '');
  try {
    const entry = listFleetDrones(fleet).find(item => item.id === id);
    if(!fleetSync)await api('/build', 'POST', { build: entry.build });
    await storeFleet(selectFleetDrone(fleet, id));
    selectedDroneId = id;
    toast(`${entry.name} selected for your next flight.`);
  } catch (error) { toast(error.message); }
  finally { fleetBusy = false; if (screen === 'hangar') renderHangar(); }
}

async function removeFleetDrone(id) {
  if (fleetBusy || !(await askReplay('Delete this modified drone?', null, 'Delete'))) return;
  fleetBusy = true;
  try {
    const next = deleteDroneCopy(fleet, id);
    if (!fleetSync && fleet.selectedId === id) {
      const fallback = listFleetDrones(next).find(entry => entry.id === next.selectedId);
      await api('/build', 'POST', { build: fallback.build });
    }
    await storeFleet(next);
    selectedDroneId = fleet.selectedId;
    if (workbenchDraft?.id === id) workbenchDraft = null;
    toast('Modified drone deleted.');
  } catch (error) { toast(error.message); }
  finally { fleetBusy = false; if (screen === 'hangar') renderHangar(); }
}

async function openWorkbench(tab = 'parts') {
  if (fleetBusy) return;
  if (room) return toast('Open Workbench between flights to change a drone.');
  let entry = selectedDrone();
  if (!account?.unlocks?.includes(entry?.baseDrone)) return toast('Unlock this drone in Career first.');
  if (entry.kind === 'original') {
    const copy = createDroneCopy(fleet, entry.id);
    fleetBusy=true;
    try{await storeFleet(selectFleetDrone(copy.fleet, fleet.selectedId));}
    catch(error){toast(error.message);return;}
    finally{fleetBusy=false;}
    entry = copy.entry;
    selectedDroneId = entry.id;
    fleetFilter = 'modified';
  }
  workbenchDraft = structuredClone(entry);
  partComparisonBuild = null;
  workbenchConflict=false;
  controllerDraft = workbenchDraft.controller;
  workbenchTab = tab;
  previewFocusKey = null;
  screen = 'workbench';
  render();
}

function workbenchDirty() {
  return workbenchHasChanges(workbenchDraft, listFleetDrones(fleet).find(entry => entry.id === workbenchDraft?.id));
}

function updateWorkbenchStatus() {
  if (!workbenchDraft || screen !== 'workbench') return;
  const dirty = workbenchDirty();
  const status = menu.querySelector('#workbench-status');
  if (status) localizedText(status, dirty ? 'Unsaved changes' : 'All changes saved');
  const save = menu.querySelector('#save-workbench');
  if (save) save.disabled = fleetBusy || !!pendingWorkbenchPart() || !dirty;
}

async function leaveWorkbench() {
  if (fleetBusy || workbenchExitPending) return false;
  if (!workbenchDirty()) { workbenchDraft = null; controllerDraft = null; return true; }
  workbenchExitPending = true;
  const choice = await new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'flow-dialog';
    dialog.setAttribute('aria-label', 'Unsaved drone changes');
    dialog.innerHTML = `<h2>Unsaved drone changes</h2><p>Save changes to ${escapeHtml(workbenchDraft.name)} before leaving?</p><div class="panel-actions"><button class="button ghost" data-choice="keep">Keep editing</button><button class="button danger" data-choice="discard">Discard changes</button><button class="button primary" data-choice="save" ${pendingWorkbenchPart() ? 'disabled' : ''}>Save changes</button></div>`;
    app.appendChild(dialog);
    const close = value => { dialog.close(); dialog.remove(); resolve(value); };
    dialog.querySelectorAll('[data-choice]').forEach(element => element.addEventListener('click', () => close(element.dataset.choice)));
    dialog.addEventListener('cancel', event => { event.preventDefault(); close('keep'); });
    dialog.addEventListener('keydown', event => event.stopPropagation());
    dialog.showModal();
  });
  try {
    if (choice === 'keep') return false;
    if (choice === 'save') return await saveWorkbench(false);
    workbenchDraft = null; controllerDraft = null; return true;
  } finally { workbenchExitPending = false; }
}

const partLabels = { frame: 'Frame', motors: 'Motors', propellers: 'Propellers', battery: 'Battery', camera: 'Camera', antenna:'Antenna' };

function pendingWorkbenchPart() {
  return Object.entries(PARTS).map(([category, items]) => ({ category, part: items.find(item => item.id === workbenchDraft.build[category]) })).find(entry => entry.part && !account?.ownedParts?.[entry.category]?.includes(entry.part.id));
}

function renderWorkbench() {
  if (!workbenchDraft) { screen = 'hangar'; return render(); }
  const draft = workbenchDraft;
  const pending = pendingWorkbenchPart();
  const parts = workbenchParts(draft.build,DRONES[draft.build.drone],partCategory,PARTS[partCategory] || []);
  const categoryRail = `<div class="component-rail" role="group" aria-label="Part category">${Object.keys(PARTS).map(category => `<button data-part-category="${category}" class="${partCategory === category ? 'selected' : ''}" aria-pressed="${partCategory === category}">${icon(category)}<span>${partLabels[category] || category}</span></button>`).join('')}</div>`;
  const chosenPart = parts.find(part => part.id === draft.build[partCategory]);
  const specifications=chosenPart?`<section class="component-specifications" aria-label="Selected part specifications"><h3>Specifications</h3><dl>${partSpecifications(chosenPart,partCategory).map(row=>`<div><dt>${escapeHtml(row.label)}</dt><dd translate="no">${escapeHtml(row.value)}</dd></div>`).join('')}</dl><p>${escapeHtml(partAppearanceNote(chosenPart,partCategory,DRONES[draft.build.drone]))}</p></section>`:'';
  const tuning = workbenchTab === 'tuning' ? controllerFields(draft.controller) : null;
  const body = workbenchTab === 'parts' ? `
    ${categoryRail}<div class="panel-header"><h2>${partLabels[partCategory]}</h2><span class="panel-label">Parts: ${parts.length}</span></div>
    <div class="part-scroll" role="group" aria-label="${partLabels[partCategory]} options">${parts.map(part => {
      const owned = account?.ownedParts?.[partCategory]?.includes(part.id);
      return `<button class="part-card ${draft.build[partCategory] === part.id ? 'selected' : ''}" data-part-choice="${escapeHtml(part.id)}" aria-pressed="${draft.build[partCategory] === part.id}"><span class="part-card-check">${icon(partCategory)}</span><span><strong>${escapeHtml(part.name)}</strong></span><em>${draft.build[partCategory] === part.id ? '✓' : owned ? 'Owned' : `${part.cost} cr`}</em></button>`;
    }).join('')}</div>${specifications}
    ` : workbenchTab === 'appearance' ? `<div class="panel-label">${icon('palette')} FINISH & LIGHTING</div><h2>Finish</h2>
    <div class="appearance-grid"><label>Body color<input data-appearance="color" type="color" value="${draft.build.color}"/></label><label>LED color<input data-appearance="led" type="color" value="${draft.build.led}"/></label></div>
    <div class="color-swatches" role="group" aria-label="Body color palette">${['#fc623d','#ffc067','#edf2f6','#4ec7d5','#6777ad','#232a35'].map(color => `<button data-swatch="${color}" style="--swatch:${color}" aria-label="Body color ${color}" aria-pressed="${draft.build.color === color}"></button>`).join('')}</div>
    ${canUseActionCamera(DRONES[draft.baseDrone])?`<section class="component-specifications"><h3>Action camera</h3><label><input id="action-camera" type="checkbox" ${draft.build.actionCamera?'checked':''}> ${escapeHtml(DRONES[draft.baseDrone].accessories.actionCamera.name)}</label><p>Cosmetic accessory. FPV uses the flight camera; this accessory does not change flight performance.</p></section>`:''}` : `<div class="controller-grid">${tuning.fields}</div>`;

  shell('Workbench', '', '', '', `
    <header class="workbench-header"><div class="workbench-title"><h1>Workbench</h1><div class="build-identity"><strong translate="no">${escapeHtml(draft.name)}</strong><small>${escapeHtml(DRONES[draft.baseDrone]?.name || draft.baseDrone)} · Modified</small></div></div>
      <div class="workbench-tools"><div class="workbench-tabs" role="group" aria-label="Workbench section">${[['parts','Parts','frame'],['appearance','Appearance','palette'],['tuning','Tuning','settings']].map(([value,label,glyph]) => `<button data-workbench-tab="${value}" class="${workbenchTab === value ? 'selected' : ''}" aria-pressed="${workbenchTab === value}">${icon(glyph)}${label}</button>`).join('')}</div></div>
    </header>
    <div class="bench-layout ${tuning ? 'bench-tuning' : 'bench-simple'}">
      <section class="game-panel component-panel">${body}</section>
      <div class="bench-center"><div class="hangar-stage" aria-label="Orbit camera around drone"></div>${tuning ? `<section class="game-panel response-panel"><div class="panel-header"><h2>Stick response</h2><div class="rate-legend"><span>Roll</span><span>Pitch</span><span>Yaw</span></div></div>${tuning.graph}</section>` : ''}</div>
      <aside class="bench-characteristics game-panel">${characteristicsHTML(draft.build,{baseline:partComparisonBuild||listFleetDrones(fleet).find(entry=>entry.id===draft.id)?.build,comparisonLabel:partComparisonBuild?'Before this part change':'Compared with saved build'})}</aside>
    </div>
    <footer class="bench-actions game-panel"><button class="button back-button" id="back-workbench"><span aria-hidden="true">←</span> Back to garage</button><button class="button guide-button" data-action="tuning-guide">Drone setup guide</button><output id="workbench-status" class="workbench-status" role="status"></output><div class="bench-save-actions">${workbenchTab === 'tuning' ? '<button class="button" id="default-tune">Reset tuning</button>' : ''}${pending ? `<button class="button" id="buy-workbench-part" ${user.guest || user.credits >= pending.part.cost ? '' : 'disabled'}>Buy ${escapeHtml(pending.part.name)} · ${pending.part.cost} cr</button>` : ''}<button class="button primary" id="save-workbench" ${pending || fleetBusy ? 'disabled' : ''}>${icon('save')} Save changes</button></div></footer>`);
  menu.querySelectorAll('[data-workbench-tab]').forEach(element => element.addEventListener('click', () => { workbenchTab = element.dataset.workbenchTab; renderWorkbench(); }));
  menu.querySelectorAll('[data-part-category]').forEach(element => element.addEventListener('click', () => { partCategory = element.dataset.partCategory; renderWorkbench(); }));
  menu.querySelectorAll('[data-installed-category]').forEach(element => element.addEventListener('click', () => { partCategory = element.dataset.installedCategory; workbenchTab = 'parts'; renderWorkbench(); }));
  menu.querySelectorAll('[data-part-choice]').forEach(element => element.addEventListener('click', () => {
    if(draft.build[partCategory]===element.dataset.partChoice)return;
    partComparisonBuild=structuredClone(draft.build);draft.build[partCategory] = element.dataset.partChoice; renderWorkbench();
  }));
  menu.querySelectorAll('[data-appearance]').forEach(element => element.addEventListener('input', () => { draft.build[element.dataset.appearance] = element.value; menu.querySelectorAll('[data-swatch]').forEach(swatch => swatch.setAttribute('aria-pressed', String(swatch.dataset.swatch === draft.build.color))); updateWorkbenchStatus(); loadHangarPreview(draft.build); }));
  menu.querySelectorAll('[data-swatch]').forEach(element => element.addEventListener('click', () => { draft.build.color = element.dataset.swatch; renderWorkbench(); }));
  menu.querySelector('#action-camera')?.addEventListener('change',event=>{draft.build.actionCamera=event.target.checked;updateWorkbenchStatus();loadHangarPreview(draft.build);});
  menu.querySelector('#back-workbench').addEventListener('click', () => onAction('hangar'));
  menu.querySelector('#save-workbench').addEventListener('click', () => saveWorkbench());
  if(workbenchConflict){
    const recovery=document.createElement('button');recovery.className='button';recovery.textContent='Save draft as a new copy';
    recovery.addEventListener('click',()=>saveWorkbenchConflict());
    menu.querySelector('.bench-save-actions').prepend(recovery);
    menu.querySelector('#workbench-status').textContent='Another device changed this Hangar. Your draft is safe; save it as a new copy or discard it and reopen Hangar.';
  }
  menu.querySelector('#buy-workbench-part')?.addEventListener('click', buyWorkbenchPart);
  if (workbenchTab === 'tuning') {
    controllerDraft = draft.controller;
    updateRateGraph();
    menu.querySelectorAll('[data-tune]').forEach(element => {
      const [section, axis, field] = element.dataset.tune.split('.');
      const labels = { rcRate: 'RC rate', superRate: 'Super rate', expo: 'Expo', p: 'P gain', i: 'I gain', d: 'D gain', angleLimit: 'Angle limit', angleStrength: 'Angle strength', horizonStrength: 'Horizon strength' };
      element.setAttribute('aria-label', field ? `${axis[0].toUpperCase() + axis.slice(1)} ${labels[field] || field}` : section === 'throttle' ? `Throttle ${axis} (%)` : labels[axis] || axis);
      element.required = true;
      element.addEventListener('input', () => { const value = element.value === '' ? NaN : Number(element.value); if (field) draft.controller[section][axis][field] = value; else draft.controller[section][axis] = value; updateRateGraph(); updateWorkbenchStatus(); });
    });
    menu.querySelector('#launch-control').addEventListener('change', event => { draft.controller.launchControl = event.target.checked; updateWorkbenchStatus(); });
    menu.querySelector('#default-tune').addEventListener('click', () => { draft.controller = structuredClone(DEFAULT_FLIGHT_CONTROLLER); renderWorkbench(); });
  }
  loadHangarPreview(draft.build);
  const focus = workbenchTab === 'parts' ? partCategory : 'frame';
  if (previewFocusKey !== focus) { world.focusWorkbenchPart(focus); previewFocusKey = focus; }
  updateWorkbenchStatus();
}

async function saveWorkbench(backToSelection = true) {
  if (fleetBusy || !workbenchDraft || pendingWorkbenchPart()) return false;
  const invalid = [...menu.querySelectorAll('[data-tune]')].find(element => !element.checkValidity());
  if (invalid) { invalid.reportValidity(); return false; }
  const controller = validateFlightController(workbenchDraft.controller);
  if (workbenchHasChanges({ build: workbenchDraft.build, controller }, workbenchDraft)) {
    workbenchTab = 'tuning'; renderWorkbench();
    toast('Check the tuning values before saving. A value is missing or outside its allowed range.');
    return false;
  }
  fleetBusy = true;
  const draft = structuredClone(workbenchDraft);
  menu.querySelectorAll('button,input,select').forEach(element => { element.disabled = true; });
  try {
    const result = !fleetSync && fleet.selectedId === draft.id ? await api('/build', 'POST', { build: draft.build }) : { build: draft.build };
    await storeFleet(updateDroneCopy(fleet, draft.id, { build: result.build, controller: validateFlightController(draft.controller) }));
    selectedDroneId = draft.id;
    if (workbenchDraft?.id === draft.id) workbenchDraft = null;
    controllerDraft = null;
    if (backToSelection && screen === 'workbench') screen = 'hangar';
    toast(`${draft.name} saved.${fleet.selectedId === draft.id ? ' This is your drone in use.' : ' Choose Use drone to fly it.'}`);
    return true;
  } catch (error) { if(error.status===409)workbenchConflict=true;toast(error.message); }
  finally { fleetBusy = false; if (backToSelection || workbenchDraft) render(); }
  return false;
}

async function saveWorkbenchConflict(){
  if(fleetBusy||!fleetSync||!workbenchDraft)return;
  const sync=fleetSync,draft=structuredClone(workbenchDraft),pilotToken=token;
  fleetBusy=true;
  try{
    const remote=await sync.load(fleet,{hasLocalFleet:false});
    if(sync!==fleetSync||token!==pilotToken)return;
    const copy=createDroneCopy(remote,`original:${draft.baseDrone}`);
    const next=selectFleetDrone(updateDroneCopy(copy.fleet,copy.entry.id,draft),remote.selectedId);
    await storeFleet(next);
    selectedDroneId=copy.entry.id;workbenchDraft=null;controllerDraft=null;workbenchConflict=false;screen='hangar';
    toast(`${copy.entry.name} saved. The other device's changes are preserved.`);
  }catch(error){toast(error.message);}
  finally{fleetBusy=false;render();}
}

async function buyWorkbenchPart() {
  const pending = pendingWorkbenchPart();
  if (!pending || fleetBusy) return;
  fleetBusy = true;
  menu.querySelector('#buy-workbench-part')?.setAttribute('disabled', '');
  try {
    await api('/buy-part', 'POST', { category: pending.category, id: pending.part.id });
    await refreshAccount();
    toast(`${pending.part.name} added to your workshop.`);
  } catch (error) { toast(error.message); }
  finally { fleetBusy = false; if (screen === 'workbench') renderWorkbench(); }
}


function renderCareer() {
  const completed = new Map((account?.career || []).map(item => [item.mission, item.stars]));
  const slice = pageEntries(CAREER, careerPage, 6); careerPage = slice.page;
  selectedMissionId = slice.entries.some(mission => mission.id === selectedMissionId) ? selectedMissionId : slice.entries[0]?.id;
  shell('Career', '', '', '', collectionLayout({ kind: 'career', entries: CAREER, selectedId: selectedMissionId, requestedPage: careerPage, maps: MAPS, completed }));
  menu.querySelectorAll('[data-learn-entry]').forEach(element => element.addEventListener('click', () => {
    selectedMissionId = element.dataset.learnEntry; renderCareer();
    menu.querySelector(`[data-learn-entry="${selectedMissionId}"]`)?.focus({ preventScroll: true });
  }));
  world.populateMapPreviews(menu.querySelectorAll('[data-map-preview]'));
}

function renderLobby() {
  if (!room) return;
  if (room.solo) return shell('Preparing challenge', 'WEEKLY CHALLENGE', '<p class="lead">Preparing your server flight. It starts when the drone and course are ready.</p>', button('Cancel', 'leave', 'ghost'));
  const players = room.players.map(item => `<div class="lobby-player"><span class="status-dot ${item.ready ? '' : 'loading'}"></span><strong>${escapeHtml(item.name)}</strong><small>${item.ready?'Ready':'Loading assets'} · ${escapeHtml(DRONES[item.build.drone]?.name || 'Drone')}</small></div>`).join('');
  shell('Ready for takeoff.', 'MULTIPLAYER ROOM', `
    <p class="lead">${room.visibility === 'public' ? 'This room is visible in the public room list.' : 'Share the code with the pilots you want to invite.'}</p>
    <div class="room-code">${escapeHtml(room.code)}</div>
    <div class="lobby-count">${room.players.length} / ${room.maxPlayers || 8} PILOTS · ${multiplayerModes[room.mode] || 'Race'}${room.cup ? ` · ROUND ${room.cup.round}/${room.cup.rounds}` : ''}</div><div class="lobby-list">${players}</div>${room.players.some(item=>!item.ready)?'<p id="asset-progress" class="auth-note">Waiting for selected assets to load…</p>':''}
    <div class="auth-note">${escapeHtml(MAPS[room.map].name)} · ${escapeHtml(getTrack(room.map, room.track).name)}</div>${roomChatHTML()}
  `, `${button('LEAVE ROOM', 'leave', 'ghost')}${room.host === ownId ? `<button class="button primary" data-action="start-room" ${room.players.some(item => !item.ready) ? 'disabled' : ''}>${room.players.some(item => !item.ready) ? 'Waiting for assets…' : 'Start session'}</button>` : '<span class="waiting">WAITING FOR HOST…</span>'}`);
  bindChatForms(menu);
}

function renderResults() {
  if (solo?.tutorial) currentPracticeJournal().complete(solo,flightMode);
  const followingLesson = solo?.tutorial && nextLesson(TUTORIALS,currentPracticeJournal().records,currentPracticeJournal().completedIds);
  const sorted = sortFlightResults(room.players, room.mode);
  const finalCup = room.cup && room.cup.round === room.cup.rounds;
  const ownResult = room.players.find(player => player.id === ownId);
  shell(finalCup ? 'Championship complete' : 'Flight complete', room.cup ? `CUP · ROUND ${room.cup.round}/${room.cup.rounds}` : room.mode === 'freestyle' ? 'FREESTYLE SESSION' : 'RACE RESULTS', `
    <article class="result-map-card"><img data-map-preview="${escapeHtml(room.map)}" src="${escapeHtml(MAPS[room.map].thumbnail || '')}" alt=""/>${mapDownloadHTML(MAPS[room.map])}<strong>${escapeHtml(MAPS[room.map].name)}</strong></article>
    ${ownResult ? `<div class="result-personal"><small>${room.mode === 'freestyle' ? 'Your score' : 'Your time'}</small><strong>${room.mode === 'freestyle' ? `${ownResult.score} pts` : ownResult.finishMs == null ? 'Not finished' : fmtTime(ownResult.finishMs)}</strong></div>` : ''}
    <div class="result-list">${sorted.map((item, index) => `<div class="result-row"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(item.name)}${item.penaltyMs ? `<small>+${item.penaltyMs / 1000}s penalties</small>` : ''}</strong><em>${room.mode === 'freestyle' ? `${item.score} PTS` : item.finishMs === null ? 'DNF' : fmtTime(item.finishMs)}</em></div>`).join('')}</div>
    ${room.cup ? `<h3>CHAMPIONSHIP STANDINGS</h3><div class="cup-standings">${room.cup.standings.map((item,index) => `<div class="record"><span>${index + 1}. ${escapeHtml(item.name)}</span><strong>${item.points} PTS</strong></div>`).join('')}</div>` : ''}
    <p class="auth-note">${solo?.tutorial ? currentPracticeJournal().persistent ? 'Practice result saved in this browser. Download your report to share it.' : 'Browser storage is unavailable. Download your results before closing this page.' : room.ranked ? 'Your server rating has been updated.' : room.cup ? 'Points: 10, 6, 4, 3, 2, 1. Ties use finishes, then combined time.' : user.guest ? 'Sign in with a pilot account to keep flight progress. Replays stay in this browser when you save them.' : 'Completed flights sync to your pilot profile. Replays save only when you choose Save replay.'}</p>
    ${solo?.tutorial ? `<div class="practice-tools">${button('Download my results (CSV)','practice-export')}${button('Download instructor report (JSON)','practice-report')}${button(followingLesson?'Next exercise':'Review practice','practice-next','primary')}</div>` : ''}
    ${roomChatHTML()}
  `, `${button('MAIN MENU', 'leave', 'ghost')}${replayBuffer.length ? button('SAVE REPLAY', 'save-replay') : ''}${clipBlob ? button('DOWNLOAD CLIP', 'download-clip') : ''}${room.host === ownId ? room.cup ? finalCup ? '' : button('NEXT ROUND', 'advance-cup', 'primary') : button('FLY AGAIN', 'restart', 'primary') : ''}`);
  bindChatForms(menu);
}

async function renderWeekly(cached = null) {
  const data = cached || await api('/weekly');
  if (screen !== 'weekly') return;
  weeklyData = data; catalog.weekly = data.challenge;
  weeklyPage = pageEntries(data.rows, weeklyPage, 6).page;
  shell('Weekly challenge', '', '', '', weeklyLayout({ challenge: data.challenge, rows: data.rows, page: weeklyPage, maps: MAPS, track: getTrack(data.challenge.map, data.challenge.track), guest: user.guest }));
  world.populateMapPreviews(menu.querySelectorAll('[data-map-preview]'));
}

async function renderChampionship(cached = null) {
  const data = cached || await api('/cup-leaderboard');
  if (screen !== 'championship') return;
  championshipData = data;
  championshipPage = pageEntries(data.rows, championshipPage, 6).page;
  shell('Championship', '', '', '', championshipLayout({ rows: data.rows, page: championshipPage, map: selectedMap(MAPS, chosenMap) }));
  world.populateMapPreviews(menu.querySelectorAll('[data-map-preview]'));
}

async function renderProfile() {
  const data = account || { user, records: [], career: [], achievements: [] };
  data.fleetCount=fleet?.modified.length||0;
  data.fleetSyncedAt=fleetSync?.updatedAt;
  shell('Pilot profile', '', '', '', pilotProfileLayout({ data, rankings: profileRankings?.rows||[], tab: profileTab, pages: profilePages, maps: MAPS }));
  world.populateMapPreviews(menu.querySelectorAll('[data-map-preview]'));
  if(profileTab==='rankings'&&!profileRankings){
    const message=menu.querySelector('.pilot-empty');if(message)message.textContent='Loading rankings…';
    const pilotToken=token;
    try {
      if(rankingsRequest?.token!==pilotToken){
        const request={token:pilotToken,promise:api('/rankings')};rankingsRequest=request;
        request.promise.finally(()=>{if(rankingsRequest===request)rankingsRequest=null;}).catch(()=>{});
      }
      const ranking=await rankingsRequest.promise;
      if(token!==pilotToken)return;
      profileRankings=ranking;
      if(screen==='profile'&&profileTab==='rankings')renderProfile();
    } catch(error) {
      if(screen==='profile'&&profileTab==='rankings'&&message?.isConnected)message.textContent='Rankings unavailable. Reopen this tab to retry.';
    }
  }
}

function renderSettings() { return renderControls(); }
function renderLanguage(){
 renderSettingsPanel('language',`<div class="language-setting"><label>Interface language<select id="interface-language">${LOCALES.map(locale=>`<option value="${locale.id}" lang="${locale.id}" translate="no" ${currentLanguage()===locale.id?'selected':''}>${locale.name}</option>`).join('')}</select></label><p class="settings-help">Choose the language for menus, help and lessons.</p></div>`);
 menu.querySelector('#interface-language').onchange=event=>setLanguage(event.target.value);
}

function renderSettingsPanel(section, content, monitor = '') {
  const backLabel = settingsReturn === 'pause' ? 'Back to flight menu' : settingsReturn === 'home' ? 'Back to main menu' : `Back to ${SCREEN_TITLES[settingsReturn] || settingsReturn}`;
  shell('Settings', '', '', '', settingsLayout(backLabel, section, content, monitor));
}

function openSettings(section = 'settings') {
  if (screen === 'flight') pauseFlight();
  const changingCategory = ['settings', 'controls', 'camera', 'graphics','language'].includes(screen);
  if (!['settings', 'controls', 'camera', 'graphics','language'].includes(screen)) settingsReturn = pauseOpen ? 'pause' : screen === 'workbench' ? 'hangar' : screen;
  screen = section;
  render();
  if (changingCategory) menu.querySelector('.menu-rail .selected')?.focus();
}

function renderControls() {
  const devices = input.devices();
  const profile = input.profile();
  const missingController = input.selected && input.selected !== 'keyboard' && !devices.some(device => deviceKey(device) === input.selected);
  renderSettingsPanel('controls', `
    <div class="controls-form">
      <div class="control-select-row"><label>Flight mode<select id="flight-mode"><option value="angle">Angle</option><option value="horizon">Horizon</option><option value="acro">Acro</option></select></label>
      <label>Radio<select id="device-select"><option value="">Auto select</option><option value="keyboard">Keyboard only</option>${missingController ? `<option value="${escapeHtml(input.selected)}" disabled>${escapeHtml(input.selected.slice(0, 50))} · Disconnected</option>` : ''}${devices.map(device => `<option value="${escapeHtml(deviceKey(device))}">${escapeHtml(device.id.slice(0, 60))}</option>`).join('')}</select></label>
      </div><label>Throttle stick<select id="throttle-mode"><option value="full">Full travel · RC radio</option><option value="centered">Centered · gamepad</option></select></label>
      <button class="mini-button calibrate-button" id="connect-hid" ${navigator.hid ? '' : 'disabled'}>Connect USB radio</button>
      ${navigator.hid ? '' : '<p class="settings-help">Direct USB access is unavailable in this browser.</p>'}
      <p id="controller-status" class="settings-help" role="status" aria-live="polite"></p>
      <div id="axis-list">${['throttle', 'yaw', 'pitch', 'roll'].map(name => `<div class="axis-row"><span>${name.toUpperCase()}</span><button class="mini-button" data-capture="${name}">AXIS ${profile.axis[name]} · REMAP</button><label class="check"><input type="checkbox" data-invert="${name}" ${profile.invert[name] ? 'checked' : ''}/> INVERT</label></div>`).join('')}</div>
      <button class="mini-button calibrate-button" id="calibrate-endpoints">Calibrate endpoints · 9 sec</button>
      <label>Dead zone <strong id="deadzone-value">${Math.round(profile.deadzone * 100)}%</strong><input id="deadzone" type="range" min="0" max="20" value="${profile.deadzone * 100}" /></label>
    </div>
  `, '<section class="virtual-radio"><div class="panel-label">INPUT MONITOR</div><h2>Live radio</h2><div class="radio-device"><div class="radio-grip"><div class="radio-gimbal"><i id="radio-left"></i></div><small>YAW · THROTTLE</small></div><div class="radio-center"></div><div class="radio-grip"><div class="radio-gimbal"><i id="radio-right"></i></div><small>ROLL · PITCH</small></div></div></section>');

  menu.querySelector('#flight-mode').value = flightMode;
  menu.querySelector('#device-select').value = input.selected || '';
  menu.querySelector('#throttle-mode').value = profile.throttleMode;
  menu.querySelector('#flight-mode').addEventListener('change', event => { flightMode = event.target.value; localStorage.setItem('liftoff-flight-mode', flightMode); });
  menu.querySelector('#device-select').addEventListener('change', event => { input.selectDevice(event.target.value); renderControls(); });
  menu.querySelector('#throttle-mode').addEventListener('change', event => { const next = input.profile(); next.throttleMode = event.target.value; input.saveProfile(next); });
  menu.querySelector('#connect-hid').addEventListener('click', async () => { try { if (await input.connectHid() && ['settings', 'controls'].includes(screen)) renderControls(); } catch (error) { toast(error.message); } });
  menu.querySelectorAll('[data-capture]').forEach(element => element.addEventListener('click', () => {
    input.beginCapture(element.dataset.capture, axis => toast(`${element.dataset.capture.toUpperCase()} mapped to axis ${axis}`), reason => toast(reason === 'timeout' ? 'No stick movement detected. Choose Remap to try again.' : 'Remapping cancelled: controller changed.'));
    updateControlStatus();
  }));
  menu.querySelectorAll('[data-invert]').forEach(element => element.addEventListener('change', () => { const next = input.profile(); next.invert[element.dataset.invert] = element.checked; input.saveProfile(next); }));
  menu.querySelector('#calibrate-endpoints').addEventListener('click', () => { const started = input.beginCalibration(() => toast('Stick endpoints saved.')); toast(started ? 'Move every stick fully through its range for nine seconds.' : 'Connect and select a controller first.'); });
  menu.querySelector('#deadzone').addEventListener('input', event => { const next = input.profile(); next.deadzone = Number(event.target.value) / 100; input.saveProfile(next); menu.querySelector('#deadzone-value').textContent = `${event.target.value}%`; });
  updateControlStatus();
}

function updateControlStatus() {
  const status = menu.querySelector('#controller-status');
  if (!status) return;
  const available = !!input.selectedDevice();
  const occupied = !!(input.capture || input.calibration);
  menu.querySelectorAll('[data-capture],[data-invert],#throttle-mode,#deadzone,#calibrate-endpoints').forEach(element => { element.disabled = !available || occupied; });
  const profile = input.profile();
  menu.querySelectorAll('[data-capture]').forEach(element => {
    const label = input.capture?.name === element.dataset.capture ? 'MOVE THAT STICK…' : `AXIS ${profile.axis[element.dataset.capture]} · REMAP`;
    localizedText(element,label);
  });
  const message = input.capture ? `${input.capture.name}: ${Math.max(0, Math.ceil((input.capture.until - performance.now()) / 1000))} sec remaining`
    : input.calibration ? `Calibrating: ${Math.max(0, Math.ceil((input.calibration.until - performance.now()) / 1000))} sec remaining`
      : !available && input.selected && input.selected !== 'keyboard' ? 'Radio disconnected' : '';
  localizedText(status,message);
}

function renderCamera() {
  const build = room?.ranked ? defaultBuild() : room?.players.find(player => player.id === ownId)?.build || user?.build || defaultBuild();
  const camera = cameraSettings(build);
  renderSettingsPanel('camera', `
    <div class="camera-form">
      <label>Flight view<select id="camera-mode"><option value="fpv">FPV · onboard camera</option><option value="chase">Dynamic chase · smooth follow</option><option value="chase-rigid">Rigid chase · fixed to aircraft</option></select></label>
      <div class="camera-setting"><label>FPV tilt <strong id="tilt-value">${camera.tilt}°</strong><input id="fpv-tilt" type="range" min="0" max="60" value="${camera.tilt}" /></label></div>
      <div class="camera-setting"><label>FPV field of view <strong id="fov-value">${camera.fov}°</strong><input id="fpv-fov" type="range" min="75" max="125" value="${camera.fov}" /></label></div>
      
    </div>
  `);
  menu.querySelector('#camera-mode').value = cameraMode;
  menu.querySelector('#camera-mode').addEventListener('change', event => { cameraMode = event.target.value; world.setCameraMode(cameraMode); localStorage.setItem('liftoff-camera-mode', cameraMode); });
  for (const [id, key, valueId] of [['fpv-tilt', 'tilt', 'tilt-value'], ['fpv-fov', 'fov', 'fov-value']]) {
    menu.querySelector(`#${id}`).addEventListener('input', event => {
      saveCameraSettings(build, { [key]: Number(event.target.value) });
      menu.querySelector(`#${valueId}`).textContent = `${event.target.value}°`;
      applyCameraSettings();
    });
  }
}

function renderPause() {
  const own = room?.players.find(player => player.id === ownId);
  const map = MAPS[room?.map] || MAPS[chosenMap];
  const roster = room && !room.solo ? `<div class="pause-roster">${room.players.map(player => `<div class="record"><span translate="no">${escapeHtml(player.name)}${player.id === ownId ? ' · YOU' : ''}</span><strong>${player.finishMs == null ? 'FLYING' : fmtTime(player.finishMs)}</strong></div>`).join('')}</div>` : '';
  shell('Flight menu', '', '', '', flightMenuLayout({ solo: !!room?.solo, finished: own?.finishMs != null, map, trackName: room?.mode === 'training' ? '' : map?.tracks.find(track => track.id === room?.track)?.name, canSave: !!replayBuffer.length, roster, chat: room && !room.solo ? roomChatHTML() : '' }));
  bindChatForms(menu);
}

function canRecordCurrentFlight(){
  const own=room?.players.find(player=>player.id===ownId);
  return !!own&&['running','paused'].includes(room.status)&&own.finishMs==null;
}
function startStutterRecording(){
  if(performanceCapture?.run)return toast('Stop the Low capture with F4 first.');
  if(screen!=='flight'||!canRecordCurrentFlight())return toast('Start flying, then press F7 to record current settings.');
  stutterCapture ||= new StutterCapture(world,toast);
  stutterCapture.start({revision:catalog.revision,
    client:new URL(document.querySelector('script[type="module"][src]')?.src||location.href).pathname,
    map:room.map,track:room.track,drone:(room.players.find(player=>player.id===ownId)?.build||user.build).drone,multiplayer:!room.solo,players:room.players.length});
}
function openDiagnostics(){
  showDiagnostics({root:app,current:()=>stutterCapture,low:()=>performanceCapture,canRecord:canRecordCurrentFlight,
    onRecord:async()=>{await onAction('continue-flight');startStutterRecording();}});
}
function downloadLatestCapture(){
  const capture=latestCapture(stutterCapture,performanceCapture);
  if(capture)capture.download();else toast('No recording yet. Open Performance diagnostics from the flight menu.');
}

function syncGraphicsPresetSelection(quality) {
  menu.querySelectorAll('[data-preset]').forEach(element => {
    const selected = element.dataset.preset === quality;
    element.classList.toggle('selected', selected);
    element.setAttribute('aria-pressed', String(selected));
  });
  const status = menu.querySelector('#graphics-quality-status');
  if (status) status.textContent = quality === 'auto' ? `Auto · ${readableLabel(readGraphics().automaticPreset)}` : quality === 'custom' ? 'Custom settings' : '';
}

function renderGraphics() {
  const settings = readGraphics();
  renderSettingsPanel('graphics',graphicsPanel(settings));
  syncGraphicsPresetSelection(settings.quality);
  updateFullscreenSetting(fullscreen.getState());
  menu.querySelector('#fullscreen-toggle').addEventListener('change',event=>{fullscreen.set(event.target.checked);});
  const updateResolution = () => {
    const percent=Math.round(world.graphics.resolution*100);
    menu.querySelector('#graphics-resolution').value=percent;
    menu.querySelector('#resolution-value').textContent=`${percent}%`;
    menu.querySelectorAll('[data-resolution]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.resolution)===percent)));
    localizedText(menu.querySelector('#resolution-size'),`3D resolution: ${world.renderer.domElement.width} × ${world.renderer.domElement.height}`);
  };
  const applyResolution = value => {
    world.setGraphics(selectRenderResolution(value));
    menu.querySelector('[data-graphic="adaptiveResolution"]').checked=false;
    syncGraphicsPresetSelection('custom');updateResolution();
  };
  updateResolution();
  menu.querySelector('#graphics-resolution').addEventListener('input',event=>applyResolution(Number(event.target.value)/100));
  menu.querySelectorAll('[data-resolution]').forEach(button=>button.addEventListener('click',()=>applyResolution(Number(button.dataset.resolution)/100)));
  menu.querySelectorAll('[data-preset]').forEach(element => element.addEventListener('click', () => { world.setGraphics(selectGraphicsPreset(element.dataset.preset)); renderGraphics(); }));
  menu.querySelectorAll('[data-graphic]').forEach(element => element.addEventListener('change', () => { world.setGraphics(saveGraphics({ [element.dataset.graphic]: element.checked, quality: 'custom' })); syncGraphicsPresetSelection('custom'); }));
  menu.querySelector('#graphics-textures').addEventListener('change',event=>{world.setGraphics(saveGraphics({textureSize:Number(event.target.value),quality:'custom'}));syncGraphicsPresetSelection('custom');});
  for (const [id, key, display, divisor] of [['graphics-exposure', 'exposure', 'exposure-value', 100],['graphics-lod','lodDistanceScale','lod-value',100]]) {
    menu.querySelector(`#${id}`).addEventListener('input', event => {
      const value = Number(event.target.value) / divisor;
      world.setGraphics(saveGraphics({ [key]: value, quality: 'custom' }));
      menu.querySelector(`#${display}`).textContent = key === 'resolution' ? `${event.target.value}%` : value.toFixed(2)+(key==='lodDistanceScale'?'×':'');
      syncGraphicsPresetSelection('custom');
    });
  }
}

async function renderReplays() {
  viewingReplay=null;replayPlaying=false;world.removeMissing(['preview']);
  let records;
  try { records = await listReplays(); } catch (error) { toast(`Cannot open replay storage: ${error.message}`); records = []; }
  if (screen !== 'replays') return;
  const slice = pageEntries(records, replaysPage, 6); replaysPage = slice.page;
  const pager = pagination(slice.page, slice.pages, 'replays', 'Replay pages');
  shell('Replays','','','',replayLibrary(slice.entries,MAPS,{pager,formatTime:fmtTime}));
  menu.querySelectorAll('[data-watch]').forEach(element => element.addEventListener('click', async () => {
    try {
      const record = await getReplay(element.dataset.watch);
      if (screen !== 'replays') return;
      if (!record?.frames?.length) { toast('This replay is no longer available.'); return renderReplays(); }
      if (!MAPS[record.map]) { toast('Restore the archived map before watching this replay.'); return; }
      await openReplay(record);
    } catch (error) { toast(`Cannot open replay: ${error.message}`); }
  }));
  menu.querySelectorAll('[data-rename]').forEach(element => element.addEventListener('click', async () => {
    try {
      const record = await getReplay(element.dataset.rename);
      if (screen !== 'replays') return;
      if (!record) { toast('This replay is no longer available.'); return renderReplays(); }
      const name = await askReplay('Rename replay', record.name, 'Rename');
      if (name !== null) { await renameReplay(record.id, name); if (screen === 'replays') renderReplays(); }
    } catch (error) { toast(`Cannot rename replay: ${error.message}`); }
  }));
  menu.querySelectorAll('[data-delete]').forEach(element => element.addEventListener('click', async () => {
    try { if (await askReplay('Delete this replay?', null, 'Delete')) { await deleteReplay(element.dataset.delete); if (screen === 'replays') renderReplays(); } }
    catch (error) { toast(`Cannot delete replay: ${error.message}`); }
  }));
}

async function openReplay(record){
  cancelFlightLoading();viewingReplay=null;replayPlaying=false;
  const builds=record.builds||{[record.ownId]:record.build||defaultBuild()},specs=Object.values(builds).map(build=>resolveBuild(build));
  const cancel=()=>{cancelFlightLoading();viewingReplay=null;screen='replays';render();};
  const session=loadingFlight(flightAssetURLs(MAPS[record.map],specs,[],getTrack(record.map,record.track),{course:courseEnabled(record)}),'Preparing replay',cancel,()=>openReplay(record));
  try{
    await session.download();session.stage('Processing models');await nextPaint();session.check();
    world.removeMissing([]);await world.load(record.map,record.track,{course:courseEnabled(record),signal:session.abort.signal});session.check();
    const items=record.frames[0].players.map(player=>world.upsertDrone(player.id,resolveBuild(builds[player.id]||record.build||defaultBuild()),player.state,player.id===record.ownId));
    await Promise.all(items.map(item=>item.mesh.assetsReady));session.check();
    replayCameraMode=cameraMode;world.setCameraMode(replayCameraMode);applyCameraSettings(record.build||defaultBuild());
    session.stage('Preparing graphics');await world.prepareGraphics();session.check();
    if(activeFlightLoad!==session)return;
    session.finish();activeFlightLoad=null;viewingReplay=record;replayPosition=0;replayPlaying=true;replaySpeed=1;replayLastFrame=performance.now();screen='replay-viewer';render();updateReplayWorld();
  }catch(error){if(activeFlightLoad===session&&error.name!=='AbortError')session.error(error);}
}

function renderReplayViewer() {
  if (!viewingReplay?.frames?.length) { screen = 'replays'; return renderReplays(); }
  world.setCameraMode(replayCameraMode);
  applyCameraSettings(viewingReplay.build || defaultBuild());
  shell('Replay', escapeHtml(viewingReplay.name), `
    <div class="replay-controls"><button class="button" id="replay-play">PAUSE</button><label>TIME<input id="replay-seek" type="range" min="0" max="${Math.round(viewingReplay.duration)}" value="0" /></label><span id="replay-clock">00:00.00</span><label>SPEED<select id="replay-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><button class="button" id="replay-camera">Camera: ${cameraModeLabel(replayCameraMode)}</button></div>
  `, button('BACK', 'replays', 'ghost'));
  menu.querySelector('#replay-play').addEventListener('click', event => { if (!replayPlaying && replayPosition >= viewingReplay.duration) replayPosition = 0; replayPlaying = !replayPlaying; event.target.textContent = replayPlaying ? 'PAUSE' : 'PLAY'; });
  menu.querySelector('#replay-seek').addEventListener('input', event => { replayPosition = Number(event.target.value); updateReplayWorld(); });
  menu.querySelector('#replay-speed').addEventListener('change', event => { replaySpeed = Number(event.target.value); });
  menu.querySelector('#replay-camera').addEventListener('click', event => { replayCameraMode = nextCameraMode(replayCameraMode); world.setCameraMode(replayCameraMode); event.currentTarget.textContent = `Camera: ${cameraModeLabel(replayCameraMode)}`; });
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
  if (!ids.includes(world.activeDroneId)) world.activeDroneId = ids.includes(viewingReplay.ownId) ? viewingReplay.ownId : ids[0] || null;
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
  for (const [axis, color] of [['roll', '#ffae70'], ['pitch', '#78d8df'], ['yaw', '#a29ae8']]) {
    const points = Array.from({ length: 65 }, (_, index) => {
      const stick = index / 32 - 1;
      return `${15 + index * 4.53},${90 - Math.max(-800, Math.min(800, rateDegrees(stick, profile.rates[axis]))) * 0.09}`;
    });
    svg.querySelector(`#curve-${axis}`).setAttribute('points', points.join(' '));
    svg.querySelector(`#curve-${axis}`).setAttribute('stroke', color);
    menu.querySelector(`#velocity-${axis}`).textContent = `${Math.round(rateDegrees(1, profile.rates[axis]))}°/s`;
  }
}

function controllerFields(profile) {
  const axes = ['roll', 'pitch', 'yaw'];
  const rates = `<section class="tune-card rates-card"><h2>Betaflight rates</h2><div class="tune-rate-head"><span></span><span>RC rate</span><span>Super rate</span><span>Expo</span><span>°/s</span></div>${axes.map(axis => `<div class="tune-rate-row"><strong>${axis.toUpperCase()}</strong>${numericTune(`rates.${axis}.rcRate`, '', profile.rates[axis].rcRate, 0.1, 2.5, 0.01)}${numericTune(`rates.${axis}.superRate`, '', profile.rates[axis].superRate, 0, 0.95, 0.01)}${numericTune(`rates.${axis}.expo`, '', profile.rates[axis].expo, 0, 1, 0.01)}<span id="velocity-${axis}"></span></div>`).join('')}</section>`;
  const pid = `<section class="game-panel tune-card"><h2>PID controller</h2><div class="tune-rate-head pid-head"><span></span><span>P</span><span>I</span><span>D</span></div>${axes.map(axis => `<div class="pid-row"><strong>${axis.toUpperCase()}</strong>${numericTune(`pid.${axis}.p`, '', profile.pid[axis].p, 0, 100)}${numericTune(`pid.${axis}.i`, '', profile.pid[axis].i, 0, 100)}${axis === 'yaw' ? '<span>—</span>' : numericTune(`pid.${axis}.d`, '', profile.pid[axis].d, 0, 100)}</div>`).join('')}</section>`;
  const level = `<section class="tune-card"><h2>Level modes</h2><div class="tune-fields">${numericTune('level.angleLimit', 'Angle limit °', profile.level.angleLimit, 10, 85)}${numericTune('level.angleStrength', 'Angle strength', profile.level.angleStrength, 0, 100)}${numericTune('level.horizonStrength', 'Horizon strength', profile.level.horizonStrength, 0, 100)}</div></section>`;
  const throttle = `<section class="game-panel tune-card"><h2>Throttle</h2><div class="tune-fields">${numericTune('throttle.start', 'Start %', profile.throttle.start, 0, 50)}${numericTune('throttle.end', 'End %', profile.throttle.end, 50, 100)}${numericTune('throttle.mid', 'Mid %', profile.throttle.mid, 10, 90)}${numericTune('throttle.expo', 'Expo %', profile.throttle.expo, 0, 100)}${numericTune('throttle.idle', 'Idle %', profile.throttle.idle, 0, 15)}</div><label class="check launch-check"><input type="checkbox" id="launch-control" ${profile.launchControl ? 'checked' : ''}/>Launch control</label></section>`;
  const graph = '<svg id="rate-graph" viewBox="0 0 320 180" preserveAspectRatio="none" role="img" aria-label="Live roll pitch yaw rate curves"><path d="M15 90 H305 M160 10 V170" stroke="#637386" fill="none"/><polyline id="curve-roll" fill="none" stroke-width="2"/><polyline id="curve-pitch" fill="none" stroke-width="2"/><polyline id="curve-yaw" fill="none" stroke-width="2"/></svg><p class="rate-graph-caption">Stick position → Rotation rate (°/s). Graph range: ±800 °/s.</p>';
  return { fields:rates+pid+level+throttle, graph };
}

function renderFlightController() {
  if (room) { openSettings(); return toast("Open Workbench between flights to change a drone."); }
  selectedDroneId = fleet.selectedId;
  openWorkbench("tuning");
}

async function enterMultiplayer(message) {
  startAudio();
  if (fleetBusy || multiplayerPending || rankedQueue) return;
  fleetBusy = true;
  const origin = screen, pilot = token;
  if (message.type === 'queue') { rankedQueue = true; renderMultiplayer(); }
  else { multiplayerPending = true; toast(message.type === 'join' ? 'Joining room…' : message.type === 'solo' ? 'Connecting weekly challenge…' : 'Creating room…'); }
  try {
    await api('/build', 'POST', { build: activeDrone()?.build || user.build });
    if (screen !== origin || token !== pilot || (message.type === 'queue' ? !rankedQueue : !multiplayerPending)) return;
    send(message);
  } catch (error) { disconnectMultiplayer(); toast(error.message); if (screen === 'multiplayer') renderMultiplayer(); }
  finally { fleetBusy = false; }
}

async function onAction(action) {
  try {
  if(action==='diagnostics')return openDiagnostics();
  if(action==='tuning-guide')return showTuningGuide({root:app,initialTopic:screen==='workbench'&&workbenchTab==='tuning'?'pid':'parts'});
  if(action==='leave'&&stutterCapture?.run){stutterCapture.run.event('flight-ended',performance.now());stutterCapture.finish();}
  if (['edition-start','edition-class','edition-standard'].includes(action) && !room) return setPracticeEdition(action.slice(8));
  if (action === 'practice-room') { roomOptions.visibility='private'; roomOptions.maxPlayers=4; roomOptions.mode='race'; screen='multiplayer'; render(); return showCreateRoomDialog(); }
  if (action === 'practice-copy') {
    const field=menu.querySelector('#practice-link'); if(!field)return;
    try { await navigator.clipboard.writeText(field.value); toast('Learner link copied.'); }
    catch { field.focus();field.select();toast('Select and copy the learner link.'); }
    return;
  }
  if (action === 'practice-export') {
    const journal=currentPracticeJournal(); if(!journal.records.length)return;
    return downloadPracticeFile(practiceCSV(journal.records,TUTORIALS),'text/csv;charset=utf-8','parvoz-practice-'+new Date().toISOString().slice(0,10)+'.csv');
  }
  if (action === 'practice-report') {
    return downloadPracticeFile(practiceReport(currentPracticeJournal().records,TUTORIALS),'application/json','parvoz-practice-'+new Date().toISOString().slice(0,10)+'.json');
  }
  if (action === 'practice-next' && solo?.tutorial && room?.status==='ended') {
    practiceSelectedId=nextLesson(TUTORIALS,currentPracticeJournal().records,currentPracticeJournal().completedIds)?.id || null;
    await onAction('leave');
    const url=new URL(location.href);url.searchParams.delete('lesson');history.replaceState(null,'',url);
    return setPracticeEdition('start');
  }
    if (screen === 'auth' && accountAction.busy) return;
    if (screen === 'profile' && action.startsWith('profile-tab-')) {
      const tab = action.slice(12);
      if (['records', 'achievements', 'rankings', 'account', 'data'].includes(tab)) { profileTab = tab; renderProfile(); menu.querySelector('.menu-rail .selected')?.focus(); return; }
    }
    const profilePaging = /^profile-(records|freestyle|rankings)-(previous|next)$/.exec(action);
    if (screen === 'profile' && profilePaging) { profilePages[profilePaging[1]] += profilePaging[2] === 'next' ? 1 : -1; return renderProfile(); }
    const paging = /^(career|tutorials|maps|rooms|weekly|championship|replays)-(previous|next)$/.exec(action);
    if (paging) {
      const delta = paging[2] === 'next' ? 1 : -1;
      if (paging[1] === 'career') { careerPage += delta; return renderCareer(); }
      if (paging[1] === 'tutorials') { lessonsPage += delta; return renderTutorials(); }
      if (paging[1] === 'maps') { mapsPage += delta; const slice = pageEntries(catalog.maps, mapsPage, 6); chosenMap = slice.entries[0].id; chosenTrack = MAPS[chosenMap].tracks[0].id; return renderMaps(); }
      if (paging[1] === 'rooms') { roomsPage += delta; return renderPublicRoomList(); }
      if (paging[1] === 'weekly') { weeklyPage += delta; return renderWeekly(weeklyData); }
      if (paging[1] === 'replays') { replaysPage += delta; return renderReplays(); }
      championshipPage += delta; return renderChampionship(championshipData);
    }
    if (action === 'championship') { screen = 'championship'; return render(); }
    if (action === 'host-championship') { roomOptions.mode = 'cup'; screen = 'multiplayer'; render(); return showCreateRoomDialog(); }
    if (action === 'launch-mission') {
      const mission = CAREER.find(entry => entry.id === selectedMissionId);
      if (!mission) return;
      chosenMode = 'career'; chosenMap = mission.map; chosenTrack = mission.track; launch.challenge = mission; return launch();
    }
    if (action === 'recover-account') {
      const recovered = await accountAccessDialog(app, api, { recover: true, username: menu.querySelector('#auth-name')?.value || '' });
      if (recovered) { renderAuth(); toast('Password changed. Sign in, then create a new recovery code in your profile.'); }
      return;
    }
    if (action === 'recovery-code') {
      if (await accountAccessDialog(app, api)) { await refreshAccount(); if (screen === 'profile') renderProfile(); }
      return;
    }
    if (fleetBusy && ['hangar','workbench'].includes(screen)) return;
    if (screen === 'workbench' && action !== 'help' && !(await leaveWorkbench())) return;
    if ((rankedQueue || multiplayerPending) && !['help','ranked'].includes(action)) { disconnectMultiplayer(); }
    if (action === 'cancel-ranked') { return renderMultiplayer(); }
    if (action === 'export-local') {
      const backup = await createLocalBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = `parvoz-drone-sim-local-${Date.now()}.json`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      return toast('Local settings and replays exported. Account progress stays on the server.');
    }
    if (action === 'import-local') {
      const picker = document.createElement('input');
      picker.type = 'file'; picker.accept = '.json,application/json'; picker.hidden = true;
      document.body.appendChild(picker);
      picker.addEventListener('cancel', () => picker.remove(), { once: true });
      picker.addEventListener('change', async () => {
        try {
          const file = picker.files?.[0];
          if (!file) return;
          if (file.size > 100 * 1024 * 1024) throw new Error('Backup is larger than 100 MB.');
          const owner=fleetOwner,sync=fleetSync,pilotToken=token;
          const count = await restoreLocalBackup(JSON.parse(await file.text()));
          if(sync && token===pilotToken && fleetOwner===owner){
            const imported=readDroneFleet(owner);
            const saved=await sync.importLocal(imported);
            if(token===pilotToken&&fleetSync===sync){fleet=saved;user.build=structuredClone(activeDrone().build);}
          }
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
      stopVideo(); pauseOpen = false; solo = null; disconnectMultiplayer(); room = null; account = null; user = null; fleet = null; fleetOwner = null; selectedDroneId = null; workbenchDraft = null; controllerDraft = null;
      world.removeMissing([]); screen = 'auth'; return render();
    }
    if (action === 'tutorials') { screen = 'tutorials'; return render(); }
    if (action.startsWith('flight-activity-')) { homeMode = action.slice(16); chosenMode = homeMode; screen = 'maps'; return render(); }
    if (action === 'home-fly' || action === 'home-location') {
      chosenMode = homeMode;
      if (!MAPS[chosenMap]?.tracks.some(track => track.id === chosenTrack)) chosenTrack = MAPS[chosenMap].tracks[0].id;
      screen = 'maps'; return render();
    }
    if (action.startsWith('tutorial-')) { const lesson = TUTORIALS.find(item=>item.id===action.slice(9)); if (!lesson) return; launch.tutorial = lesson; chosenMode = 'training'; chosenMap = lesson.map; chosenTrack = lesson.track; return launch(); }
    if (action === 'help') return showHelp();
    if (action === 'continue-flight') {
      input.reset();
      if (room?.solo && room.status === 'paused') send({ type: 'resume' });
      pauseOpen = false; screen = 'flight'; menu.classList.add('hidden'); hud.classList.remove('hidden'); return;
    }
    if (action === 'restart-flight') {
      replayBuffer = []; replayCaptureAt = 0; pauseOpen = false;
      send({ type: 'restart-flight' }); screen = 'flight'; menu.classList.add('hidden'); hud.classList.remove('hidden'); return;
    }
    if (action === 'settings-back') { screen = settingsReturn === 'pause' ? pauseOpen && room ? 'pause' : 'home' : settingsReturn; return render(); }
    if (action === 'settings-category-back' || action === 'graphics-back') { screen = 'settings'; return render(); }
    if (action === 'save-replay') return saveCurrentReplay();
    if (action === 'replays') { screen = 'replays'; return render(); }
    if (['controls', 'camera', 'graphics'].includes(action)) return openSettings(action);
    if (action === 'flight-controller') return renderFlightController();
    if (['login', 'register', 'guest'].includes(action)) {
      if (accountAction.busy) return;
      const callsign = menu.querySelector('#auth-name'), passwordField = menu.querySelector('#auth-password');
      if (action !== 'guest') {
        callsign.value = callsign.value.trim();
        if (!callsign.reportValidity() || !passwordField.reportValidity()) return;
      }
      const username = callsign.value;
      const password = passwordField.value;
      return accountAction.run(async () => {
        const fields = [...menu.querySelectorAll('.auth-panel input, .auth-panel button')];
        const status = menu.querySelector('#auth-status'), errorMessage = menu.querySelector('#auth-error');
        fields.forEach(element => { element.disabled = true; });
        errorMessage.hidden = true;
        status.textContent = action === 'register' ? 'Creating account…' : action === 'guest' ? 'Starting…' : 'Signing in…';
        try {
          const result = await api(`/${action}`, 'POST', action === 'guest' ? undefined : { username, password });
          token = result.token; localStorage.setItem('liftoff-token', token); user = result.user;
          await refreshAccount();
          // A first sign-in can select a different cloud build than the guest
          // workshop prepared at startup. Finish that preparation before home.
          const loading=new StartupLoading();
          try{await prepareInitialHangar(loading);loading.finish();}catch(error){loading.cancel();throw error;}
          screen = action === 'register' ? 'profile' : 'home'; render();
        } catch (error) {
          errorMessage.textContent = error.message; errorMessage.hidden = false;
        } finally {
          status.textContent = '';
          fields.forEach(element => { element.disabled = false; });
        }
      });
    }
    if (action.startsWith('mode-')) {
      chosenMode = action.slice(5); chosenMap = defaultMap(MAPS).id; chosenTrack = MAPS[chosenMap].tracks[0].id; screen = 'maps'; return render();
    }
    if (action === 'home') { screen = 'home'; return render(); }
    if (action === 'career') { screen = 'career'; return render(); }
    if (action === 'weekly') { screen = 'weekly'; return render(); }
    if (action === 'weekly-start') { chosenMode = 'weekly'; chosenMap = catalog.weekly.map; chosenTrack = catalog.weekly.track; return launch(); }
    if (action === 'hangar') {
      if (screen !== 'workbench' && screen !== 'hangar') hangarReturn = screen === 'maps' ? 'maps' : 'home';
      screen='hangar';render();
      if(!workbenchDraft){
        const previous=JSON.stringify([fleet,account?.unlocks]);await refreshAccount();
        if(screen==='hangar'&&!fleetBusy&&JSON.stringify([fleet,account?.unlocks])!==previous)render();
      }
      return;
    }
    if (action === 'fleet-back') { screen = hangarReturn; return render(); }
    if (action === 'profile') { if (!token) { screen = 'auth'; return render(); } profileRankings = null; screen = 'profile'; render(); await refreshAccount(); if (screen === 'profile') return render(); return; }
    if (action === 'retry-screen') return render();
    if (action === 'retry-connection') return boot();
    if (action === 'reload-game') return location.reload();
    if (action === 'settings') return openSettings();
    if (action === 'language') return openSettings('language');
    if (action === 'launch') return launch();
    if (action === 'start-room') return send({ type: 'start' });
    if (action === 'restart') { replayBuffer = []; replayCaptureAt = 0; return send({ type: 'restart' }); }
    if (action === 'advance-cup') { replayBuffer = []; replayCaptureAt = 0; return send({ type: 'advance-cup' }); }
    if (action === 'leave') { cancelFlightLoading(); input.reset(); stopVideo(); pauseOpen = false; send({ type: 'leave' }); solo = null; disconnectMultiplayer(); room = null; localState = null; ghostFrames = []; world.removeMissing([]); screen = 'home'; return render(); }
    if (action === 'download-clip') return downloadClip();
    if (action === 'multiplayer') {
      screen = 'multiplayer'; return render();
    }
    if (action === 'create-room') return showCreateRoomDialog();
    if (action === 'room-options') { screen = 'multiplayer'; render(); return showCreateRoomDialog(); }
    if (action === 'join-room') {
      const field = menu.querySelector('#join-code');
      field.value = field.value.trim().toUpperCase();
      field.setCustomValidity(/^[A-F0-9]{6}$/.test(field.value) ? '' : 'Enter the six-character invite code shown in the room.');
      field.oninput = () => field.setCustomValidity('');
      if (!field.reportValidity()) return;
      return enterMultiplayer({ type: 'join', code: field.value });
    }
    if (action === 'ranked') { if (user.guest || rankedQueue) return; await enterMultiplayer({ type: 'queue' }); return; }
  } catch (error) { toast(error.message); }
}

async function launch() {
  cancelFlightLoading();
  const generation = ++flightGeneration;
  world.cancelMapPreviews();
  input.reset();
  ghostFrames = []; ghostBuild = null; ghostIndex = 0; clipBlob = null;
  replayBuffer = []; replayCaptureAt = 0; pauseOpen = false;
  if (chosenMode === 'multiplayer') { startAudio(); return enterMultiplayer({ type: 'create', map: chosenMap, track: chosenTrack, ...roomOptions }); }
  if (chosenMode === 'weekly') { startAudio(); solo = null; return enterMultiplayer({ type: 'solo', mode: 'weekly' }); }
  if (['race', 'time', 'weekly'].includes(chosenMode)) {
    api(`/ghost?track=${encodeURIComponent(chosenTrack)}`).then(ghost => {
      if (generation === flightGeneration && solo) { ghostFrames = ghost.frames || []; ghostBuild = ghost.build; ghostIndex = 0; }
    }).catch(() => { /* A prior ghost is optional. */ });
  }
  disconnectMultiplayer();
  const lesson = launch.tutorial;
  const mission = launch.challenge || (chosenMode === 'career' ? CAREER.find(item => item.map === chosenMap && item.track === chosenTrack) : null);
  const course=courseEnabled({mode:chosenMode,tutorial:lesson,challenge:mission});
  const objects=[...(lesson?.objects||[]),...(mission?.objects||[])];
  const spec=resolveBuild(user.build);
  const session=loadingFlight(flightAssetURLs(MAPS[chosenMap],[spec],objects,getTrack(chosenMap,chosenTrack),{course}),'Preparing flight',()=>{
    cancelFlightLoading();launch.tutorial=null;launch.challenge=null;solo=null;room=null;localState=null;world.removeMissing([]);world.invalidateEnvironment();screen='maps';render();
  },()=>launch());
  try {
    // Opening the system audio device can block for hundreds of milliseconds.
    // Paint the loading/cancel UI first; prior menu gestures permit audio resume.
    await nextPaint();session.check();startAudio();
    await session.download();mapDownloads?.refresh().catch(()=>{});session.stage('Processing models');await nextPaint();session.check();
    world.removeMissing([]);await world.load(chosenMap,chosenTrack,{course,signal:session.abort.signal});session.check();
    activeFlightController=flightControllerFor(user.build);appliedControllerSlot=0;
    solo=new SoloSession({map:chosenMap,track:chosenTrack,mode:chosenMode,user,profile:activeFlightController,tutorial:lesson,challenge:mission,onCheckpoint:()=>audio?.checkpoint()});
    currentPracticeJournal().begin(solo);
    if(solo.opponents.length){session.stage('Planning race opponents');await solo.prepareOpponents(async()=>{session.check();await nextPaint();session.check();});}
    room=solo.room;ownId=user.id;localState=solo.state;serverClockOffset=0;
    applyCameraSettings();world.setCameraMode(cameraMode);
    const aircraft=room.players.map(player=>{
      const drone=world.upsertDrone(player.id,solo.spec,player.state,player.id===ownId);
      drone.soloResetId=player.resetId;world.resetDroneVisual(player.id,player.state);return drone.mesh.assetsReady;
    });
    await Promise.all([...aircraft,world.addContentObjects(objects)]);session.check();
    session.stage('Preparing graphics');await nextPaint();session.check();await world.prepareGraphics();session.check();
    if(generation!==flightGeneration)return;
    launch.tutorial=null;launch.challenge=null;
    solo.restart();localState=solo.state;
    for(const player of room.players){const drone=world.upsertDrone(player.id,solo.spec,player.state,player.id===ownId);drone.soloResetId=player.resetId;world.resetDroneVisual(player.id,player.state);}
    session.finish();activeFlightLoad=null;
    hud.dataset.layout='';screen='flight';menu.classList.add('hidden');hud.classList.remove('hidden');startAudio();
  } catch(error) {
    if(activeFlightLoad===session && error.name!=='AbortError') {solo=null;room=null;world.removeMissing([]);world.invalidateEnvironment();world.setMenuScene(true, {mapId: chosenMap, trackId: chosenTrack}).catch(() => {});session.error(error);}
  }
}

async function saveCurrentReplay() {
  if (!room || replayBuffer.length < 2) return toast('Fly a little longer before saving a replay.');
  if (room.solo && screen === 'flight') pauseFlight();
  const record = { map: room.map, track: room.track, mode: room.mode, sceneCourse:courseEnabled(room), ownId, build: room.players.find(player => player.id === ownId)?.build || user?.build || defaultBuild(), builds: Object.fromEntries(room.players.map(player => [player.id, player.build])), duration: replayBuffer.at(-1).time, frames: structuredClone(replayBuffer) };
  const name = await askReplay('Save replay', `${MAPS[room.map]?.name || room.map} · ${new Date().toLocaleString()}`, 'Save replay', room.solo ? 'This replay stays in your browser.' : 'Multiplayer flight continues while this dialog is open.');
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
      hud.innerHTML = '<div class="hud-countdown"><small>Your next line starts in</small><strong id="countdown-value"></strong></div>';
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
        world.activeDroneId = spectatorPilotId(room.players, ownId, world.activeDroneId, [...world.drones.keys()], true);
      });
      bindChatForms(hud);
    }
    const watched = room.players.find(item => item.id === world.activeDroneId);
    hud.querySelector('#spectator-label').textContent = watched ? `SPECTATING ${watched.name}` : 'Preparing final results…';
    hud.querySelector('#waiting-standings').innerHTML = room.players.map(item => `<div class="record"><span translate="no">${escapeHtml(item.name)}</span><strong>${item.finishMs == null ? 'RACING' : fmtTime(item.finishMs)}</strong></div>`).join('');
    return;
  }
  if (!localState) return;
  const velocity = localState.velocity || [0, 0, 0];
  const speed = Math.round(Math.hypot(...velocity) * 3.6);
  const elapsed = solo ? solo.elapsed : ['running', 'paused'].includes(room.status) ? (room.pausedAt || Date.now() - serverClockOffset) - room.started : 0;
  if (hud.dataset.layout !== 'flight') {
    hud.innerHTML = flightHudHTML({
      location: escapeHtml(MAPS[room.map]?.name || room.map),
      activity: escapeHtml(solo?.tutorial ? 'Lesson' : flightActivityLabel(room.mode)),
      session: solo?.opponents?.length ? 'Solo · 3 AI pilots' : room.solo ? 'Solo' : 'Multiplayer',
      label: room.mode === 'freestyle' ? 'Score' : room.mode === 'training' ? 'Flight time' : 'Lap time',
      tutorial: Boolean(solo?.tutorial), chat: roomChatHTML(true), freestyle: room.mode === 'freestyle'
    });
    hud.dataset.layout = 'flight';
    hud.querySelector('#reset-flight').addEventListener('click', () => send({ type: 'reset' }));
    hud.querySelector('#lesson-next')?.addEventListener('click', () => { solo?.advanceManual(); if (solo?.room.status === 'ended') { screen = 'results'; render(); } });
    hud.querySelector('#pause-flight').addEventListener('click', pauseFlight);
    hud.querySelector('#save-flight').addEventListener('click', saveCurrentReplay);
    bindChatForms(hud);
    hudRefs = null;
  }
  const refs = ensureHudRefs();
  const lang = currentLanguage();
  const setPlain = (el, val) => { if (el && el.textContent !== val) el.textContent = val; };
  const setLocalized = (el, val) => { if (el && (el._parvozSrc !== val || el._parvozLang !== lang)) { el._parvozSrc = val; el._parvozLang = lang; localizedText(el, val); } };
  const setAttr = (el, attr, val) => { if (el && el.getAttribute(attr) !== val) el.setAttribute(attr, val); };
  const progress = room.mode === 'training' ? (solo?.tutorial?.steps[solo.stepIndex]?.text || 'Free flight') : room.mode === 'freestyle' ? (me?.lastTrick || 'Find your flow.') : `Lap ${Math.min(me?.lap || 1, getTrack(room.map, room.track).laps)} / ${getTrack(room.map, room.track).laps} · Gate ${(me?.gate || 0) + 1} / ${getTrack(room.map, room.track).gates.length}`;
  setLocalized(refs.mode, `${readableLabel(flightMode.toUpperCase())} · ${cameraModeLabel(cameraMode)}`);
  setPlain(refs.main, room.mode === 'freestyle' ? (me?.score || 0).toLocaleString() : fmtTime(elapsed));
  if (refs.remaining) {
    const seconds = Math.ceil(Math.max(0, 180000 - elapsed) / 1000);
    setPlain(refs.remaining, `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`);
  }
  const raceOrder=solo?.opponents?.length?[...room.players].sort((a,b)=>{
    if(a.finishMs!=null||b.finishMs!=null)return (a.finishMs??Infinity)-(b.finishMs??Infinity);
    const stages=(b.lap-a.lap)*solo.track.gates.length+b.gate-a.gate;
    if(stages)return stages;
    const gate=solo.track.gates[a.gate].position;
    return Math.hypot(...a.state.position.map((v,i)=>v-gate[i]))-Math.hypot(...b.state.position.map((v,i)=>v-gate[i]));
  }):null;
  setLocalized(refs.progress, raceOrder?`Position ${raceOrder.findIndex(p=>p.id===ownId)+1}/${raceOrder.length} · ${progress}`:progress);
  refs.lessonNext?.classList.toggle('hidden', solo?.tutorial?.steps[solo.stepIndex]?.objective !== 'manual');
  if(refs.feedback && solo?.tutorial)setLocalized(refs.feedback, lessonFeedback(solo.tutorial.steps[solo.stepIndex],localState,solo.stepTime,solo.stepIndex,solo.tutorial.steps.length,flightMode));
  const attitude=flightAttitude(localState.rotation),pitchDeg=Math.round(attitude.pitch),rollDeg=Math.round(attitude.roll);
  setAttr(refs.attitude,'aria-label',translate(`Drone pitch ${pitchDeg}°, roll ${rollDeg}°`,lang));
  setPlain(refs.attitudeOut,`P ${pitchDeg}° · R ${rollDeg}°`);
  refs.leftStick.style.left=`${50+latestInput.yaw*43}%`;refs.leftStick.style.top=`${93-latestInput.throttle*86}%`;
  refs.rightStick.style.left=`${50+latestInput.roll*43}%`;refs.rightStick.style.top=`${50-latestInput.pitch*43}%`;
  setPlain(refs.speed, String(speed));
  setPlain(refs.altitude, `${(localState.position[1]-(MAPS[room.map]?.floorY||0)).toFixed(1)} m`);
  const battery = Math.max(0, Math.min(100, Math.round(localState.battery * 100)));
  setPlain(refs.battery, `${battery}%`);
  const batteryPct = `${battery}%`;
  if (refs.batteryBar.style.width !== batteryPct) refs.batteryBar.style.width = batteryPct;
  const lowStr = String(battery <= 20);
  if (refs.batteryWidget.dataset.low !== lowStr) refs.batteryWidget.dataset.low = lowStr;
  setAttr(refs.batteryWidget, 'aria-label', translate(`Battery ${battery}%`, lang));
  refs.batteryWarning.classList.toggle('hidden', battery > 20);
  setLocalized(refs.throttle, `Throttle ${Math.round(latestInput.throttle * 100)}%`);
  const hint = solo?.challenge?.hints?.filter(hint => (me?.lap || 1) >= (hint.lap || 1) && (me?.gate || 0) >= (hint.afterGate || 0)).at(-1);
  setLocalized(refs.mission, hint?.text || '');
  refs.mission.classList.toggle('hidden', !hint);
}

let hudRefs = null;
function ensureHudRefs() {
  if (hudRefs && hudRefs.root === hud.firstElementChild && hud.dataset.layout === 'flight') return hudRefs;
  const attitude = hud.querySelector('#hud-attitude');
  hudRefs = {
    root: hud.firstElementChild,
    mode: hud.querySelector('#hud-mode'),
    main: hud.querySelector('#hud-main'),
    remaining: hud.querySelector('#hud-remaining'),
    progress: hud.querySelector('#hud-progress'),
    lessonNext: hud.querySelector('#lesson-next'),
    feedback: hud.querySelector('#lesson-feedback'),
    attitude,
    attitudeOut: attitude?.querySelector('output'),
    leftStick: hud.querySelector('#hud-stick-left'),
    rightStick: hud.querySelector('#hud-stick-right'),
    speed: hud.querySelector('#hud-speed'),
    altitude: hud.querySelector('#hud-altitude'),
    battery: hud.querySelector('#hud-battery'),
    batteryBar: hud.querySelector('#hud-battery-bar'),
    batteryWidget: hud.querySelector('#hud-battery-widget'),
    batteryWarning: hud.querySelector('#hud-battery-warning'),
    throttle: hud.querySelector('#hud-throttle'),
    mission: hud.querySelector('#hud-mission'),
    markers: [...hud.querySelectorAll('.target-marker')].map(el => ({
      el, icon: el.querySelector('i'), label: el.querySelector('small'), hidden: null, offscreen: null, iconChar: '', transform: '', labelSrc: '', labelLang: ''
    })),
  };
  return hudRefs;
}

function updateNavigation() {
  if (!room || !localState || screen !== 'flight' || hud.dataset.layout !== 'flight') return;
  const refs = ensureHudRefs();
  if (!refs.markers.length) return;
  const player = room.players.find(item => item.id === ownId);
  const targets = flightTargets(getTrack(room.map, room.track), player, room.mode, solo?.tutorial?.steps[solo.stepIndex]);
  const width = world.resizeState?.[0] || world.container.clientWidth;
  const height = world.resizeState?.[1] || world.container.clientHeight;
  if (!width || !height) return;
  const lang = currentLanguage();
  for (let index = 0; index < refs.markers.length; index++) {
    const item = refs.markers[index], target = targets[index], hide = !target;
    if (item.hidden !== hide) { item.hidden = hide; item.el.classList.toggle('hidden', hide); }
    if (!target) continue;
    const position = projectFlightTarget(target, world.camera, width, height);
    item.el.style.left = `${position.x}px`; item.el.style.top = `${position.y}px`;
    const offscreen = !position.visible;
    if (item.offscreen !== offscreen) { item.offscreen = offscreen; item.el.classList.toggle('offscreen', offscreen); }
    const nextChar = position.visible ? '◇' : '↑';
    if (item.iconChar !== nextChar) { item.iconChar = nextChar; item.icon.textContent = nextChar; }
    const nextTransform = position.visible ? '' : `rotate(${position.bearing}deg)`;
    if (item.transform !== nextTransform) { item.transform = nextTransform; item.icon.style.transform = nextTransform; }
    const nextLabel = `${target.label} · ${Math.round(position.distance)} m`;
    if (item.labelSrc !== nextLabel || item.labelLang !== lang) {
      item.labelSrc = nextLabel; item.labelLang = lang;
      localizedText(item.label, nextLabel);
    }
  }
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
  const link = document.createElement('a'); link.href = url; link.download = `parvoz-drone-sim-${Date.now()}.webm`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function startAudio() {
  try {
    audio ||= new DroneAudio();
    audio.resume();
  } catch { /* Audio is optional when browser autoplay is restricted. */ }
}

let lastSceneRender=-Infinity;
function frame(now) {
  if (app.dataset.screen !== screen) {
    app.dataset.screen = screen;
    if (screen === 'flight') app.dataset.scene = 'live';
  }
  const cpuStart = performance.now();
  stutterCapture?.beginFrame(cpuStart);
  const dt = Math.min(0.1, Math.max(0, (now - lastTick) / 1000)); lastTick = now;
  const ownFinished = !solo && room?.players.find(item => item.id === ownId)?.finishMs != null;
  latestInput = input.read(screen === 'flight' && room?.status === 'running' && !ownFinished ? dt : 0);
  stutterCapture?.phase('input');
  if (solo && room && !activeFlightLoad) {
    const previous = room.status;
    solo.update(dt, latestInput, flightMode);
    localState = solo.state;
    for(const player of room.players){
      const drone=world.upsertDrone(player.id,solo.spec,player.state,player.id===ownId);
      if(player.id!==ownId&&drone.soloResetId!==player.resetId)world.resetDroneVisual(player.id,player.state);
      drone.soloResetId=player.resetId;
    }
    world.setActiveGate(solo.item.gate);
    world.predictionRemainder = room.status === 'running' ? solo.accumulator : 0;
    if (ownResetId !== solo.item.resetId) { ownResetId = solo.item.resetId; world.resetDroneVisual(ownId,localState); input.reset(); }
    if (room.status === 'running' && solo.elapsed - replayCaptureAt >= 45 && replayBuffer.length < 36000) {
      replayCaptureAt = solo.elapsed;
      replayBuffer.push({time: solo.elapsed, players: room.players.map(player=>({id:player.id,state:{position:[...player.state.position],rotation:[...player.state.rotation],motors:[...player.state.motors],motorRpm:[...(player.state.motorRpm||[])]},resetId:player.resetId}))});
    }
    if (room.status === 'ended' && previous !== 'ended') {
      input.reset();
      if (room.mode === 'freestyle' || solo.item.finishMs !== null && room.mode !== 'training') {
        const result = room.mode === 'freestyle' ? { score: solo.item.score } : { timeMs: solo.item.finishMs };
        api('/solo-result','POST',{map:room.map,track:room.track,mode:room.mode,...result}).then(refreshAccount).catch(error=>toast('Result could not sync: '+error.message));
      }
      screen = 'results'; render();
    }
  }

  stutterCapture?.phase('soloSimulation');
  if (['flight', 'pause', 'settings', 'controls', 'camera', 'graphics','language', 'flight-controller'].includes(screen) && room?.status === 'running') {
    if (localState && !solo && !waitingResync && !ownFinished) {
      const build = room.ranked ? defaultBuild() : room.players.find(item => item.id === ownId)?.build || user.build;
      const advance = fixedSteps(physicsAccumulator, dt);
      physicsAccumulator = advance.remainder;
      const commands = [];
      for (let step = 0; step < advance.steps; step++) {
        if(prediction.entries.length>=240) {requestResync();break;}
        const command = { seq: ++inputSeq, input: { ...latestInput }, flightMode };
        commands.push(command);
        simulateCommand(localState, command, resolveBuild(build), MAPS[room.map], sceneTrack(getTrack(room.map, room.track),courseEnabled(room)), getTrackObstacles(room.map,room.track,{course:courseEnabled(room)}), activeFlightController);
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
  stutterCapture?.phase('prediction');
  if (audio) audio.update(localState, solo?.spec || world.drones.get(ownId)?.spec, screen==='flight' && room?.status==='running' && !ownFinished);
  if (['settings', 'controls'].includes(screen)) {
    updateControlStatus();
    const left = menu.querySelector('#radio-left'), right = menu.querySelector('#radio-right');
    if (left && right) {
      left.style.left = `${50 + latestInput.yaw * 40}%`;
      left.style.top = `${90 - latestInput.throttle * 80}%`;
      right.style.left = `${50 + latestInput.roll * 40}%`;
      right.style.top = `${50 - latestInput.pitch * 40}%`;
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
  downloadPanel?.setVisible(screen==='home'&&!room);
  stutterCapture?.phase('audioAndMenus');
  updateHud(now);
  stutterCapture?.phase('hud');
  if(sceneRenderDue(now,lastSceneRender,{loading:!!activeFlightLoad||!!startupLoading,menu:app.dataset.scene==='menu'&&!world.hangarPreview&&!room})){
    world.render(now);lastSceneRender=now;
  }
  stutterCapture?.phase('renderSubmit');
  updateFlightInstrument();
  updateFlightChat(now);
  pilotMarkers.update(world,room?.players||[],ownId,screen==='flight' && room && !room.solo);
  performanceCapture?.update(now, { flying: screen === 'flight' && room?.status === 'running', cpuMs: performance.now() - cpuStart, map: room?.map, track: room?.track });
  updateNavigation();
  stutterCapture?.phase('overlays');
  frameStats.update(now, performance.now() - cpuStart);
  if (Math.floor(now / 500) !== frame.lastStats) {
    frame.lastStats = Math.floor(now / 500);
    if(screen==='flight'&&room?.status==='running')world.adjustPerformance(frameStats.fps);
    const label = `${frameStats.fps} FPS · ${frameStats.frameMs.toFixed(1)} ms/frame · CPU ${frameStats.cpuMs.toFixed(1)} ms · ${world.renderer.info.render.drawCalls ?? world.renderer.info.render.calls} draws · ${world.renderer.domElement.width}×${world.renderer.domElement.height}`;
    const overlay = document.querySelector('#performance');
    overlay.classList.toggle('hidden', !showPerformance); overlay.textContent = label;
    const readout = document.querySelector('#graphics-performance'); if (readout) readout.textContent = label;
    const resolutionSize=document.querySelector('#resolution-size');if(resolutionSize)localizedText(resolutionSize,`3D resolution: ${world.renderer.domElement.width} × ${world.renderer.domElement.height}`);
    const warning=document.querySelector('#graphics-warning'); if(warning) warning.textContent=world.renderWarning || '';
    let captureIndicator=app.querySelector('#capture-indicator');
    if(stutterCapture?.run&&!captureIndicator){captureIndicator=document.createElement('div');captureIndicator.id='capture-indicator';captureIndicator.className='capture-indicator';app.append(captureIndicator);}
    if(captureIndicator){captureIndicator.hidden=screen!=='flight'||!stutterCapture?.run;
      if(!captureIndicator.hidden)localizedText(captureIndicator,`Recording: ${Math.min(60,Math.floor((stutterCapture.run.last?.now-stutterCapture.run.started||0)/1000))} / 60 seconds`);}
  }
  stutterCapture?.phase('statistics');
  stutterCapture?.update(now,{flying:screen==='flight'&&room?.status==='running',cpuMs:performance.now()-cpuStart});
}

function pauseFlight() {
  if (screen !== 'flight' || !room || !['running', 'countdown'].includes(room.status)) return;
  input.reset();
  pauseOpen = true;
  if (room.solo) send({ type: 'pause' });
  screen = 'pause'; renderPause();
}
window.addEventListener('blur', () => { if (room?.solo && screen === 'flight') pauseFlight(); });

window.addEventListener('keydown', event => {
  if (app.querySelector('dialog[open]')) return;
  if (event.code === 'F3') { event.preventDefault(); showPerformance = !showPerformance; localStorage.setItem('liftoff-performance', String(showPerformance)); return; }
  if (event.code === 'F4') {
    event.preventDefault(); if (event.repeat) return;
    if(stutterCapture?.run)return toast('Stop the current-settings capture with F7 first.');
    performanceCapture ||= new PerformanceCapture(world, toast);
    if (performanceCapture.run) performanceCapture.finish();
    else if (screen === 'flight' && room?.status === 'running') performanceCapture.start({ map: room.map, track: room.track, multiplayer: !room.solo });
    else toast('Start flying, then press F4 for the Low 1280×720 test.');
    return;
  }
  if (event.code === 'F7') {
    event.preventDefault();if(event.repeat)return;
    if(performanceCapture?.run)return toast('Stop the Low capture with F4 first.');
    if(stutterCapture?.run)stutterCapture.finish();
    else startStutterRecording();
    return;
  }
  if (event.code === 'F8') {event.preventDefault();if(!event.repeat)stutterCapture?.mark();return;}
  if (event.code === 'F6') {
    event.preventDefault();
    downloadLatestCapture();
    return;
  }
  if (event.code === 'Escape') {
    event.preventDefault();
    const popover = menu.querySelector('.more-menu[open]');
    if (popover) { popover.open = false; return; }
    if (screen === 'flight' && ['running','countdown'].includes(room?.status)) {
      pauseFlight(); return;
    }
    if (pauseOpen && screen === 'pause') { onAction('continue-flight'); return; }
    if (['controls', 'camera', 'graphics','language', 'settings'].includes(screen)) { onAction('settings-back'); return; }
    if (screen === 'workbench') { onAction('hangar'); return; }
    if (screen === 'hangar') { onAction('fleet-back'); return; }
    if (screen === 'maps') { onAction(chosenMode === 'multiplayer' ? 'room-options' : 'home'); return; }
    if (screen === 'replay-viewer') { screen = 'replays'; render(); return; }
    if (['career','profile','replays','weekly','tutorials','multiplayer'].includes(screen)) { onAction('home'); return; }
  }
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
  if (screen==='flight' && room && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code) && !event.altKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    const build=room.ranked?defaultBuild():room.players.find(player=>player.id===ownId)?.build||user?.build||defaultBuild();
    const patch=cameraKeyPatch(event.code,cameraSettings(build));
    const value=saveCameraSettings(build,patch);
    world.setFov(value.fov);world.setFpvTilt(value.tilt);
    toast(`${patch.tilt!==undefined?'FPV tilt: '+value.tilt:'FPV field of view: '+value.fov}°`);
    return;
  }
  if (event.code === 'Enter' && screen === 'flight' && room && !room.solo) { event.preventDefault(); openFlightChat(); return; }
  if (event.code === 'KeyR' && !event.repeat && screen === 'flight' && room?.status === 'running') { send({ type: 'reset' }); return; }
  if (event.code === 'KeyC' && screen === 'flight') { cameraMode = nextCameraMode(cameraMode); world.setCameraMode(cameraMode); localStorage.setItem('liftoff-camera-mode', cameraMode); }
  if (event.code === 'KeyM' && screen === 'flight') { flightMode = { angle: 'horizon', horizon: 'acro', acro: 'angle' }[flightMode]; localStorage.setItem('liftoff-flight-mode', flightMode); toast(`FLIGHT MODE: ${flightMode.toUpperCase()}`); }
});
window.addEventListener('beforeunload', event => { if (workbenchDraft && workbenchDirty()) { event.preventDefault(); event.returnValue = ''; } });

function updateFlightInstrument(){
  if(screen!=='flight'||!localState)return;
  const instrument=hud.querySelector('#hud-attitude');if(!instrument)return;
  const width=world.container.clientWidth,height=world.container.clientHeight;
  const railWidth=Math.min(width*.57,570),railHeight=Math.min(height*.64,455);
  const clip={left:(width-railWidth)/2,right:(width+railWidth)/2,top:(height-railHeight)/2,bottom:(height+railHeight)/2};
  const svg=instrument.querySelector('svg');
  if(instrument.dataset.size!==`${width}:${height}`){
    instrument.dataset.size=`${width}:${height}`;svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    instrument.querySelector('.attitude-ladder').setAttribute('d',`M${clip.left} ${clip.top}V${clip.bottom} M${clip.right} ${clip.top}V${clip.bottom}`);
    instrument.querySelector('.attitude-reticle').setAttribute('transform',`translate(${width/2} ${height/2})`);
  }
  const line=projectFlightHorizon(world.camera,width,height,{clip,span:railWidth*.6});
  instrument.querySelector('.attitude-level').setAttribute('d',line?`M${line.x1} ${line.y1}L${line.x2} ${line.y2}`:'');
}

function updateFullscreenSetting(state){
  const toggle=menu.querySelector('#fullscreen-toggle'),status=menu.querySelector('#fullscreen-status');
  if(!toggle)return;
  toggle.checked=state.active;toggle.disabled=!state.available||state.pending;
  localizedText(status,!state.available?'Fullscreen is unavailable in this browser.':state.error?'Fullscreen was not enabled. You can keep playing in this window.':state.active?'Press Esc to leave fullscreen.':'Fullscreen is off.');
}
fullscreen.subscribe(updateFullscreenSetting);

function initializeMapDownloads(){
  downloadPanel?.dispose();mapDownloads?.dispose();
  mapDownloads=new MapDownloadManager({assets:catalog.assets||[]});
  for(const map of Object.values(MAPS)){
    mapDownloads.registerMap(map.id,flightAssetURLs(map,[],[],undefined,{course:true}),{coreUrls:flightAssetURLs(map,[],[],undefined,{course:false})});
  }
  downloadPanel=new DownloadPanel({root:app,manager:mapDownloads,maps:Object.values(MAPS)});
  downloadPanel.setVisible(false);
  mapDownloads.initialize().then(()=>mapDownloads?.pruneObsoleteAssets((catalog.assets||[]).map(asset=>asset.url))).catch(()=>{});
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)mapDownloads?.refresh().catch(()=>{});});

async function enterStartup(next='home'){
  const loading=startupLoading;if(!loading||enterStartup.busy)return;
  enterStartup.busy=true;
  // Request synchronously from the Play/Sign in click, before any network await.
  const request=fullscreen.getState().preferred?fullscreen.enter():Promise.resolve();
  loading.opening();
  try{
    if(next==='home'&&!user){
      const result=await api('/guest','POST');token=result.token;user=result.user;
      localStorage.setItem('liftoff-token',token);await refreshAccount();
    }
    await request;loading.finish();startupLoading=null;menu.inert=false;screen=next;render();
  }catch(error){loading.error(error);}
  finally{enterStartup.busy=false;}
}

async function prepareInitialHangar(loading) {
  const build=activeDrone()?.build||user?.build||defaultBuild();
  const map=hangarBackdropMap();
  const urls=startupAssetURLs(map,resolveBuild(build),Object.values(DRONES));
  loading.cached=hasLoadedModel;
  loading.timingKey=JSON.stringify([catalog.revision,'workshop',world.graphics,world.renderer.backend?.isWebGPUBackend?'WebGPU':'WebGL2']);
  loading.resources(urls,catalog.assets||[]);loading.stage('Downloading assets');await loading.download();mapDownloads?.refresh().catch(()=>{});loading.check();
  loading.stage('Processing models');await nextPaint();
  await loadHangarPreview(build,{startup:true,mapId:map.id,onGraphics:()=>loading.stage('Preparing graphics')});loading.check();
  world.leaveHangarPreview();
  await world.setMenuScene(true,{mapId:map.id,trackId:getTrack(map.id,world.track?.id).id,kind:'home',course:false});loading.check();
  world.render(performance.now());
}

async function boot() {
  startupLoading?.cancel();
  screen = 'loading';
  render();
  menu.inert=true;
  const loading=startupLoading=new StartupLoading({onRetry:()=>boot()});
  try {
    await prepareStartup({loading,connect:async()=>{
      catalog = await loadStartupCatalog(api,{revision:installedRevision,maps:MAP_LIST,assets:installedAssets});loading.check();
      if (catalog.protocol !== NETWORK_PROTOCOL)throw Object.assign(new Error('Game update available'),{code:'UPDATE_REQUIRED'});
      if (catalog.customContent) applyCustomContent(catalog.customContent);
      chosenMap = selectedMap(MAPS, chosenMap).id;
      chosenTrack = getTrack(chosenMap, chosenTrack).id;
      if (token) { try { await refreshAccount(); } catch (error) { if (error.status !== 401) throw error; token = null;localStorage.removeItem('liftoff-token');user=null; } }
      initializeMapDownloads();
    },prepareRenderer:async()=>{
      await world.ready;loading.check();world.setCameraMode(cameraMode);
      world.setGraphics(await initializeAutomaticGraphics(world.renderer));
    },prepareHangar:()=>prepareInitialHangar(loading)});
    const state=fullscreen.getState();
    loading.ready(()=>enterStartup(),()=>enterStartup('auth'),state);
    if(state.preferred){const attempt=await fullscreen.startup();if(attempt.active)await enterStartup();}
    else await enterStartup();
  } catch (error) {
    if(error.code==='UPDATE_REQUIRED'){loading.cancel();startupLoading=null;menu.inert=false;screen='update-required';render();}
    else if(error.name!=='AbortError')loading.error(error);
  }
  if (!animationStarted) { world.startAnimation(frame); animationStarted = true; }
}

observeLanguage(document.body);
chooseInitialLanguage(app).then(()=>boot());
let contentRefreshPending = false;
setInterval(async()=>{
  if(!catalog || !['home','maps','hangar','workbench'].includes(screen) || fleetBusy || contentRefreshPending || app.querySelector('dialog[open]'))return;
  const origin = screen, pilot = token;
  const stillEditing = () => screen === origin && token === pilot && !fleetBusy && !app.querySelector('dialog[open]');
  contentRefreshPending = true;
  try {
    const revision = await api('/content-revision');
    if (!stillEditing() || !revision.revision || revision.revision === catalog.revision) return;
    const nextCatalog = await api('/catalog');
    if (!stillEditing()) return;
    catalog = nextCatalog; applyCustomContent(catalog.customContent);
    initializeMapDownloads();
    await refreshAccount();
    if (!stillEditing()) return;
    world.invalidateEnvironment(); render(); toast('Content updated from developer folders.');
  } catch { /* No active flight depends on catalog polling. */ }
  finally { contentRefreshPending = false; }
},5000);
