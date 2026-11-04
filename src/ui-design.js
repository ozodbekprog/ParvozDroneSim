// Shared game navigation and flight HUD presentation.
export const SCREEN_TITLES = {
  auth: 'Pilot access', home: 'Flight deck',
  maps: 'Flight setup', hangar: 'Drone Selection', workbench: 'Workbench',
  career: 'Career', multiplayer: 'Multiplayer',
  lobby: 'Room lobby', weekly: 'Weekly challenge',
  profile: 'Pilot profile', settings: 'Settings', controls: 'Controls', camera: 'Camera',
  'flight-controller': 'Drone tuning', graphics: 'Graphics',
  replays: 'Replays', pause: 'Flight menu',
  tutorials: 'Flight school', 'replay-viewer': 'Replay'
};

export function readableLabel(label) {
  return label === label.toUpperCase() ? label.charAt(0) + label.slice(1).toLowerCase() : label;
}

const paths = {
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  drone: '<path d="m8 8 8 8M8 16l8-8"/><rect x="9" y="9" width="6" height="6" rx="2"/><ellipse cx="5" cy="5" rx="4" ry="2.5"/><ellipse cx="19" cy="5" rx="4" ry="2.5"/><ellipse cx="5" cy="19" rx="4" ry="2.5"/><ellipse cx="19" cy="19" rx="4" ry="2.5"/>',
  frame: '<path d="m5 5 14 14M5 19 19 5"/><rect x="8" y="8" width="8" height="8" rx="2"/><circle cx="4" cy="4" r="2"/><circle cx="20" cy="4" r="2"/><circle cx="4" cy="20" r="2"/><circle cx="20" cy="20" r="2"/>',
  motors: '<path d="M7 8V5h10v3M5 8h14v11H5zM9 19v2m6-2v2M12 5V2M8 12v4m4-4v4m4-4v4"/>',
  propellers: '<circle cx="12" cy="12" r="2"/><path d="M10 10C3 1 1 4 4 8l6 4m4 2c7 9 9 6 6 2l-6-4"/>',
  camera: '<rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="4"/><path d="m7 6 2-3h6l2 3"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1-4c-2-1 0-3 2-3h2a3 3 0 0 0 3-3c0-5-4-8-9-8z"/><path d="M7 8h.01M12 6h.01M17 8h.01M6 13h.01"/>',
  flag: '<path d="M5 22V3h14l-3 4 3 4H5"/>',
  orbit: '<ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="2"/>',
  mountain: '<path d="m2 17 6-9 4 6 3-4 7 7M6 11l2 2 2-2"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  battery: '<rect x="2" y="6" width="18" height="12" rx="3"/><path d="M23 10v4M5 9h12v6H5z"/>',
  antenna: '<circle cx="12" cy="8" r="2"/><path d="M12 10v11M8 21h8M7 4a6 6 0 0 0 0 8M17 4a6 6 0 0 1 0 8"/>',
  play: '<path d="m9 5 11 7-11 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 9M3 4v6h6"/>',
  save: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  school: '<path d="m2 9 10-6 10 6-10 6zM6 12v5c4 3 8 3 12 0v-5M22 9v8"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 4a4 4 0 0 1 0 8M20 15a6 6 0 0 1 2 6"/>',
  trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4M12 14v6M8 21h8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  location: '<path d="M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2"/>'
};

export function icon(name) {
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.mountain}</svg>`;
}

export function flightHudHTML({ location, activity, session, label, tutorial, chat, freestyle = false }) {
  return `
    <div class="hud-location"><span>${location}</span><small>${activity} · ${session}</small></div>
    <div class="hud-mode" id="hud-mode"></div>
    <div class="hud-attitude" id="hud-attitude" role="img" aria-label="Drone attitude"><svg class="attitude-window" viewBox="0 0 1280 720" preserveAspectRatio="none" aria-hidden="true"><path class="attitude-ladder"/><path class="attitude-level"/><g class="attitude-reticle"><circle r="8"/><path d="M0 -15V-10 M0 10V15 M-15 0H-10 M10 0H15"/></g></svg><output class="sr-only"></output></div>
    <div class="hud-sticks" aria-label="Control inputs"><span class="hud-stick" aria-label="Throttle and yaw"><i id="hud-stick-left"></i></span><span class="hud-stick" aria-label="Pitch and roll"><i id="hud-stick-right"></i></span></div>
    <div class="flight-navigation" aria-label="Flight targets"><div class="target-marker hidden"><i>◇</i><small></small></div><div class="target-marker secondary hidden"><i>◇</i><small></small></div></div>
    <div class="hud-mission hidden" id="hud-mission" role="status"></div>
    <div class="hud-battery-warning hidden" id="hud-battery-warning" role="status">Low battery</div>
    <div class="hud-instruments">
      <div class="hud-progress" id="hud-progress"></div>
      ${tutorial ? '<output id="lesson-feedback" class="lesson-feedback"></output>' : ''}
      ${tutorial ? '<button id="lesson-next" class="lesson-action button primary hidden">Next step →</button>' : ''}
      <div class="hud-instrument-bar">
        <span class="hud-speed"><strong id="hud-speed"></strong><small>km/h</small></span>
        <span class="hud-timer"><small class="hud-label">${label}</small><strong id="hud-main"></strong></span>
        ${freestyle ? '<span class="hud-timer"><small class="hud-label">Time left</small><strong id="hud-remaining"></strong></span>' : ''}
        <span class="hud-battery" id="hud-battery-widget" aria-label="Battery"><span class="battery-icon"><i id="hud-battery-bar"></i></span><strong id="hud-battery"></strong></span>
      </div>
    </div>
    <div class="hud-bottom">
      <details class="hud-tools"><summary aria-label="Flight actions">${icon('more')}</summary><div class="hud-tools-popover"><div class="hud-extra"><span>Altitude <strong id="hud-altitude"></strong></span><span id="hud-throttle"></span></div><button id="reset-flight">${icon('reset')}<kbd>R</kbd> Reset</button><button id="save-flight">${icon('save')} Save replay</button><small>C · camera &nbsp; M · flight mode</small></div></details>
      <button id="pause-flight" class="hud-pause"><kbd>Esc</kbd> Pause</button>
    </div>${chat}`;
}
