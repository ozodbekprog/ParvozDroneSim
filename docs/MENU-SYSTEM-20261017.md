# Menu system continuation — 17 October 2026

**Publication update — 18 October:** the integrated client, maps and lessons are
published in finalized release 20261018-learning-01. Earlier pending access,
browser and candidate instructions below are historical. Continue from
[the completed release](LEARNING-RELEASE-20261018.md) and
[verified Oracle state](ORACLE-DEPLOYMENT.md); do not redeploy an older candidate.


## User direction and local work

The user saw actual Sign in/Register/Downloads captures in
`data/ui-review-20261017/` and explicitly liked their compact dark design.
Extend that style to all menus, simplify loading, fix Downloads placement/scope,
reorganize Pilot Profile, investigate menu/Hangar delays, add FPV arrow controls,
and review an original abstract drone mark before replacement.

- `compact-ui.css` provides shared typography, fields, buttons, panels, navigation,
  cards, settings, replay and profile styling. Existing functional flows remain.
- Home map caption is bottom-left; Downloads is bottom-right. The Downloads
  panel/launcher is available only on Home; transfers remain independent.
- Profile identity/rating/XP are in a header. Records, Achievements, Rankings,
  Account and Data are separate tabs. Account actions align with their rows;
  export/import are in Data. Rankings load only on their tab; concurrent requests
  share one promise. The rest of the profile renders immediately.
- Hangar renders before account refresh. Background fleet results cannot replace
  an active draft, pending save or locally changed fleet. Repeated writes of the
  same menu-ready DOM attribute were removed.
- Loading covers the viewport, cycles actual catalog map/course images every
  6.5 seconds with a crossfade/subtle pan, respects reduced motion, and uses one
  bottom progress bar/percentage plus essential status/actions/errors. Download
  bytes account for 0–80%, models 85%, aircraft/opponents 90%, graphics 95%; only
  confirmed Ready reports 100%. Cancel/retry/buffer ownership remain intact.
- Flight arrows: Up/Down change tilt, Right/Left change FOV by one degree, with
  the same per-aircraft storage and bounds as Settings. Text inputs/dialogs and
  modified shortcuts are excluded. Help documents the keys. Saved separately
  as `6dabb02`, pushed with exact local/remote SHA agreement.
- Logo A/B were rejected; the user selected E from C/D/E. Its editable SVG
  refinement now replaces P in Home, loading and the favicon.
  [Design board and prompt](design/menu-system-20261017/README.md).

## Verification and limits

The 28 targeted tests pass (camera persistence/bounds, input, profile/menu flows,
loading ownership/cancel/retry, startup ordering and honest preparation percent).
Production build passes; its pre-existing bundle-size warning remains.
The full suite passed **353 tests, zero failures/skips** outside the sandbox
(172.3 s). Its initial sandbox run had 11 environment errors (spawn/mkdtemp EPERM);
those are resolved by the verified rerun, not product failures.
Final loading accessibility-label cleanup also passed all 8 affected tests and a
fresh build. Source commits are `136f23b` (menus/profile/responsiveness) and
`a5dca1b` (loading), each pushed with exact local/remote SHA agreement.
The static `design/menu-system-20261017/loading-preview.png` illustrates the
layout with example progress; it is not a new browser screenshot.

Browser access briefly worked in the IAB on localhost:2567, viewport 1075×605:
Play reached the menu; map caption/Downloads no longer overlapped; Settings,
Hangar and Profile/Account opened; Downloads was absent on those other menus;
Hangar drag/zoom worked. Profile tabs inherited column layout from the old rail;
this was corrected to an explicit row after the observation, not yet rechecked.

A warm Hangar capture with CPU profiling, drag and zoom recorded 1829 frame
intervals: median 11.2 ms, p99 22.4 ms, maximum 33.5 ms, no intervals above 50 ms
and no observed long tasks. CPU samples were mainly renderer work and matrix
updates. This did **not** reproduce the reported once-per-second freeze and is
not a UHD 620/720p acceptance result. Do not claim the freeze fixed.

The IAB reported `document.fullscreenElement === null` after Play. Real fullscreen
entry/exit is not verified. Access then reverted to
`Local browser use is disabled in Work settings`. The final loading UI, profile
row fix, narrow layouts, full background-download navigation and flight keys
still need browser checks. Temporary profiling stopped before access was lost;
reload the page to clear its stopped `__menuProbe` object. No production data
was used: server DATA_DIR is `data/entry-download-qa`, HOST 127.0.0.1, PORT 2567.

## Continue

1. Review the real captures in `design/menu-system-20261017/browser/` with the
   user. Prefer fresh higher-resolution map captures for slideshow.
2. Further narrow-window checks and authenticated account interactions remain.
3. Reproduce the reported Hangar hitch on the affected device/settings. Do not
   change physics or claim the hardware target from the unrelated local sample.
4. Complete verification and save any follow-up changes, then prepare a fresh Oracle
   candidate. The `20261017-entry-01` candidate is obsolete. No Oracle update has
   occurred in this UI work; production remains `20261016-hangar-race-01`.
   Follow the existing backup/drain/incremental-deploy/restore verification rules.

## Browser verification after E selection - 17 October

IAB access is working again. Restarted the isolated server on 127.0.0.1:2567
with `data/entry-download-qa`; production data was not used. Latest Vite build
passes (existing bundle-size warning). Actual unaltered captures are committed
under `design/menu-system-20261017/browser/`.

- Loading fills the viewport, shows the selected mark and real map imagery,
  and reaches Ready/100%. Play reaches Home.
- Fullscreen is now verified through native CDP Runtime state, not the restricted
  read-only DOM evaluator: false before Play, true after Play; Settings toggle
  switches false/true correctly. The earlier null result from the restricted
  evaluator did not establish native fullscreen state.
- Profile tabs are horizontal; Account has an aligned action row. Settings,
  Profile and Hangar have no Downloads launcher/panel. Home map caption and
  Downloads occupy separate corners.
- Started Minus Two download, observed 25% / 26.3 MB of 102.8 MB, entered Hangar
  and manipulated Luma. Returning to Home showed Downloaded / 102.8 MB. The
  selected map card also showed Downloaded; Free flight launched successfully.
- Flight Up/Down changed tilt 25 -> 26 -> 25; Right/Left changed FOV
  105 -> 106 -> 105, confirmed by the live HUD notices.
- Warm Luma drag/zoom sample: 1886 frames, median 13.0 ms, p99 26.1 ms,
  maximum 39.1 ms, zero frames above 50 ms, zero observed long tasks. The
  once-per-second hitch was not reproduced; UHD 620 performance remains
  unconfirmed. The temporary probe was stopped/removed and page reloaded.
  One logged error came from deleting the probe before its queued animation
  callback returned; it was diagnostic-only, not a product error.
- SSH to the existing Oracle host still times out. No deployment, firewall rule,
  production account or current-release change occurred. The old entry-01
  candidate remains obsolete.
