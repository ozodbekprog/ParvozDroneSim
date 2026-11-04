# Public after-release checks, stability-03

Direct `https://parvoz-drone-sim.duckdns.org/` in Edge. Client
`index-D31s-vkZ.js`; runtime source `78fb1f8`. Records 01–04 are real public
after-deployment runs; 05/06 remain pending because Browser Use was disabled.

- Cold HTTP/optional encoded caches were cleared; retained-download cache was
  observed empty. Player/account data was not cleared. Driver cache stays warm.
- Run 01: Ready 3488.6 ms, longest task 135 ms, client really transferred.
- Run 02: Ready 1297.7 ms, longest task 263 ms, client HTTP-cache hit confirmed.
- Run 03: 5 Mbps /160 ms; Ready 3271 ms, longest task 96 ms, client really transferred.
- Run 04: exact catalog block generated three `blockedReason: inspector` events.
  Clear Russian error and enabled Retry were visible. Removing the block and
  clicking Retry reached Ready in 675.5 ms without reload. The full navigation
  timestamp includes the deliberate wait at the error gate.

All four have zero startup GLB requests, zero JS errors and no focus/visibility
changes. Observers were installed before Ready, not after detecting the result.
JSON contains only graphics settings, timings and public resource paths; no
account tokens or private player rows. Screenshots show actual public UI.

Published fix removes the 39.9 MiB startup gate; Hangar/flight still load their
required models on demand. These results do not prove all first-Hangar behavior,
model-processing smoothness or 1280×720 performance on UHD 620 / GTX 1650.
See [full state](../../../PUBLIC-STABILITY-20261023.md) for remaining work.
