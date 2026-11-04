# Map and route preparation — 14 October 2026

The original client kept at most 64 MiB of encoded assets in RAM. Hangar C03's
271 MB delivery and Arena's 174 MB delivery could never remain in that cache.
HTTP immutable caching could still avoid an Internet transfer, but a new scene
repeated parsing, texture preparation and GPU resource allocation. Menu and
garage transitions unnecessarily discarded the already prepared environment.

`AssetDelivery` shares concurrent reads, preserves cancellation ownership, and
stores only content-addressed game files in optional CacheStorage. The disk
budget is bounded by 512 MiB and 20% of browser storage quota. Eviction, private
mode and unavailable storage do not block loading. The 64 MiB RAM budget stays
bounded. Account APIs and mutable responses are excluded.

The world retains an already loaded location across home, secondary menus,
garage inspection and flight. Route changes replace their gates, props and
collision sidecar while retaining the map. Switching to another location still
requires preparation. Stale or failed transitions cannot replace the active
scene. GPU objects are released when a different environment replaces them.

The loader distinguishes memory, disk, browser delivery and measured network
transfers. It shows bytes, file count, elapsed time and an honest read rate.
Processing and graphics preparation use an indeterminate bar instead of a
misleading download percentage. Progress DOM writes are throttled to 10 Hz.
Network rate is reported only when ResourceTiming identifies a real transfer.

Validation: 20 focused asset, cancellation, loading, marker and scene tests
passed; the integrated suite passed 234 tests; production build succeeded.
These checks do not establish UHD 620 FPS, manufacturer-calibrated physics or
zero delay on cold loads. Browser scenario and publication evidence belong in
the UI audit and Oracle deployment record. This milestone alone is local code;
GitHub push and Oracle deployment are separate operations.

Follow-up, 15 October: published in `20261015-native-01`. A real-browser local
proxy check of repeated Minus Two flight delivered **0 new asset requests / 0
bytes**. The first garage visit separately fetched a 3,409,196-byte lower-detail
map delivery; it did not redownload the complete map. Controlled asset HTTP 503
showed the real error/Cancel/Retry UI; restoring the fixture and choosing Retry
successfully reached flight. The same client produced the FHD loading evidence.
This confirms cache/source behavior, not zero CPU/GPU work or a precise latency
benchmark. See the [completed review](design/ui-audit-20261014/REVIEW.md).
