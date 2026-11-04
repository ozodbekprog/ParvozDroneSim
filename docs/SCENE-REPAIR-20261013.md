# Free Flight, native markers and workshop repair

## Ready locally

- Free Flight (`training` without a lesson/challenge) loads only environment geometry and collisions. Course gates, models and colliders remain available to races, tutorials and missions. Client prediction, solo simulation and authoritative server use the same scope; protocol is now 9. Replays record the actual course scope.
- All three editable map sources hide the native PlayerDummy, DroneDummy and PowerBox placeholders before any LOD batching. Delivery audit finds none; Hangar's bonus-box collider is removed. Existing source exclusions remove the character collision hierarchy.
- Luma uses the frame's child `SnapPoint`, as native `PartSlot.Awake` does, instead of stale serialized snap rotation or a guessed bounding-box offset. Source mount in game coordinates: approximately `[0, .043367903, -.016500005]`, identity rotation. Flight parameters and model centering are unchanged. This supersedes the earlier underslung/bounding-box repair.
- Workshop tools/spares use actual mesh vertices and ray-tested tabletop support. Delivered GLB contact errors are below 2 mm for all five groups. Editable `.blend` files are retained; no artistic primitives were created.
- Inspection zoom is bounded and reaches close detail; selection no longer forces a 2.7 m minimum. Camera ray stays within map bounds. Accessible zoom buttons supplement the wheel.
- Workbench has a visible Flight performance button and dialog with Escape/focus return. Part Specifications are displayed beside the choices.
- A 64 MiB LRU retains encoded immutable deliveries, not decoded GPU resources. Revisits can avoid fetching route bytes; decoding can still repeat. Eviction and browser cache remain relevant.

## Verification

217 tests, client build, content validation, all-map marker/collision/material audits, real exported workshop contact checks and local two-client race smoke passed. Free Flight is checked in solo tests and the browser. Low browser inspection verified Luma socket, tabletop placement, both zoom extremes and the performance dialog. Public rooms retain their existing race/time/freestyle mode choices; a diagnostic training-room request normalized to race, so it is not evidence of multiplayer Free Flight. This is not UHD 620 performance acceptance or full-course artistic acceptance.

Geometry-only map exports retain the previously verified KTX2 bindings and material parameters, avoiding texture/UV regressions. Arena retains Float32 positions.

## Recovery and continuation

Before files: `D:/DroneLiftoffUz-import-temp/scene-repair-20261013/before/` (sources, deliveries and collision data). Do not delete preserved-cache. No full Liftoff recovery is needed.

Deployed release: `/opt/liftoff/releases/20261013-scene-02`, revision `4233a00856896de1`, protocol 9; local package is retained as `data/oracle-release-20261013-scene-02.tar.gz`. The duplicate expanded stage was removed during verified disk cleanup; its inventory is retained in `data/oracle-release-20261013-scene-02.RELEASE.json`. Actual publication/backup checks are recorded in [ORACLE-DEPLOYMENT.md](ORACLE-DEPLOYMENT.md). Production DB and env files are excluded from the package.

Minimum verification commands:

```powershell
node tools/audit-scene-markers.js
node --test --test-isolation=none test/scene-content.test.js test/preview-orbit.test.js test/workbench-contact.test.js test/liftoff-drone-materials.test.js
npm run content:check
```

Completed preparation logs: `data/scene-delivery-finalize-20261013.log`, `data/scene-repair-final-tests-20261013.log`, `data/scene-final-model-checks.log`. Do not repeat the full exports just to resume publication. `data/finish-scene-deliveries-20261013.js` was the one-time texture-preserving finishing step; current deliveries are already finished.
