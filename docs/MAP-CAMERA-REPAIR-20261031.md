# Map collisions, cameras and imported scene repair — 31 October 2026

Scope: user's reports of invisible walls, unstable third-person cameras after
crashes, camera clipping, Liftoff branding, blank Hangar containers, missing
checkpoint collision, and missing/foreign track props. Local work only. No
Oracle release or public UI release has been performed by this task.

Branch: `codex/map-camera-repairs-20261031`, based on `0fb6fef`.
Pre-existing presentation, UI exploration, quickstart and editor configuration
changes belong to other work and must remain outside these commits.

## Verified camera slice

Commit `cc1cbf7` is pushed. Three initially failing regression cases reproduce
wall clipping in rigid chase, vertical-pitch orbit collapse, and a camera spinning
with crash tumble. Both chase modes now hold the last flying orientation during
crash translation; rigid chase uses the near-plane obstruction solver. The
dynamic orbit interpolates heading rather than shrinking its offset through zero.
Twenty focused tests and an isolated Vite production build passed.

Browser developer tool: `tools/research/scene-repair.html`, currently served by
Vite at `http://127.0.0.1:2599/`. Native WebGPU rendered the real Hangar map at
1280×720 on Low and Ultra, with no page errors in the visible report. Full camera
checks also rendered all five maps on Low and Hangar through WebGL2. No
target-hardware claim is made.

## Completed content repairs

- All five source scenes contain invisible `LevelWalls`: Hangar 4, Arena 4,
  Minus Two 4, Pine Valley 12, The Green 22. `repair-map-boundaries.mjs` matched
  all 46 boxes uniquely against canonical collisions. The `--apply` pass removed
  only those entries and wrote per-map `boundary-repair.json`; generated delivery
  was regenerated with `content:sync`. All other collider arrays are retained.
- Hangar has 34 enabled `m_CastShadows == 3` renderers, including combined
  container shadow geometry using `Default-Material`. Arena has one. These are
  shadow-only proxies, currently rendered as white untextured solids. Source
  textures/materials were present behind them. Only source-proven shadow proxies
  are now suppressed; real geometry and textures remain. Unity documents value 3
  as [ShadowsOnly](https://docs.unity3d.com/ja/6000.0/ScriptReference/Rendering.ShadowCastingMode.ShadowsOnly.html).
- The base environment includes two `FreezeFrameFinish` flags per map. They are
  preview-only finish props, independent of the selected race. That
  source hierarchy is now removed from environment delivery; race-owned finish
  props remain. Only affected far cells reuse the intact textured Low geometry.
- Track importer ignores `TrackBlueprintRibbon` objects such as
  `TapeYellowBlack01` and `TapeWhiteRed01`. Source XML contains the attachment
  positions; prefab metadata contains the ribbon material, width and tiling.
  Restored 462 ribbons on 17 native courses (62,650 triangles total) with source
  width, positions, materials and tiling. Each has editable `ribbons.blend` and
  `ribbon-source.json`. Static strips reproduce placement; rope dynamics are not
  simulated. Models load only with their owning course or its practice reuse.
- Track BoxCollider conversion uses Blender Euler angles directly, unlike the
  existing Three.js-compatible `three_euler` helper used for capsules. Mixed-axis
  box rotations are corrected on all 25 native tracks, verified against source
  matrices. Counts, positions, sizes and mesh payloads are preserved. Five stale
  practice collision copies now match the native props they display.
- Source race-to-track dependencies were checked across all 25 native races:
  current sorted track assignment matches every SOURCE record. No mismatch was
  found there; do not relabel or reorder gates on that assumption.

- Selected branded cloth, posters, displays and plaques now use neutral project
  surfaces, removing printed/auxiliary/emission artwork. Browser inspection found
  `InflatableArchBrandless01` also prints LIFTOFF; it is covered by the final policy.
  Terrain, real container finishes, arrow signs and unrelated torn posters remain.
  Neutral cloth, optimized KTX2, editable packed material library and generated
  image provenance are in `content/shared-assets/parvoz-neutral-surfaces/`.
- Corrected frame collisions exposed an AI recovery regression on Hangar's third
  lap. Commit `d971375` prepares checkpoint detours before flight; no race-time A*
  search or relaxed aircraft clearance. It is pushed.

Canonical map/track `.blend` sources and existing caches remain available; no
whole-map re-extraction or re-export was performed. Import/export policies apply
the repairs on future exports. The task-owned AssetRipper used solely for two
ribbon materials is stopped. Other caches and player databases are untouched.

## Final verification

Compiled revision `18e829da005f6299`: 5 maps, 30 races, 184 assets.

- All 158 test files completed: **687 passed, zero failed**. The final inflatable
  logo assertion passed in an additional rerun of all five GLB repair tests.
  After compacting collision JSON, content validation and all 16 focused scene,
  boundary, checkpoint and asset regressions passed again; values are unchanged.
- Source spawn/order/full-clearance passage checks passed on all 25 native tracks.
- Final material audit: **30 GLBs, 1,429 materials, zero failures**, no untreated
  material selected by the policy. Exact neutral KTX2 payloads are verified and
  leftover branded auxiliary maps are rejected.
- Final isolated build, content validation and two-client server smoke passed in
  run `2026-10-31T18-19-14-517Z-17b0c1`. All four baseline Chrome checks were
  observed and saved in `browser-proof.json`. Final `accept` is pending because
  the live quota reached the configured 3% threshold. The runner stopped its
  server, interrupting the extra real-flight download; no completed flight or
  complete pilot sign-off is claimed. After these checks, map collision JSON was
  returned to its original compact formatting without changing values. This
  changes the raw source digest: create a new snapshot after quota reset instead
  of accepting the old snapshot as current. The old run retains its evidence.
- Real Chrome scripted crash-tumble: dynamic 37 frames, rigid 74, both zero camera
  translation drift and zero view turn at a fixed aircraft position; native
  WebGPU, actual 1280×720 framebuffer, no page errors. Physics regressions cover
  real wall obstruction; this scripted check specifically covers presentation.

Evidence: `data/map-repair-20261031/` (tests, source passages, material checks,
browser reports and screenshots). The acceptance pilot checks baseline UI and
network behavior; scene-specific checks are additional evidence.
Selected Chrome images and scene reports are retained in
`docs/evidence/map-camera-repair-20261031/` for Git history.

Do not repeat the full import. `repair-map-visuals.mjs` refuses repeated full
`--apply`; `--branding-only` handles new material discoveries. The ribbon linker
is idempotent. Imported resources retain their original permission metadata.
Removing visible artwork does not establish redistribution permission.

UHD 620 performance remains untested. Some scenes exceed the provisional Low
triangle budget; affected far cells can retain more geometry than the baked
proxies. Oracle, production accounts/progress and admission 20 are unchanged.

The old acceptance pilot `2026-10-27T16-06-41-506Z-e5e6d7` is already passed and
belongs to another chat/goal. This changed source requires a new acceptance
snapshot plus scene-specific checks; do not reuse that pilot's browser proof.
