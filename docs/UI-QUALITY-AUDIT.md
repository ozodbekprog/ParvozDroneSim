# Game menus — 7 October 2026

The current task is a visual redesign of the existing web beta. Flight physics, flight camera behavior, controller calibration values and Kestrel IDs are preserved. The user supplied concrete screenshots and requested clearer composition, visible actions, fewer scrollbars and Workbench inspection motions.

## Implemented

- The logo/account bar appears on the main menu only. Weekly challenge is a visible main-menu destination; Replays has a direct button.
- Multiplayer uses a compact heading with a solid Back button and prominent Create room action. Invite codes and ranked matchmaking have their own panels. Championship opens a separate screen with its own leaderboard and hosting action.
- Career uses map cards, stars, a selected-mission panel and explicit Start mission. All 24 missions remain available on four pages; selecting a card no longer starts a flight immediately.
- Flight school uses four illustrated cards, a selected lesson outline and Start lesson. Existing lesson objectives are unchanged.
- Weekly challenge puts the course and launch action in a centered feature panel, beside a separate leaderboard. Leaderboards and public rooms use pages instead of long internal scrolling lists.
- Map selection uses two pages of six maps. Hangar/Workbench orbit hints and the explanatory live-radio hint are removed. The input monitor has a neutral background and clearer gimbals; its input normalization is unchanged.
- Workbench part selection smoothly changes inspection angle over 0.65 seconds. Frame, motors, propellers, battery and camera have distinct views. Manual drag/zoom interrupts the motion; reduced-motion preference uses an immediate change.
- Repeated color inputs no longer attach duplicate drag/wheel handlers to the same preview stage. This was the cause of increasing orbit sensitivity.
- Account actions prevent duplicate requests, show pending status and persistent errors, and recover after a failed attempt. JSON API requests time out after 15 seconds. Startup version mismatch offers Reload game; invite-code validation explains the six-character format. Cancelling a local import removes its temporary file input.

## Verification

Chrome checks used an isolated server on 127.0.0.1:4177 and a separate SQLite database under `data/ui-audit-20261007/db`. Test-only account, drone copy and replays were used. Server-error/version/slow-asset scenarios used a loopback proxy on 4178; those responses were not applied to Oracle.

At an actual DOM viewport of **1280×720**, the main menu, multiplayer, career, flight school (including a five-step outline), map selection, championship, Controls and Workbench fit without internal vertical or horizontal overflow. Narrow or very short windows retain one outer scroll area so controls remain reachable. Viewport size is a UI measurement, not GPU/framebuffer or UHD 620 acceptance.

| Screen / action | Checked |
| --- | --- |
| Account access | Required fields; delayed sign-in disables actions; wrong-password error stays visible; successful retry; recovery dialog opens/cancels |
| Main menu / Settings | Destinations, category return paths, visible weekly challenge, graphics preset, camera selector, help dialog |
| Maps / career / school | All 12 map selectors and modes; map pages; all four career pages; mission and lesson selection; flight preparation/HUD; explicit launch actions |
| Hangar / Workbench | Fleet filters; original/copy distinction; parts/appearance/tuning; six repeated body-color inputs; unchanged tuning; unsaved-change choices; battery inspection view |
| Multiplayer | Filters, refresh, empty list, invalid/nonexistent invite, ranked queue/cancel, room settings in all four modes, lobby readiness/chat, start/leave |
| Weekly / Championship | Separate panels and navigation; weekly server flight; championship hosting preselects cup mode |
| Flight / results | Pause, continue, reset, restart, settings return, exit, replay save; a real three-minute freestyle session reaches results with neutral inputs |
| Replays | Stored replay playback, pause, seek, speed, camera, rename, delete dialog/cancel and local export |
| Failure states | Version mismatch → Reload; server unavailable → Reconnect; failed sign-in → retry; delayed asset load → Cancel |

**152 automated tests passed**, including account/recovery/admission, real weekly/ranked transport, replay/solo flows, collection paging, shortest-path inspection motion and the repeated-preview gesture regression. Production build and content validation passed: 12 maps, 19 races, 4 drones, 15 parts, 24 missions, 4 lessons.

## Follow-up menu refinement

The Workbench garage button and the main-menu Replays destination now use the shared button style. Settings uses three compact category tiles. Controls no longer shows the idle instructions or flight-mode paragraph; the live panel has no raw channel footer. Its gimbal updates remain independent of that removed text. Camera keeps its controls without the long explanatory paragraphs. Replays is centered and paged in groups of three. Flight setup shares illustrated location cards and a selected-location panel with career and school, retaining activity, course, drone and multiplayer room options.

The follow-up build and content validation passed; **154 tests passed**. Local Chrome verified the edited menus, garage return, both map pages, course selection, multiplayer setup, free-flight launch and Settings return to the paused flight. At an actual 1280 x 720 DOM viewport the flight collection and detail panel had no internal overflow. Console errors were empty. Physics, controller and Kestrel hashes still match the original baseline. Publication status is tracked separately in ORACLE-DEPLOYMENT.md.

## Selected concept adaptation - 8 October 2026

The user selected the structure of concept 01 (shared panels) and requested the existing game design. Pilot Profile, Settings, Create Room and Flight Menu now share the existing Barlow Condensed / DM Sans fonts, navy surfaces, amber selections, cyan values and SVG line icons. This replaces the follow-up Settings tiles described above with a category rail and immediately visible controls.

Profile has identity/navigation on the left, paged personal records and separate server rankings on the right. Achievements and Account remain reachable categories; recovery, sign-out and local import/export are in Account. No generated friends/country rankings, avatars or sample statistics were added. Create Room has parameter buttons and a live session summary, followed by the existing map/course selection. Flight Menu shows the actual selected drone and map beside its actions; solo is marked Paused, while multiplayer explicitly says Flight continues. Multiplayer roster/chat remain available in compact disclosures.

Validation: **160 tests passed**, production build and content validation passed. Local Chrome checked all four profile categories, recovery dialog open/cancel, all Settings categories and category focus, room parameter changes and map transition, a real private two-pilot-capacity freestyle room with one test pilot, solo pause/continue/restart, replay dialog open/cancel, Settings return to pause by Escape, multiplayer roster/chat and exit. Console errors were empty. Main panels fit the measured 1280 x 720 viewport without outer scrolling; Controls also fit 1280 x 600. At 520 x 827 the profile remains reachable, rankings use their category, and Settings stacks its live monitor with outer scrolling. No controls are hidden to force a fit. Physics, flight-controller and Kestrel hashes still match the baseline; server/index.js is unchanged.

Evidence and logs: `data/ui-audit-20261008/`. Concept sources: `output/ui-concepts-20261008/`. The local server at http://127.0.0.1:4177/ uses the separate UI-audit database. These changes are **locally ready, not deployed to Oracle**; the last verified public release remains 20261007-ui-01. SSH access remains the release blocker recorded in ORACLE-DEPLOYMENT.md.

## Settings stability and lighter pause - 8 October 2026

The Settings card now reserves the same viewport-bounded height for every category. Its header/navigation stay in place; only the content pane can scroll when a small window requires it. The Controls-only dark backdrop override was removed. Chrome measured identical 1224 x 640 panel bounds and computed backdrops for Settings/Controls, Camera and Graphics at 1280 x 720, and identical 358 x 588 bounds at 390 x 620. Settings opened from a paused flight also keeps its backdrop and panel bounds across categories.

The pause menu no longer renders a drone image/icon, drone name or flight-mode badge, and no longer starts drone-thumbnail generation. It uses a compact single-column card with location, pause/live status and the existing actions. Chrome verified solo pause, settings and return. The 11 targeted layout tests and production build passed. Evidence: `data/ui-audit-20261008/settings-stability.json`, `screenshots/stable-settings.png` and `screenshots/simple-flight-menu.png`. This follow-up is local only; Oracle has not been updated.

## Limits

- File import through Chrome could not complete because the browser extension lacks access to file URLs. Backup validation has automated coverage; a real UI file-import/round-trip remains unchecked.
- Real RC hardware was not connected for this audit. No hardware calibration, password/recovery-code change, permanent replay deletion or paid resource was performed.
- Not every combination of map, part and race outcome was played manually. Ranked/weekly protocol behavior and result ordering also have automated coverage. The neutral-input UI session is not a flight-quality or capacity test.
- This does not establish 100-player capacity, UHD 620 performance, art acceptance, or equivalence to Liftoff physics.

The latest verified deployment and remaining public-beta gates are recorded in [ORACLE-DEPLOYMENT.md](ORACLE-DEPLOYMENT.md). Screenshots, DOM layout measurements and test logs are under `data/ui-audit-20261007/`; that folder is excluded from production images.
