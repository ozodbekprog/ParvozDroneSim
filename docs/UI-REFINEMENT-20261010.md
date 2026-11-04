# Vector FPV - local UI and content refinement

## Verified follow-up after browser access approval

The user explicitly allowed inspection of local origins 2590 and 2570. This supersedes the pending-browser status in the earlier implementation record below. Oracle remains unchanged.

- Real Chrome verification found and fixed blank rendering, map-to-garage cleanup failure, green textures overriding selected paint, undersized framing and footer overlap. Three r180 cached sampler references are restored after texture resizing; cleanup completes even if a damaged pipeline fails to dispose. Menu fallback hides only after a successful frame, and its live camera shows the courtyard at flight height.
- Blender prepared neutral tint images on authored frame/LED materials and saved the editable Kestrel source. Original geometry buffers and 37,780 / 10,410 / 2,809 LOD triangle counts remain intact. Checksummed backups: `data/menu-qa/before-polish/kestrel/`. The neutral finish preparation is integrated into the repeatable Blender build route.
- Workbench specifications now sit beneath component choices, Appearance controls fit above the footer, and actual visible geometry determines preview framing. Other drones retain their own assets/loading path instead of inheriting Kestrel LODs and attachment metadata. Propeller alternatives are visibly distinct; other authored alternatives mainly change finish.
- Chrome checked menu/garage/Workbench on Low/custom graphics, blue/white paint and both propeller geometries. The original Chrome graphics preferences, active Atlas 7 and saved Kestrel copy were restored. A separate in-app guest checked unauthenticated reload, access background, Kestrel Low free flight and a real 44 degree bank. Chase now uses 1.2 m distance, 0.38 m world-space height and a separate 72 degree FOV, preserving the user's FPV FOV.
- Evidence: `data/menu-qa/auth-after.jpg`, `menu-low-after.jpg`, `workbench-after.jpg`, `garage-low-after.jpg`, `propellers-three.jpg`, `flight-low-after.jpg`, `flight-attitude-after.jpg`.
- Full suite: 189/189 passed (`full-polish.log`). The subsequent camera refinement passed 11 affected tests (`final-camera-tests.log`). Local and filtered release builds/content validation passed. This supersedes earlier test totals below.
- Race prop collisions are hashed JSON sidecars loaded by client and server during preflight; editor save round-trip is covered. Startup JS decreased from about 17.8 MB to 1.73 MB. Protocol 7 requires older clients to reload. Career unlocks account for reduced active mission count while preserving historic progress.

Filtered candidate: `data/menu-qa/release-20261010/`, licensed Ironworks only, no Minus Two, archived maps, database, env secrets or Blender source. SSH source is recorded as `195.158.3.42/32`; current developer IP was verified as `144.124.196.42`. A separate network-access approval was requested before changing the source and publishing. Map/model artistic acceptance, complete manual races and target UHD 620 true-720p performance remain unconfirmed.

## Earlier implementation record

## Implemented

- Working rebrand: Vector FPV, original vector mark, browser title/favicon and home/access-screen wordmark. Change the name in `shared/brand.js`; keep `index.html` title in sync. Existing URLs, storage keys, account data and protocol identifiers stay compatible.
- Cold-start menus make one map request, use an actual Ironworks Low screenshot until models finish, and keep it on loading failure. The Ironworks camera is explicitly positioned above the site. This avoids the previous initial Hangar request being disposed by the next menu request.
- Garage preview uses a separate, neutral lit scene. It does not load the archived Hangar map, enlarge the model by 1.6, or include hidden components/LODs when fitting the camera. Swaps finish before replacing the visible model; stale results are disposed. Appearance changes update loaded materials directly.
- Workbench has two columns outside Tuning. Part cards show name and ownership/price; specifications have one disclosure under the preview. Installed Build is removed. Build performance is a footer disclosure in Parts only. Model credits are available through Help rather than overlaid on the drone. Inactive selections have no "Previewing this drone" label. Modular drones offer fully authored choices; installed legacy stat-only components remain available with an honest appearance label. Apart from propellers, current SCOUT/HUNTER alternatives change the finish, not component shape.
- Flight HUD includes an attitude instrument based on aircraft quaternion, independent of yaw, with readable pitch/roll and support for inverted flight. Close chase camera follows at 1.8 m with 0.55 m world-space height.
- Twelve generated map packages, nineteen courses and their missions/lessons moved to `content/archived-maps/`. Existing player records/progress were not deleted. Replays of unavailable maps request restoration.

## Verification

- Real GLBs loaded through Three's GLTFLoader in CPU tests: all five categories installed, both propeller variants selected, color changes applied, correct real-world bounds, camera forward and battery above frame. This verifies hierarchy/assembly, not artistic acceptance or the reported upside-down visual on the user's device.
- Preview race/cancellation, visible bounds, attitude through inverted/vertical states, close chase camera, current courses and schema have focused regression coverage.
- Full suite: 177/180 initially passed; the three isolated socket fixtures still carried model selector/LOD metadata after removing their visual models. Fixed those fixtures; all three passed on retest. Added modular-choice test also passed (181 current tests covered). The local preview server was restarted with explicit 20-player admission, preserving `data/minus-two-demo-server`; no new hardware FPS claim.
- Single-folder Hangar restoration tested: three courses, two missions, two lessons; the verified copy then removed from active content and retained at `data/menu-qa/restored-hangar/`. Backups remain unchanged.
- Final local build and independently filtered release build passed; release content validates (one map, two courses, two missions). All 18 active local asset/decoder URLs returned successful HEAD responses; the local room API reports admission limit 20. These are loading-path checks, not browser rendering acceptance. The preview error regression also suppresses failures from cancelled obsolete downloads.

## Remaining acceptance and publication

The earlier browser-access block was resolved by the explicit user answer. Current affected-UI verification is recorded above; no origin bypass was used.

Oracle is unchanged. A current 10 October SSH-port probe timed out after five seconds; the last ingress-source mismatch remains described in `ORACLE-DEPLOYMENT.md`. Server access must be restored through the documented reviewed procedure. Candidate `data/menu-qa/release-20261010/` excludes unconfirmed-redistribution Minus Two assets, old map backups, env files and databases. Verify public release backups, drain active races, preserve production env/database, deploy to a fresh release directory, test HTTPS/health/affected scenarios, then update the deployment record.

Visual acceptance, complete manual races and UHD 620 at true 1280×720 are still pending. The rebrand remains a local draft until the user accepts the name/logo.
