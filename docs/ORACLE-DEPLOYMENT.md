# Oracle deployment — verified browser release 1 November 2026 (`20261101-startup-01`)

## 1 November, 20:01 Tashkent — published and finalized (`20261101-startup-01`)

**`20261101-startup-01` is live** on both public HTTPS hostnames (`https://parvoz-drone-sim.duckdns.org/` and `https://drone-liftoff-uz.duckdns.org/`) and `/opt/liftoff/current` points to `/opt/liftoff/releases/20261101-startup-01`, finalized at `2026-11-01T15:01:42.873Z`.

- **Runtime source commit**: `87db1850225ed4a876d530b0b6c8ebc50b7238f9` (`gemini/oracle-perf-20261031`), combining:
  - The approved `20261031-ui-perf-01` UI (`18ffbe9` / `64ca6ac`) and performance baseline (`dc51898`),
  - Startup 3D Main Menu map + 3D `home-drone` + 3D Hangar preload fix (`923b09b`),
  - Direct embedded KTX2 decoding with r180 adapter (`0fb6fef` / `7b58e23`),
  - Chase & rigid camera stabilization during crash tumble and near walls (`cc1cbf7` / `da6b400`),
  - AI recovery detour paths around angled checkpoint frames (`d971375` / `87db185`).
- **Client bundle**: `/assets/index-Ro_kxin9.js` (SHA-256 `b550b23cf0383393816da79ecb0fa00b6dfaa100857e296c1eccff3b43f78b18`), CSS `/assets/index-D0RdIDG0.css` (SHA-256 `f3d0d9c9c5caf74d4efc7df12eef61f517dab07cb4d07f7b71df8336f34c9d37`).
- **Container image**: `sha256:1325739d49799cced0441243769ac1e9485b0653275d5aa9a8fecedc83d486d0` (`liftoff-game:latest` and `liftoff-caddy:latest` healthy).
- **Protocol / Revision / Admission**: Protocol `13`, catalog revision `0fe968941a806c66`, admission `20`, budget `$0` Always Free.

### Verification Summary
- **Local & VM Checks**: `91/91` combined tests passed (startup preload, scene switching, direct KTX2 decode, camera crash/wall regressions, menu focus, and all 25 physical AI track completions); fresh VM `npm ci && npm run build && npm run content:check` and all `479` release inventory hashes (`194` canonical sources) verified.
- **Isolated & External Public Multiplayer**: Isolated container (`parvoz-startup-isolated-20261101-01`), isolated Caddy (`parvoz-caddy-proxy-20261101-01`), and live external public two-client races on `liftoff-pine-valley-demo` and `liftoff-the-green-demo` passed.
- **Live Public Browser Verification (Playwright, clean browser profile, zero cache)**:
  - `StartupLoading` on `https://parvoz-drone-sim.duckdns.org/` downloaded all `9` startup 3D assets (`minus-two-demo/model-b937e910f9981b0a.glb`, `minus-two-demo/delivery-87910eb6e6a5e197.glb`, `kestrel/hangar-5916cca55a137dcd.glb`, `kestrel/source-f34a43818bab7bc0.json`, and 5 drone thumbnails) and precompiled both `'preview'` and `'menu'` shader states (`12,303 ms`).
  - Clicking **«Играть»** (`Play`) entered the Main Menu with `dataset: { screen: "home", scene: "menu", menuScene: "ready", edition: "standard" }` — 3D map and 3D drone visible on Frame 1.
  - Clicking **«Ангар»** (`Hangar`) opened the 3D Hangar and 3D drone in **`209 ms`** (`loadingOverlayText: null`, `0` console errors) instead of the previous ~20 s wait.
- **Backups, Player Data & Rollback**:
  - Pre-update OCI cloud backup (`/home/liftoff/pre-startup-cloud-20261101-01.sqlite`, `634,880` bytes, SHA-256 `6f659b57daf6f660602888952a0179d446e8f4f3b8a49677523beb4a223ccead`) and post-update OCI cloud backup (`/home/liftoff/post-startup-cloud-20261101-01.sqlite`, `634,880` bytes, SHA-256 `6f659b57daf6f660602888952a0179d446e8f4f3b8a49677523beb4a223ccead`) independently downloaded, restored, and verified (`4` users, `5` records, `4` achievements, `1` fleet, `2` replays, `1` weekly record preserved).
  - Rollback: `/opt/liftoff/releases/20261031-ui-perf-01`, image `sha256:ab41d6a18a1a47ae3747f9856791d376c5d68107c4cb80e1b0caac5039a70db7` (`liftoff-game:rollback-ab41d6a18a1a47ae3747f9856791d376c5d68107c4cb80e1b0caac5039a70db7`), recorded in `deploy/previous-release.txt`.
  - Hard-linked `524` byte-identical `dist/assets/*` files across retained October releases without deleting any release file, increasing free disk to `869,814,272` bytes (~830 MiB).

## 31 October, 13:29 Tashkent — published and finalized (`20261031-perf-01`)

**`20261031-perf-01` is live** on both public HTTPS hostnames (`https://parvoz-drone-sim.duckdns.org/` and `https://drone-liftoff-uz.duckdns.org/`) and `/opt/liftoff/current` points to `/opt/liftoff/releases/20261031-perf-01`, finalized at `2026-10-31T08:29:13.214Z`.
- **Runtime source commit**: `dc5189833267e42a1c74927963cc95781683c25` / `dc5189833267e42a1c749273362f6656bdb05c85` (`gemini/oracle-perf-20261031`), built cleanly on top of the `20261026-collision-01` public baseline (`bea19c068e291ec55e463ef731aa9392794d281b`) without unpublished Oct 27–28 UI changes.
- **Client bundle**: `/assets/index-Cmvzy7TQ.js` (SHA-256 `43a111abf59e3e871f226c24261274be838e7fd3d10727bd11cf179025a1e4c2`), CSS `/assets/index-DRMy7-Vl.css` (`154.97 kB`, unchanged).
- **Container image**: `sha256:abb35e7efc849425a9e16f40740e4ba50fa4358538a78eebaf474f115a1aa6a6` (`liftoff-game:latest` and `liftoff-caddy:latest` healthy).
- **Protocol / Revision / Admission**: Protocol `13`, catalog revision `0fe968941a806c66`, admission `20`, budget `$0` Always Free.

### What Changed & Verified Checks
- **Performance, Graphics (`Ultra`), Shadow/AO, & Map Download Persistence**:
  - Restored full-resolution `Ultra` grass/ground textures (`maxTextureDimension: 2048` on `Ultra`) and anisotropic filtering on terrain, road, and grass surfaces.
  - Eliminated shadow/AO striping (shadow acne) via normal-offset bias (`shadow.normalBias = 0.028`, `shadow.bias = -0.00035`) and GTAO depth/normal distance falloff tuning.
  - Eliminated flight LOD/animation micro-stutters (`updateMatrixWorld()` call count reduced ~99% by running `updateAnimatedNodes` only on maps with animated nodes; zero per-frame allocations in `updateDistanceVisibility`).
  - Fixed map download persistence across browser reloads and map version updates: stored both encoded KTX2 and decoded asset URLs in persistent Cache Storage (`parvoz-downloaded-assets-v1` + `parvoz-encoded-assets-v1`), bypassed double browser HTTP cache re-downloads, increased download concurrency to `4`, and automatically evicted stale hash-versioned assets when a map updates.
  - Enabled Caddy `precompressed gzip` for `.pcol` collision sidecars (`77.7%` transfer reduction on `liftoff-the-green-demo` collision sidecar).
- **Verification Summary**:
  - Local & VM build/content checks and all `471` release inventory hashes (`194` canonical sources against `20261020-optimization-01/content`) verified.
  - Isolated container (`parvoz-perf-isolated-20261031-01`) and isolated Caddy (`parvoz-perf-caddy-20261031-01`) passed health, `check-public.js`, two-client `smoke-lan.js` (`liftoff-pine-valley-demo` & `liftoff-the-green-demo`), and `.pcol` collision decompression/hash verification.
  - Live public verification passed: both HTTPS domains, all `202` public assets (`167` catalog + `35` retained `.pcol` sidecars) HEAD/Range/cache checks (`DELIVERY-VERIFICATION.json`), external two-client races on `liftoff-pine-valley-demo` and `liftoff-the-green-demo`, and live Chromium browser verification (`BROWSER-VERIFICATION.json`: `minus-two-demo` `.pcol` `200`, `state: "downloaded"` persisted across full `page.reload()`, Hangar preview canvas rendered cleanly, `0` console errors).
  - Remaining open items: UHD 620 / 60 FPS hardware target and 100-player admission remain unconfirmed.

### Backups, Player Data & Rollback
- Production `.env` files (`deploy/production.env`, `deploy/backup.env`) verified byte-identical via `cmp`; `liftoff_game-data` volume preserved without `down -v`.
- **Pre-update cloud backup**: uploaded to OCI (`liftoff-2026-10-31.sqlite`, `634,880` bytes), downloaded from OCI to `/home/liftoff/pre-perf-cloud-20261031-01.sqlite`, SHA-256 `c003acfb3f8ce4cf337e1b51fb85381796378e4bdc1d05b27ea429d66394d887`.
- **Post-update cloud backup**: uploaded to OCI, downloaded from OCI to `/home/liftoff/post-perf-cloud-20261031-01.sqlite`, SHA-256 `c003acfb3f8ce4cf337e1b51fb85381796378e4bdc1d05b27ea429d66394d887`.
- Every original non-session row is preserved (`4` users, `5` records, `4` achievements, `1` fleet, `2` replays, `1` weekly record); `liftoff-backup.timer` is `active` (`7` retained cloud backups).
- **Rollback**: `/opt/liftoff/releases/20261026-collision-01`, image `sha256:f9c082ffa8ff507fd151a4fb89b782dd8addd8172d17fd12f4c41e043f8ed693` (`liftoff-game:rollback-f9c082ffa8ff507fd151a4fb89b782dd8addd8172d17fd12f4c41e043f8ed693`), recorded in `/opt/liftoff/releases/20261031-perf-01/deploy/previous-release.txt`. Free disk after finalization: `687,722,496` bytes.

**UI publication rule — 29 October:** Keep the current public interface. The
shown Hangar redesigns were rejected. UI changes require a separate test/preview
review and explicit user permission to release that result. Earlier general
deployment requests do not authorize publishing these designs or bundling other
unapproved local UI changes. [Current direction](UI-ITERATION-RULES-20261029.md).
This documentation update is not a deployment; release records below are retained.

## 26 October, 18:55 Tashkent — activated; final browser gates pending

**`20261026-collision-01` is serving both public HTTPS hosts.** Fresh SSH/HTTPS
readback at `2026-10-26T13:55:51.549Z` verifies healthy runtime image
`sha256:f9c082ffa8ff507fd151a4fb89b782dd8addd8172d17fd12f4c41e043f8ed693`,
client `index-OPei9JC_.js`, protocol 13, revision `0fe968941a806c66` and admission
20. Runtime source is `b26c2a98940760a6ccf62bc4968a458e37c94b5e`; the separate
Caddy configuration correction is `bea19c068e291ec55e463ef731aa9392794d281b`.
This supersedes the historical SSH-blocked/preparation notes below.

VM build/content/inventory, isolated and public Pine/Green two-client races,
all 202 current/retained asset HEAD/range/cache checks, and independently
restored pre/post cloud backups pass. Original non-session player rows and
production env/data volume are preserved. The backup timer remains active;
fresh free disk is 906,137,600 bytes. No paid resources were added.

Chrome rendered Minus Two at an actual 1280×720 Low framebuffer with adaptation
disabled and requested its binary collision sidecar. Cancelling Green returned
to setup. After that, browser control disconnected before the following flight
and Hangar checks could be confirmed. Windows Computer Use then stopped because
it could not confidently determine Chrome's current URL. The in-app browser
earlier lost its GPU device and its renderer recovery failed; that is an open
limitation. UHD 620 performance remains unverified.

**Finalization is incomplete:** `/opt/liftoff/current` deliberately still points
to `20261025-browser-03`, while the running Compose project is the new release.
Do not infer the serving version from that pointer or redeploy through it.
The previous release/image is retained for rollback. Resume only the unfinished
browser checks, restore the temporary Chrome graphics/emulation settings, and
then run the gated finalizer. Do not repeat upload, build, activation or completed
backup operations. See [evidence and exact continuation](ORACLE-COLLISION-20261026.md).

## Historical checkpoint — 26 October, 15:28 Tashkent — SSH blocked

Candidate `20261026-collision-01` is built, validated, packaged and saved to GitHub,
but **not uploaded or deployed**. The approved TCP22 source was changed to
`195.158.3.42/32` and SSH worked. The connection subsequently changed to
`37.110.211.16`, so SSH timed out again; the user chose to restore the approved
connection. No broader ingress rule was applied. The new deployment helpers
have not run on the VM. Current remains `20261025-browser-03`; fresh public
health/API/WebSocket and sampled delivery checks pass.

A fresh cloud backup was uploaded/downloaded and independently restored on the
VM, SHA-256 `3cb59f579c5e9d1d6f05a406e3bd8ccdca82b7a39ff05d22589dbc3c68ad47dc`.
Seven obsolete host `node_modules` folders were cleared after retained-lockfile
checks, increasing free disk to 2,151,800,832 bytes; all release sources, assets,
rollback images and production data remain. See the
[exact package, backup evidence and continuation](ORACLE-COLLISION-20261026.md).

## 26 October — main and education entry views checked

Fresh SSH/public HTTPS/browser checks confirm `20261025-browser-03` remains live.
The root opens the full simulator; Start/Class are optional views of that same
application and share its assets, physics and performance fixes. No replacement
deployment or production data change was made. See the
[direct comparison and evidence](EDITION-COMPARISON-20261026.md).

## 25 October, 23:14 Tashkent — published and finalized

**20261025-browser-03 is live** on both public HTTPS hosts and current points to
/opt/liftoff/releases/20261025-browser-03. Finalized at 2026-10-25T18:14:21.822Z;
fresh readback verifies the pointer, healthy containers and exact new client.
Runtime source 2d003d296f51052b18b6172a38e01073938e5c29, client index-BMjsxyqU.js,
SHA-256 3d5462b181cb7805800ec19f78ea4b76e9c6d6bfc95124670ce3c75efe97b3d8;
image sha256:644e4b762b7bc5faa984f5d36176020f43ad0410d985a5e6fbf75bcf23624253.
Protocol13/revision2132caf43c0e38df, admission20 and $0 are unchanged.

The collision-worker/memory-retirement update includes a cancellation fix found
in real browser QA: the prior candidate was rolled back while corrected, and
browser-03 keeps map/light state paired until replacement. Full suite565/565,
transition22/22, local/VM build/content and 418 inventory hashes pass. Isolated
and external public Pine/Green two-client races pass. All132 public delivery
HEAD/range/cache checks pass from the VM. External Edge passes cancel → new
flight → menu/Hangar → flight, with no captured JavaScript errors. The external
full inventory probe timed out; it is not counted as a pass. UHD620/60FPS,
smaller map downloads and bundle size remain unconfirmed/open.

Env files compare unchanged and liftoff_game-data/player progress are preserved.
Fresh pre/post cloud backups were uploaded, downloaded and independently restored
on the VM. Every original non-session row is intact: 4 users,5 records,
4 achievements,1 fleet,2 replays,1 weekly record. Pre SHA-256:
a217610bd73b2e7c2a6efb3565551232c4559be753606918ceae5215a47eddb8.
Post SHA-256:43d556a3b8d6fe5ac61be65103abba1a393c69d7e1356a5be5e9e3341777b177.
Backup timer remains active; seven private cloud copies are retained.

Normal SSH recovered with the approved public key, preserving old keys. The final
approved TCP22 source213.230.78.242/32 is saved; other rules/IAM are unchanged.
The user-approved temporary serial connection is deleted and the empty console
connection list verified. No additional recovery boot or paid resource is needed.

Rollback: /opt/liftoff/releases/20261023-stability-03, image
sha256:a9c840316ead73e0aa170ec75ab0c76fa648e617748ab8ee7aa48b5c09485a69,
recorded in the new deploy/previous-release.txt. Earlier images/releases are
retained; rejected browser-02 has its own retained tag. The disk-safe build adds
one patch layer and preserves original runtime configuration. Final free disk:
1,326,071,808 bytes. Reuse immutable delivery assets and retained canonical source
content; do not repeat exports, backups or this completed deployment.
See [full verification, scope and continuation](ORACLE-BROWSER-20261025.md).
Historical records below describe earlier releases.

## 23 October, 15:58 Tashkent — activated, final verification in progress

**This supersedes the historical pending-deployment notes below.** Release
`20261023-stability-03` is serving both public HTTPS hostnames from
`/opt/liftoff/releases/20261023-stability-03`, activated at
`2026-10-23T10:58:00.742Z`. Runtime source `78fb1f8`, client
`index-D31s-vkZ.js`, SHA-256
`a7fea3bf1d7635a9cea5f81575c40cfc4b2e7709f05bf1ce352910f6e3cf7807`;
image `sha256:a9c840316ead73e0aa170ec75ab0c76fa648e617748ab8ee7aa48b5c09485a69`.
Protocol 13 / revision `2132caf43c0e38df`, admission 20 and $0 are unchanged.

Oracle sign-in and the previously authorized TCP22 source rotation are complete;
SSH works. VM build/content and 399 inventory hashes, isolated temporary-database
Pine/Green races, public two-client races, both HTTPS hosts and all 132 public
assets (1,789,800,866 bytes) passed. New code reuses existing immutable assets and
the canonical read-only `20261020-optimization-01/content`; no re-export.
Production envs and `liftoff_game-data` were preserved. No active race remained
before activation. The previous 21 October release/image is retained for rollback.

Fresh pre-update cloud copy was independently restored on the VM:
`/home/liftoff/pre-stability-cloud-20261023-03.sqlite`, SHA-256
`5d8b6acaf0225fa16335f792efb26e0fd6c952986f9f8081546f183b551f3d79`.
Initial public Edge runs: cold native 3.489 s, repeat 1.298 s to Ready, zero model
requests before the menu. Cold 5 Mbps /160 ms: **3.271 s** Ready, actual positive
client network bytes. Exact catalog failure: three attempts, readable Russian
error and Retry; restored connection reached Ready **675.5 ms** after Retry,
without reloading. No JavaScript errors or focus/visibility changes in these runs.
**Four of six after-release scenarios are complete.** Browser Use became disabled
again before first Hangar/cancellation and CPU4 first-flight checks; user was asked
once to re-enable it. `/opt/liftoff/current` still
points to the 21 October release until those checks finish. Do not redeploy or
repeat completed staging/build/backups merely to resume.

Post-update cloud copy independently downloaded/restored **on the VM**, integrity
and rollback-write checked at `2026-10-23T11:40:20.912Z`:
`/home/liftoff/post-stability-cloud-20261023-03.sqlite`, SHA-256
`06f935471637be99036af92e50af384189386e1352597f427f9d448bdfa7c28a`.
The checked read-only row comparator confirms every original non-session row is
preserved: 4 users, 5 records, 4 achievements, 1 fleet, 2 replays, 1 weekly record;
other player tables remain empty. New test sessions are allowed. Private rows
remain on the VM. Production env files are identical to the previous release,
the existing player volume and read-only new asset mount are verified. Free disk
after this check: **1,700,663,296 bytes**. Do not repeat this completed backup.

Docker packaging initially exhausted disk while duplicating historical base
layers in build cache. Only Docker build cache was pruned; production stayed
healthy, all rollback images/releases and player data were retained. The already
exported candidate image then passed isolated checks. Free disk after isolation
was 1,694,052,352 bytes; check again at finalization.

Public beta: https://parvoz-drone-sim.duckdns.org/ . Parvoz Drone Simulator and the current imported Liftoff content are deployed for the user's explicitly authorized multiplayer test on different computers. The old https://drone-liftoff-uz.duckdns.org/ remains a working alias. HTTPS, health, WebSocket, all delivery assets, two-client multiplayer and browser guest/flight checks passed. This is functional release verification, not UHD 620, 100-player or artistic acceptance. Earlier release sections below are historical.

## 23 October — stability candidate pending, no new deployment

Afternoon continuation: direct public baseline runs 5/6 are complete (72.554 s
cold at 5 Mbps; CPU4 after startup first flight 12.499 s / 939 ms longest task).
These exercised the existing 21 October release. Edge is connected; Oracle
console login is incomplete, awaiting manual completion after the automatic
redirect returned to sign-in. Do not resend phone prompts. No ingress rule or VM state has changed yet.
Runtime `087c2b5` adds deferred map physics with **37/37** affected checks and
local browser fault/recovery QA. Subsequent runtime `78fb1f8` adds localized
interrupted-download copy, with 29/29 affected checks/build and browser recovery.
Latest checked `20261023-stability-03` (`candidate-03.tar.gz`, 35 members, client
`index-D31s-vkZ.js`) supersedes both earlier unpublished candidates.
It is **not uploaded or deployed**. Preserve the
canonical 20 October source directory and all production data/rollback images.

Morning check at 09:01 Tashkent again matches the published client hash, health
and revision below. SSH still times out and Oracle is at its sign-in form.
Browser access has returned; temporary test controls were reset. No VM access
rule, release, production data or backup was changed. Candidate publication and
the complete six-run browser acceptance remain pending.

Read-only direct public check at 01:41 Tashkent confirms the same 21 October
client SHA below, health ok, protocol 13 / revision `2132caf43c0e38df` and 217-byte
matching catalog. Current SSH attempt timed out; no VM state is inferred from
the old manifest. Oracle sign-in waits for the user's phone MFA. The user already
authorized source-only TCP22 replacement `144.124.196.183/32 -> 144.124.199.147/32`;
it has **not been saved**. Browser Use is disabled and the six-run matrix is incomplete.

Local source `91887c2` includes safe read retries, interrupted-file recovery,
deferred 3D menu assets and abandoned Hangar cancellation, together with the
other chat's 30% resolution controls. Full tests 504/504 before the final scene
guard, final affected checks 57/57, build and content validation pass. Checked
code-only candidate `20261023-stability-01` is **prepared, not uploaded/deployed**.
No new production backup, drain, activation or finalization was performed; no
production data/env, ingress rule or image was changed. Do not label this work
published. See [resume steps, hashes and blockers](PUBLIC-STABILITY-20261023.md).

## Active cold-start release - 21 October, 13:28 Tashkent

23 October continuation: the new [render resolution control](RENDER-RESOLUTION-20261023.md)
is verified locally but **not published**. Public HTTPS/API/WebSocket/asset checks
still pass; SSH to the existing VM timed out. No access rules, production data or
running release were changed for this feature. Current VM state could not be
re-read over SSH; the finalized release details below are the last verified state.

**20261021-cold-start-01 is serving public HTTPS**, activated at
**2026-10-21T08:28:49.582Z**, from
`/opt/liftoff/releases/20261021-cold-start-01`. Source commit
**b124f5407d4d7dbd12d7a1021d1f58559a8aa023**; client
`index-7TSF7k3X.js`, SHA-256
`8763faa9ef0601327fce7d54ed9f52199ea698e7a44d86af84fa222f65cf21be`.
Protocol **13**, revision **2132caf43c0e38df**, admission **20**, $0 scope retained.
**Finalized at 2026-10-21T09:09:14.039Z (14:09 Tashkent)**.
`/opt/liftoff/current` now resolves to this release and both containers are healthy.

This update avoids retransmitting an already installed catalog (matching-revision
reply is 217 bytes), shows loading phases/MiB/files/elapsed time, and slices shader
preparation and WebGPU reflection work. WebGL retains native reflection capture
because the experimental staged image differed. No model, texture preset, physics
or aircraft was reduced for this patch.

VM build/content validation and **393 inventory hashes** pass. All **132 active
assets** remain byte-identical. Source canonical content is shared read-only for
builds from `/opt/liftoff/releases/20261020-optimization-01/content`; preserve that
source directory. Only the host-specific import-cache stamp file was regenerated.
The new release has its own real read-only runtime asset directory; immutable
files are hard-linked and old URLs/client bundles retained. No art was exported.
Running image:
`sha256:966b143765ebb965bf8b04240a5bd3f390f890cc7e5f3a80c309eae27f641b52`.

The isolated candidate passed API/WebSocket and two-client Pine Valley/The Green
races with a temporary database. Public HTTPS on both hostnames returns the exact
new client hash and compact catalog; administration endpoints remain 404. Public
API/WebSocket/asset HEAD/range/cache and the same two-client race checks also pass.
The old server was drained; no active races remained before recreation.

Direct canonical-URL Edge testing rejected an initially cached run. After actual
HTTP-cache clearing and optional encoded-cache deletion, all four required assets
showed positive network transfer in **three runs: 17.166 / 8.467 / 8.203 s** to
Ready; maximum startup long tasks **305 / 316 / 319 ms**. These are measured
attempts, not a controlled network-speed comparison with the earlier 128.3 s run.
First Low Hangar was ready within 2.304 s of its action marker (environment
transfer 1.570 s), with no long tasks >=50 ms. Repeated Home/Hangar/Settings
navigation also recorded none. First flight was ready within 4.324 s of the
action marker; keyboard throttle/pitch/yaw, pause and exit passed. The High Hangar
rendered with reflections and no console warnings/errors; High FPS is not accepted.

A valid 180 s WebGPU Low capture, real **1280x720**, adaptation off, with short
keyboard inputs and substantial stationary time: **77.22 mean FPS, 13 ms median,
1% low 75.16 FPS**, maximum 25.9 ms, zero frames >50 ms. This is not a standardized
flown route or a target-hardware proof. Peak 332,368 triangles exceeds the
provisional 300k Low budget; resident texture memory is unmeasured. ANGLE reports
Intel UHD D3D11 manually; the WebGPU adapter, tester's GTX 1650 and UHD 620 acceptance
remain unverified. Auto Low/65%/256px and original Acro were restored. Temporary
observers were removed and normal browser cache restored.

Fresh pre-update cloud backup was restored and integrity/rollback-write checked
**on the VM**: `/home/liftoff/pre-cold-cloud-20261021.sqlite`, SHA-256
`e2610c6417504e684843607755d112fe2ed19ff0e26fb97bdc86f79ed80c6b5c`.
Pre-update rows: users **4**, records **5**, achievements **4**, fleet **1**,
sessions **55**. Production env files and the existing `liftoff_game-data` volume
are retained. Post-update cloud copy was downloaded and independently restored
on the VM at `/home/liftoff/post-cold-cloud-20261021.sqlite`, SHA-256
`97c1a6acb43e6f7fdfa421322b4ea015980109697085fa83af995a268d35a877`.
All pre-update rows are preserved, including accounts/progress; sessions are
**59** after four public test guests. All non-session counts/digests are unchanged.
Comparison: `/home/liftoff/cold-post-player-rows-20261021.json`. Backup timer is
active with seven retained cloud copies. No player database was downloaded locally.

SSH was restored after the user's exact authorization and manual save of only
the existing TCP 22 source, **144.124.199.147/32 -> 144.124.196.183/32**; console
readback and SSH both pass. HTTP/HTTPS, ICMP and egress remain unchanged. Only
unused Docker build cache was removed, including the completed build's temporary
cache; all **18 images** and the running production containers were checked
unchanged during cleanup. The unused incoming directory and duplicate upload
archive were removed after verification; local checked runtime archive/manifest
remain. Final free disk: **1,896,611,840 bytes**. Sources, game assets, all images
and rollback are retained. Do not rerun completed staging/activation/finalization.

Immediate rollback directory/image, recorded in the new release's
`deploy/previous-release.txt`:
`/opt/liftoff/releases/20261020-optimization-01`,
`sha256:4854c169905e3ca485d678d4a8a372fdaa0739ea0d2313e703edaa1448e43f6d`.
See [direct cold diagnosis and evidence](COLD-GRAPHICS-20261021.md).

## Historical optimization release - 20 October, 02:47 Tashkent

**20261020-optimization-01 is deployed and finalized** at
**2026-10-19T21:47:10.466Z**. Current symlink and healthy running directory:
`/opt/liftoff/releases/20261020-optimization-01`. Published source commit
**f1477709fcc4617ec579cb00d298bb332fc36aa2**, verified on private origin/main.
Protocol **13**, revision **2132caf43c0e38df**, admission **20**, Always Free / $0.

Published changes include retained menu/map/drone resources, the menu light
invalidation repair, renderer pipeline preparation and WebGPU scenery instancing,
Pine's native tiled terrain, source rounded map/course collisions, camera follow
smoothing, varied faster AI hardware with unchanged tuning, and native Liftoff
slot/compatibility transforms in the existing Workbench. Separate action cameras
are prohibited on all five aircraft by the user's explicit choice. Gecko forces
no separate antenna; Luma exposes Soupape Micro. Source permission metadata and
the scope of the authorized multiplayer test remain unchanged; Ironworks stays
retired. Five maps, thirty routes, five drones, 42 parts and twelve lessons remain.

Verification: **483/483 full tests**, final local and VM builds/content checks,
and all **583 runtime inventory** hashes pass. Only the host-specific
`public/content/import-cache/files.json` was regenerated and recorded separately;
source, catalog, client and delivery hashes remain verified. All **132 active
assets / 1,789,800,866 bytes** pass public HEAD/Range/cache and GLB header checks.
Both HTTPS hostnames return the new revision and exact client SHA-256:
`9a21181080333991a9c9f964cc0e02040b79fa5e8007ff7190442a3816ce2bfc`.
Internal administration endpoints remain unavailable through public HTTPS.

An isolated candidate with a temporary database passed API/WebSocket and
two-client races on Pine Valley and The Green before activation. The same
two-client checks subsequently passed on the public server: different drones,
readiness before countdown, stale revision rejection, controller profiles,
authoritative movement and uninterrupted multiplayer during a pause request.
The old server was drained before recreation; no active races remained.
Actual public browser checks covered guest entry, Gecko camera/antenna filtering,
Luma's sole compatible antenna, existing Workbench, Hangar/Settings returns,
Pine free flight, visible tiled ground, pause and exit. No error-level browser
messages were captured. **Scene cleanup warnings about `usedTimes` did occur**
during the map transition; their renderer-resource cause remains unresolved.
See [public browser evidence](design/optimization-release-20261020/README.md).

Fresh off-VM cloud backups before/after publication were restored and verified
**on the VM**, including integrity and rollback-write probes. All pre-update
non-session rows are byte-for-byte preserved: users **4**, records **5**,
achievements **4**, replays **2**, weekly **1**, fleets **1**; career, owned parts,
freestyle and cups remain **0**. Original sessions remain, with **57 to 61** after
the four public guest test clients. No production database was downloaded or
replaced; the same `liftoff_game-data` volume and private env files are retained.
Seven cloud copies remain and the backup timer is active.

Pre-restore: `/home/liftoff/pre-optimization-cloud-20261020.sqlite`, SHA-256
`9db24e40e403db1df0650a16445f89044bbd089b372f83397e76434e11b63657`.
Post-restore: `/home/liftoff/post-optimization-cloud-20261020.sqlite`, SHA-256
`c34e6de91dab736b888fbf0d5b724cb2dde56db4f9ce8c1b61109dd53deed943`.
Row comparison: `/home/liftoff/optimization-post-player-rows-20261020.json`.

Running image:
`sha256:4854c169905e3ca485d678d4a8a372fdaa0739ea0d2313e703edaa1448e43f6d`.
Required read-only runtime asset mount:
`/opt/liftoff/releases/20261020-optimization-01/public/content/assets`
to `/app/public/content/assets:ro`. The new release contains its own complete
enabled canonical `content/`; it does not depend on an older canonical source
mount. Old immutable asset URLs are retained for cached clients. Preserve the
release directory. The explicit full-source incremental package uploaded only
changed files and reused verified immutable binaries; no art export was repeated.

Immediate rollback: `/opt/liftoff/releases/20261018-ui-performance-04`, image
`sha256:31ab39cbfedc3c977b5ba2e8ca7514f7b0c08eaa32851c35b952b95af0540c9a`.
The new `deploy/previous-release.txt` records this pair. Older release assets,
source directories and images remain. Only unused build cache older than a day,
six verified unmounted host `node_modules` directories and the verified temporary
upload were removed. Sources, assets, images and player data were not pruned.
Cleanup inventory: `/home/ubuntu/optimization-build-cache-cleanup-20261020.json`.
Final available VM disk: **530,223,104 bytes**; review space before another build.
Build dependencies used temporary RAM storage to avoid filling the root disk.

UHD 620 / 60 FPS, 100 players, full modern-art acceptance, lighter geometry LODs,
Green's remaining art and first-view GPU stalls are still unconfirmed/unresolved.
Publishing these improvements does not complete those acceptance items.
Continuation: [optimization](OPTIMIZATION-20261019.md) and the linked focused reports.

## Historical UI/performance release - 18 October, 22:11 Tashkent

**20261018-ui-performance-04 is deployed and finalized** at
**2026-10-18T17:11:13.765Z**. Current symlink and healthy running directory:
`/opt/liftoff/releases/20261018-ui-performance-04`. Published source commit
**a469168672489b585ccf7a0337313a48613a3e32**, pushed to private origin/main.
Protocol **13**, revision **c39594a402708803**, admission **20**, Always Free / $0.

The release includes the shared Back style, in-card download actions across
the map selections, fixed profile panel, help in Settings, Uzbek/Russian/English
with first-run choice, three real full HD Ultra loading frames, a separate rigid
camera, indexed GLTF lookup, retained inspection resources, shared draw batching
and native Pine foliage normal/roughness recovery. Original map geometry,
collisions, courses and flight parameters are preserved. Five maps, thirty
routes and twelve piloting lessons remain. Tuning education is still the separate
Hangar workshop proposal. Provenance and permission metadata are unchanged.

Verification: **443/443 full tests pass** in 342.7 seconds. Final local and VM
build/content checks pass; all **332 runtime inventory** hashes pass. Public
HTTPS/API/WebSocket, the old hostname alias and all **112 active assets /
1,767,131,882 bytes** pass HEAD/Range/cache checks. Two-client multiplayer passes
on Pine Valley and The Green. Public client SHA-256:
`e7da9bcf921fdf8541bc3fca189d2e32e2356eeb4fae8fb06ef22af1411c4b3e`.

Actual browser checks covered first-run language selection, live three-language
switches, unchanged guest identity, fixed profile dimensions, independent Pine
download through Downloaded, shared Flight School status, Pine free flight in
rigid/dynamic modes, and a visibly rendered cached Luma on repeated Hangar entry.
The final warm Minus Two/Luma check took **1,055 ms including browser calls**, at
1040×585, waiting for the actual `aria-busy` preparation state to clear, with
the model visually verified. This is not a target-hardware FPS test. No captured
game-console errors.
See [browser evidence](design/ui-performance-20261018/README.md).

The final cache repair restores a hidden model before measuring tabletop bounds;
the previous empty bounds produced an infinite position and a blank preview.
The full-scene Hangar compiler bypass is also removed. Intermediate -01 and -02
were published during verification; -03 was only a superseded local package,
never a VM release. Do not rerun completed staging/backup/finalization scripts.

Fresh cloud backups before/after each deployment restored and passed integrity
checks **on the VM**; no production database was downloaded or replaced.
All original player/progress rows remain: users 4, records 4, achievements 3,
replays 2, weekly 1, fleets 1; career/owned parts/freestyle/cups remain 0.
Sessions changed 45→57 across all three releases' guest tests (53→57 for -04).
Final pre-restore `/home/liftoff/pre-ui-performance-04-cloud-20261018.sqlite`:
`ed95c1e28281ecad52554dd91ba389d909a28ec1db3c79cd7c1d92efa867f626`.
Final post-restore `/home/liftoff/post-ui-performance-04-cloud-20261018.sqlite`:
`b0e4fa8f015bbaeb85042737a14901efda660a2c8b501a675f1ae977c8e5a950`.
Seven cloud copies / 4,308,992 bytes remain; backup timer active. Production envs,
the `liftoff_game-data` volume and all rollback images/directories are retained.

Running image:
`sha256:31ab39cbfedc3c977b5ba2e8ca7514f7b0c08eaa32851c35b952b95af0540c9a`.
Required read-only runtime asset mount:
`/opt/liftoff/releases/20261018-ui-performance-04/public/content/assets`
→ `/app/public/content/assets:ro`. It retains 113 immutable deliveries, including
the superseded Pine model for old clients. **Keep this asset directory.**
The code-only host build used
`/opt/liftoff/releases/20261018-ui-performance-01/content` at `/app/content:ro`.
**Keep -01's canonical sources for future builds**; -04 does not duplicate them.
Editable art and full sources remain in private Git/LFS. See
[incremental build rules](INCREMENTAL-ORACLE-BUILD.md).

Immediate rollback: `/opt/liftoff/releases/20261018-ui-performance-02`, image
`sha256:eb3ccdf703be7b35b3b45ed31ee47302abfc3c5abadd88bbe24ec444411d45e1`;
it retains the known cached-preview limitation repaired in -04. Earlier learning
and Hangar/Race releases/images remain. New release's `deploy/previous-release.txt`
contains the matching directory/image pair. Only verified duplicate uploads and
unmounted host npm build caches were removed. Final available VM disk:
**589,414,400 bytes**; review space before another build. No old assets/images
were pruned or rewritten.

UHD 620 / 60 FPS, 100 players and full modern-art acceptance remain unconfirmed.
Existing map LODs do not materially reduce geometry; both maps still exceed Low
budgets. Ultra cold GPU/shader preparation remains expensive. Native material
recovery improves identified foliage, not every original art limitation.
Continuation: [UI/performance report](UI-PERFORMANCE-20261018.md).

## Historical finalized learning and maps release - 18 October, 13:22 Tashkent

**20261018-learning-01 is deployed and finalized** at **2026-10-18T08:22:35.302Z**.
Current symlink and healthy running directory:
`/opt/liftoff/releases/20261018-learning-01`. Source commit
**e4826767728209ff2e6eaad1002471d8dd7c3469**, pushed to private origin/main.
Protocol **13**, revision **4274546e0bac3771**, multiplayer admission **20**.

The online catalog has **five maps, 30 routes, five drones and twelve piloting
lessons**: Pine Valley adds five native courses and The Green six, plus a
practice route and introductory lesson on each map. Seven new general lessons
cover hover, height, yaw, braking/landing, turns, narrow gates and initial Acro.
The current client also includes the previously local menu/download/fullscreen
changes. Tuning education remains the separate [Hangar workshop proposal](TUNING-LEARNING-PROPOSAL-20261018.md);
it has not been implemented or inserted into the piloting sequence. Liftoff
permission metadata is unchanged; this is the explicitly authorized online test.

Verification: full **397-test suite**, two additional authored-lap scenarios,
seven affected content tests and **12 deployment checks** pass (overlapping
counts, not a summed suite total). Local/candidate/VM builds and content checks
pass. All **645** staged inventory files matched SHA-256. Public HTTPS and the
old hostname alias pass health checks. All **112 assets / 1,763,690,874 bytes**
pass exact-size HEAD, Range, immutable cache and GLB magic checks; the public
client matches the local, staged and VM client SHA-256
`1f0726580147c9dd536e28dc1edc966c133e882037a48c7898f8d1ac4dadcf08`.
Two-client multiplayer passed on both new maps' first native courses, including
content readiness, profile validation, movement and pause handling.

Actual public IAB checks covered five cards with real game thumbnails, both
native course lists/lap counts, all twelve lessons over three pages, and The
Green lesson's target/speed/hold HUD. No captured game-console errors. See
[public screenshots](online-evidence-20261018/README.md). Earlier local browser
checks cover both maps, lesson HUDs, contacts, workshops and course tours at
fixed 1280×720 / Low / adaptive off. Both maps **exceed rendering budgets**;
UHD 620, 60 FPS, 100-player capacity and artistic acceptance remain unconfirmed.
See [measured map costs](NEW-MAPS-LOW-20261018.md).

Fresh before/after backups were uploaded to OCI, restored and integrity-tested
**on the VM**. Every original account/progress/replay/weekly/fleet row matched:
users 4, records 4, achievements 3, replays 2, weekly 1, fleets 1; career,
owned parts, freestyle and cups remain 0. Sessions increased 41→45 for tests.
No production database was downloaded or replaced. Pre-release restore
`/home/liftoff/pre-learning-cloud-20261018-03.sqlite` SHA-256
`7303df2883648fe56166e2b2ff690ec0ce0e9140f8ab9b268e25f790e0d43d69`;
post-release `/home/liftoff/post-learning-cloud-20261018.sqlite` SHA-256
`a325c8af3f33d5efb0c55c776cb388684e366dc48e551b185713f105e85a8597`.
OCI retains seven backups; the backup timer is active. Private env files and
`liftoff_game-data` are preserved. Always Free / $0 and admission 20 remain.

Running image: `sha256:5222a223f144c65a7ad08107d5e74436e7bba5a0ca225aa7d02b0ef269919fa4`.
Its **required read-only asset bind** is
`/opt/liftoff/releases/20261018-learning-01/public/content/assets` →
`/app/public/content/assets:ro`. Preserve that directory for restarts/rollback;
new assets are not embedded in image layers. See [incremental deployment](INCREMENTAL-ORACLE-BUILD.md).
Rollback directory: `/opt/liftoff/releases/20261016-hangar-race-01`;
image `sha256:39e4402a51bd83ec9d07a65326696640d4447361e05c8aa7cc9bb53cd349ed44`.
The matching two-line record is in the new release's
`deploy/previous-release.txt`. Do not prune rollback images or active assets.

The earlier full-asset image failed before activation because disk unpacking
needed more space. Only unused builder cache and hash-verified duplicate upload
payloads were removed; older release assets were not deduplicated or rewritten.
Automatic approval rejected raw-DB download and cross-release hardlink changes;
neither was performed. VM restore/row comparison and the new release's read-only
mount completed the work without those operations. Final free VM disk:
**2,960,285,696 bytes**. Do not repeat imports, successful backups, staging,
activation or finalization helpers. The non-sensitive finalized manifest is
retained locally at `data/liftoff-forest-green-20261018/learning-online-release-20261018.json`.

## Historical preparation: startup/download/fullscreen/HUD - 17 October

The verified local candidate `20261017-entry-01` (source `67ed9fc`) has **not
been uploaded or deployed**. The last public health/catalog checks on 17 October
returned the previous protocol 13 / revision `b68f2b229bf64134` / 80-asset baseline.
Browser fullscreen,
background-download navigation and HUD checks remain unfinished because the
browser tool reports disabled in Work. SSH timed out. The user authorized the
specific SSH-source rotation recorded in
[the continuation](ENTRY-DOWNLOAD-20261017.md#prepared-candidate-and-access-handoff),
but no Oracle rule, production env/database, container or current symlink has
been changed. Prepared deployment scripts require fresh backups and access;
they are not publication evidence.

The user subsequently selected dark compact UI concept A. Its authentication and
Downloads implementation passes local build and 18 focused tests, but browser
verification remains blocked. The staged entry-01 client predates this redesign:
retain it as reference and prepare a fresh candidate after browser acceptance.
Neither the selected redesign nor the preceding entry update is published.

## Finalized Hangar, account fleet, cameras and Race - 16 October, 00:54 Tashkent

**20261016-hangar-race-01 is deployed and finalized** at
`2026-10-15T19:54:53.768Z`. Current symlink and healthy running directory:
`/opt/liftoff/releases/20261016-hangar-race-01`. Source commit
**f51e38d865965cfac82144e0a6dfe265783b7f03**, pushed to private origin/main.
Protocol **13**, revision **b68f2b229bf64134**, admission **20**.

The release reduces repeated Hangar scene traversal/framing work, synchronizes
account aircraft copies and tuning across devices, guards failed initial cloud
merges, bounds inspection/chase/FPV cameras and uses authored FPV sockets. Home
shows the selected customized aircraft in a fixed flight pose. Ordinary solo
Race has three physical AI pilots without aircraft-to-aircraft forces; Time Trial
remains clock-only. Eleven battery lead arrangements and optional cosmetic
action cameras cover all five aircraft. Editable Blender source and provenance
are retained. Existing contact/launch and map UV repairs remain included.
Details: [integration](HANGAR-ACCOUNT-RACE-20261015.md),
[AI](RACE-AI-20261015.md), [aircraft details](DRONE-DETAIL-20261015.md).

Verification: canonical suite **311 passed, zero failures/skips**, independent
local/candidate/VM build and content checks. Isolated VM container with a
temporary database verified two account sessions, accessory/tuning sync,
stale-write rejection and persistence after restart. Public HTTPS/alias health,
private-route protection, all **80 assets / 904,599,026 bytes**, immutable cache,
native ranges and two-client WebSocket readiness/controls/movement passed.
Public client SHA-256 matched both independent local dist and VM dist:
`7151ebebaa6b5271e99199b1a8231383098dd0239896c3f5d87b9e3bb9c0336a`.
Production dependency audit: zero vulnerabilities; build-time dependency
warnings remain separate. Actual in-app browser checked Race startup/HUD with
three AI, Luma action-camera save/use, Hangar orbit/zoom and the customized home
composition, with no captured client errors. [Screenshots](online-evidence-20261016/README.md)
are functional proof, not hardware or artistic acceptance.

Initial delta: 52 changed, 434 reused, zero removed files; archive 21,398,802 bytes,
SHA-256 `f88d6d7be16906c1d1c82ec305d97c4f63b915c1901e6fd40ac021d1238cd07d`.
A 29,666-byte deployment supplement added the strict incremental-image helper;
final **488 inventory files** verified. The build regenerated only the absolute
path/fingerprint index `public/content/import-cache/files.json`; original and
built hashes are recorded separately in RELEASE.json. All 76 reused delivery
assets matched SHA-256 against the previous image; four new deliveries total
6,493,791 bytes. The complete public directory remains mounted by Caddy.

The first full Docker build ran out of temporary disk before drain/activation.
Only unused Docker build cache was pruned; previous running/rollback images,
release directories and volumes were preserved. The verified
[optional incremental build](INCREMENTAL-ORACLE-BUILD.md) used a 17.70 MB context,
unchanged lock/runtime dependencies and the exact retained base image. Drain
completed with zero active rooms, env files stayed byte-identical and volume
`liftoff_game-data` was retained. New running image:
`sha256:39e4402a51bd83ec9d07a65326696640d4447361e05c8aa7cc9bb53cd349ed44`.
Rollback directory **20261015-contacts-01** and image
`sha256:8928a35e269a66a9497e44a085c65e68f72f98c9866feba7f6eb095cb5adb9a5`
are retained in `deploy/previous-release.txt`. Rollback was not executed.
Disk has **3.3 GiB free** after publication; do not repeat a full build without
checking temporary capacity. No paid resources or admission increase.

Fresh OCI cloud copies were downloaded and independently restored on the VM
and locally before and after update. Pre SHA-256:
`760c67f516d513b1ae549711ae6d79538d09b9d5bd5b5ef56e681a963e44a617`;
post SHA-256:
`d7656d585ffb13c5c558416da9e9813de7d7a79316e0809646d04a3f722b478f`.
Every original row matched exactly: users 4, records 4, career 0, achievements 3,
owned_parts 0, replays 2, weekly_records 1, freestyle/cup scores 0, cloud fleets 1.
Sessions 37 to 39 during guest testing. Backup timer active, seven-copy retention
and $0 budget preserved. No local player database was uploaded.

Remaining limits: occasional Hangar long frames, UHD 620/4 GB acceptance,
all aircraft/part combinations, exhaustive manual camera paths, artistic
acceptance and 100-player capacity remain unconfirmed. Imported content remains
within the existing online-test authorization; its origin was not disguised.
Next delta baseline: ignored `data/hangar-race-online-release-20261016.json`.
Do not repeat completed exports, staging, backups, deployment or finalization.

## Finalized contact solver update - 16 October, 00:01 Tashkent

**20261015-contacts-01 is deployed and finalized** at
`2026-10-15T19:01:04.536Z`. Current symlink and healthy running directory:
`/opt/liftoff/releases/20261015-contacts-01`. Source commit
**6a9e1beb70e7942be59222edd2355fb270d3dcdd** is pushed to private origin/main.
Protocol **13**, revision **91a4b5db45d47a74**, admission **20**.

The release replaces heuristic ground leveling/braking with coupled contact
impulses, uses native rotor lever arms and lets disabled rigid bodies fall.
See [physical contact report](PHYSICAL-CONTACTS-20261015.md) for behavior,
research and remaining fidelity limits. This isolated source snapshot includes
committed account-fleet sync bf3c2b3; later camera/Hangar/fleet and AI work in
other chats is outside this release. Do not equate current Git HEAD with the
published source commit.

Verification: isolated suite 267 passed, one optional source-cache UV fixture
skipped; all 32 affected physics regressions passed locally and on the VM.
Candidate/VM build and content checks, public HTTPS/health/WebSocket, all 76
assets (898,105,235 bytes), native range/cache checks and two-client multiplayer
passed. Actual Chrome protocol-13 client started Minus Two solo free flight,
rendered the scene and returned to main menu. The [new screenshot](physics-evidence-20261015/README.md)
proves startup/rendering only; no FHD audit, hardware benchmark or physical
calibration is inferred. Public client bytes matched the independently built VM
dist. Production dependency audit: zero vulnerabilities.

Delta: 13 changed files, 448 reused, zero removed; all 461 inventory files
verified. Archive: 124,037 bytes, SHA-256
`f6c3faa870fdaf69e78f8391e26ecd8ae686f053e73a81b3e78cfd40cfef4f84`.
Both env files were preserved byte-for-byte, active rooms drained to zero,
production volume `liftoff_game-data` retained. Running image:
`sha256:8928a35e269a66a9497e44a085c65e68f72f98c9866feba7f6eb095cb5adb9a5`.
Rollback: physics-01 directory and image
`sha256:8a7e456ffdaa273fbfa9e960dd98cc5cd18729d12e11b62b9be2936b63fe0efc`.

Independent OCI cloud restores passed on the VM and locally before and after
publication. Pre SHA-256:
`e2148579a874160b58260dc959eb4df1e81c65c845b3e30708ea8c6311367cc5`.
Post SHA-256:
`760c67f516d513b1ae549711ae6d79538d09b9d5bd5b5ef56e681a963e44a617`.
Full unchanged row comparison: users 4, records 4, career 0, achievements 3,
owned_parts 0, replays 2, weekly_records 1, freestyle_scores 0, cup_scores 0.
The additive drone_fleets table was absent before; after the browser check it
contains one normalized fleet for an existing account, with a valid revision.
Original account/build rows stayed byte-for-byte equivalent. Sessions 35 to 37.
Backup timer active; no player database replacement or production volume removal.

The user approved both exact SSH source rotations as egress changed. Final
saved source **144.124.199.191/32**, TCP **22**, checked in Oracle Console and
by renewed SSH. HTTP/HTTPS, ICMP and egress rules stayed unchanged. Only unused
Docker build cache was pruned; images, release directories and volumes retained.
Post-publication cache cleanup reclaimed 6.037 GB; disk had 6.5 GiB free, and
both running and rollback image IDs were rechecked afterwards.
Always Free/$0 and 20-player admission preserved. UHD 620, total 4 GB memory,
measured real-aircraft fidelity and 100-player capacity remain unconfirmed.

Next delta baseline: ignored `data/contacts-online-release-20261015.json`.
Do not repeat this release's staging, deployment, backups or finalizer. Retain
its reviewed scripts/reports under ignored data/ for diagnostic reference.

## Finalized physics update - 15 October, 12:54 Tashkent

**20261015-physics-01 is deployed and finalized** at
`2026-10-15T07:54:35.046Z`. Current symlink and healthy running directory:
`/opt/liftoff/releases/20261015-physics-01`. Source commit
`0e99c4e84262641bedb2b7b6a5eba3ba9c4d6b1a`, protocol **12**, revision
**91a4b5db45d47a74**. Public HTTPS/health/WebSocket, all 76 assets,
two-client movement, Chrome flight startup and seven deployed physics tests
passed. Full local suite: 255 passed. Local, isolated candidate and VM builds
and content checks passed. See [initial physics audit](PHYSICS-AUDIT-20261015.md).

The delta changed 4 files and reused 453; all 457 inventory files were verified.
Archive 62,323 bytes, SHA-256
`56d3074c8b0f0b2b955ff07e8f7ef1f65527403755669bececf6ce6ed1062287`.
Production and backup env were preserved byte-for-byte. Running image:
`sha256:8a7e456ffdaa273fbfa9e960dd98cc5cd18729d12e11b62b9be2936b63fe0efc`.
Rollback loading-01 image:
`sha256:9c8f3cdca63d6a31f6bf6f3101e6204cf11a889070a8931559b53db07a957923`.

Independent OCI cloud restores passed on the VM and locally before and after
publication. Pre SHA-256:
`010f08904d0ed5e56a88c1c65edd232ed4cdb827346c9980cfbe3bf4d7128633`.
Post SHA-256:
`e2148579a874160b58260dc959eb4df1e81c65c845b3e30708ea8c6311367cc5`.
Original rows preserved: users 4, records 4, career 0, achievements 3,
owned_parts 0; sessions 33 to 35 after browser checks. Backup timer active;
production volume liftoff_game-data, admission 20 and Always Free preserved.
Runtime audit: zero vulnerabilities; four existing high development-tool
findings remain. Public client bytes matched the independently built VM dist.

The earlier approval-service usage failure is resolved and finalization completed.
Do not repeat this release's deployment/backups/finalizer. Next delta baseline:
ignored `data/physics-online-release-20261015.json`.

## Previous finalized release - 15 October, 08:18 Tashkent

**20261015-loading-01 is deployed and verified**, finalized at
`2026-10-15T03:18:31.839Z`. Current symlink and healthy running directory:
`/opt/liftoff/releases/20261015-loading-01`. Source commit
**7155fdd780448425992d8ee3cb42254387b95518**, pushed with matching remote SHA.
It retains the previous flight/collision/atlas and general UI repairs.

Protocol **11**, revision **91a4b5db45d47a74**: 3 maps / 17 routes / 5 aircraft /
36 parts / **76 delivery assets, 898,105,235 bytes**. Five saved stock-drone
thumbnails are added; all previous delivery assets remain byte-for-byte.
Imported-content provenance and user-authorized online-test scope remain;
Ironworks stays retired.

Map-card selection retains the loaded menu scene. Hangar inspection uses one
close LOD, retains one hidden preview on return and swaps only changed component
categories. Parsed idle models have a bounded memory cache. Auto uses GPU
identity and ignores stale Auto fields; loading/menu frame times cannot reduce
flight resolution. Replay listings read metadata, v1 flights migrate intact,
and playback waits for assets/graphics. Replay scene blur is removed.
[Repair and limits](LOADING-REPAIR-20261015.md),
[five actual FHD UI captures](loading-repair-evidence-20261015/README.md).

Verified: **248 tests**, root and independent candidate production build/content
checks; VM build/content checks; HTTPS, health, WebSocket, all 76 asset sizes/cache
headers, native ranges, protected paths and alias health. Public two-client
Gecko/Dquad readiness, acknowledged controller input, authoritative movement
and multiplayer pause behavior passed. Actual public Chrome checks passed:
Auto **High / 100%**, five saved stock images, warm Hangar return without busy
state, map-card selection without scene loading, browser flight, replay save/open,
seek, speed and FPV/Chase rendering. Local replay survived page reload.

The **387,420-byte** delta changed 27 files and reused 430. All **457** source
inventory files were checksum-verified on VM. Archive SHA-256:
`4eebd3cf45486e15590f33c7be9d3a28f264532cdd21007aefa319b286150962`.
Server/backup env matched byte-for-byte. The standard deployment retained the
rollback image, built, drained active races and waited for healthy containers.
Public checks and independent backup restores preceded the final symlink switch.

Fresh before/after private cloud downloads restored on VM and locally. Every
original users (4), records (4), career (0), achievements (3), owned_parts (0)
row matched exactly. Sessions increased **31 → 33** during guest verification.

- Before: `b7128e9bbe458593445fcc4452c65f062cce88b81699429de64cc98744e2b1b0`.
- After: `10d2a771792a47921be7cce80ec40d68c7159a665868e78681d62c8d57419591`.
- Restore copies: `/home/liftoff/pre-loading-cloud-20261015.sqlite` and
  `/home/liftoff/post-loading-cloud-20261015.sqlite`; matching ignored local
  copies and `data/loading-online-release-20261015.json` remain. Backup timer
  active; retention seven.
- Running image: `sha256:9c8f3cdca63d6a31f6bf6f3101e6204cf11a889070a8931559b53db07a957923`.
- Rollback directory: `/opt/liftoff/releases/20261015-flight-01`; retained image
  `sha256:f1b538e00e14de2dc293923e25c6688cc72924c9100569ba1c953f162867061a`.
  Use current `deploy/previous-release.txt`; no rollback performed.

Production volume **liftoff_game-data**, accounts/progress, admission **20**,
domains, network rules and $0/Always Free scope are preserved. Runtime audit:
zero vulnerabilities; four existing high findings remain in build dependencies.
Disk had approximately **5.6 GiB free** after finalization. First uncached assets
still need download/decode/GPU setup; idle-cache limits are not a total RAM cap.
Total RAM on a 4 GB PC, UHD 620 FPS, 100-player capacity and manufacturer-calibrated
handling remain unconfirmed. Browser-tool keyboard holds are excluded from input
acceptance. Reload an already open game tab to use this client repair.

## Previous release - 15 October, 03:21 Tashkent

**20261015-flight-01 was deployed and verified; now retained for rollback**, finalized at
`2026-10-14T22:21:59.324Z`. Current symlink and healthy running Compose directory:
`/opt/liftoff/releases/20261015-flight-01`. Source commit **a66ebac** includes
the separate collision (`64fa748`) and grounded launch (`e5c77c0`) repairs.
The verified UI from `20261015-ui-01` is preserved.

Protocol **11**, revision **4d221c5be747e24c**: 3 maps / 17 routes / 5 aircraft /
36 parts / **71 delivery assets, 898,065,411 bytes**. Primary UV0 is repaired
in all three map and fourteen native-course Blender sources and deliveries.
The saved materials, lighting, collision assets and source permission metadata
remain. Ironworks stays retired; no new extraction or distribution authorization.

Verified: **241 tests**, root and independent candidate build/content validation,
1,516/1,516 compressed source-atlas comparisons, unchanged texture bindings,
alpha modes and geometry counts in seventeen deliveries. Public HTTPS, health,
WebSocket, all 71 asset sizes/cache headers, ranges and private-path closure
passed. Real two-client readiness/controller/authority checks passed on all
three public maps. A further live authoritative test settled Kestrel and Luma,
then used 50% throttle plus full pitch during launch: height gains **2.16 m**
and **2.37 m**, neither crashed. Browser guest entry and Low flight/rendering
passed; in-app key-hold delivery is excluded from public keyboard acceptance.
[Repair details](FLIGHT-UV-REPAIR-20261015.md),
[actual UV/game evidence](flight-uv-evidence-20261015/README.md).

The reviewed delta changed 54 files and reused 391; all **445** reconstructed
source files were checksum-verified on VM. Archive **1,034,701,731 bytes**,
SHA-256 `cfd40780033ad7606c6d9832e453675975eac4b24361f948008d63ef304c0ee0`.
Production/backup env matched byte-for-byte; the standard deploy retained a
rollback image, built, drained races and waited for healthy game/Caddy before
public checks and the final current-symlink switch.

Fresh private cloud downloads restored on VM and locally. All original rows
in users (4), records (4), career (0), achievements (3), owned_parts (0) matched
exactly. Sessions increased **21 → 31** during guest verification.

- Before: `25e94aa8dfd16dd75475275e4f1ff8f49227c81d4e63f3d6894d0f6b51935890`.
- Final after: `b7128e9bbe458593445fcc4452c65f062cce88b81699429de64cc98744e2b1b0`.
- Restore copies: `/home/liftoff/pre-flight-cloud-20261015.sqlite` and
  `/home/liftoff/post-flight-final-cloud-20261015.sqlite`; matching ignored
  local copies remain in `data/`. Backup timer active; retention seven.
- Running image: `sha256:f1b538e00e14de2dc293923e25c6688cc72924c9100569ba1c953f162867061a`.
- Rollback: `/opt/liftoff/releases/20261015-ui-01`, image
  `sha256:7efeaeb3bdeda324a5bc74dab132cf8eff8b585834f5e0e10878f782e663030a`.
  Use the current release's `deploy/previous-release.txt`. No rollback performed.

Volume **liftoff_game-data**, account/progress data, admission **20**, existing
domains, SSH/network rules and $0/Always Free scope are preserved. Disk had
approximately 11 GiB free after image export. UHD 620 FPS, 100-player capacity,
manufacturer-calibrated handling, complete native courses and final artistic
acceptance remain unconfirmed; triplanar/world-space shader approximations remain.
Old protocol-10 browser clients should reload to use the repaired release.

## Previous release - 15 October, 02:31 Tashkent

**20261015-ui-01 was deployed and verified; now retained for rollback**, publication timestamp
`2026-10-14T21:31:42.954Z`. At that publication, symlink and running Compose directory:
`/opt/liftoff/releases/20261015-ui-01`. Client source commit:
`befc562886ad7ab2120bf8140f9ff2ff87b2accb` (pushed, remote SHA matched).

The user's UI/UX research request was clarified as a request to improve the
general interface. This release applies consistent panels/buttons, larger
supporting text, compact component choices, centered lobby/results and
settings that use the available height. Local and public browser screenshots
verify the visible result: [comparison and report](design/ui-polish-20261015/README.md).
There are 19 new FHD frames and five 1280×720 layout checks. Windows 150%
was preserved; actual viewport and output image sizes were checked.

Protocol **10**, revision **9a0ff4f715bbd733**, 3 maps / 17 routes / 5 drones /
36 parts / **71 delivery assets / 885,897,947 bytes** remain unchanged.
The **94,532-byte** UI delta reused the previous content. Archive SHA-256:
`ce40546cd8e92e3b1fa8dafe7a23bc2c28e18767fc136f7f0ef061d9241d5b86`.
All **447 source inventory files** were verified before deployment; production
and backup env were copied and compared byte-for-byte. The standard script
built/validated, retained the previous image, drained active sessions and
waited for healthy containers. Public checks and backup verification preceded
the final `current` switch.

Passed: local and independent staged builds/content checks, 21 affected menu
tests; public HTTPS/health/WebSocket, active new CSS, all 71 asset sizes/cache
headers, native GLB ranges, private-path protection and admission **20**.
Gecko/Dquad two-client smoke passed authoritative movement, preparation,
controller acknowledgement, stale-content rejection and continued multiplayer
during pause. Public browser checks covered the home, graphics and native
Workbench. A real local timed freestyle session reached the improved results.

- Running image: `sha256:7efeaeb3bdeda324a5bc74dab132cf8eff8b585834f5e0e10878f782e663030a`.
- Production volume: **liftoff_game-data**, preserved. Runtime dependency audit: zero vulnerabilities.
- Immediate rollback: `/opt/liftoff/releases/20261015-native-01`, retained image
  `sha256:a8deac87ab80c678ba82fdb05496b03394274a7dc7311e84a8b0cbcab7534e98`.
  Use this release's `deploy/previous-release.txt`; no rollback was needed.
- Fresh independent before/after cloud verification copies:
  `/home/liftoff/pre-ui-cloud-20261015.sqlite` and
  `/home/liftoff/post-ui-cloud-20261015.sqlite`, also retained locally under
  ignored `data/`. Both restored successfully on VM and locally. Their SHA-256
  is `7ed7d2698db11a29b15b6fb0d1f1f3183cc62ac1acc04845fd7c5b8490f6506b`.
  No persistent player rows changed during the UI update: users 4, records 4,
  career 0, achievements 3, owned_parts 0; all original row values matched.
- Backup timer active; private bucket retention seven. No paid resources,
  network-rule changes or admission increase in this UI release.

UHD 620 performance, 100-player capacity, manufacturer-calibrated handling
and final artistic approval remain unconfirmed. Native content retains its
existing provenance and unconfirmed redistribution permission metadata.

## Previous release - 15 October, 01:55 Tashkent

**20261015-native-01 was deployed and verified; now retained for rollback.** Publication timestamp:
`2026-10-14T20:55:24.333Z` (15 October, 01:55 local). At that publication, symlink and
running Compose directory were `/opt/liftoff/releases/20261015-native-01`.
Protocol **10**, revision **9a0ff4f715bbd733**: 3 maps, 17 routes, 5 aircraft,
36 component records, **71 delivery assets / 885,897,947 bytes**. Gecko 3-inch
and Dquad Addiction and their native variants are included in the user's
authorized online multiplayer test. Permission/provenance metadata remains;
redistribution rights are not asserted. Ironworks stays retired.

The final client includes loading/environment reuse, hardware-dependent
physics, pilot labels and live chat. Browser QA found inactive overlay CSS;
the active entry/import fix is `3d4f349`, independently built/content-validated
and live-verified. Full suite: 235 passed; ten affected overlay/loading/menu
checks passed after that fix. Canonical content/Blender sources stay in Git LFS.

The already uploaded 197,744,421-byte native delta was reused; only a **72,292
byte overlay** was added, SHA-256
`002f5e3000102fd89b223f19abcea1588f5297c5e07f4155b1a167ef9d74d324`.
All **445 source files** were checked when reconstructing the final release.
Production and backup env compared byte-for-byte unchanged. Standard deploy
retained the previous image, built/content-checked, drained rides and waited
for both containers to become healthy before public checks and current switch.

Verified: public HTTPS/API/WebSocket, all 71 asset HEAD sizes/cache headers,
native GLB ranges, all prior map deliveries retained, private internal/editor
paths closed, and admission **20**. Gecko/Dquad two-client smoke passed content
mismatch rejection, readiness, controller acknowledgement, authoritative
movement and multiplayer continuing during pause. Two real browser guests
through the main domain and old alias verified native selection, saving a
motor change, room readiness, chat in both directions and full results.
Local two-browser checks additionally verified labels, fade/clipping/departure,
Enter/Escape chat behavior and both aircraft moving on Low at 1280×720.
The screenshots distinguish local evidence from published evidence.

Fresh before/after production backups were uploaded, independently downloaded
from the private bucket and restore-tested on VM and locally. All original
rows in users (4), records (4), career (0), achievements (3), owned_parts (0)
matched exactly. Session rows rose from 16 to 18 during verification.

- Before SHA-256: `4a0a661dc9a02278b6f936ae27632afda8d6eded00fa73100ea240a9c27ac633`.
- After SHA-256: `7ed7d2698db11a29b15b6fb0d1f1f3183cc62ac1acc04845fd7c5b8490f6506b`.
- VM verification copies: `/home/liftoff/pre-native-cloud-20261015.sqlite`
  and `/home/liftoff/post-native-cloud-20261015.sqlite`; ignored local copies
  have the same names under `data/`. Backup timer active, retention seven.
- Running image: `sha256:a8deac87ab80c678ba82fdb05496b03394274a7dc7311e84a8b0cbcab7534e98`;
  volume **liftoff_game-data** unchanged. Production dependency audit: zero vulnerabilities.
- Rollback: `/opt/liftoff/releases/20261013-parvoz-01`, image
  `sha256:0ac2594786edc4b63d2e183e77c3ac142827adf242065b8aedf3eeaf93b200f7`;
  retained and inspected. Use the final release's `deploy/previous-release.txt`.
  No rollback was needed or performed.
- With explicit action-time approval, Oracle's existing TCP 22 source was
  replaced from `144.124.196.42/32` to **144.124.199.191/32**. The exact saved
  row and subsequent SSH were verified. TCP 80/443, ICMP and egress rules remain
  as before. No paid resources or capacity increase.

Evidence/review: [UI audit](design/ui-audit-20261014/REVIEW.md) and
[current continuation](UI-NATIVE-CONTINUATION-20261015.md). UHD 620, 100 players,
manufacturer-calibrated handling and final artistic approval remain unconfirmed.

## October 14 preparation history (superseded by the release above)

Local candidate, 14 October: `20261014-native-01`, protocol 10, revision
`9a0ff4f715bbd733` independently builds and validates; 235 regression tests
pass. It includes Gecko/Dquad/native parts, loading reuse and multiplayer UI.
It is **not deployed**. SSH timed out; ipify returned 195.158.3.42, differing
from the recorded approved source below. No ingress change, production DB/env
change or fresh deployment backup was performed. Public catalog still returned
protocol 9 / revision 4233a00856896de1; `/api/rooms` returned limit 20 and no
rooms. A complete read-only public-check attempt timed out, so no new full
release verification is asserted. Remaining browser/access/deployment work:
[UI-NATIVE-CONTINUATION-20261014.md](UI-NATIVE-CONTINUATION-20261014.md).

Later reconnection on 14 October restored SSH from the previously allowed
144.124.196.42, with no ingress changes. Current symlink remains parvoz-01.
Fresh production backup/cloud download and independent restores passed on the
VM and locally: users 4, records 4, career 0, sessions 16, achievements 3,
owned parts 0; SHA-256
`4a0a661dc9a02278b6f936ae27632afda8d6eded00fa73100ea240a9c27ac633`.
Backup timer active, activeRooms 0, 14 GiB free. The reviewed native delta and
reconstruction script are uploaded, but reconstruction/activation have not
run. Browser acceptance remains unfinished because automatic approval review
hit the account usage limit. Production DB/env and admission 20 are unchanged.

- Oracle home region: Riyadh (`me-riyadh-1`), `drone-liftoff`, Ubuntu 24.04 Minimal ARM64, A1 Flex 2 OCPU / 12 GB, default boot volume.
- Ephemeral public IPv4: `84.8.106.32`. DuckDNS A record resolves to this address. If the address changes, update DuckDNS before expecting the game to be reachable.
- Oracle ingress: TCP 80/443 from everyone; TCP 22 source changed from **195.158.6.35/32** to **144.124.196.42/32** with explicit action-time approval on 13 October. Save was submitted, then the console session expired. Subsequent SSH succeeded from `144.124.196.42`; this is functional access verification, not a post-save console-row readback. Existing ICMP rules and private port 2567 remain unchanged.
- Docker, Compose, host Node 24 and OCI CLI installed from official sources; game and Caddy run with restart policies. Initial admission limit: **20**.
- Running game/Caddy release: `/opt/liftoff/releases/20261013-parvoz-01`; `/opt/liftoff/current` points there, verified by SSH readback. Game image: `sha256:0ac2594786edc4b63d2e183e77c3ac142827adf242065b8aedf3eeaf93b200f7`. Database volume remains `liftoff_game-data`.
- Caddy serves hashed assets and proxies secure WebSockets. `/api/internal/status` and `/editor/` return 404 after a verified routing correction.

## Parvoz rebrand release - 13 October, 18:02 UTC

Release `20261013-parvoz-01` is verified online. Browser title, menu wordmark,
download names and server log use **Parvoz Drone Simulator / PARVOZ**. The P
monogram is temporary; final graphic identity remains unselected. Protocol **9**
and revision **4233a00856896de1** are unchanged. The code-only archive was
**118,447 bytes**, SHA-256
`294b3dc76a08d8dde81afe1227c5287f11ad042f84c52f0a774506c0fbf59283`.
All **359** baseline/delta files were verified on the VM; all **55 delivery
assets / 814,088,978 bytes** were reused without reupload or art exports.

DuckDNS registration and DNS lookup verified the new A record at `84.8.106.32`.
Only GAME_DOMAIN changed in the copied production env, to the quoted two-host
list; all other production settings and backup env compare unchanged. Caddy
validation passed. The standard deployment built/content-checked the new release,
drained races and launched healthy containers while retaining the production
volume. No local player database was uploaded.

Both HTTPS origins passed health/API/WebSocket/HEAD/range/cache checks. All 55
assets passed exact length/cache checks; catalog matches the previous delivery
inventory. Admission remains **20**; internal status and editor paths return 404.
Unknown non-API paths such as `/deploy/production.env` return the public SPA
shell, not private file content. Two-client guest race smoke passed controller
and asset readiness, stale-content rejection, input acknowledgments and
authoritative movement. Browser verified guest access, PARVOZ menu, Minus Two
Free Flight/HUD and return to menu, with no captured errors. First load at the
new origin downloaded **62.7 MB**; this was not a bandwidth or FPS acceptance
measurement. Proofs: `data/parvoz-live-menu-20261013.jpg` and
`data/parvoz-live-flight-20261013.jpg`.

Fresh pre/post backups were uploaded, independently downloaded from the private
bucket and restored both on the VM and locally. Every pre-update row in users
**3**, records **4**, career **0**, achievements **3** and owned parts **0**
matches exactly. Guest sessions changed **9 → 12** during testing. SHA-256:

- Before: `97f1033be73ffc52be19ea8b313a6bfe0a99d159dd94b41de8fc8e40d0829137`.
- After: `08a02e28ffe86f949e0d70f47a20dc2b719bad1d5a857c02fd0d9475f452b9ae`.

Finalization detected that the old untagged image ID `69afe413…` was unavailable
after replacement. The retained scene-02 sources rebuilt the previous release
under **liftoff-game:rollback-scene-02**, image
`sha256:b60836596eb51574d409e06fd473ad41c918dd407e607d4e8fa6dc8a5f1b1e30`.
An isolated container with separate temporary data and no external network
verified its health, Vector FPV title, protocol/revision, three maps, 55 assets
and admission 20. No production rollback was executed. The new release's
`deploy/previous-release.txt` now names that valid image and scene-02 directory;
the original record is retained as `previous-release-original.txt`. Local deploy
tooling now pins the previous image before rebuilding; two regression scenarios
and Bash syntax passed, committed/pushed as `bbcf200`.

Only after public, player-data and rollback checks was `current` switched and
read back. Release status is `deployed-online-test`; backup timer remains active,
seven-copy retention and $0 resources unchanged. Old-origin browser settings,
replays and sessions remain accessible through the alias; use local backup
export/import to transfer browser data. Account progress uses the same server
database. Liftoff permission metadata and Ironworks retirement are unchanged.

## Scene repair release - 13 October, 10:31 UTC

Release `20261013-scene-02`, protocol **9**, content revision **4233a00856896de1**, was deployed and is now retained for rollback. Free Flight excludes course models/gates/collisions; all three maps have their native human, bonus-box and static-drone placeholders removed across LODs. Luma follows its authored battery socket. Workshop props rest on ray-tested tabletop surfaces. Inspection zoom is bounded; Workbench exposes Flight performance and Specifications clearly. See [SCENE-REPAIR-20261013.md](SCENE-REPAIR-20261013.md).

Local verification: 217 tests, build/content validation, all-map marker/collision/material audits, exported workshop contact checks and two-client race smoke. Public verification: HTTPS/health/WebSocket/HEAD/range/cache, all **55 assets / 814,088,978 bytes**, protocol/revision, private paths returning 404, two-client race with authoritative movement, admission limit **20**, and Low browser inspection of Luma/Workbench/performance dialog and Free Flight map switching. No browser console errors were captured. Native map geometry and verified KTX2/material parameters were preserved apart from removed placeholders. UHD 620 and full-course artistic acceptance remain unconfirmed.

The new directory was built and launched through `deploy/deploy.sh`, which drained before replacement. Production env files were copied and compared unchanged. The existing data volume was retained. Previous directory `/opt/liftoff/releases/20261013-test-01` and image `sha256:60ca675feac729e1068cb3054d4e51fefb20be850e5c52f4093987bdbb9c6dcf` remain for rollback. Only after public checks was `current` switched and read back; backup timer remains active.

Fresh backups before and after deployment were uploaded, downloaded from the private bucket and independently restored. Users **3**, records **4**, career **0**, achievements **3**, owned parts **0**: all pre-update rows match exactly. Guest session count changed from 11 to 13 during the multiplayer smoke; these are not progress changes. Seven dated cloud copies remain configured. Verified backup SHA-256:

- Before: `eceec62a61c70e929cc871921570567a94133472392afa5c9d7a50003dd68e97`.
- After: `66145087a675a3f9ba6364785a6952b94f323ce299369d3bf5a2351e9b3daa09`.

The user-authorized Liftoff multiplayer-test scope and permission metadata are unchanged. Ironworks remains retired. No paid resources, admission increase or production database replacement occurred.

## Earlier online multiplayer test - 13 October

The user explicitly authorized publishing the existing Liftoff maps, drones and workshop resources for multiplayer tests. Provenance and permission metadata are preserved; no redistribution license is asserted. No further extraction or commercial release is included. Ironworks v2 and the twelve older generated maps are absent from this release; their archives and the previous VM release remain available.

- Release `/opt/liftoff/releases/20261013-test-01`, protocol **8**, content revision **2c857663aa68a02c**: Minus Two, Hangar C03, Arena; **17 routes, 6 drones, 15 parts, 3 missions, 3 tutorials**. Includes the current menu/rebrand, native checkpoints, workshop, loading, UV, battery and Kestrel orientation repairs.
- Independently staged build and content validation passed. The previously completed source suite passed **209/209**; deployment introduced no new game source edits. The obsolete 10 October candidate and the superseded licensed-only 13 October candidate were not deployed.
- Uploaded archive SHA-256 `183a62dea0534182c0c1ef7c3b09c480cd721d47b923cc36cec3473015f0df6e`; every staged file hash verified on the VM. Env files copied and compared unchanged. `deploy/deploy.sh` built a new image, drained races and launched healthy containers, keeping the existing database volume.
- Public health, WebSocket upgrade, asset HEAD/range/cache and decoder routes passed. All **55 unique delivery files**, **814,417,416 bytes**, passed exact HEAD length/cache checks. Private/internal/editor routes return 404. Admission remains **20**, Always Free resources and $0 budget unchanged.
- Real public two-client guest smoke passed: different drones/colors, stale revision rejection, controller/asset readiness, start/countdown, input acknowledgments and authoritative movement. Browser verified the new title, imported garage/Luma Workbench and actual Minus Two solo launch/HUD without captured console errors. Low settings were checked at a genuine **1280x720 framebuffer with adaptation off**; original Auto settings restored. This was a visual smoke check, not a target-hardware timing run.
- Proofs: `data/oracle-live-workbench-20261013.png`, `data/oracle-live-flight-20261013.png`; review and asset/player-data results under `data/oracle-*-20261013.json`.

Fresh backups succeeded before and after update; both cloud copies were downloaded and independently restored on this computer. Pre-copy SHA-256 **058542d731bedb6350e951cda55f86f6f93f9fc2a78b51a600724df4970588ae**; post-copy **d933e5756c183fc9de963c3927f022c9ff07fa0a3f80cd6cb5fb7f6f69354bb6**. All pre-update rows in users (3), records (4), career (0), achievements (3) and owned_parts (0) matched exactly after update. Sessions increased from 6 to 9 during guest testing. Backup timer remains active; seven-copy retention and 9 GB cloud budget preserved. No local player database was uploaded.

Rollback: previous directory **/opt/liftoff/releases/20261007-ui-01**, image **sha256:40414f31ce3db252bf3449f706122280770af61d7437de8ed805e16d51d2cf95**, and `deploy/previous-release.txt` retained. Rollback was not executed. Finalization script `data/oracle-finalize-20261013.sh` completed; after restoring SSH for the changed IP, readback confirmed the new current symlink, `deployed-online-test` release status and new running image. Do not rerun this completed script.

Remaining limitations: UHD 620 60 FPS, eight-drone performance, all native course completions and 100-player capacity remain unverified; imported-map triangle budgets are exceeded. Users must reload existing browser tabs to receive protocol 8 and the current catalog.

## Menu release - 7 October

Latest local cleanup (8 October): fixed Settings panel bounds/background across tabs and removed the drone preview/name/flight-mode display from pause. The targeted layout checks and local build passed; these are also awaiting deployment and do not change the verified public release listed above.

Follow-up status as of 8 October: Settings, Replays, Controls/Camera and flight-setup refinements, plus the user's selected concept-01 layout adapted to existing fonts/colors/icons for Pilot Profile, Settings, Create Room and Flight Menu, are locally ready with **160 tests passing**, but **not yet published**. SSH timed out on 7 October and on the 8 October access check; the last approved ipify check returned `144.124.196.42`, while the recorded SSH rule permits `195.158.3.42/32`. Oracle sign-in and a reviewed SSH-source replacement are needed before the next release. Public HTTPS/API/WebSocket/assets passed the 7 October interruption check; that is not a current-server verification. The formerly proposed `20261007-ui-02` path was not deployed. Choose a fresh dated release path when access is restored. Production database and backup resources have not been changed by this local follow-up.

The main-menu logo bar is removed from secondary screens. Weekly challenge is directly visible. Multiplayer has a prominent Create room action and a separate Championship screen; career, lessons and weekly challenge use illustrated selections and separate details/leaderboards. Lists use pages. Workbench has smooth part inspection motions and a fix for duplicate gesture handlers after recoloring. See [UI-QUALITY-AUDIT.md](UI-QUALITY-AUDIT.md) for changes, coverage and limits.

Validation: **152 tests passed**, production build and content validation passed. Local Chrome checked the changed screens at an actual 1280 x 720 DOM viewport and exercised room creation, a full three-minute freestyle session, results and restart. Error/version/slow-download checks used a separate loopback fixture. The public Chrome check confirmed visible Weekly challenge, the new multiplayer controls, the existing account session and the unchanged **20-player** admission limit; no browser console errors were captured.

The release was built in a new directory, with unchanged server env files, the same persistent database volume and the existing content revision `e5314d3de3127b75`. `deploy/deploy.sh` drained before replacing containers; both containers became healthy. Only after public checks was `current` switched. Previous directory `/opt/liftoff/releases/20261005-01` and image `sha256:e05ad32df54c74dc7faaa2f9cde742f083571ea7fc4e8b3d65ac06492bb91142` are retained; rollback metadata is in the new release's `deploy/previous-release.txt`. A rollback was not executed during this update.

Fresh backups succeeded before and after deployment. The cloud copy was downloaded and restored independently. The post-update backup passed SQLite integrity and rollback-write verification: users 3, records 3, career 0, sessions 13, achievements 3, owned_parts 0. Full row comparisons of users, records, career, achievements and owned_parts matched the pre-update backup exactly. SHA-256 of the verified cloud/post-update copy: `5c5f62e5482f21ff873b0d1cf31eca5c0eea6d1c773e4682edde69e4fb17c57b`. The private bucket has four dated objects (4-7 October); seven-copy retention and the 9 GB storage budget remain configured. The backup timer is active and its post-update service run succeeded.

Flight physics, flight-controller defaults and the Kestrel content file match the pre-task hashes. No admission increase or paid resource was added. Production dependency audit reported zero vulnerabilities; npm's build-time warnings concern development dependencies, which were not upgraded in this UI task.

## Initial migration and backup setup - 5 October

The existing local database was copied with SQLite online backup, restored into a temporary database for verification, checksummed during transfer, and imported before the first public game process started. One registered account was preserved; the source had no career/record/achievement/owned-part rows. Existing-account login on another computer still needs a real user check.

Private Standard bucket: `liftoff-backups`, namespace `axshgasoak3h`, Riyadh. Auto-tiering and object versioning are disabled. The Console reported 10 GiB free Standard storage and no prior stored objects. Backup storage budget is limited to 9,000,000,000 bytes; retention keeps the last seven dated backups after a successful checksum-verified upload.

Dynamic group `Default/liftoff-backup-vm` matches this instance ID only. Policy `liftoff-backup-storage` permits reading this bucket's metadata and listing/reading/creating/overwriting/deleting its objects. It grants no bucket administration or access to other buckets. Exact policy: [oracle-backup-policy.txt](../deploy/oracle-backup-policy.txt).

`liftoff-backup.timer` is enabled: daily 03:00 UTC (08:00 Tashkent), with up to five minutes of jitter. The first service run succeeded. The stored object `liftoff-2026-10-04.sqlite` (UTC date), 98,304 bytes, was downloaded and independently restored with an integrity and rollback-write check. Uploaded and downloaded SHA-256:

`f02ac55ff642a48bea3896f9d9afd598f12d9a7e15408f20475ac0bf5c4e555a`

An idle-only container restart was also checked. After the server became healthy again, a new consistent SQLite backup passed restoration checks; full rows in users, records, career, achievements and owned_parts matched the pre-restart cloud-restored copy. Public health returned `ok` again. This checks game-process persistence, not a full VM reboot or deployment rollback.

Check operation on the VM:

```bash
sudo systemctl status liftoff-backup.timer
sudo journalctl -u liftoff-backup.service -n 30 --no-pager
cd /opt/liftoff/current
sudo -u liftoff docker compose --env-file deploy/production.env -f compose.production.yaml ps
```

## Outstanding release gates

- Hour-long 100-client runs with both 13 large rooms and 50 small rooms, real assets and an isolated database; acceptance is not confirmed.
- Real play, ping and controls from Uzbekistan/CIS; 10–20-person closed beta before expanding admission.
- UHD 620 Low at true 1280×720 with adaptation off; current smoke check does not meet the hardware acceptance requirement.
- Real account/profile/recovery UI verification and deployment rollback on the VM.
- Artistic acceptance remains separate. No payments, store, paid cloud upgrade or Unity migration were added.

See [WEB-BETA.md](WEB-BETA.md) for acceptance commands and [FREE-HOSTING.md](FREE-HOSTING.md) for operating procedures. Do not delete production volumes.

## External health monitoring

10 October local refinement was subsequently verified in Chrome and the in-app browser after explicit local-origin approval: texture-cache/scene-transition fixes, Blender-prepared Kestrel tint, usable modular Workbench, unauthenticated access background, Low free flight and attitude HUD. Candidate `data/menu-qa/release-20261010/` independently builds and validates; protocol 7, only licensed Ironworks. Full suite 189/189; final camera refinement 11 affected tests. No new deployment has occurred, and production env/database/backups were not changed. Developer IP remains `144.124.196.42`; replacement of the recorded SSH source requires network-access approval, requested after staging. See the verified follow-up in `UI-REFINEMENT-20261010.md`.

Local follow-up on 10 October: Vector FPV draft branding, cold-menu fallback/loading, independent garage previews, simpler Workbench, attitude HUD, closer chase camera and archiving of twelve generated maps are implemented locally. At the 10 October read-only public check, HTTPS `/` and `/api/health` returned 200 (`status: ok`), the title remained **Drone Liftoff**, and `/api/catalog` returned revision `e5314d3de3127b75` with the twelve older map IDs. This confirms those changes are **not deployed**; it does not verify the VM release directory or backups. The existing recorded SSH ingress mismatch/access block remains unresolved. Production data and env files were not modified. Minus Two redistribution remains unconfirmed and it must be excluded from a public release; see `UI-REFINEMENT-20261010.md`.

Always Free APM domain `liftoff-health` is active in Riyadh. REST monitor `liftoff-health-https` is enabled: HTTPS GET to `/api/health`, SSL verification, required response 200 and body containing `"status":"ok"`. One Oracle-managed Frankfurt vantage point runs every ten minutes (six runs/hour); retries and network collection are off. This stays below the displayed Always Free limit of ten monitor runs/hour. No paid domain or external-provider vantage point was selected. [Oracle free-domain documentation](https://docs.oracle.com/en-us/iaas/application-performance-monitoring/doc/application-performance-monitoring-terminology.html).

The first scheduled result was still pending during setup. The independent manual HTTPS check succeeded. Notification delivery has not been configured; results are available in Oracle APM monitor history.
