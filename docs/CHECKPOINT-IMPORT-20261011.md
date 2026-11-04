> Superseded on 2026-10-13 by [WORKBENCH-20261012.md](WORKBENCH-20261012.md).
> Stages and pending items below describe earlier work in progress.

# Checkpoints, HUD, ground contact and local content imports

Local work only. Oracle has not received this follow-up. Imported Liftoff
content has no established redistribution permission and is excluded from the
licensed release candidate.

## Implemented and checked

- Authored map/course frames use `frameSource: map|track`; generated visual and
  collision frames are suppressed. Tilted gates retain their own orthogonal
  axes. Elliptical trigger bounds reject rectangular corners. Empty Unity
  builtin trigger bounds use the documented unit dimensions:
  [Unity primitive documentation](https://docs.unity3d.com/cn/2023.1/Manual/PrimitiveObjects.html).
- Checkpoint chirps are synthesized locally. Solo race, training and free-flight
  callbacks fire once per crossing; multiplayer sound belongs to the local pilot.
- Centered dotted attitude display and reticle, plus separate stick indicators.
  The bottom flight panel no longer covers the indicators.
- Ground motor limits survive the physics substeps and authored floor contacts.
  Regression checks cover zero/low throttle, neutral takeoff and leaving a ledge.
  Browser reproduction with Luma stopped spinning after the fix.
- Menu backdrop follows selected map. Clean licensed startup shows Ironworks on
  pilot access. Minus Two thumbnail now shows its original arches.
- CC0 Poly Haven metal desk, screwdrivers and vice prepared in Blender; editable
  source, provenance and KTX2 delivery are under `content/shared-assets/workbench`.
- Luma 5 and Armattan Chameleon have editable source, stock assemblies, spinning
  prop pivots, paint bindings and approximately 38k / 11k / 2.6k triangle LODs.
  Optional unmounted action cameras were omitted. Flight parameters use this
  project's simulator, with source mass and rotor spacing; this is not a port of
  Liftoff physics. Their fixed frames do not offer unrelated Kestrel frame models.

## Current map production checkpoint

Hangar C03 and Liftoff Arena are not yet connected to the catalog. Both full
editable scenes and source courses are recovered. Two Hangar and seven Arena
source courses passed spawn/aperture checks. Arena branching courses expose one
legal complete Route A and retain the source graph/provenance.

Hangar's previous optimized geometry passed all three LODs with zero missing or
moved surfaces on 25,392 deterministic spatial probes. This samples the scene;
it is not exhaustive coverage. The audit now decodes the actual delivery GLB and
checks its hash. Position precision is 16 bits; 14 bits caused two 6 cm errors.
The PBR adaptation changes require a new export/optimization/audit.

Prepared adaptations include source terrain color, alpha-tested static trees,
bark detail, detail masks, height-derived normals and specular gloss converted
to roughness. World-space terrain projection, shader displacement, tree wind,
colored specular reflectance and custom water effects remain approximations;
records are stored with the material audit. Active unsupported terrain layers
fail instead of being silently ignored. Cutout foliage is retained at distance.

Running at this checkpoint: Hangar `refreshMaterials` succeeded (185 materials,
1,767 slots), and its new `export` completed (13,468,022 triangles across all
LODs); optimization is running. Arena's refreshed textures completed; material
refresh and export are running sequentially. Its earlier complete export had
5,306,074 triangles across all LODs. These are not visible-triangle or FPS claims.

## Storage and continuation

Required data caches, QA directory, backups, race packages and the two new map
directories use verified junctions into
`D:/DroneLiftoffUz-import-temp/preserved-cache`. Do not remove that directory.
Checksum manifests accompany moved data. Full Blender stages run one at a time.
KTX scratch files now stay beside the output, away from the system drive.

After the active export finishes, run `optimize`, `geometryCheck`,
`materialsCheck`, `course`, `package`, `markers`, `sync`, source aperture/scenario
checks and `build`. Refresh Arena's prepared textures after the latest detail
mask change, then `refreshMaterials` and `export` first. Existing recovery,
prefabs, meshes, HDR files and courses do not need re-extraction.

All 197 automated regression tests passed with zero failures; see
`data/menu-qa/full-native-regression.log`. Final map screenshots, eight-drone
checks and manual completion of native courses remain pending. True 1280×720 on UHD 620 has not been measured.

Proof images are in `data/checkpoint-proof/`: `minus-two-native-gates.png`,
`hud-low-ground.jpg`, `luma-painted.jpg`, `arena-source-low.jpg` and
`fresh-pilot-background.png`. Arena image is a source-area probe, not final map
acceptance. Original Kestrel flight selection was restored in the QA guest.

The isolated licensed candidate at `data/menu-qa/release-20261010` builds from
its real D-drive path; port 2592 serves it with a separate test database. It has
one licensed map and four base drones. Final candidate refresh/validation is
still required after remaining code changes. The game at 2590 is an older local
build during the ongoing import; rebuild/restart before final verification.
