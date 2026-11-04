# Direct public Edge observations — 23 October 2026

Served release: `20261021-cold-start-01`, client `index-7TSF7k3X.js`.
Canonical public origin only. No proxy or localhost observation is counted here.
These are **before-fix** captures; current source fixes are not yet deployed.

1. Cold network: HTTP and optional encoded cache cleared; retained cache empty.
   All four required deliveries have positive network bytes. Ready at 345.673 s.
   Main model took 314.751 s; close aircraft took 238.689 s. Decoder/driver caches
   are not equivalent to a newly installed PC.
2. First Hangar: action marker 377958.6 ms; 3.409 MB environment request started
   at 378207.3 ms and lasted 18507.2 ms. Preview had completed by the snapshot
   27.531 s after the marker. This is an upper bound, not a measured exact ready
   instant; thumbnails start roughly 19.37 s after the action. Post-action
   longest observed main-thread task: 136 ms.
3. Warm reload: 5.659 s Ready; map/aircraft came from saved encoded storage, so
   absent asset network requests are expected. This cannot represent a first visit.
4. Offline document: browser's ERR_INTERNET_DISCONNECTED page is expected.
   Separately, exact API catalog URL blocking was verified with loadingFailed /
   blockedReason inspector. The game remained at an error/Retry gate after the
   block was removed. Manual Retry then reached Ready in 5.325 s from its marker.
   An earlier wildcard blocking attempt failed to block; it was rejected.
5. The interrupted capture and unattended morning completion remain invalid for
   foreground acceptance. `05-limited-network-repeat-before.json/png` replaces
   them: cleared HTTP/optional encoded cache, retained cache empty, 5 Mbps /160 ms,
   Ready **72.554 s**, longest task 280 ms. All four required files have positive
   transfer; no focus/visibility changes or JS errors. This is still too slow.
6. `06-public-cpu4-before.json` and flight PNG: CPU4 **after startup**, home →
   Settings/Graphics → maps → first Free Flight → reset/inputs → exit. Map/close
   model retained, actual network for Low/far (~20.8 MB), first flight **12.499 s**,
   longest task 939 ms, movement 10 km/h. Adaptation off, framebuffer **836×420**.
   This is functional stress diagnosis, not a valid 1280×720 FPS capture.

`candidate-*-local.*` are explicitly separate **localhost implementation QA**,
not public after-fix acceptance. They establish no map/model download in initial
menus, canceled pending Hangar transfers, successful reopen/first flight, and
Hangar success while map collisions are blocked followed by flight error/Retry
recovery. `candidate-physics-local.json` corresponds to client `index-BW3toLKF.js`.
It still records a 1214 ms processing task; do not claim smoothness.

`candidate-readable-error-local.json/png` is the later `index-D31s-vkZ.js`
implementation check: three real blocked requests produce a readable Russian
error and enabled Retry; unblocking and Retry recover into flight without reload.
The raw `Failed to fetch` visible in older captures is repaired locally, not yet
on the public site.

`source-loader-*-local.json` describe a temporary local Meshopt worker experiment.
Parsing dominates cloning, but the uncontrolled trial did not eliminate pauses.
No worker-mode change was shipped; reload removed it.

Temporary observers and network controls apply only to the agent's test tab.
CPU/network/cache controls have been reset and reload removed temporary probes.
Rerun the complete matrix on the candidate public release after deployment.
Screenshots show actual observed states; they are not public after-fix proof.
