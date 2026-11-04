# Local Liftoff workbench and scene transitions

Local implementation only; Oracle has not been updated. Liftoff assets and
their references must stay out of the public release.

## Completed production work

- Original DroneEditor/DroneSelector source inspection identified PicnicTable01,
  DroneCharger01 and SolderingIron01. Only their 31 hierarchy records, three
  meshes and materials were recovered. Existing Luma battery, motor and prop
  meshes supply the spare parts. No new artistic mesh was generated.
- Editable source and KTX2 kit are in `content/shared-assets/liftoff-workbench`:
  about 16.5k triangles, 14 objects. The previous Poly Haven kit is preserved.
- Fixed placements for all four maps are recorded in
  `data/liftoff-workbench-recovery/placements.json` and each map/profile `garage`.
  Ground support, volume probes, first-course collisions and camera positions
  passed. Each garage records selection/Workbench camera presets. The selected
  drone is grounded using its actual model bounds and the measured tabletop.
- Menu/garage scenes now stage offscreen and commit only when complete. Stale
  requests release their assets; shared downloads abort only after their final
  consumer cancels. A failed scene preserves the current background and offers
  Retry. Track selection refreshes the background too.
- Both new maps are installed. Hangar and Arena passed the actual-delivery
  geometry audit at all three LODs with zero missing/moved surfaces. Material
  checks passed. Controlled hover, landing, checkpoint reset, training and timed
  mission completion passed. Complete manual flying of all source routes is
  not established by these checks.

## Import corrections and cache reuse

Some source bundles strip their Unity version. Use the verified fallback
`2022.3.62f3` before loading them (`tools/assetripper-version.js`). Material
texture dependencies are found through the catalog, not stale bundle indices.
Each recovered slot is saved immediately. Do not repeat full recovery.

Material-only updates can use `refreshMaterials` then `deliveryMaterials`.
The latter verifies unchanged geometry and reuses matching compressed textures.
Changes to alpha classification require `export` first so far foliage keeps its
texture and silhouette. Arena uses lossless Float32 positions: 16-bit position
quantization caused 16 terrain seam misses. Hangar's 16-bit audit passed.

Arena's static PBR adaptations explicitly omit procedural grass generation,
tree wind/packed specular shading and runtime video. Provenance and material
audit record these limits. Source geometry and editable scenes are retained.

One source prop cell contains only one authored LOD; represent it as a regular
model, not an invalid one-level LOD array. Source Arena course object bindings
were restored from cached prefabs. All seven Arena prop/material/course checks
passed; the two Hangar source routes passed too.

## Verification, updated 2026-10-13

- Local catalog: four maps, 19 races, six original drones. Hangar C03 adds two
  source races; Arena adds seven. Each also has a practice route and mission.
- Full suite: 204/204 passed. Final scene/cancellation/distance/orbit checks:
  12/12 passed, including the added missing-garage regression. Build and content
  validation passed after the final Blender tool placement and camera change.
- In-app browser: ten consecutive/rapid map selections, then back -> garage ->
  Workbench. Stale results did not replace the latest scene. Controlled slow
  completion, failure/retry and last-scene retention are covered by World tests.
- Original table, charger, soldering iron and Luma spare parts inspected on Low
  inside Minus Two, Ironworks, Hangar C03 and Arena. Orbit and close Workbench
  views checked; Luma/Armattan models sit upright on the tabletop. Luma paint
  preview checked and restored; Kestrel part compatibility tests passed. No new
  disassembly mode was added. This is a technical visual check, not user artistic
  acceptance of Ironworks.
- Screenshots: `data/checkpoint-proof/liftoff-workbench-final.png`,
  `hangar-bench-final.png`, `arena-bench-final.png`, `hangar-low-final.png` and
  `arena-low-final.png`. Final Low framebuffer was 1280x720, adaptive scaling off.
- The isolated public candidate builds and validates: one licensed map, four
  base drones, no Liftoff workshop/model references. Its browser verification is
  not renewed for this revision. Oracle has not been updated in this stage.
- Garage/Workbench also have an inline Retry button for a failed load. The final
  UI change builds successfully; its deliberate browser failure/retry check was
  interrupted before execution. The temporary localhost fault fixture is stopped.
- Source Hangar first view at true 1280x720 Low: before distance culling,
  2,260,477 triangles / 927 calls; with 180m culling, 2,247,151 / 164 calls.
  Triangle budget is still exceeded; this is not a UHD 620 FPS result.
- Arena's first Low view with source course: 1,244,989 triangles / 176 calls.
  Both imported maps exceed the preliminary 150-300k triangle budget. Current
  geometry-preserving LODs primarily simplify materials; further geometry work
  is required before calling these imports performance-ready.
- UHD 620 FPS, eight-drone hardware runs and complete manual source-course runs
  remain unverified. Controlled gate/mission tests do not establish manual runs.

## Minimal continuation

Do not recover again. For scene code, run affected tests and `npm run build`.
For bench placement, run `node tools/place-workbench.js`, then build/content
check. For the original kit use `tools/blender/prepare_liftoff_workbench.py`, then
`tools/optimize-art.js`; its original scoped source is `map.blend`. Reuse the
existing `.prepared.glb`/KTX2 payloads. Keep the Poly Haven kit as a backup.

Required junctions and D-drive caches from AI-QUICKSTART remain in use. Do not
delete `D:/DroneLiftoffUz-import-temp/preserved-cache`.
