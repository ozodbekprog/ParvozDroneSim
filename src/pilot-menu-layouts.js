import { icon } from './ui-design.js';
import { sectionHeader, pagination } from './menu-layouts.js';
import { pageEntries } from './ui-flow.js';

const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const time = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(Math.floor(ms % 1000 / 10)).padStart(2, '0')}`; };
const art = map => map ? `<img data-map-preview="${html(map.id)}" ${map.thumbnail ? `src="${html(map.thumbnail)}"` : ''} alt=""/>` : '';
const tabs = [['records','Records','flag'],['achievements','Achievements','trophy'],['rankings','Rankings','users'],['account','Account','settings'],['data','Data','save']];

function rankingRows(rows, page, username) {
  const slice = pageEntries(rows, page, 6);
  return `<div class="pilot-ranking-list">${slice.entries.map((entry,i) => `<div class="pilot-ranking-row ${entry.username === username ? 'is-own' : ''}"><span>${String(slice.start + i + 1).padStart(2,'0')}</span><strong translate="no">${html(entry.username)}</strong><em>${entry.rating}</em></div>`).join('') || '<p class="pilot-empty">No pilots ranked yet.</p>'}</div>${pagination(slice.page,slice.pages,'profile-rankings','Ranking pages')}`;
}

function recordRows(records, page, maps, freestyle = false) {
  const slice = pageEntries(records, page, 3);
  return `<div class="pilot-record-list">${slice.entries.map(record => {
    const precision = !freestyle && record.track.startsWith('precision-');
    const trackId = precision ? record.track.slice(10) : record.track;
    const map = freestyle ? maps[record.map] : Object.values(maps).find(map => map.tracks?.some(track => track.id === trackId));
    const track = map?.tracks?.find(track => track.id === trackId);
    const title = freestyle ? map?.name || record.map : track?.name || record.track.replaceAll('-',' ');
    return `<div class="pilot-record-row"><span class="pilot-record-art">${map ? art(map) : icon('flag')}</span><span><strong>${html(title)}</strong><small>${html(freestyle ? 'Freestyle' : `${map?.name || 'Personal record'}${precision ? ' · Precision Run' : ''}`)}</small></span><em>${freestyle ? `${record.best_score} pts` : time(record.best_ms)}</em></div>`;
  }).join('') || `<p class="pilot-empty">${freestyle ? 'No freestyle scores yet.' : 'No recorded laps yet.'}</p>`}</div>${pagination(slice.page,slice.pages,freestyle ? 'profile-freestyle' : 'profile-records',freestyle ? 'Freestyle pages' : 'Record pages')}`;
}

export function pilotProfileLayout({ data, rankings = [], tab = 'records', pages = {}, maps = {} }) {
  const user = data.user;
  const xp = Math.max(0, Number(user.xp) || 0), level = Math.floor(xp / 500) + 1, progress = xp % 500;
  const nav = `<nav class="menu-rail pilot-tabs" aria-label="Profile sections">${tabs.map(([value,label,glyph]) => `<button class="rail-choice ${tab === value ? 'selected' : ''}" data-action="profile-tab-${value}" aria-pressed="${tab === value}">${icon(glyph)}${label}</button>`).join('')}</nav>`;
  let content;
  if (tab === 'account') {
    content = `<section class="pilot-primary"><div class="pilot-account-section"><h2>Sign-in</h2><div class="pilot-account-row"><span><strong>${user.guest ? 'Guest session' : `<span translate="no">${html(user.username)}</span>`}</strong><small>${user.guest ? 'Sign in to sync your progress and drones.' : 'Your progress and drones sync across devices.'}</small></span><button class="button ${user.guest ? 'primary' : ''}" data-action="logout">${user.guest ? 'Sign in / Register' : 'Sign out'}</button></div></div>${user.guest ? '' : `<div class="pilot-account-section"><h2>Security</h2><div class="pilot-account-row"><span><strong>Recovery code</strong><small>${data.recoveryEnabled ? 'Set' : 'Not set'}</small></span><button class="button" data-action="recovery-code">${data.recoveryEnabled ? 'Replace code' : 'Create code'}</button></div></div>`}</section>`;
  } else if (tab === 'data') {
    content = `<section class="pilot-primary"><div class="pilot-account-section"><h2>Cloud saves</h2><div class="pilot-account-row"><span><strong>${user.guest ? 'Guest session' : `${data.fleetCount || 0} custom drones synced`}</strong><small>${user.guest ? 'Guest progress stays on this device.' : 'Drone builds, career, records and unlocks'}</small></span></div></div><div class="pilot-account-section"><h2>Local data</h2><div class="pilot-account-row"><span><strong>This browser</strong><small>Replays, calibration and settings</small></span><div class="pilot-account-actions"><button class="button" data-action="export-local">Export</button><button class="button" data-action="import-local">Import</button></div></div></div></section>`;
  } else if (tab === 'achievements') {
    const achievements = [['first-finish','First Finish','Complete a race','flag'],['speed-100','Velocity','Reach 100 km/h','clock'],['freestyle-300','Flow State','Score 300 freestyle points','orbit'],['career-complete','Champion','Finish all career missions','trophy']];
    content = `<section class="pilot-primary"><h2>Achievements</h2><div class="pilot-achievements">${achievements.map(([code,title,description,glyph]) => { const earned = data.achievements?.includes(code); return `<div class="pilot-achievement ${earned ? 'earned' : ''}">${icon(glyph)}<strong>${title}</strong><small>${description}</small><span>${earned ? 'Unlocked' : 'Locked'}</span></div>`; }).join('')}</div></section>`;
  } else if (tab === 'rankings') {
    content = `<section class="pilot-primary"><div class="panel-header"><h2>Server rankings</h2><span class="panel-label">RATING</span></div>${rankingRows(rankings,pages.rankings,user.username)}</section>`;
  } else {
    content = `<section class="pilot-primary"><h2>Personal records</h2>${recordRows(data.records || [],pages.records,maps)}<h2 class="pilot-subheading">Freestyle bests</h2>${recordRows(data.freestyleScores || [],pages.freestyle,maps,true)}</section>`;
  }
  return `<section class="game-panel unified-menu-card pilot-card">${sectionHeader('Pilot profile')}<div class="pilot-layout"><header class="pilot-overview"><div class="pilot-avatar" aria-hidden="true">${html(user.username.slice(0,1).toUpperCase())}</div><div class="pilot-identity"><h2 translate="no">${html(user.username)}</h2><span>${user.guest ? 'Guest pilot' : `Level ${level}`}</span></div><div class="pilot-stats"><span>Rating<strong>${user.rating}</strong></span>${user.guest ? '' : `<span>Credits<strong>${user.credits}</strong></span>`}</div>${user.guest ? '' : `<div class="pilot-xp"><progress value="${progress}" max="500" aria-label="Level progress"></progress><span>${progress} / 500 XP</span></div>`}</header>${nav}<div class="pilot-content">${content}</div></div></section>`;
}

export function hostSessionLayout({ options, map, modes }) {
  const glyphs = { race:'flag', precision:'clock', freestyle:'orbit', cup:'trophy' };
  return `<form><header class="section-header"><div class="section-heading"><button type="button" class="button back-button" id="cancel-room-create" aria-label="Back to multiplayer"><span aria-hidden="true">←</span> Back to multiplayer</button><h1 id="room-create-title">Create room</h1></div></header><div class="host-layout"><section class="host-fields"><fieldset><legend>Visibility</legend><div class="host-visibility" role="group" aria-label="Room visibility">${['public','private'].map(value => `<button type="button" class="activity-choice ${options.visibility === value ? 'selected' : ''}" data-room-visibility="${value}" aria-pressed="${options.visibility === value}">${value === 'public' ? 'Public' : 'Private'}</button>`).join('')}</div></fieldset><label class="host-capacity">Pilots<select id="room-capacity">${[2,3,4,5,6,7,8].map(count=>`<option value="${count}" ${options.maxPlayers === count ? 'selected' : ''}>${count} pilots</option>`).join('')}</select></label><fieldset><legend>Mode</legend><div class="host-modes" role="group" aria-label="Room mode">${Object.entries(modes).map(([value,label])=>`<button type="button" class="activity-choice ${options.mode === value ? 'selected' : ''}" data-room-mode="${value}" aria-pressed="${options.mode === value}">${icon(glyphs[value])}${html(value === 'cup' ? 'Championship' : label)}</button>`).join('')}</div></fieldset></section><aside class="host-summary"><h2>Session summary</h2><div class="host-location-art">${art(map)}</div><dl><div><dt>Visibility</dt><dd id="room-summary-visibility">${options.visibility === 'public' ? 'Public' : 'Private'}</dd></div><div><dt>Pilots</dt><dd id="room-summary-capacity">${options.maxPlayers}</dd></div><div><dt>Mode</dt><dd id="room-summary-mode">${html(modes[options.mode])}</dd></div><div><dt>Location</dt><dd>${html(map?.name || 'Choose next')}</dd></div></dl></aside></div><footer class="host-actions"><button type="submit" class="button primary">${icon('location')} Select map &amp; course ${icon('arrow')}</button></footer></form>`;
}

export function flightMenuLayout({ solo, finished, map, trackName, canSave, roster = '', chat = '' }) {
  return `<section class="game-panel unified-menu-card flight-card ${roster||chat?'has-room':'solo-flight-card'}"><header class="flight-menu-header"><h1>Flight menu</h1><span class="session-state ${solo ? '' : 'live'}">${solo ? 'Paused · Solo' : finished ? 'Finished · Multiplayer' : 'Flight continues · Multiplayer'}</span></header><div class="flight-menu-layout"><section class="flight-menu-context"><div class="flight-location">${icon('location')}<span><strong>${html(map?.name || 'Flight')}</strong>${trackName ? `<small>${html(trackName)}</small>` : ''}</span></div>${roster ? `<section class="flight-room-panel"><h2>Pilots in this room</h2>${roster}</section>` : ''}${chat ? `<section class="flight-room-panel flight-chat-panel"><h2>Room chat</h2>${chat}</section>` : ''}</section><nav class="flight-menu-actions" aria-label="Flight actions"><button class="button primary" data-action="continue-flight">${icon('play')} Continue ${icon('arrow')}</button>${solo ? `<button class="button" data-action="restart-flight">${icon('reset')} Restart</button>` : ''}${canSave ? `<button class="button" data-action="save-replay">${icon('save')} Save replay</button>` : ''}<button class="button" data-action="settings">${icon('settings')} Settings</button><button class="button" data-action="diagnostics">${icon('clock')} Performance diagnostics</button><div class="flight-exit"><button class="button" data-action="leave">${icon('arrow')} Exit flight</button></div></nav></div></section>`;
}
