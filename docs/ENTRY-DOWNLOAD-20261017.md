# Initial preparation, downloads, fullscreen and HUD - 17 October 2026

**Publication update — 18 October:** the integrated client, maps and lessons are
published in finalized release 20261018-learning-01. Earlier pending access,
browser and candidate instructions below are historical. Continue from
[the completed release](LEARNING-RELEASE-20261018.md) and
[verified Oracle state](ORACLE-DEPLOYMENT.md); do not redeploy an older candidate.


## Implementation

The initial HTML contains an immediate loading shell. Client startup downloads
the selected menu environment, collision data and close aircraft model, then
waits for the real scene, aircraft and graphics preparation. The default Minus
Two/Kestrel preparation is four files / 41,873,399 bytes; this is not a forced
download of every location. The menu stays inert behind preparation. Failures
offer Retry without exposing an incomplete deck. Play opens the menu as a guest
when needed; Sign in opens the existing account screen.

Fullscreen defaults to requested at the end of preparation. A denied automatic
request leaves Play/Sign in available; their handlers request fullscreen in the
click stack before account/network awaits. Browser state determines the Settings
checkbox, including Esc. An explicit Off is saved and respected next time.
Unavailable/denied fullscreen never prevents playing. Its local backup key is
`liftoff-fullscreen-v1`. [Fullscreen Standard](https://fullscreen.spec.whatwg.org/)
requires transient user activation; a page cannot guarantee automatic entry.

Each flight-setup map has a separate download action and device status. The
nonmodal Downloads panel stays outside menu rerenders so Workbench drafts and
Settings remain usable. It has queue, byte/file progress, cancellation, resume,
retry and saved/error states. It hides during flight and returns in menus.

`MapDownloadManager` saves encoded immutable assets in a separate explicit
CacheStorage cache, shared by normal flight loading. It does not decode maps or
retain background buffers in the 64 MiB memory cache. One map/file is downloaded
at a time; shared foreground requests retain independent cancellation.
The explicit cache is capped at 2 GiB, further limited by browser quota/free
space. It never silently evicts a completed map. Reload, panel opening, map
selection and tab return recheck actual saved entries. Browser eviction,
unsupported storage and quota errors do not become a false Downloaded badge.
Incomplete cache writes keep Retry enabled. Canceled foreground subscribers do
not leave their RAM/optional-cache policy on a background-only transfer.
Browser storage remains best effort; see
[storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

The user's three reference stills identify the large dotted attitude instrument.
Previously its side rails rotated/translated with body Euler angles and ignored
FPV tilt and FOV. Side rails and center reticle are now fixed. The short horizon
line is projected from the actual rendered camera after camera updates, clipped
between the rails and hidden if no valid horizon crosses the instrument.
At level body / 25-degree camera tilt / 90-degree vertical FOV / 1280x720,
the correct world horizon is y=527.87px; the previous formula put it at360px.
Projection tests cover roll/inversion, yaw, tilt, aspect, zoom and view offsets.

The official [Liftoff 1.3.0 changelog](https://www.liftoff-game.com/news/liftoff-130-milestone-update)
describes the horizon being restricted to the side bars;
[1.5.9](https://www.liftoff-game.com/news/update-159-released) calls it the horizon
axis. The separate ring's exact meaning is not established by stills or these
sources; no speculative velocity marker is enabled. This implements a geometric
world horizon and does not claim the proprietary game's exact calibration.

## Verification and remaining work

- Full canonical suite: **345 passed**, zero failures/skips. After the last
  startup/accessibility edits, 28 affected integration/controller/HUD/local-backup
  checks pass. Production build passes; final isolated candidate is separate.
- Real local Chrome showed preparation of 41.9 MB / four files, Ready to play,
  Play-to-menu guest entry and all three map download actions/statuses. A screenshot
  is saved in `entry-download-evidence-20261017/`. Its Play action did not produce
  confirmed browser fullscreen; actual on/off and background-download navigation
  verification remain required. Browser access was subsequently disabled in Work.
- The initial hidden-tab preparation took longer than expected. Read-only tracing
  found no dependency on the game animation loop: native RAF waits, model/Basis
  decoding, clone and surface jobs precede readiness. Default collision parsing,
  validation and BVH preparation measured 0.285s in Node. A long hidden-tab delay
  is not proof of a collision or renderer-loop deadlock; no speculative change
  to the animation order was made.
- Oracle SSH timed out on17 October. Public health/catalog still return200,
  protocol13 / revision`b68f2b229bf64134` /80assets. **These changes are not yet
  deployed.** Resume browser verification and restore authorized SSH access,
  then use a fresh release directory and verified before/after cloud restores.
  Preserve the 20-player limit, production database/env and rollback image.
- The mandatory `gpt-6.1-sol / xhigh` delegation section was removed at the user's
  request; global preferences already contained no such rule. No further
  delegation is required by this task.

The retained online baseline is ignored
`data/hangar-race-online-release-20261016.json`; previous publication/restore
scripts must not be rerun. Use the strict optional incremental image build when
dependencies and immutable assets remain unchanged; check VM disk first.

## Prepared candidate and access handoff

Candidate `20261017-entry-01` is already prepared from source
`67ed9fcbaec27980f9bb4a232ea87c0e8aecb942`. It now predates the user's selected
auth/Downloads redesign A and must not be deployed as the finished UI. Retain
its staging files for reference; prepare a fresh candidate after browser checks.
The isolated build/content checks passed. Its 493-file inventory retains all
80 delivery assets (904,599,026 bytes), protocol 13 and revision
`b68f2b229bf64134`. The delta changes 14 files, reuses 479 and removes none.
Ignored `data/oracle-patch-20261017-entry-01.tar.gz` is 121,586 bytes, SHA-256
`f37b66b1f04698719be140552a68543d479c17e8e43ff894a058517a5d41d114`.
Candidate client: `/assets/index-DN2Us71P.js`, SHA-256
`47acfe8831ec3b31cb6e168d1359ff9b66abff9c16a481473c17b756696e90a8`.

The user authorized one ipify request, which returned `144.124.199.147`, and
then explicitly authorized replacing only the existing TCP 22 source
`144.124.199.191/32` with `144.124.199.147/32`. **That replacement has not been
performed.** Do not ask for the same authorization again, broaden the source or
repeat the one-use external-IP request without a new reason and authorization.

The browser still returns `Local browser use is disabled in Work settings`,
including after the user's enablement reply and a tool-session refresh. No
browser-policy workaround was used. The plugin search found no OCI network
administration integration; Oracle Analytics is unrelated. Restore browser
access, change/read back the exact authorized SSH source in Oracle Console,
then verify SSH before beginning any VM update.

Ignored `data/oracle-{pre,stage,activate,post}-entry-20261017.sh` are prepared,
**not executed**. They guard the previous release, verify the archive/inventory,
preserve env files and use the incremental build with fresh before/after cloud
restores. No candidate upload, drain, production database change, activation or
symlink switch has occurred. Complete actual fullscreen, background-download
navigation/reload and HUD browser checks before deployment; then perform public
checks, compare independently restored backups and finalize the release.

## Selected compact UI - 17 October

The user selected [concept A](design/auth-downloads-20261017/README.md).
Authentication now uses a compact centered form with Sign in/Register tabs;
Downloads uses compact thumbnail rows and relevant actions, with general storage
explanation behind optional details. Existing account endpoints, download/cache
semantics and navigation are preserved. Adobe Source Sans 3 is self-hosted with
its original OFL license and provenance. Production build and 18 focused tests
passed. Browser access was rechecked and still reports disabled in Work; actual
layout, autofill, recovery and background navigation remain unverified. No Oracle
changes were made. Rebuild the release candidate/scripts for this newer source
after completing acceptance; the entry-01 archive does not include these edits.
