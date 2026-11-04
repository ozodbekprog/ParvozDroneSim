# AI quick start: save context and reuse completed work

**1 November — mandatory moving-flight performance scenario:** The user caught
an invalid attempt to investigate flight stutters while the drone was stationary.
FPS/stutter checks must exercise and prove sustained fast flight, turns and
direction changes along a repeatable route. Idle recordings, HUD time and capture
frame counts only verify the instrument; they do not establish flight performance.
See the new rule in `AGENTS.md` and [profiling procedure](STUTTER-PROFILING-20261026.md).
[UI work checkpoint and limitations](evidence/ui-completion-20261101/README.md).

**29 October — UI direction supersedes the rejected mockups:** Use the current
public game's complete UI as the baseline. Improve it in small, reviewable steps
in a separate test build or preview. The latest Hangar PNG/HTML and earlier shown
concepts were rejected; do not publish them or continue the Figma import as an
approved direction. Every public UI update requires the user's explicit release
permission after preview review. Earlier general deploy requests do not cover it.
[Current rule, baseline and continuation](UI-ITERATION-RULES-20261029.md).

**27 October — product completion slice:** Flight menu/Graphics now expose the
current-settings recorder, summary and JSON download. Flight school and Workbench
open an EN/RU/UZ parts/rates/PID reference without changing drafts or lesson
progress. Build and 60 focused tests pass; Chrome checks cover recording/buttons,
guide keyboard/dirty-draft behavior and signing in to an isolated Luma account.
[Finished work and remaining product gates](PRODUCT-COMPLETION-20261027.md).
Oracle is unchanged; target-hardware/stutter acceptance remains open.

**27 October — Chrome UI follow-up:** Browser access is restored. The live pass
found and repaired Tuning height/scrolling, narrow-screen overlaps, Hangar scale
and roster sizing, Graphics alignment and RU/UZ status translations. See
[checks and continuation](UI-VISUAL-20261027.md). Earlier disabled-browser notes
below are historical. Oracle is unchanged; FPS/stutter acceptance remains open.

**26 October — UI repair and profiling implemented locally; browser QA pending:**
[Implementation and continuation](UI-REPAIR-20261026.md),
[F7/F8 and existing public profiling instructions](STUTTER-PROFILING-20261026.md).
Local client prepares the selected workshop at startup/first account sign-in,
retains Hangar roster images/focus, fixes collapsed names/Language positioning,
shows permanent physical characteristic scales and before-part-change markers,
tabulates Specifications and regroups Tuning/Graphics/Pause/Replays. Remaining
time estimates distinguish observed download time from learned preparation.
F7 captures 60 seconds at current settings; F8 marks stutters; F6 downloads the
latest finished F4/F7 report. F4 remains the separate Low 1280×720 control.
Physics/controller/save logic is retained. Combined affected tests 102/102 pass,
including startup scope; production client builds. Browser Use is disabled
in Work settings, so visual/cold-warm/export verification is pending. No Oracle
update, FPS gain or diagnosed gameplay cause is claimed. Green/red semantics and
the exact requested Tip remain unresolved; neutral markers/paragraphs retained.
Other presentation edits are unrelated and must stay outside these commits.

**Historical audit checkpoint — 26 October, before application changes:**
[Findings and proposed sequence](UI-AUDIT-AND-PLAN-20261026.md),
[player profiling instructions](STUTTER-PROFILING-20261026.md).
Confirmed: startup does not prepare Hangar, selecting a drone recreates blank
thumbnail elements, name rows shrink to zero height, Language lacks the shared
Settings container. Existing F4 forces Low 1280×720 and is not a current-settings
stutter capture. No dedicated PID lesson exists among the 12 published lessons.
User clarified loading time means ETA, Delay means motor response, and wants
characteristic scales. Proposed universal better/worse color rules were rejected;
do not treat them as accepted. Exact Tip paragraph remains unidentified. Expanded
pause chat and populated Replays still need live visual inspection. Game code,
physics and Oracle unchanged in this audit; preserve unrelated presentation edits.

**26 October, 18:55 Tashkent — performance update is serving; browser gates pending:**
[Live evidence, backups and exact continuation](ORACLE-COLLISION-20261026.md).
Release `20261026-collision-01` / revision `0fe968941a806c66` is active on both
HTTPS hosts; runtime source `b26c2a9`, Caddy configuration `bea19c0`. VM build,
content/inventory, Pine/Green isolated/public two-client races, all 202 delivery
checks, pre/post cloud restores and original player-row preservation pass.
Admission remains 20. Chrome Minus Two flight at actual 1280×720 Low and Green
cancellation passed; following flight and Hangar checks remain unconfirmed.
Browser control disconnected; Windows Computer Use stopped on uncertain URL.
The in-app browser GPU recovery failed; UHD 620 acceptance is still open.
`current` still points to the old `20261025-browser-03` while the new Compose
project serves players. Finish the recorded browser/finalizer gates and restore
Chrome's temporary settings. Do not repeat upload/build/activation/backups.
SSH works with the user-approved `195.158.6.35/32` rule; other rules unchanged.
Retain all prepared evidence under `data/oracle-collision-20261026/`.
The local-only statements below describe earlier implementation checkpoints;
the shipped changes and development-only 3D Tiles comparison are distinguished
in the deployment record.

**26 October - existing-library streaming comparison ready locally:**
[3D Tiles/grid result and limits](TILES-COMPARISON-20261026.md).
Pinned 3d-tiles-renderer 0.5.3 only for the camera QA tool; same verified compiled
Minus Two files/texture leases as the grid. Fixed candidate/cache churn and
in-flight slot handling; both pass three browser release cycles and immediate
cancel, with zero remaining loader ownership. 600 distinct tests across 139
files pass in partitioned runs; final changed streaming subset 12/12. Local
GTX 1650 browser checks are functional, not UHD 620 FPS/visual-equivalence
acceptance. Visual streaming is not installed in the game; no Oracle release.

**26 October - prepared collision delivery implemented locally:**
[Implementation and measured limits](BINARY-COLLISION-20261026.md).
All five maps have lossless prepared Float64 collision sidecars, with JSON
compatibility retained. Real-map arrays/metadata and 2,660 contact/sweep probes
match. Fresh-process worker medians: Green peak RSS 683.2 -> 274.8 MiB;
Pine 549.3 -> 193.0 MiB. These are Node CPU/process observations, not browser
memory or UHD 620 acceptance. Pine/Green gzip bytes grow about 6%. Build/content,
collision/flight/AI tests and isolated browser flight/cancel/legacy checks pass.
Revision `0fe968941a806c66`, protocol 13. No Oracle deployment. Reuse generated
packs and evidence under `data/collision-binary-20261026/`; no source re-export.

**26 October - independent technology investigation, research only:**
[Decision report](INDEPENDENT-BROWSER-TECHNOLOGY-20261026.md), with community
replies/resolutions, exact-version source audits and metadata. Strong next
candidates: compiled visual cells, pre-baked existing collision arrays, 3D Tiles
versus the grid control, and a matched PlayCanvas renderer experiment. Additional
checks cover r180 instance uploads and an MIT distant-tree impostor source.
No game/dependency/asset change, benchmark execution or Oracle request/release.
UHD 620 performance and engine selection remain unverified.

**26 October — second external research implemented locally:**
[Review and measured implementation](SECOND-RESEARCH-IMPLEMENTATION-20261026.md).
True scenery instances now run on WebGL2 as well as WebGPU, with an ordinary
mesh fallback for unique geometry when optional multi-draw is unavailable.
Fixed false prototype matches for interleaved attributes. Pine batch geometry
attributes: 653.90 → 221.12 MB (432.78 MB avoided); these are payload counts,
not total VRAM/process memory. Three matching Low views are pixel-identical.
73 affected tests and final build pass. Whole-map streaming, excessive triangles
and UHD 620 frame acceptance remain open. No Oracle deployment. Reuse captured
reports under `data/research-followup-20261026/`; no imports/re-exports needed.

**26 October — external research checked and implemented locally:**
[Review, changes and measured limits](RESEARCH-IMPLEMENTATION-20261026.md).
Lossless map image dedup removes 71.75 MB across deliveries; Pine is 33.58%
smaller with unchanged payloads/scene semantics. Normal and streaming loaders
share one cancellable batched Meshopt worker; initial visible texture uploads
run before the ready gate. Full suite 582/582, final affected checks and build
passed; actual Pine scene reached Ready in WebGL2 at 1280×720 Low. Worker decode
trades total time for responsiveness. Full streaming, target UHD 620 FPS and
whole-game memory remain unverified. No Oracle release in this work. Reuse the
verified delivery/decoder reports; do not repeat imports or source exports.

**25 October — deeper modern web game research, stage one:**
[Comparison and experiment gates](MODERN-WEB-GAME-RESEARCH-20261025.md) covers
engines, streaming, memory, profiling, assets and current upstream versions.
New shortlist: 3D Tiles / Needle progressive loading, WebGPU Inspector,
PlayCanvas / Babylon comparisons. Research only; no runtime or Oracle change.
[Deeper follow-up](WEB-GAME-DEEP-RESEARCH-20261025.md): fresh map payload hashes,
68.783 MB repeated Pine images, 51.123 MB cross-map reuse after local dedup,
unused Meshopt workers, and further streaming/terrain source qualifications.
[Community follow-up](COMMUNITY-WEB-GAME-RESEARCH-20261025.md): 19 community
cases, four public benchmarks, maintainer corrections and new system checks.

**25 October — browser performance recovery:**
[audit/modern options](BROWSER-READINESS-AUDIT-20261025.md) and
[implementation, measurements and next checks](BROWSER-RECOVERY-20261025.md).
Compact collision buffers, cancellable workers and map retirement fixes are
committed/pushed. 20 real-map CPU preparation/release cycles return heap and
buffers near baseline; this is not browser/GPU acceptance. Low map packaging and
shared-texture chunk experiments pass geometry/file checks; they are not
installed in the game. Reuse ignored `data/browser-readiness-20261025/` outputs.
Browser Use is restored. The [streaming prototype](MAP-STREAMING-PROTOTYPE-20261025.md)
has shared textures, persistent distant coverage, bounded detail, browser
load/release and cancel checks. It is a separate local camera tool, not game
integration. UHD 620 remains the minimum and must be tested before release.
The separate Oracle update subsequently shipped as `20261025-browser-03`:
[publication and backup record](ORACLE-DEPLOYMENT.md). This is the last recorded
verified release, not a fresh server check or product/FPS acceptance.
Preserve independent presentation edits.
The [foreground timing record](BROWSER-TIMING-20261025.md) covers debugger focus
emulation, invalid-run safeguards and the isolated Three r186 comparison.

**25 October — local Class group reports:** presumed customer requirements in
[Class specification](CLASS-CUSTOMER-SPEC-20261025.md), implementation/checks in
[Class delivery](CLASS-DELIVERY-20261025.md). Learner JSON import, per-pilot local
roster, lesson/date filtering, group CSV, RU/UZ/EN. Synthetic browser QA is not
an actual class or hardware trial. No Oracle deployment or customer agreement.
Preserve the independent unfinished presentation work below.

Read this after `AGENTS.md`. It supplements all project rules, including the required deployment documents. Read [AI-CONTENT-IMPORT.md](AI-CONTENT-IMPORT.md) only for the import section needed by the task. Do not repeat documents already read in this conversation unless they changed.

## Find the minimum useful context

- Use `rg -n` in relevant files and bounded reads. Do not scan the entire repository, installation or generated assets by default.
- Never print whole GLB, XML, logs, base64 or large one-line JSON. Parse JSON and return selected keys/counts; show only errors and the final test summary.
- Reuse existing profiles, caches, reports and screenshots. A stage succeeding does not prove visual quality, race completion or hardware performance.
- Run checks affected by the change. Do not repeat a passing build/test without a new change or unresolved failure. Documentation-only edits need no game build or deployment.
- Before stopping, update the facts below if changed; leave completed work, remaining issues and exact next commands. Do not write a transcript or secrets.

## GitHub and disk cleanup (2026-10-13)

**23 October — repository presentation:** root README now presents the product
with an original SVG cover/status strip, real existing game captures, beta link,
English/Russian versions and documentation navigation. Technical detail moved
to `docs/DEVELOPMENT.md`; `docs/README.md` is the new index. About description,
homepage and topics are recorded in `docs/presentation/repository.json`.
Documentation-only work: no game build, import or Oracle deploy is needed.
Private visibility and resource permission metadata remain unchanged. Browser
stability runs 5/6 below are still pending; README checks do not complete them.

**24 October - team presentation:** two completed nine-slide light business
PDFs (player features and project overview) are in `output/pdf/Parvoz-*.pdf`.
Editable text/layout, provenance and rebuild notes:
[presentation sources](presentations/team-overview-20261024/README.md).
All 18 PDF pages visually inspected; headings/main points and page counts
verified. Documentation/artifact-only work, no game change or Oracle release.

**23 October — demand-based local pilot variants:** branch `codex/demand-pilots`
adds Parvoz Start (`?edition=start`) and Class (`?edition=class`), using the same
runtime/catalog. [Evidence, prospects, offers and QA](DEMAND-PILOTS-20261023.md).
Ordered exercises, assignment links, per-pilot browser history and learner CSV
are implemented in RU/UZ/EN. No cloud classroom, payments, outreach or commercial
asset clearance is claimed. No Oracle deployment in this work; the stability
release status below remains separate. Full suite 521/521 passed before final
small action-handler guard; final affected checks/build recorded in the pilot doc.
Actual IAB verified Start/Class selection, assignment link, lesson launch/manual
step/pause/exit with no false completion. Browser Use then became disabled;
CSV download UI, group-room shortcut and narrow viewport QA remain unverified.
Use existing content/caches. Do not repeat imports or full staging.

**23 October 15:58 Tashkent — supersedes all older pending notes:**
`20261023-stability-03` (runtime `78fb1f8`, client `index-D31s-vkZ.js`) is now LIVE.
Oracle sign-in/source rotation/SSH, VM build/399 hashes, isolated and public
Pine/Green races, all 132 public assets and pre-cloud restore pass. Direct public
Edge cold/repeat Ready 3.489/1.298 s; zero startup model downloads. Remaining:
finish six after-release browser scenarios, then finalize current/docs; the
post-cloud restore and original-row comparison passed below. Current symlink intentionally still 21
October. Preserve canonical 20 October content, previous images, envs and player
volume. Do not repeat deployment/imports/backups already complete.
See the newest section of [Oracle state](ORACLE-DEPLOYMENT.md).

**Update 16:40 Tashkent:** post-cloud restore and all original non-session rows
verified, production env/volume preserved. Four new public scenarios pass:
cold 3.489 s, cached repeat 1.298 s, cold 5 Mbps/160 ms 3.271 s, exact API failure
after 3 attempts → readable error → Retry recovered in 675.5 ms. No startup
model requests. Browser Use became disabled again; one request to re-enable is
pending. First Hangar/cancellation and CPU4 first flight remain; do not claim
six completed or finalized, and do not bypass browser controls. New runtime is
already LIVE; do not rebuild/redeploy or repeat completed cloud backups.

**23 October afternoon — supersedes the morning continuation below:** Edge is
connected; all six original public baseline scenarios now exercised. Foreground
cold 5 Mbps /160 ms repeat: **72.554 s** Ready, all four actual network transfers;
CPU4 after startup: first flight **12.499 s**, longest task 939 ms, functional
movement/reset/exit at 836×420, not hardware FPS acceptance. Test controls reset.
Runtime **087c2b5** pushed: Hangar skips map physics, first flight waits for it even
with a retained scene. Red/green regression, final affected **37/37**, build and
content checks pass. Local real browser QA covers menus, cancel/reopen, missing
collision file and Retry recovery. Model processing pauses remain; no smoothness
claim. Subsequent **78fb1f8** adds readable localized download failure/retry copy:
29/29 focused checks/build and real browser failure → Retry → flight pass.
Latest verified **candidate-03.tar.gz**, release `20261023-stability-03`, client
`index-D31s-vkZ.js`, is **not deployed** and supersedes candidates 01/02. Reuse its
35-member checked archive; do not rebuild without changed source. Oracle console
login remains incomplete after phone confirmation; user must finish that console
session manually and say «консоль открыта». Do not resend MFA or ask for the SSH
source permission again. Local QA servers stopped. Fresh VM baseline/backups/
deploy and six **candidate** public runs remain. [Details](PUBLIC-STABILITY-20261023.md).

**23 October morning check:** browser access is restored; temporary test-tab
network/cache controls reset and observers removed by reload. No user browser
setup is needed now. Fifth run eventually Ready at 507.876 s while unattended,
not valid foreground acceptance; sixth run still unperformed. Fresh public check
at 09:01 matches the 21 October client/health/revision. SSH still times out;
Oracle login/phone confirmation and a brand social profile are the only current
user dependencies. The one-time morning automation `parvoz` ran and was deleted.
No new deployment, build, import or backup was attempted for this check.

**23 October, stability fixes local and pushed, publication blocked:**
[Current continuation](PUBLIC-STABILITY-20261023.md). Direct public Edge cold
startup reproduced **345.673 s**, first Hangar environment **18.507 s**, warm
reload **5.659 s**. Exact API failure/recovery reproduced. Fifth limited-network
run was interrupted; sixth CPU/flight run is unperformed. Browser tool now says
local use disabled; Oracle sign-in waits for phone MFA. User is asleep: collect
only unavoidable help for the 09:00 Tashkent heartbeat (`parvoz`), do not ask
repeatedly or bypass these barriers. One approved IP query returned 144.124.199.147;
user already authorized exact TCP22 source .196.183/32 -> .199.147/32. Not saved yet.

Pushed network recovery `129e1df`, then final runtime `91887c2`: bounded safe GET
retries, verified partial-file recovery/silence timeout, no 39.9 MiB map/aircraft
gate before menus, poster until an environment is already loaded, and cancellation
of abandoned Hangar transitions. Preserve the other chat's 30% controls (`9fb3070`).
Full 504/504 before the final Hangar guard; final affected 57/57, build/content
check pass. No candidate visual/public acceptance. Checked 3.21 MB code-only
candidate archive/manifest is in `data/stability-20261023/`; do not rebuild it or
repeat content exports just to resume. Public state at 01:41 still matches the
21 October client. Phone/browser access, VM baseline/backups and all six public
candidate runs are required before marking a new release verified.
[Audience plan](PRODUCT-DIRECTION-20261023.md) and own-brand social cards/copy
are prepared; no social posts, new imports, paid services or production changes.

**23 October, local feature pending publication:**
[render resolution](RENDER-RESOLUTION-20261023.md) adds 30–125%, shortcut buttons,
fixed manual selection/adaptation off and actual framebuffer dimensions in
Settings > Graphics. 20 focused checks/build and actual local 30/50/100% canvas
sizes pass. Public HTTPS remains healthy, but SSH timed out; no new public
release or access-rule change was made. This local check is not public acceptance.

**Published 21 October, finalized 14:09 Tashkent:**
`20261021-cold-start-01`, source `b124f5407d4d7dbd12d7a1021d1f58559a8aa023`,
client `index-7TSF7k3X.js`, unchanged protocol 13 / revision `2132caf43c0e38df`.
See [Oracle state](ORACLE-DEPLOYMENT.md) and [cold graphics diagnosis](COLD-GRAPHICS-20261021.md).
Current pointer, healthy image, HTTPS on both hosts, all 132 resources, public
two-client Pine/Green races, before/after cloud restores and original player rows
are verified. Admission 20 / $0 preserved. Rollback is the 20 October release/image.
Retain its canonical `content/`: the new release shares it read-only for builds.
Final VM free disk is 1,896,611,840 bytes; all images and source releases retained.

Shipped: catalog reuse (217-byte reply), loading phases/MiB/files/time, sliced
shader preparation and exact-parity WebGPU reflection capture. WebGL retains its
native reflection path. Full suite 494/494 before the final WebGL guard; final
affected checks 43/43; local and VM build/content checks plus 393 VM hashes pass.

Acceptance must use **https://parvoz-drone-sim.duckdns.org/** directly; localhost
and loopback proxies are implementation diagnostics only. Edge is connected.
Reject zero-transfer/cache observations: `Network.setCacheDisabled` alone proved
insufficient. Actual HTTP-cache clearing, optional encoded-cache deletion and
reload produced three verified network runs: **17.166 / 8.467 / 8.203 s** Ready,
maximum startup long tasks 305/316/319 ms. Retained-download cache was observed
empty; do not clear player/account data. Driver shader cache remains warm.
No >=50 ms long tasks in first Low Hangar or the repeated menu sequence; first
flight ready within 4.324 s of action marker. High Hangar functional check passed.

Published Low, real 1280x720, WebGPU, adaptation off: valid 180 s with short
keyboard inputs, mean 77.22 FPS / median 13 ms / 1% low 75.16, zero frames >50 ms.
Substantial stationary time, no standardized route. Auto Low/65%/256px and Acro
restored; temporary observers removed and normal cache restored. Manual ANGLE
reports Intel UHD D3D11, not WebGPU adapter identity. GTX 1650/UHD 620, resident
textures, all maps/backends and the intermittent slow transport cause remain
unverified; do not claim complete performance acceptance. Peak Low triangles
332,368 still exceed the provisional 300k budget.

SSH source 144.124.196.183/32 is console/connection verified after the exact user
approval and manual save (automatic review blocked the automated save). No new
IP lookup without a new reason/consent. Completed release helpers, checked
3.16 MB runtime archive and manifest remain in `data/cold-release-20261021/`.
Duplicate local/remote unpacked stages and upload archive were removed. Do not
rerun completed staging, backup/finalization or full uploads to resume.

**Historical 20 October pre-release diagnosis (now shipped above):** see
[first-visit diagnosis](TESTER-STARTUP-20261020.md). Matching startup revisions
now avoid retransmitting the full catalog; loading exposes phases/MiB/time.
Full suite **487/487**, focused tests and build pass. Code commits `a23ffe5`
and `8f219f6` are pushed. User explicitly corrected the warm-cache test:
use a fresh origin and actual Oracle transfers. Cold public probe measured
Minus Two's 26.3 MB model at 9.16 s in the first interrupted run. Browser access
was restored: a second cold public run reached Ready by the ~28 s observation,
guest Home, completed Hangar, Settings and first free flight with throttle.
However the first Hangar's 3.4 MB file took 60.67 s (later direct request 2.52 s).
Intermittent transfer cause and matched candidate comparison remain open.
Fresh Auto chose Low; this is not a GTX1650/UHD620 FPS acceptance.
Oracle is unchanged. Do not claim the tester's timeout/freezes resolved.

**Published 20 October, 02:47 Tashkent:** `20261020-optimization-01`, source
`f1477709fcc4617ec579cb00d298bb332fc36aa2`, revision `2132caf43c0e38df`, protocol13.
Current `/opt/liftoff/releases/20261020-optimization-01`; healthy game and HTTPS
aliases, exact client hash, 132 active assets, isolated/public two-client races
on Pine and Green, public Workbench and Pine free flight verified. Full 483/483
tests and local/VM builds pass. All original player rows and the production
volume remain; fresh before/after cloud restores verified on VM. Admission20/$0.
Immediate rollback is `20261018-ui-performance-04` / image `31ab39cb...`.
Keep both releases and the new release's required read-only asset mount. The new
release has complete enabled canonical sources; no older content mount is needed
for its build. Final VM free disk 530,223,104 bytes: review before another build.
Do not repeat completed staging, backups, activation or finalization scripts.
Public scene transition emitted nonfatal renderer cleanup `usedTimes` warnings;
this remains to diagnose. Exact hashes/backups/limits:
[ORACLE-DEPLOYMENT.md](ORACLE-DEPLOYMENT.md).

Active work (19 October): [Optimization, map repair, customization and AI](OPTIMIZATION-20261019.md).
Local verified changes: retained home drone/map presentation, native slot rules,
global separate-action-camera prohibition (explicit user choice), chase offset
smoothing, varied AI models/hardware, exact rounded source colliders on five maps.
AI now preserves diagonal acceleration and speed through aligned gates; actual
single/multi-lap regression courses pass. Missing native rounded track prop
colliders are restored on all 25 imported courses. Remaining map art,
transient renderer cost and visual acceptance are detailed in that continuation.
Browser restored: home fill-light visibility invalidated all scene materials;
fixed and measured Settings/back 470-690 ms to 11-25 ms on the same Intel UHD IAB.
Native customization continuation: [slots and antenna integration](NATIVE-CUSTOMIZATION-20261019.md).
Four native antennas now use source slot matrices and the existing Workbench;
Luma camera's stale offset is corrected. Gecko stays blank; separate action
cameras stay prohibited. Browser subsequently verified Workbench constraints,
antenna selection/save/reopen and fixed a 0px part-list height on short viewports.
Actual game captures are linked in the customization continuation.
Pine ground continuation: [native tiled terrain](NATIVE-TERRAIN-20261019.md).
Source 1 m layer tiling replaces the undersampled 94 m patch bake. Actual Low
comparison and normal/Ultra frames on both backends pass visually without shader
errors; 55 related tests and build pass. Static batches 481→166. Cold Ultra
stalls and WebGPU individual BatchedMesh draws need further profiling before
performance acceptance. Map art review and UHD620 measurement remain outstanding.
Subsequent [renderer warmup repair](RENDERER-WARMUP-20261019.md): missing pipeline
variants and the Low canvas/linear-framebuffer mismatch are fixed. Same baked
Pine control: first Low frame 12.94→0.274 s (189→1 new pipeline), Ultra
83.41→2.34 s (461→55); combined compile/frame preparation also decreases.
27 focused tests/build pass. Ultra total cold preparation is still too long.
These changes are included in the 20 October publication above.

[WebGPU scenery instancing](WEBGPU-INSTANCING-20261019.md) now preserves source
geometry/tints/LOD while combining repeated tree prototypes. Same Low FPV:
2,737 to 442 draws, CPU median 13.2 to 9.5 ms; all 90 moving-view triangle counts
match. Moving CPU remains about 9.6 ms and FPS gains are not stable. Low frames
are byte-identical; Ultra and Green browser checks plus 57 tests/build pass.
WebGL retains multi-draw. First-view multi-second freezes and the five-million
triangle view remain unresolved; no UHD620 or Oracle acceptance is claimed.

[Arena yaw/detail observation](ARENA-DETAIL-20261019.md): actual fixed-position
0°/20°/0° maximum-distance captures preserve every source LOD selection; the
historical polygon switch does not reproduce in this view. Oblique texture blur
does reproduce. Medium now requests 4× filtering, High/Ultra 8× within GPU limits;
Low retains native filtering. Actual comparison, 28 tests and build pass.

Previous release: [UI, languages, performance and graphics](UI-PERFORMANCE-20261018.md).
**20261018-ui-performance-04 is deployed and finalized**, source **a469168**,
revision **c39594a402708803** / protocol **13**. Full **443/443** tests, final
local/VM builds, all 112 active deliveries, public client hash, two-client
multiplayer on both maps and actual browser checks pass. Git sources are pushed.
UI, three languages/first choice, real full HD Ultra gallery, separate rigid
camera, indexed lookup, retained previews, shared batching and native Pine
normal/roughness recovery are online. Cached previews are restored before
bounds measurement; repeated opening no longer produces a blank model.
See [final browser evidence](design/ui-performance-20261018/README.md).

Warm public Minus Two/Luma entry: 1,055 ms including browser calls, waiting for
the actual aria-busy state, with a visibly rendered model, at 1040×585. This is
not a target-hardware FPS benchmark. Original geometry at 512 m submission groups
previously measured 18.2 ms / 352 calls on Pine and 18.2 ms / 246 calls on Green,
GTX 1650, fixed 1280×720 Low/adaptation off. Existing LOD1 has essentially the
same whole-map geometry as LOD0; real geometry reduction remains necessary.
The packed/thinned 278.9 MB candidate remains rejected. Do not repeat/promote it.

Remaining: genuinely lighter scenery LODs preserving canopy shape/density,
actual UHD 620 / 60 FPS measurement, further grass/foliage art and cold Ultra
shader profiling. Nine Pine material fixes are not a complete modern-art
acceptance. Original geometry, collisions, routes and flight parameters remain.
Native source packet and 5.9 MB editable material blend are in private Git/LFS.

Historical baseline: /opt/liftoff/releases/20261018-ui-performance-04. Its public/content/assets
is a required read-only runtime mount. **Preserve -01/content** as the recorded
read-only canonical source for future host builds; -04 is a code-only release.
Immediate rollback -02/image eb3ccdf remains, with the known preview limitation
repaired in -04. Earlier directories/images remain. Exact paths/hashes/backups:
[ORACLE-DEPLOYMENT.md](ORACLE-DEPLOYMENT.md). Final VM free space 589,414,400 bytes;
review space before another build. Only verified duplicate uploads and unmounted
host npm caches were removed; no old assets/images or player data were pruned.

Fresh OCI before/after restores and all original rows are verified on VM:
users4/records4/achievements3/replays2/weekly1/fleets1; remaining progress tables0.
Sessions45→57 for the integrated releases' guest tests. Seven cloud copies,
private envs, production volume, admission20 and Always Free/$0 are preserved.
No production DB was downloaded/replaced. Never retry rejected raw-DB download
or old-release cross-link cleanup helpers. Do not repeat completed imports,
exports, backups, staging, activation or finalization scripts. Package -03 is an
unpublished superseded local artifact; no -03 VM release exists.

Previous [learning release](LEARNING-RELEASE-20261018.md) added five maps,
30 routes and twelve piloting lessons, preserved here. Tuning education remains
the separate Hangar workshop proposal, not code or a mixed piloting queue.
The old full local learning stage is retained as the verified 646-file
`data/oracle-release-20261018-learning-01.tar.gz` plus inventory. Its expanded
stage was removed; do not recreate it. Current code deltas use the verified
runtime inventory and explicit `--read-only-content-source` for unchanged
content. A content change requires a full source candidate. Canonical art and
D: import caches remain; Ironworks stays retired.

The following 17 October pending publication/access statements are historical;
their integrated client changes are included in learning-01. Older candidate
entry-01 must not be deployed over the current release.

Latest user direction (17 October): the new authentication and Downloads UI has
too much text and needs familiar layouts and better typography. The user requires
image concepts before a final visual decision and confirmed desktop mouse/keyboard
as the primary input. See [the concept brief](design/auth-downloads-20261017/README.md).
The user selected A (dark compact panels), then saw actual Sign in/Register/
Downloads screenshots and explicitly liked the implementation. The active task
now extends that style to all menus, restructures Profile, fixes Downloads scope,
adds a full-viewport loading slideshow and FPV arrow shortcuts, investigates
menu/Hangar delay, and reviews a new abstract mark. Continue from
[MENU-SYSTEM-20261017.md](MENU-SYSTEM-20261017.md). Local build, 28 targeted tests
and the full 353-test suite pass. Browser access briefly allowed Home,
Settings, Hangar and Profile checks, then reverted to disabled. Final screenshots,
fullscreen, download navigation and flight-key checks subsequently passed in the
IAB (see the continuation's latest section). Logo E was selected and its editable
SVG is installed locally. Actual screenshots are retained with the design docs.
No new UI changes are published; Oracle SSH still times out.

Current work (17 October): [startup/downloads/fullscreen/HUD](ENTRY-DOWNLOAD-20261017.md).
Core download manager, fullscreen controller and horizon projection are committed;
UI/startup integration is implemented. Full suite345 passed, final affected28
passed. Browser showed Ready/Play/menu/map statuses; real fullscreen and background
navigation still need verification because Browser use was disabled. Oracle SSH
timed out; public health/catalog remain on the previous release below. Do not
claim these changes published. Candidate `20261017-entry-01` was staged
from `67ed9fc`, with a verified 121,586-byte delta; it now predates the accepted
auth/Downloads redesign. Retain it as reference, but prepare a fresh candidate
after browser validation instead of deploying that stale UI.
The user authorized the exact SSH source rotation to `144.124.199.147/32`, but
it has not been performed because the browser still reports disabled in Work.
Continue browser verification and the authorized SSH repair, then deploy with
fresh verified backups. Exact candidate hashes and prepared, unexecuted scripts
are recorded in the linked continuation. The user's
mandatory SOL/xhigh subagent rule was removed; do not recreate it.

Current follow-up (16 October): [Hangar/accounts/cameras](HANGAR-ACCOUNT-RACE-20261015.md),
[solo Race AI](RACE-AI-20261015.md), [electrical details/action cameras](DRONE-DETAIL-20261015.md).
All three are integrated, reviewed and **published** as
**20261016-hangar-race-01**, source **f51e38d**, finalized 00:54 Tashkent.
Final canonical suite **311 passed**; local/candidate/VM build/content,
public 80 assets, two-client multiplayer and actual browser Race/Hangar/camera/home
checks pass. Original asset deliveries are
unchanged; the additive library restores eleven battery lead pairs and optional
cosmetic cameras for five aircraft. Editable `details.blend` and source-only export
workflow are saved. Do not re-extract or repeat Blender exports. Published
protocol **13**, revision **b68f2b229bf64134**, 80 assets / 904,599,026 bytes.
Before/after OCI restores passed on VM/locally; all original account, progress,
replay, weekly and fleet rows matched exactly. Current symlink finalized,
contacts-01 directory/image retained for rollback, admission 20 and $0 preserved.
Next baseline: ignored `data/hangar-race-online-release-20261016.json`.
Do not repeat exports, publication, backup or finalization. Exact checks and
remaining limits: [Oracle deployment](ORACLE-DEPLOYMENT.md).
The candidate's full Docker build exceeded free temporary disk before activation;
only unused build cache was pruned. The tested optional
[incremental image build](INCREMENTAL-ORACLE-BUILD.md) preserves dependencies,
all old delivery files and rollback images; do not repeat the failed full build.

Previous finalized result (16 October): [physical contacts](PHYSICAL-CONTACTS-20261015.md).
Published and finalized **20261015-contacts-01**, source **6a9e1be**, protocol
**13**, revision **91a4b5db45d47a74**. Contact impulses replace hidden ground
leveling/braking; native rotor lever arms and falling damaged craft repaired.
267 isolated tests plus 32 deployed physics regressions, build/content checks,
public 76 assets/two-client smoke and actual Chrome flight startup passed.
Both OCI restores and all account/progress/replay/weekly rows are verified;
one valid account fleet was added by browser sync. Admission 20, volume and $0
preserved. Current symlink finalized; physics-01 image/directory retained for
rollback. Next baseline: ignored `data/contacts-online-release-20261015.json`.
Do not repeat completed publication/backups/exports. Later camera/Hangar/fleet
and AI commits from other chats are not included; current Git HEAD can differ
from the deployed source. Exact checks/limits: [Oracle deployment](ORACLE-DEPLOYMENT.md).

Previous finalized result (15 October): [LOADING-REPAIR-20261015.md](LOADING-REPAIR-20261015.md).
Published **20261015-loading-01**, source **7155fdd**, protocol **11**, revision
**91a4b5db45d47a74**. Map cards retain the loaded background; Hangar swaps only
changed components, loads one inspection LOD and keeps one warm preview. Parsed
idle models have a 48/96 MiB budget; stock cards use five saved images. Auto uses
GPU identity; menus/loading cannot reduce flight resolution. Replay metadata
listing/migration, preparation before playback and clear scene rendering repaired.
248 tests, independent build/content checks, public 76 assets, two-client smoke,
actual browser Auto/Hangar/map/replay checks and before/after cloud restores passed.
All original account/progress rows preserved; admission 20. Current symlink is
finalized; **20261015-flight-01** directory/image retained for rollback. The next
delta baseline is ignored `data/loading-online-release-20261015.json`. Reuse it
and the prepared sources; do not repeat extraction, completed backups/deployment
or upload unchanged large assets. Five [FHD captures](loading-repair-evidence-20261015/README.md).
First uncached asset preparation remains necessary. Total RAM on a 4 GB system
and UHD 620 performance remain unconfirmed; the idle budget is not a RAM cap.

Earlier flight result: [FLIGHT-UV-REPAIR-20261015.md](FLIGHT-UV-REPAIR-20261015.md).
Published **20261015-flight-01**, protocol **11**, revision **4d221c5be747e24c**:
stable grounded launch with a direction, continuous wall/floor collision and
primary atlas UV repair in three maps / fourteen native courses. All 241 tests,
1,516 real compressed atlas probes, seventeen texture/geometry preservation
checks, independent build/content checks and public two-client checks on all
three maps passed. Live 50% throttle plus launch pitch lifted Kestrel/Luma
2.16 m / 2.37 m. Public guest flight/rendering and all 71 assets verified.
Before/after cloud restores and original player rows verified; admission 20.
Current symlink is finalized; **20261015-ui-01** directory/image is retained
for rollback. Sources/prepared caches are repaired; do not repeat UV inversion,
extraction, packaging, backup or finalization. See the dated repair note for
exact continuation and [UV evidence](flight-uv-evidence-20261015/README.md).

Earlier UI result: [UI-POLISH-20261015.md](UI-POLISH-20261015.md).
The user's clarification led to actual general interface improvements, now
published in **20261015-ui-01**, source `befc562`, with 24 new verified-size
screenshots and a before/after gallery. Local/staged builds, 21 affected tests,
public UI/all assets/two-client smoke and before/after cloud restores passed.
Gecko/Dquad/native parts, component physics, loading reuse, labels and live chat
remain included in the current release. At the UI publication the protocol was
10, revision 9a0ff4f715bbd733. **20261015-native-01** is an older rollback record.
235 tests plus ten affected checks pass. Live two-client, all 71 public assets,
before/after cloud restores and existing player rows verified. Primary UI review
has 90 accepted FHD frames with explicit exclusions. Reuse sources/caches;
do not repeat exports, backups, completed publication or unchanged uploads.

- Follow the commit/push rule in `AGENTS.md` after each small, verified change.
  Setup, cloning, rollback and exclusions: [GITHUB-WORKFLOW.md](GITHUB-WORKFLOW.md).
- `origin`: https://github.com/Fayzullo637/ParvozDroneSim.git (verified private).
  Initial `main`/baseline tag and all 592 LFS objects were pushed; remote SHA
  matched `59d0972`. Canonical sources include junction contents as
  regular tracked files; another computer does not need D: for normal builds.
  Raw import caches, secrets and player databases stay outside Git.
- Verified redundant stages and old delivery hashes were removed. Current and
  previous Oracle `.tar.gz` archives and their inventory sidecars remain in `data/`.
  The Ironworks ZIP remains in `backups/`; expanded duplicates were removed.
  Do not look for the former expanded release/restore stages. Cleanup alone did
  not update Oracle; the later publication is recorded below. See
  [GITHUB-CLEANUP-20261013.md](GITHUB-CLEANUP-20261013.md).

## Latest online test (2026-10-13)

Branding follow-up: the user confirmed **Parvoz Drone Simulator** / **Parvoz
Drone Sim** and authorized rebranding the game and public URL. Text rebrand,
editor labels, export filenames and a temporary P monogram are pushed; the game
is verified online at **https://parvoz-drone-sim.duckdns.org/**. The old URL is a
working alias. Final graphic identity remains unselected. See
[BRANDING-PARVOZ.md](BRANDING-PARVOZ.md). GitHub and Oracle are separate actions.
Current continuation: [PARVOZ-REBRAND-20261013.md](PARVOZ-REBRAND-20261013.md).
The text rebrand is pushed (`cc84eba`); deployed code patch `20261013-parvoz-01`
is 118,447 bytes and reuses all 55 delivery assets. DNS, SSH access, publication,
cloud restores and finalization are complete. Do not repeat registration,
completed builds/backups/finalization or upload the unchanged 814 MB of assets.
One-time scripts, verification reports and the patch archive remain in `data/`.

Read [ORACLE-DEPLOYMENT.md](ORACLE-DEPLOYMENT.md) for verified publication and backups.
User explicitly authorized Liftoff resources online for multiplayer testing.

- Running Oracle release: `/opt/liftoff/releases/20261013-parvoz-01`, protocol 9,
  revision `4233a00856896de1`: 3 maps / 17 routes / 6 drones / imported workshop.
- Public HTTPS/API/WebSocket/all 55 assets, two-client multiplayer and browser
  PARVOZ guest menu/Minus Two Free Flight verified. Before/after cloud restores
  and all existing player rows verified; production DB and 20-player limit
  preserved. Only public GAME_DOMAIN changed; other private env is unchanged.
- Finalization completed: current symlink, deployed status and running image
  verified by SSH readback. SSH source replacement to `144.124.196.42/32` was
  explicitly approved and SSH succeeded from that address. Rollback scene-02
  image was rebuilt under `liftoff-game:rollback-scene-02` and independently
  started with isolated data; use the updated `deploy/previous-release.txt`.
  The deploy script now retains a tagged rollback image (`bbcf200`, two tests).
  Existing source repair/import caches remain valid.
- Local archive `data/oracle-release-20261013-scene-02.tar.gz` is retained;
  the redundant expanded stage was removed after inventory verification. For a future update,
  `node tools/prepare-oracle-update.js NEW-DATED-ID --include-local-imports-for-online-test --previous-catalog=LIVE-SNAPSHOT.json`.
  The 10 October and licensed-only 13 October candidates are superseded.
- No new import/model recovery is needed. UHD 620 and all-course acceptance
  remain outstanding. Temporary previews 2595/2596/2597 are no longer running.

## Latest local repair (2026-10-13; subsequently deployed above)

Read [SCENE-REPAIR-20261013.md](SCENE-REPAIR-20261013.md) for the completed Free Flight scope, native socket, marker cleanup, tabletop contacts, cache and UI repair. Sources and delivery backups are at `D:/DroneLiftoffUz-import-temp/scene-repair-20261013/before/`. All exports and texture-preserving finishing steps are complete. Do not rerun them to resume publication. 217 tests passed; the 64 MiB cache keeps encoded deliveries, never decoded GPU resources.

For the preceding UV/orientation repair, see [LOCAL-REPAIR-20261013.md](LOCAL-REPAIR-20261013.md).

- Loading layout, imported drone/tool UVs, native Luma battery placement and
  Kestrel upright orientation/spin repaired in Blender and runtime.
- Ironworks retired: backups/ironworks-v2-20261013.zip. Extract its map folder
  into content/maps/ and build to restore; two routes/missions are bundled.
- Active: Minus Two, Hangar C03, Arena; 17 routes, 6 drones.
- Final build/content valid; 209/209 tests passed. Sources preserved.
- Initial local-only scope was superseded by explicit online-test authorization.
  Repairs are included in the running Oracle release; old candidate obsolete.
- Do not repeat completed recovery/repair. UHD 620 and map triangle budgets
  remain unverified/exceeded respectively.

## Historical workbench implementation (before map retirement)

Read [WORKBENCH-20261012.md](WORKBENCH-20261012.md) for current results, commands
and limits. Older handoff sections below are historical. Oracle is unchanged;
Liftoff resources and references stay local.

- Ready: Minus Two, Ironworks v2, Hangar C03 and Arena. Hangar's two and Arena's
  seven native races are installed. Catalog: 4 maps / 19 races / 6 drones.
- Garage/Workbench use the selected map with original PicnicTable01,
  DroneCharger01, SolderingIron01 and Luma spare parts. Blender source and KTX2
  delivery: content/shared-assets/liftoff-workbench/. Poly Haven backup remains
  in content/shared-assets/workbench/.
- Atomic scene swaps, canceled stale loads, last-scene retention and Retry are
  implemented. Track changes update the backdrop. No other-map garage fallback.
  Map/profile garage records fixed placements and camera shots.
- Both new maps passed actual-delivery geometry/material audits. Arena keeps
  Float32 positions; do not restore 16-bit terrain positions. Source route/prop
  checks passed. Reuse recovery, prefabs, HDR and compressed textures.
- Verified: 204 full tests, 12 final focused tests, build/content checks, ten
  rapid browser selections, Low bench views on all four maps and paint preview.
- True 1280x720 Low: Hangar 2,247,151 triangles / 164 calls; Arena 1,244,989 / 176.
  Triangle budget exceeded. UHD 620 FPS, eight-drone runs and complete manual
  source courses remain unverified.
- Required caches/junctions: D:/DroneLiftoffUz-import-temp/preserved-cache.
  Do not delete them. AssetRipper fallback: 2022.3.62f3. Heavy Blender stages run
  one at a time. Never repeat full recovery without changed/missing inputs.
- Placement: node tools/place-workbench.js -> npm run build -> content:check.
  Material-only: refreshMaterials -> deliveryMaterials -> audits. Alpha changes
  require export first. Use the prepared GLB/KTX2 cache for unchanged textures.
- Licensed-only candidate: data/menu-qa/release-20261010, one map/four drones;
  final build/content validated, current candidate not browser reverified.
- Local game: http://127.0.0.1:2590/. Check availability before reporting it live.

## Current handoff — verified 2026-10-10

- Scope: local Vector FPV UI/rebrand draft plus Minus Two preview; Oracle has not received these changes. Read `docs/UI-REFINEMENT-20261010.md` for this follow-up, not the full import history.
- Active maps: `ironworks-v2`, `minus-two-demo`. Twelve old generated packages and their gameplay definitions are backed up at `content/archived-maps/`; copying one whole package into `content/maps/` restores it. See `docs/MAP-ARCHIVE.md`; single-folder Hangar restoration was verified and the check copy retained in `data/menu-qa/restored-hangar/`.
- Garage is an independent neutral preview scene with atomic model swaps and direct color updates. Workbench no longer has Installed Build; parts show authored choices, preserve installed legacy selections, and disclose specs/performance. Flight has attitude HUD and a 1.2 m chase distance with independent 72 degree FOV. Branding is a draft, not user acceptance.
- Local tests: 189/189 passed (`data/menu-qa/full-polish.log`); final chase change passed 11 affected tests. Browser access was explicitly allowed. Chrome verified menu/garage/Workbench, live paint and propeller swaps on Low/custom; a separate in-app guest verified unauthenticated startup and Low flight with a real 44 degree bank. Original Chrome preferences/build/selection restored. See `docs/UI-REFINEMENT-20261010.md`.
- Local release candidate: `data/menu-qa/release-20261010/` builds and validates independently, containing only licensed Ironworks v2, not Minus Two, archived maps, env files or databases. Runtime Basis/Draco decoders are included; `RELEASE.json` records verification. Public HTTPS/health were 200 on 10 October, but public title/catalog still use the old name/twelve maps; current SSH port probe timed out. Deployment requires restored Oracle access and the documented backup/drain/release checks.
- Profile: `tools/import-profiles/minus-two-demo.json`. Cache: `data/minus-two-recovery/`. Package: `content/maps/minus-two-demo/`; editable source: `map.blend`.
- Seasonal props and CombinedCharacter/PlayerDummy removed. All three LODs passed 7,823 probes with zero missing/moved opaque surfaces; see package `geometry-coverage.json`.
- Five source races `minus-two-demo-liftoff-01` through `05` now include their original visible props, non-trigger collisions and authored LODs. Each has `track.blend`, `props.glb`, SOURCE and inventory. Source repair/charge logic is not implemented.
- Glass alpha/BLEND, AO and detail textures repaired. `materialsCheck`: 49 materials, zero missing bindings; 18 normal maps and 28 roughness maps. One triplanar shader is approximated using source UVs; unsupported shaders must be mapped explicitly.
- Build and 175 tests passed; five starts/gate openings checked with prop collision; two-client multiplayer smoke passed. Only the selected track's assets are downloaded. Full manual completion of every race remains unverified. User explicitly allowed both local origins. Affected UI/Low free-flight checks passed; complete manual source races remain unverified.
- Earlier Low measurements predate these props/settings; remeasure before claiming budgets. UHD 620 FPS remains unverified.
- Local URLs: game `http://127.0.0.1:2590/`, editor `http://127.0.0.1:2570/`. Check availability before reporting them running.

## Resume only affected stages

Run each stage separately; `plan` lists stages without executing them:

```powershell
node tools/import-game-content.js tools/import-profiles/minus-two-demo.json --step=plan
```

Replace `plan` with a stage below. Follow prerequisites in the detailed guide.

| Change | Minimum route |
| --- | --- |
| Existing race/mission JSON | Edit canonical `content/` JSON → `sync` → content/focused scenario check → `build` |
| Source race layouts/models | `tracks` → `trackModels` → `trackOptimize` → `trackCollisions` → `markers` → `sync` → checks → `build`; reuse cached prefab resources |
| Saved Blender geometry | `export` → `optimize` → `geometryCheck` → `materialsCheck` → `package` → `sync` → checks → `build` |
| Import exclusions | `exclusions` → `collisions` → `assemble` → geometry route above |
| Another map | Separate profile/cache/IDs → small `probe` first; follow detailed guide |

Checks: `npm run content:check`; source races: `node tools/check-liftoff-tracks.js`; materials: `materialsCheck` / `trackMaterialsCheck`; own scenarios: pipeline `check`. The `build` stage also syncs content. For material/prop/graphics tasks, read the first section of the detailed guide.

## Avoid expensive or destructive repetition

- Do not rerun `inputs`, `recover`, `textures`, `lightmaps`, `recoverTracks` or `gateConfig` when their inputs/caches are unchanged. Missing cache or changed source requires recovery, not invented data.
- `assemble` overwrites `map.blend`: make a backup and verify matching SHA256 first. Current backup: `data/minus-two-recovery/before-materials-20261010/`. `course`, `tracks` and `package` regenerate content; preserve edits or move them into profile/source before running.
- Keep `lod.preserveGeometry=true`. Percentage/COLLAPSE decimation caused holes; do not restore it or patch holes individually. Do not instance objects across different LOD parents. Recheck geometry after export changes.
- Do not publish this map with generic `content:blender --publish`; it loses the prepared LOD structure. `markers` is the supported marker update.
- New maps can require adapter changes. Keep installation read-only, preserve provenance and Kestrel settings. Redistribution permission is unconfirmed; deployment is separate from local completion.
