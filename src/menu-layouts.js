import { icon } from './ui-design.js';
import { pageEntries } from './ui-flow.js';
import {mapDownloadHTML} from './download-ui.js';

const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const time = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

export function sectionHeader(title, back = 'home', actions = '', eyebrow = '', backLabel = back === 'multiplayer' ? 'Back to multiplayer' : back === 'home' ? 'Back to main menu' : 'Back') {
  return `<header class="section-header"><div class="section-heading"><button class="button back-button" data-action="${back}" aria-label="${html(backLabel)}"><span aria-hidden="true">←</span><span>${html(backLabel)}</span></button><div>${eyebrow ? `<small>${html(eyebrow)}</small>` : ''}<h1>${html(title)}</h1></div></div><div class="section-header-actions">${actions}</div></header>`;
}

export function pagination(page, pages, prefix, label = 'Pages') {
  if (pages <= 1) return '';
  return `<nav class="pagination" aria-label="${html(label)}"><button class="mini-button" data-action="${prefix}-previous" ${page === 0 ? 'disabled' : ''} aria-label="Previous page">← Previous</button><span>${page + 1} / ${pages}</span><button class="mini-button" data-action="${prefix}-next" ${page >= pages - 1 ? 'disabled' : ''} aria-label="Next page">Next →</button></nav>`;
}

function image(map, className = '') {
  return `<img class="${className}" data-map-preview="${html(map.id)}" ${map.thumbnail ? `src="${html(map.thumbnail)}"` : ''} alt=""/>`;
}

export function settingsLayout(backLabel, section = 'controls', content = '', monitor = '') {
  const categories = [['controls','Controls','settings'],['camera','Camera','camera'],['graphics','Graphics','mountain'],['language','Language','users']];
  return `<section class="game-panel unified-menu-card settings-card">${sectionHeader('Settings', 'settings-back', '', '', backLabel)}<div class="settings-split"><nav class="menu-rail" aria-label="Settings categories">${categories.map(([action,title,glyph]) => `<button class="rail-choice ${section === action ? 'selected' : ''}" data-action="${action}" aria-pressed="${section === action}">${icon(glyph)}${title}</button>`).join('')}<button class="rail-choice settings-help-link" data-action="help"><span class="help-glyph" aria-hidden="true">?</span>Controls help</button></nav><div class="settings-detail ${monitor ? 'has-monitor' : ''}"><section class="settings-fields"><h2>${html(categories.find(([id]) => id === section)?.[1] || 'Controls')}</h2>${content}</section>${monitor}</div></div></section>`;
}

export function flightSetupLayout({ maps, selectedMap, selectedTrack, mode, page, droneName, roomOptions, modeLabel }) {
  const multiplayer = mode === 'multiplayer';
  const slice = pageEntries(maps, page, 6);
  const activities = [['training','Free flight','drone'],['race','Race','flag'],['time','Time trial','clock'],['freestyle','Freestyle','orbit']];
  const modeBar = multiplayer
    ? `<div class="setup-session-bar">${icon('users')}<strong>${html(modeLabel)}</strong><span>${roomOptions.visibility === 'public' ? 'Public room' : 'Private room'} · ${roomOptions.maxPlayers} pilots max</span></div>`
    : `<div class="setup-modebar" role="group" aria-label="Flight activity">${activities.map(([value,label,glyph]) => `<button class="activity-choice ${mode === value ? 'selected' : ''}" data-action="flight-activity-${value}" aria-pressed="${mode === value}">${icon(glyph)}${label}</button>`).join('')}</div>`;
  const header = sectionHeader('Flight setup', multiplayer ? 'room-options' : 'home', `<button class="button setup-drone" data-action="hangar" aria-label="Change drone">${icon('drone')} <span translate="no">${html(droneName)}</span> ${icon('arrow')}</button>`, '', multiplayer ? 'Back to room options' : 'Back to main menu');
  const cards = slice.entries.map(map => `<article class="course-card-shell"><button class="course-card ${selectedMap.id === map.id ? 'selected' : ''}" data-map="${html(map.id)}" aria-label="${html(map.name)}" aria-pressed="${selectedMap.id === map.id}">${image(map)}<span class="course-card-content"><strong>${html(map.name)}</strong><small>${html(map.region)}</small></span></button>${mapDownloadHTML(map)}</article>`).join('');
  const course = mode === 'training' ? '' : `<label class="setup-course">${mode === 'freestyle' || multiplayer && roomOptions.mode === 'freestyle' ? 'Gate layout' : 'Course'}<select id="track-select">${selectedMap.tracks.map(track => `<option value="${html(track.id)}" ${track.id === selectedTrack ? 'selected' : ''}>${html(track.name)}${mode === 'freestyle' || multiplayer && roomOptions.mode === 'freestyle' ? '' : ` · ${track.laps} ${track.laps === 1 ? 'lap' : 'laps'}`}</option>`).join('')}</select></label>`;
  return `${header}${modeBar}<div class="collection-layout flight-collection"><section class="course-browser"><div class="course-browser-caption"><span>Choose a location</span><small>${maps.length} locations</small></div><div class="course-grid">${cards}</div>${pagination(slice.page, slice.pages, 'maps', 'Map pages')}</section><aside class="game-panel course-detail setup-detail">${image(selectedMap,'course-detail-image')}<div class="course-detail-body"><div class="panel-label">${icon('location')} SELECTED LOCATION</div><h2>${html(selectedMap.name)}</h2><p class="course-location">${html(selectedMap.region)}</p><p class="course-description">${html(selectedMap.description)}</p>${course}<div class="setup-conditions"><span>Wind</span><strong>${Math.hypot(...selectedMap.wind).toFixed(1)} m/s</strong></div><button class="button primary course-launch" data-action="launch">${icon('play')} ${multiplayer ? 'Create room' : `Start ${html(modeLabel.toLowerCase())}`} ${icon('arrow')}</button></div></aside></div>`;
}

export function collectionLayout({ kind, entries, selectedId, requestedPage = 0, maps, completed = new Map() }) {
  const lessons = kind === 'tutorials';
  const slice = pageEntries(entries, requestedPage, lessons ? 4 : 6);
  const selected = slice.entries.find(entry => entry.id === selectedId) || slice.entries[0];
  const map = selected && maps[selected.map];
  const stars = [...completed.values()].reduce((sum, value) => sum + value, 0);
  const header = sectionHeader(lessons ? 'Flight school' : 'Career', 'home', lessons
    ? `<span class="section-stat">${entries.length} guided lessons</span><button class="button" data-action="tuning-guide">${icon('settings')} Drone setup guide</button>`
    : `<span class="section-stat">${completed.size} / ${entries.length} missions · ${stars} stars</span>`, lessons ? 'LEARN TO FLY' : 'YOUR NEXT CHALLENGE');
  const cards = slice.entries.map((entry, i) => {
    const location = maps[entry.map];
    const earned = completed.get(entry.id) || 0;
    return `<article class="course-card-shell"><button class="course-card ${selected?.id === entry.id ? 'selected' : ''}" data-learn-entry="${html(entry.id)}" aria-pressed="${selected?.id === entry.id}">${image(location)}<span class="course-card-number">${String(slice.start + i + 1).padStart(2, '0')}</span><span class="course-card-content"><strong>${html(entry.name)}</strong><small><span translate="no">${html(location.name)}</span>${lessons ? ` · <span>${entry.steps.length} steps</span>` : ''}</small>${lessons ? `<span class="course-type">${html(entry.topic || (i + slice.start === 0 ? 'Control basics' : 'Navigation'))}</span>` : `<span class="course-stars" aria-label="${earned} of 3 stars">${'★'.repeat(earned)}${'☆'.repeat(3 - earned)}</span>`}</span></button>${mapDownloadHTML(location)}</article>`;
  }).join('');
  const detail = selected ? `<aside class="game-panel course-detail">${image(map, 'course-detail-image')}<div class="course-detail-body"><div class="panel-label">${icon(lessons ? 'school' : 'flag')} ${lessons ? 'SELECTED LESSON' : 'SELECTED MISSION'}</div><h2>${html(selected.name)}</h2><p class="course-location">${html(map.name)} · ${html(map.region)}</p>${lessons
    ? `${selected.description ? `<p class="course-description">${html(selected.description)}</p>` : ''}<ol class="lesson-outline">${selected.steps.map(step => `<li>${html(step.title || step.text)}</li>`).join('')}</ol>`
    : `<p class="course-description">${html(map.description)}</p><div class="mission-goal"><span>Target time<strong>${time(selected.target * 1000)}</strong></span><span>Your stars<strong>${'★'.repeat(completed.get(selected.id) || 0)}${'☆'.repeat(3 - (completed.get(selected.id) || 0))}</strong></span></div><p class="course-reward">${icon('trophy')} Complete missions to earn stars and credits.</p>`}<button class="button primary course-launch" data-action="${lessons ? `tutorial-${html(selected.id)}` : 'launch-mission'}">${icon('play')} ${lessons ? 'Start lesson' : 'Start mission'} ${icon('arrow')}</button></div></aside>` : '<p class="empty">No courses are available.</p>';
  return `${header}<div class="collection-layout"><section class="course-browser"><div class="course-browser-caption"><span>${lessons ? 'Choose a lesson' : 'Choose a mission'}</span><small>${lessons ? 'Practice at your own pace' : 'Earn stars on each course'}</small></div><div class="course-grid ${lessons ? 'lesson-grid' : ''}">${cards}</div>${pagination(slice.page, slice.pages, lessons ? 'tutorials' : 'career', lessons ? 'Lesson pages' : 'Mission pages')}</section>${detail}</div>`;
}

export function leaderboardPanel(rows, page, prefix, title, metric, emptyText) {
  const slice = pageEntries(rows, page, 6);
  return `<section class="game-panel leaderboard-panel"><div class="panel-header"><h2>${icon('trophy')} ${html(title)}</h2><span class="panel-label">${metric === 'time' ? 'BEST TIME' : 'POINTS'}</span></div><div class="leaderboard-rows">${slice.entries.map((entry, i) => `<div class="leaderboard-row"><span class="leaderboard-rank">${String(slice.start + i + 1).padStart(2, '0')}</span><strong translate="no">${html(entry.username)}</strong><span class="leaderboard-value">${metric === 'time' ? time(entry.best_ms) : `${entry.points} pts`}<small>${metric === 'time' ? `${String(entry.best_ms % 1000).padStart(3, '0')} ms` : `${entry.wins} wins`}</small></span></div>`).join('') || `<div class="leaderboard-empty">${icon('trophy')}<h3>The first line is yours.</h3><p>${html(emptyText)}</p></div>`}</div>${pagination(slice.page, slice.pages, prefix, 'Leaderboard pages')}</section>`;
}

export function weeklyLayout({ challenge, rows, page, maps, track, guest }) {
  const map = maps[challenge.map];
  return `${sectionHeader('Weekly challenge', 'home', '', 'ONE COURSE · EVERY PILOT')}<div class="competition-layout"><section class="game-panel competition-feature">${image(map, 'competition-image')}${mapDownloadHTML(map)}<div class="competition-body"><span class="competition-badge">THIS WEEK’S COURSE</span><h2>${html(map.name)}</h2><p class="competition-location">${html(map.region)}</p><div class="competition-course">${icon('flag')}<div><strong>${html(track.name)}</strong><small>${track.laps} ${track.laps === 1 ? 'lap' : 'laps'} · Server-timed flight</small></div></div><p>${guest ? 'Practice as a guest. Sign in to keep a leaderboard time.' : 'Race the shared course and set your best time for the weekly leaderboard.'}</p><button class="button primary" data-action="weekly-start">${icon('play')} Race this week ${icon('arrow')}</button></div></section>${leaderboardPanel(rows, page, 'weekly', 'Weekly leaderboard', 'time', 'No times yet. Complete a flight to set the first time.')}</div>`;
}

export function championshipLayout({ rows, page, map }) {
  return `${sectionHeader('Championship', 'multiplayer', '', 'THREE ROUNDS · ONE CHAMPION')}<div class="competition-layout"><section class="game-panel competition-feature">${image(map, 'competition-image')}<div class="competition-body"><span class="competition-badge">RACE WITH FRIENDS</span><h2>Three races.<br>One champion.</h2><p>Race on three different maps. Placement points decide the winner.</p><div class="championship-points"><span>1st<strong>10 pts</strong></span><span>2nd<strong>6 pts</strong></span><span>3rd<strong>4 pts</strong></span></div><p class="competition-rules">Next places earn 3, 2 and 1 points. Ties use finishes, then combined time.</p><button class="button primary" data-action="host-championship">${icon('users')} Host a championship ${icon('arrow')}</button></div></section>${leaderboardPanel(rows, page, 'championship', 'Championship leaderboard', 'points', 'Complete a three-round championship to appear here. Accounts keep their results.')}</div>`;
}
