# First-visit tester report — 20 October 2026

Publication follow-up, 21 October: these fixes are now shipped in finalized
`20261021-cold-start-01`. See [current deployment](ORACLE-DEPLOYMENT.md) and
[direct Edge verification](COLD-GRAPHICS-20261021.md). The 20 October status and
measurements below are historical; target-hardware acceptance and intermittent
network-transfer cause remain unconfirmed.

Status: local fixes verified; not published. Oracle remains
`20261020-optimization-01`, protocol 13, content revision `2132caf43c0e38df`.
This work does not establish playability or resolve all reported freezes.

## Report and limitations

The tester could not complete an initial launch, recalled a server timeout,
reported unclear loading, menu freezes and poor graphics/performance.
User confirmed i5-10300H / GTX 1650. Browser, RAM, active GPU, settings,
exact error and failing screen are still unknown.

The user correctly pointed out that our existing browser has game caches.
Warm-origin observations must not be used as first-visit acceptance.
The public and local browser checks also had different saved settings and
aircraft; their elapsed times are not a before/after comparison.

## Evidence

- Public health returned HTTP 200 in 1.375 s during this session.
- The matching source error is `The server took too long to respond. Please
  try again.` in `src/client-request.js`, after a 15-second API timeout.
  This is a possible match to the recalled error, not confirmation.
- Live `/api/catalog` returned 14,816,039 decoded bytes, about 607,567 bytes
  with browser zstd (630,267 with gzip). The client already embeds the
  canonical catalog. Duplicate transfer, parsing and catalog installation
  are real costs; they do not prove the tester's timeout cause.
- One warm public menu sequence (Hangar → Home → Settings → Home) recorded a
  431 ms main-thread long task. Longer tester freezes were not reproduced.
- The warm public browser had saved Low, 65% resolution and 256 px textures.
  Those settings explain reduced detail there, not the tester's settings.

## Cold content-cache run

`tools/qa-cold-start-proxy.js` creates a fresh loopback origin on an OS-assigned
port and forwards all page/resource requests to the public Oracle host.
It does not read local asset files or reuse the original origin's CacheStorage,
HTTP cache or localStorage. Existing browser data is not deleted.
The request report includes paths/status/bytes/timing only, without credentials.
It is a startup/menu probe, not a multiplayer proxy.

Run against the **unchanged published version**, 20 October at 13:31 Tashkent:

| Request | Network bytes | Total |
| --- | ---: | ---: |
| Main JS, zstd | 781,532 | 1.887 s |
| Catalog, zstd | 607,567 | 1.740 s |
| Minus Two model | 26,340,900 | 9.163 s |
| Kestrel close model | 11,030,204 | 2.523 s |
| Collision JSON, zstd | 396,662 | 1.442 s |
| Basis WASM, zstd | 256,297 | 1.224 s |

Requests overlap: do not sum them as total startup time. Around 12 seconds
after language selection, the observed UI remained at “Preparing 85%”.
All listed transfers completed HTTP 200. Browser access subsequently became
disabled in Work settings, so Ready/Play and the cold menu transitions were
**not verified**. This probe does not reset driver shader caches, emulate the
tester's network or identify their active GPU.

Raw evidence: [cold-public.jsonl](design/tester-startup-20261020/cold-public.jsonl).

## Local fixes

1. Startup sends the revision of its installed catalog. An exact match returns
   only server status/week/protocol. Actual local response: 216 bytes, versus
   13,991,753 for the full local catalog. Old clients still receive the original
   full response; changed revisions still install the full server content.
   This also helps a first visitor because the canonical data arrives with JS;
   it does not depend on a previous browser visit.
2. Loading now exposes the concrete phase, decoded MiB loaded/total, completed
   file count and elapsed time. Preparation stages show elapsed time rather
   than a fabricated ETA. Russian/Uzbek translations are included.
   Byte download progress still occupies 0–80%; model/graphics stages are
   fixed milestones, not measured time percentages.
3. A reusable cold-origin probe preserves the user's existing caches.

29 focused tests passed, including an initially failing server regression,
old/changed catalog compatibility, account persistence, isolated multiplayer,
loading/retry/cancellation and localization. Production build passed with the
same content revision. Local browser verified language selection, preparation,
Ready/Play, guest Home and Hangar entry; final Hangar readiness was not captured.
[Actual local loading screenshot](design/tester-startup-20261020/loading.png).
Full suite: **487/487 passed**, zero failures/skips, 565.259 s. Local log:
`data/tester-startup-tests-20261020.log`. The prolonged CPU-intensive portion
eventually completed; it was not an assertion failure or interrupted run.
Code saved in `a23ffe5` (catalog) and `8f219f6` (loading), both pushed to main.

## Continue

- Browser access was restored and a complete public cold run is recorded
  below. Compare public baseline and candidate with the same browser, default
  graphics, network and aircraft. Observe complete Ready, guest entry,
  initial Hangar, Settings and first flight; capture timings and errors.
- Get the tester's browser, settings and exact timeout/screen. Do not infer
  their active GPU from the laptop specification alone.
- The default menu still needs 39.9 MiB decoded essential files; no geometry,
  texture or first-frame GPU cost was reduced here. Further scene/decode/GPU
  profiling is needed. Do not claim FPS or graphics acceptance.
- Deployment remains pending. Use a new release, fresh verified cloud backup,
  production-data preservation and rollback procedures. Recorded VM disk is
  only about 530 MB free; inspect it before staging/building.

## Browser restored: second public cold run

20 October, started around 13:53 Tashkent. A new loopback origin fetched the
unchanged Oracle release; language selection confirmed fresh site storage.
Ready/Play was observed 28.05 seconds after language selection, including
intervals between agent observations (an upper bound, not an exact ready event).
Guest entry, completed Hangar model/thumbnail display, Settings and Graphics,
first Minus Two free flight, throttle response (HUD reached 24 km/h), pause
and return Home all worked. No error-level messages were captured.

The new origin selected **Auto → Low**, 65% rendering, 256 px textures,
adaptive resolution enabled. This is not a GTX 1650 or fixed-720p benchmark.
The user's old settings were not changed.

Network observations from the loopback proxy:

| Request | Bytes transferred | Duration |
| --- | ---: | ---: |
| Catalog, zstd | 607,567 | 1.622 s |
| Default map GLB | 26,340,900 | 16.776 s |
| Kestrel close GLB | 11,030,204 | 10.408 s |
| First Hangar environment GLB | 3,409,196 | **60.670 s** |
| First flight Kestrel far GLB | 10,299,248 | 10.890 s |

The first Hangar stayed visibly busy beyond 21 seconds. The 60.670-second
transfer finished HTTP 200, with first response headers at 502 ms. A subsequent
direct request for that identical Hangar file completed in 2.516 seconds
(first byte 985 ms). This establishes an intermittent slow cold transfer in
this run; it does not separate upstream throughput, proxy/client backpressure
or browser scheduling. Do not attribute it to shaders or claim it repaired.

A read-only browser diagnostic command itself took about 20 minutes to return.
Exclude that tool latency from game timings; exact Hangar-ready latency is
unavailable. Proxy request timings were recorded independently.

Evidence: [request timings](design/tester-startup-20261020/cold-public-02.jsonl)
(repetitive content-revision polls omitted),
[default graphics](design/tester-startup-20261020/cold-public-settings.png),
[first flight](design/tester-startup-20261020/cold-public-flight.png).
This removes the browser-access blocker and confirms one complete cold
functional run. The tester's timeout, intermittent loading, steady-state
performance, visual acceptance and matched candidate comparison remain open.
No production release or additional game-code change was made.
