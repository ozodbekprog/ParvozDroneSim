# Public stability — 23 October 2026

## 23 October 15:58 Tashkent — live release, after-run matrix in progress

Release **20261023-stability-03**, runtime **78fb1f8**, is now publicly serving
`index-D31s-vkZ.js`. Oracle sign-in, exact already-authorized SSH source rotation,
VM build/399 hashes, isolated and public two-client Pine/Green races, all 132
public resources and a restored fresh pre-update cloud copy passed. Accounts,
envs, admission 20 and $0 are preserved. No new imports/art exports.

After-release direct canonical-URL Edge evidence is under
`design/public-stability-20261023/after-stability-03/`: cold native **3.489 s**,
repeat with normal caching **1.298 s**, zero startup GLB requests. Six scenarios
and post-backup/player-row comparison are still in progress. These timings do
not prove target-hardware FPS or matched native-network speedup.
`current` intentionally remains on the previous release until final checks.
Historical blocked/unpublished statements below describe earlier checkpoints.

### After-release evidence checkpoint — 16:40 Tashkent

| Run | Conditions | Observed result |
| --- | --- | --- |
| 1 | Direct public Edge, HTTP cache cleared/disabled, optional encoded cache deleted, retained cache empty, native network | Ready **3.489 s**, longest task 135 ms; client 786,474 transferred bytes; zero GLB requests |
| 2 | Repeat with normal HTTP caching | Ready **1.298 s**, longest task 263 ms; client transfer 0 confirms HTTP cache; zero GLB requests |
| 3 | Same cold-resource procedure, 5 Mbps /160 ms | Ready **3.271 s**, longest task 96 ms; client 786,474 transferred bytes; zero GLB requests |
| 4 | Exact catalog URL blocked, native network | Exactly 3 inspector-blocked requests, Russian connection error + Retry; unblocking and Retry recovers in **675.5 ms**, no page reload |
| 5 | First Hangar, leave while loading, reopen and menu navigation | Pending: Browser Use disabled before this scenario |
| 6 | CPU4 after startup, first flight, movement/reset/exit | Pending: same browser access block |

No JavaScript errors or focus/visibility transitions in the first four records.
Driver shader cache is not reset; these are not target-hardware FPS measurements.
For run 4, `readyAt` includes the deliberate human/agent wait at the error gate;
subtract the recorded `retryActionAt`, rather than calling that whole interval
startup/recovery latency. The following flight-setup navigation was incidental,
not a completed first-flight scenario. Test tab 14803452 remains at flight setup;
CPU1, normal network/cache and no URL blocks were restored before access stopped.

Fresh post-update cloud copy restored on VM at 11:40 UTC; checked read-only
comparator confirms all original player rows (sessions excluded) remain. SHA-256
`06f935471637be99036af92e50af384189386e1352597f427f9d448bdfa7c28a`.
Both cloud restores and production env/volume checks are complete. New release
is live, but final `current` switch awaits the remaining two browser scenarios.
Do not rerun activation, imports, completed backups or invent six passed runs.

## Afternoon continuation — latest state

**Latest runtime: 78fb1f8da1559fc4ec8ef519724637f5bfabdf7f; candidate-03 below.**
Console authentication remains incomplete: one confirmed login opened Oracle
My Apps, the console requested its own login, and the page returned to its normal
sign-in form. The user has been asked to complete that console session manually
and report «консоль открыта». Do not keep resending phone prompts or ask again
for the already authorized SSH source rotation. No ingress/VM change occurred.

Edge is connected again after the user's confirmation. The original six public
baseline scenarios are now exercised against the **21 October release**; this
does not verify the new candidate. The interrupted fifth run was replaced by a
foreground run with cleared HTTP/optional encoded cache, retained cache empty,
5 Mbps / 160 ms: **Ready 72.554 s**, longest task **280 ms**, all four required
files have positive network transfer. No focus/visibility changes or JS errors.

Sixth scenario: CPU emulation rate 4 was applied **after startup**, followed by
Settings, Graphics, maps, first Free Flight, reset/keyboard input and exit.
First flight readiness **12.499 s** from its marker; longest task **939 ms**.
The map/close model were retained; Low/far models really transferred roughly
20.8 MB. Final HUD shows movement at 10 km/h. Low surface settings, adaptation
off, actual **836×420** framebuffer: functional stress diagnosis, **not** the
1280×720 hardware acceptance. CPU/network/cache controls were reset afterward.

Local runtime **087c2b54d274436e06bdf7a258627ce1eaf6dfd3** additionally skips map
collision downloads/BVH construction for menu/Hangar presentations. First flight
awaits the complete authored physics even when it reuses the Hangar environment;
completed physics is reused without duplicate colliders. Failed loads retry and
older catalog completions cannot replace newer data. A regression first failed
on the old warm-flight path; final collision/scene/startup checks **37/37**, build
and content validation pass. Ordinary push matched origin/main at this commit.

Actual local Chrome checks: home/settings issued no content-model requests;
leaving an unfinished Hangar canceled both model/environment requests; reopening
and first flight worked. With the exact collision URL blocked, the new Hangar
completed without requesting it, flight stayed at a Retry error, then recovered
after unblocking without page reload. These localhost checks are implementation
QA only. That capture exposed `Failed to fetch`; subsequent runtime `78fb1f8`
replaces exhausted transport failures with a clear RU/UZ/EN recovery message,
retains the original cause and keeps cancellation distinct. Red/green regression;
**29/29** network/download/localization checks and build pass. Actual browser
check confirms three blocked requests, the Russian message, enabled Retry and
recovery into flight after unblocking. See `candidate-readable-error-local.*`.

Model processing still produces long tasks, including **1214 ms** in one local
production-build Hangar. Source-loader metrics locate time in parsing rather
than cloning (map 139 clones total 23.8 ms). A temporary two-worker Meshopt trial
did not eliminate long tasks (474 vs 424 ms maxima, uncontrolled cache/warmup);
it was reset by reload and **not shipped**. Do not claim full smoothness.

Latest candidate **20261023-stability-03**, prepared/verified, not deployed:
`data/stability-20261023/candidate-03.tar.gz`, **3,212,095 bytes**, SHA-256
`81de2164eb13cb06e8c80afd91bef9a19da72e130a04ede57207d08cd0f80d4e`.
All **35** archive members checked; 15 changed / 384 reused inventory files.
Client `index-D31s-vkZ.js`, SHA-256
`a7fea3bf1d7635a9cea5f81575c40cfc4b2e7709f05bf1ce352910f6e3cf7807`.
Earlier candidates `stability-01` and `stability-02` are superseded, not published.
No new ingress, release or backup yet. Local QA servers were stopped after use;
only isolated test data and verified candidate artifacts remain under ignored data/.

## Morning check — 09:00 Tashkent

The browser connection is available again. Temporary network throttling, blocked
URLs and disabled HTTP caching on the test tab were reset; a reload removed the
temporary page observers. The fifth run eventually reached Ready at 507.876 s
with all four files transferred, but its unattended/occluded interval prevents
foreground acceptance. The sixth CPU/flight run remains unperformed.

Fresh HTTPS/client-hash/health/catalog checks at 09:01 still match the deployed
21 October release; the candidate is **not published**. SSH still times out.
Oracle shows the ordinary sign-in form again: the user must finish that login
and any phone confirmation. Browser setup no longer requires user help. The
other remaining user dependency is the intended brand social profile/channel.
Evidence: `05-morning-observation.json` and `morning-public-state.json`.
The one-time morning automation `parvoz` was deleted after this check.

Status: local fixes verified and pushed; public candidate acceptance/publication
blocked by Oracle login and pending candidate browser acceptance. User prioritizes six varied direct public-game
runs and critical first-visit failures over new content or promotion. Do not
present the 21 October fast samples as evidence against current slow reports.

## Verified observations

- Direct canonical HTTPS in Edge, cleared HTTP and optional encoded cache,
  retained-download cache empty: **345.673 s** to Ready. The 39.9 MiB startup
  gate blocks the menu during the entire download. This is a failed startup UX.
- Read-only transport comparison from this computer: 1 MiB identity Range,
  HTTP/1.1 1.812 s, HTTP/2 4.558 s. This does not isolate the browser's much
  slower connection or establish the hosting root cause.
- Evidence: `design/public-stability-20261023/`. Keep network, processing and
  observer/action delays separate. Driver shader caches are not reset.

## Run matrix

| Run | Condition | Result |
| --- | --- | --- |
| 1 | Edge cold, real network, native conditions | Ready 345.673 s; unacceptable |
| 2 | First Hangar after cold startup | Environment 18.507 s; preview ready by 27.531 s observation, post-action longest task 136 ms |
| 3 | Repeat page with saved encoded assets | Ready 5.659 s, longest task 271 ms |
| 4 | Offline document; then precise startup API failure and online Retry | Browser offline page is expected; API failure leaves a manual Retry gate; after Retry the menu recovers |
| 5 | Cold resources, 5 Mbps / 160 ms emulation | Foreground repeat Ready 72.554 s, four real network files, longest task 280 ms; earlier interrupted/unattended captures retained as invalid |
| 6 | CPU pressure, menu and first flight | CPU4 after startup, mixed cache, first flight 12.499 s, longest task 939 ms, actual movement/reset/exit; functional only, 836×420 |

## Needs the user in the morning

**Update:** browser access is restored and the temporary test controls have been
reset. The browser dependency below is historical. Only Oracle sign-in/phone
confirmation and the intended social profile currently require the user.

- Browser Use reports **Local browser use is disabled in Work settings** after
  the user's Continue interruption. Do not bypass this using another automation
  mechanism. Re-enable the existing connection to finish the fifth/sixth runs
  and candidate visual/public acceptance. Temporary 5 Mbps / 160 ms emulation
  may remain on the agent's test tab (14803275); reset it before ordinary use.
- Oracle requests an approval notification on the existing SM-A536E device.
  Existing credentials were submitted once; no new account/key was created.
  Stop at MFA. SSH currently times out. The user already authorized the exact
  source replacement **144.124.196.183/32 → 144.124.199.147/32, TCP 22**.
  After authentication, edit only that rule and verify SSH before publication.
  One authorized ipify query returned the new address; do not repeat it without
  a new reason. No cloud firewall change has been saved yet.
- Publishing the prepared Instagram/YouTube materials needs the intended
  brand profile/channel and a working session. No destination was identified;
  do not publish from the user's personal account or create a random account.

## Local changes

- `129e1df`: GET requests recover transient transport/upstream failures with
  at most three attempts. POST/account mutations are never automatically retried.
- Immutable file transfers resume a verified uncompressed Range after a broken
  stream, restart safely when Range is ignored, and reject invalid/short bytes
  before caching. A silence timeout replaces an endless wait; last-subscriber
  cancellation terminates recovery. Focused network checks: **31/31**.
- Startup now waits for the server and renderer, not a map, close aircraft or
  physics collisions. Menus use a small existing game capture until a real
  environment is already loaded; navigating settings never initiates a full map.
  Actual flight preparation remains mandatory before entering a flight.
- Leaving a loading Hangar cancels its pending scene. A delayed menu promise
  cannot re-enter that Hangar later. Both formerly failing races have tests.
- Final runtime source: **91887c2094372eae50b5f1d8dd8f70d657197cc6**. Ordinary push
  to private origin/main matched that SHA. The previous network fix is a separate
  commit; no unrelated unfinished changes were included.
- Full suite **504/504** passed in 415.575 s before the final Hangar cancellation
  fix/two new cases. Final affected suite, including all changed network, startup,
  scene, graphics and locale checks: **57/57**. Final production build and content
  validation pass: five maps, 30 races, five aircraft, 42 parts, 12 tutorials,
  44,079 asset references. These checks are not browser acceptance.
- Another chat's committed 30% render-resolution controls (`9fb3070`) are
  preserved. That feature is also pending public release; do not remove it.
- [Audience and product plan](PRODUCT-DIRECTION-20261023.md) and
  [prepared marketing cards/copy](marketing/20261023/README.md) are local outputs.
  No new Liftoff imports, paid services or promotional posts were performed.

## Publication boundary

Oracle remains the verified 21 October release until a new release is actually
deployed and publicly checked. No player database, env file, asset or image was
changed by this investigation. Commit/push is separate from deployment.

Read-only public check at **23 October 01:41 Tashkent** still serves
`index-7TSF7k3X.js`, SHA-256
`8763faa9ef0601327fce7d54ed9f52199ea698e7a44d86af84fa222f65cf21be`;
health is ok, protocol 13, revision `2132caf43c0e38df`, compact catalog 217 bytes.

Prepared candidate **20261023-stability-01**, **not uploaded or deployed**:
`data/stability-20261023/candidate.tar.gz` (3,210,859 bytes), SHA-256
`c8a8d8d2940dff7f39be74fa97015d8ceea1a33bf097a4fd8b5fde201d1936b5`.
All 34 archive members were independently read back and checked. It contains
32 runtime/build files, with a delta manifest of 14 changed and 384 reused files.
Client `index-99QjUIgP.js`, SHA-256
`87212a26caea4cb8ebcda18dbd0664f0a20b147645d355fde4e58cdb32b05a36`.
The unchanged canonical source pointer remains `20261020-optimization-01/content`.
Keep the small unpacked candidate until the pending visual/release checks finish;
it is reviewable, not an automatically approved production update.

## Exact continuation

1. Edge is connected; the six baseline scenarios are complete and controls reset.
   Reuse their evidence. Await the user's manually completed **console** login;
   do not repeat baseline runs, imports, finished builds or phone prompts.
2. In the authenticated console, apply only the already authorized TCP 22 source replacement.
   Verify SSH, current VM release/inventory, disk budget and rollback image.
   If the VM differs from the retained baseline, regenerate the delta deliberately.
3. Use the verified **candidate-03** archive from runtime `78fb1f8`. Local visual
   and fault/recovery QA is complete; it is not public acceptance. Preserve the
   other chat's 30% controls. Regenerate the delta only if the actual VM baseline
   or runtime source differs. Do not reuse the superseded candidate-01/02 archives.
4. Fresh cloud backup/restore on VM, isolated candidate checks, drain races,
   activate in a new release directory, verify direct public six-run matrix,
   player rows and after-backup before current/finalization. Keep admission 20,
   private envs, player volume, source release and rollback. Do not rerun old
   completed 21 October deployment helpers.
5. After successful verification, record actual deployment in Oracle state,
   commit/push evidence, and remove only verified duplicate temporary stages.

The one morning heartbeat **«Утренний итог Parvoz»**, id `parvoz`, ran at
**09:00 Tashkent, 23 October** and was deleted after checking. Do not create a
duplicate reminder without a new user request.
