# Cold browser graphics diagnosis — 21 October 2026

**23 October follow-up:** a new direct public cold Edge run took **345.673 s**,
so the three fast runs below do not establish stability. New local recovery/menu
fixes are pushed but not published. The fifth/sixth public runs and candidate
acceptance remain incomplete because browser access is disabled and Oracle MFA
is pending. Continue in [PUBLIC-STABILITY-20261023.md](PUBLIC-STABILITY-20261023.md).

Status: **published and finalized** as `20261021-cold-start-01` at
2026-10-21T09:09:14.039Z. Current pointer, HTTPS, API, all 132 resources,
public two-client races, browser flow and before/after cloud restores pass.
See [actual Oracle release](ORACLE-DEPLOYMENT.md). Target-hardware acceptance
and the intermittent slow transport cause remain open.

## Published direct Edge checks

The user requires the canonical **https://parvoz-drone-sim.duckdns.org/** directly.
No localhost/proxy run is public acceptance. Source `b124f54`, client
`index-7TSF7k3X.js`, protocol 13 / revision `2132caf43c0e38df` are deployed.

An initial 3.3 s candidate observation was rejected: model Resource Timing showed
`deliveryType: cache` / zero transfer, despite a cache-disable command. Real cold
checks then cleared HTTP cache with `Network.clearBrowserCache`, deleted only
the optional encoded-asset CacheStorage and reloaded the document to clear RAM.
Retained-download storage was observed empty; account/session/settings were kept.
Every required asset must show positive network transfer before accepting a cold
run. Do not rely on `Network.setCacheDisabled` alone. Driver shader caches were
not reset. The rejected run is retained in `edge-published-rejected-cached.json`.

| Direct public cold run | Ready | Largest main-thread long task |
| --- | ---: | ---: |
| 1 | 17.166 s | 305 ms |
| 2 | 8.467 s | 316 ms |
| 3 | 8.203 s | 319 ms |

All four required assets transferred in every run. Matching-revision catalog is
now **217 bytes decoded**, rather than 14,816,039. The scene took 11.362 s in run 1
and about 3.5 s in runs 2/3. Network variability prevents attributing the entire
difference from the old 128.3 s attempt to the code change. Server access logs
independently confirm the old 116.702 s response body delivery; no TCP/kernel or
hosting-resource change was made.

First Low Hangar: ready within **2.304 s of the automation action marker**, including
1.570 s environment transfer, no main-thread tasks >=50 ms. Repeated
Home/Hangar/Settings navigation also recorded none. First free flight: ready within
**4.324 s of its action marker**, largest long task 111 ms; the two additional drone
models transferred 20,816,148 bytes. Throttle, pitch/yaw, pause and exit worked.
High Hangar rendered with reflections, with no captured console warnings/errors;
this is a functional check, not High FPS acceptance.

Published Low capture: WebGPU, real **1280x720**, adaptation off, 30 s warmup plus
180 s / 13,899 samples; mean **77.22 FPS**, median **13 ms**, p95 13.1 ms, p99 13.2 ms,
1% low **75.16 FPS**, maximum 25.9 ms, **zero frames >50 ms**. Inputs were short and
substantial time was stationary; this is not a standardized route or a controlled
FPS comparison to the older ground-only run. Peak 332,368 triangles exceeds the
provisional Low budget; resident textures are unmeasured. The user's ANGLE Intel
UHD string does not identify the WebGPU adapter, GTX 1650 or UHD 620 performance.

Evidence: `public-release-verification.json`, `public-delivery-verification.json`,
`edge-published-cold-start*.json`, `edge-published-hangar.json`,
`edge-published-menu-loop.json`, `edge-published-first-flight.json`,
`edge-published-low-720p.json`, screenshots in `design/cold-performance-20261021/`.
Original Auto Low/65%/256px and Acro were restored, temporary observers removed,
and normal HTTP caching restored. Public game is left open in Edge.

## Historical diagnosis before publication

The user explicitly requested a different browser and empty caches. The Browser
inventory contained external Chrome and the in-app browser, but no Edge. A
user installed Edge and its extension later in this session; it is now connected.
Earlier Chrome measurements below are not Edge acceptance.

An external Chrome tab used a newly created loopback proxy origin forwarding
all files from the unchanged public server. Its initial language selector and
request report establish fresh game storage without clearing the user's old
profile. This does not reset the driver shader cache. The browser exposes
NVIDIA Turing / 16 GB; this is not proof of the tester's active GPU model.

Public first-visit data: the 26,340,900-byte Minus Two map took 3.435 s,
catalog 607,567 compressed bytes took 1.719 s, first Hangar environment
3,409,196 bytes took 3.181 s. The earlier 60.670 s transfer did not repeat.
The startup observer captured a **4,544 ms main-thread long task**.
The local proxy source report is `data/tester-cold-public-20261021-01.jsonl`.

Ranked checks: network delivery; scene/model processing and graphics preparation;
repeat preparation when navigating menus. Real shader building and reflection
capture both reproduced long blocking work, independently of network transfer.

## Changes

- `compileScenePrograms` prepares structural variants in small CPU slices and
  yields to browser input/painting. Independent GPU compilation remains parallel.
  Live visibility is restored before every wait; a replaced scene stops new work.
- The renderer retains the previous picture during preparation instead of
  rendering an incompletely warmed scene in between preparation slices.
- Three r180 `PMREMGenerator.fromSceneAsync` synchronously performs its six
  captures and all blur levels after renderer initialization. The isolated
  `prepareReflection` adapter prewarms each view and yields between views and
  convolution levels, restoring render target, MRT, auto-clear and background
  at every asynchronous boundary. WebGPU retains the original capture and blur
  math. WebGL keeps the native r180 capture path: its experimental readback
  differed (15,068/786,432 values, RMSE 0.002389, maximum error 0.15863), so the
  progressive path is disabled there pending separate image-parity work.
- Local QA now exposes Medium/High and records synchronous compile/render slices,
  plus an actual GPU reflection pixel comparison.

No quality preset, texture size, geometry, map, aircraft or flight physics was
reduced to obtain this change. These changes and the prior catalog/loading-detail
fixes are now included in the published release above.

## Measurements and limits

Same external Chrome, WebGPU, Minus Two, Kestrel, fixed 1280×720, adaptation off.
Each QA reload creates fresh decoded models/renderer; local asset/network and
driver caches and concurrent host workload are not equivalent to a new PC.
Use CPU slice measurements to assess responsiveness; do not infer an end-to-end
network speedup or target-hardware FPS from these local runs.

| Observation | Before | Candidate |
| --- | ---: | ---: |
| Low initial single shader-building call | 1,811.3 ms | 185.4 ms in initial sliced run |
| High initial surface/reflection work | 5,780.1 ms, synchronous | 3,287.4 ms spread over slices in final run |
| High initial scene total, local QA | 19,077.5 ms | 11,101.2 ms in final run |
| High largest final compile slice | — | 536.3 ms |
| High largest final render slice | — | 165.0 ms (shadow capture 158.0 ms) |
| First High Hangar, final run | — | 868.4 ms total, 105.9 ms largest compile slice |

WebGPU readback compared the original and progressive reflection atlases:
**786,432 channel values, zero differences, maximum error 0**. Evidence is in
`docs/design/cold-performance-20261021/`. The first High attempt after just the
shader fix still blocked for 6,170 ms; this caught the separate reflection issue.
Intermediate sequential-GPU scheduling was rejected and replaced with parallel
submission; do not use its wall-clock timings as final results.

The remaining 0.54 s individual shader build and model-processing stalls are
still material; this is not acceptance of completely smooth first startup.
Larger maps, the tester's browser/active GPU, fixed-resolution UHD 620 performance,
the recalled API timeout and intermittent slow network transfers remain open.

## Verification before publication

Full suite **494/494** passed in 529.586 seconds before the final WebGL native-path
guard. The final affected checks including the guard pass **43/43**; the final
build passes. The earlier full run caught an empty-scene warmup regression, which
was repaired and is covered by the passing scene-switching/empty-selection tests.

The user corrected the acceptance method: open the canonical public HTTPS URL
directly, with no loopback proxy. Fresh direct Edge showed language selection,
completed initial startup, guest entry, Hangar, return Home, Graphics settings
and the first Minus Two free-flight startup. Its fresh Auto selects Low / 65% /
256 px textures. This explains reduced detail in that observation but does not
establish its active GPU or FPS. The user manually supplied Edge's GL_RENDERER:
`ANGLE (Intel, Intel(R) UHD Graphics (0x00009BC4) Direct3D11 vs_5_0 ps_5_0, D3D11-31.0.101.2115)`.
This identifies the ANGLE/D3D11 path, not necessarily the adapter chosen by the
WebGPU capture. Do not label the Edge report as a verified GTX 1650 or UHD 620
measurement. Browser policy blocks the agent from opening the internal GPU page;
no workaround was used.

Direct public Resource Timing evidence is now saved in
`design/cold-performance-20261021/edge-public-direct-network.json`. The served
client is still `index-D41ectSg.js`; this is the published baseline, not the
candidate. The 26,340,900-byte map transferred in 3,169.5 ms; Kestrel Hangar
11,030,204 bytes in 2,100.1 ms; first-flight Low/Far models 10,516,900 and
10,299,248 bytes in 4,315.3 and 4,287.8 ms. Catalog transfer was 607,567 bytes
compressed / 14,816,039 decoded in 1,241.8 ms. These are individual request
durations; they overlap and must not be added into a startup duration. Idle
language/menu observation gaps also prevent an exact end-to-end startup claim.
The 34 filtered resource entries total 66,372,618 transfer bytes including
headers; three later image/logo accesses used cache within this visit. This is
not proof that every browser/driver cache is empty.

The first fixed-720p capture was stopped early and rejected: 11 sampled frames
were spaced about one second apart while the window was not in front, despite
no `document.hidden` flag being recorded. The HUD retained an older 43 FPS /
23 ms value through this period; do not report that as measured game performance.
The rejected report is retained as `edge-public-direct-rejected-background.json`.
Bringing the public tab to the foreground restored continuously advancing flight
time and HUD updates. A separate fixed-resolution run then completed with valid
capture conditions: WebGPU, Low, 1280x720, adaptation off, 30 s warmup +
180.001 s / 13,860 measured frames. Mean 77.00 FPS, median 13.0 ms, p95 13.1 ms,
p99 13.2 ms, 1% low 65.26 FPS; maximum 166.2 ms and two frames over 50 ms.
Peak 334,807 triangles / 169 draws exceeds the provisional Low triangle budget;
texture memory is unmeasured. The drone stayed on the ground at the spawn view.
The report is `edge-public-direct-static-720p.json`, screenshot
`edge-public-direct-flight-720p.png`. This is a static baseline on this computer,
not a flown route, the tester's GTX 1650 result or UHD 620 acceptance. No console
warning/error entries were returned for the direct public scenario at this point.

### Repeated direct public cold run

The same canonical HTTPS tab was then tested with HTTP cache explicitly disabled,
the optional `parvoz-encoded-assets-v1` CacheStorage deleted, and the document
reloaded to clear its in-memory models/bytes. The existing guest/session/settings
and retained-download cache were kept; the observed required assets all transferred
over the network. Driver shader caches were not reset. Instrumentation attached
at 2,279.6 ms and collected buffered long tasks from document start.

Ready/Play appeared **128,313.5 ms after navigation start**. Downloading began
at 3,974.9 ms, processing at 125,237.3 ms, Ready at 128,313.5 ms.

| Public request | Encoded bytes | Request duration |
| --- | ---: | ---: |
| Minus Two scene | 26,340,900 | 121,251.8 ms |
| Kestrel close model | 11,030,204 | 64,500.3 ms |
| Collision JSON | 396,662 (4,516,888 decoded) | 32,979.5 ms |
| Small aircraft metadata | 788 | 11,110.5 ms |

The scene and close-model response headers arrived in about 0.89 s after their
requests; most of their delay was body delivery, not shader work. The tiny
metadata request also waited about 10.94 s for headers. Requests overlapped.
During this run a separate public health request returned 200 in 1.438 s.
The data distinguishes network delivery from later processing but does not
isolate the VM, HTTP/2 transport, intermediate network or client-side cause.
Startup's largest observed main-thread long task was 540 ms on this run.
See `edge-public-direct-cold-start.json`, `edge-public-direct-cold-progress.png`
and `edge-public-direct-cold-ready.png`.

The first subsequent Hangar request fetched its 3,409,196-byte environment in
7,699.4 ms. After delivery, the observer recorded 143 ms and **1,306 ms** long
tasks; the preview then completed. This reproduces a separate interface freeze
on the actual public version. Evidence: `edge-public-direct-cold-hangar.json`.
No inferred shader timings or local candidate results replace this public result.

HTTP cache was restored to its normal setting and the page reloaded to remove
temporary instrumentation after collecting the evidence. Those pre-update tests
did not publish the candidate or resolve the intermittent slow transfer. A local gzip
probe saved only about 2% on the close model and under 1% on the Low/Far models;
generic compression alone cannot remove their duplicated download payload.

## Completed access recovery and release

SSH initially timed out while public health remained available.
The user signed into Oracle Console in Edge. Readback confirms the existing
drone-liftoff instance is Running, 84.8.106.32, A1 Flex 2 OCPU / 12 GB. The actual
security list permitted TCP 22 only from 144.124.199.147/32. With a new explicit
one-request authorization, ipify returned
144.124.196.183. The user explicitly approved replacing only that SSH source with
144.124.196.183/32. The source field was filled, but automatic approval review
rejected the Save changes click, stating that cloud-access changes need a fresh
action-time confirmation despite the received approval. No alternate automated
save was attempted. The user then saved the rule manually. Console readback and
SSH verified **144.124.196.183/32**; HTTP/HTTPS, ICMP and egress were unchanged.
Do not repeat the external-IP lookup without a new reason and consent.

The completed runtime patch is retained locally in
`data/cold-release-20261021/runtime-patch.tar.gz`: 32 runtime/build files,
11,463,823 uncompressed bytes / 3,163,279 archive bytes; archive SHA-256
`fc677999f4013991f299b41e0947eb6ff58bd4a63813eb487ea1e578a22f13fb`.
Its manifest records source `b124f5407d4d7dbd12d7a1021d1f58559a8aa023`,
baseline `f1477709fcc4617ec579cb00d298bb332fc36aa2`, unchanged protocol/revision,
and per-file hashes. It contains the final verified `index-7TSF7k3X.js`, no
canonical art, player database or env files. Its upload reconstructed the separate
393-file VM release, linking unchanged immutable assets and using the retained
20 October canonical source read-only for the build. VM build/content checks,
isolated and public two-client races, all public deliveries and before/after cloud
restores passed. All original player rows are preserved. Current pointer now
resolves to the new release; old release/image are retained for rollback.
Unused Docker build cache and duplicate unpacked/upload stages were removed only
after verification. Archive/manifest are retained; do not rerun completed helpers.
