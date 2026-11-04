# Liftoff customization integration — 19 October 2026

Local implementation for the four imported Liftoff aircraft. The existing
Workbench parts rail, selection cards, draft/save flow, preview replacement and
account fleet remain the UI. The new Antenna category fits the rail in two rows.
Separate action cameras remain prohibited on every aircraft by the user's
explicit choice, including old saved builds and the legacy server build API.
Published in `20261020-optimization-01`; public Gecko/Luma Workbench checks pass.
See [deployment verification](ORACLE-DEPLOYMENT.md).

## Recovered native configuration

The installed Assembly-CSharp implementation and the preserved prefab records
are the reference. No new game bundles were recovered. The adapted configuration
is stored in each `content/drones/*/drone.json` under `customization`.
Original component values, frame transform records and their source SHA256 are
retained in `content/shared-assets/liftoff-drone-parts/customization-source.json`.

- `PartIDRestrictor`: ALLOW_ONLY=0, EXCLUDE=1. Camera/motor/antenna selections
  apply the frame's native lists to the UI, saves, server and race hardware.
- `PartSlot.overridePart`: a forced native component takes precedence over the
  blueprint. Gecko therefore has AntennaBlank and ActionCamBlank.
- `PartSlot.Awake/FindSnapPosition`: the direct child SnapPoint replaces stale
  serialized offsets; absent child means identity. Parent transforms and scale
  are composed relative to the frame and Unity X is mirrored once for runtime.
- `PropellerSizeRestrictor`: GREATER=0 rejects diameter above its value, LESS=1
  rejects below it; UseFrameSettings=10 uses the airframe maximum.
- `AntennaAngleRestriction`: STRAIGHT=0, ANGLED=1; `isAngled` participates in
  compatibility. Luma combines this with its Soupape Micro whitelist.
- `ActionCamMountRestriction`/native action-camera lists are preserved as source
  data. The user's global product prohibition overrides them.

Camera and battery mount transforms are applied before replacement assembly.
The retained stock meshes move together with their mounts, once per loaded LOD.
This corrects Luma's camera: old imported Z=0.0721 m, native Z=0.0564 m
(15.7 mm difference), Y=0.0337 m. Model transforms and nested parents are retained;
repeated changes cannot accumulate the correction.

Conditional visibility masks restore prior state before replacing hardware.
Gecko's wrongly embedded Fatshark renderer is hidden at every LOD. The four
recovered frame prefabs contain no camera-dependent frame-cover visibility rule;
the integration does not invent one or hide an entire frame. Native skin prefab
substitution is a separate mechanism from a camera selection.

## Antennas

| Aircraft | Native selection exposed in Workbench |
| --- | --- |
| Luma 5 | Soupape Micro only |
| Armattan Chameleon | Pagoda circular, Soupape Micro, Soupape, Fatshark circular |
| Dquad Addiction | Same four compatible original antennas |
| Armattan Gecko 3 | No separate antenna, forced by AntennaBlank |
| Kestrel 5 | Its existing fixed antenna |

Four already recovered antenna prefabs were exported using Blender with their
original meshes/materials. Editable source, exports, preparation and provenance
are in `content/shared-assets/liftoff-antennas/`. The shared compressed runtime
library has 6,092 triangles across all four models, 1,831,192 bytes; only the
selected node is instantiated at each aircraft LOD. Existing embedded antenna
renderers are hidden while the configured replacement is installed. The original
renderer is never stacked with the new component.

Selected antenna source mass affects the native component mass/inertia resolver.
Stock aircraft mass, Kestrel behavior and controller tuning remain as before.
AI samples the same compatible antenna choices without randomizing tuning.
Preview thumbnail keys include the antenna, and frame keys include native config.

## Verification and remaining acceptance

- All-content validation: five maps, 30 races, five aircraft, 42 parts.
  Catalog revision: `396d64fa8c15d70e`.
- Broad non-route suite: 420/421 passed. The only failure was an old assertion
  counting the new fixed Kestrel antenna as an interchangeable GLB. Its corrected
  delivery assertion and fleet-sync tests pass (17/17).
- Final actual GLB/native configuration/workbench/details/LOD checks: 34/34.
  All four antenna alternatives repeatedly swap on every LOD, hide stock meshes,
  use native slot matrices, stay within aircraft bounds and restore atomically.
  Native camera/battery matrices are checked against every actual aircraft LOD.
- Separate race-hardware regressions pass: compatible antenna diversity, unchanged
  controller, own component physics and open-course completion. Prior broad
  actual-route results are in `OPTIMIZATION-20261019.md`; not rerun here.
- Final preview/scene/fleet/details checks: 37/37. Real account API saves from two
  devices and survives restart, including a pre-antenna client's missing field.
- Production build passes. Blender front/rear views of Chameleon and Dquad were
  inspected. These are offline source renders, not in-game Low acceptance.

Browser was initially disabled, then restored on the next continuation. Actual
IAB at 1076x606 verified all four aircraft in the existing Workbench: Chameleon's
four antennas, Fatshark selection/save/reopen and survival through client reload;
Gecko's forced blank antenna and Redot Split Mini camera; Luma's sole Soupape
Micro; Dquad's four choices and Soupape Micro replacement. Appearance has no
separate action-camera control. The loaded Gecko antenna renderer was explicitly
checked: visible=false, including inherited visibility. Temporary diagnostics
were removed afterwards. In-game evidence is under
`docs/design/native-customization-20261019/browser/`.

This browser check found the new two-row category rail could shrink the part
list to **0 px height** in a short viewport. The list now retains its content
height while the whole panel scrolls; measured 287 px afterwards. Lower cards
are selectable and visible on scroll, and the fixed Save/back footer remains
available. No extra test mirroring the CSS rule is needed; the actual browser
scenario reproduces and verifies it. Quality/target-hardware FPS acceptance and
an Oracle publication are separate from these local UI checks.

## Minimal continuation

No full extraction or export is needed. Existing source rules can be regenerated
with `node tools/import-native-customization.js`. The antenna installer is
`node tools/install-native-antennas.js`; it uses the retained small preparation
report and four existing blueprint XMLs. After canonical content edits run
`node tools/sync-content.js`, then the affected checks/build.

For an intentional antenna geometry change, the narrow Blender export is
`export_liftoff_parts.py -- --antennas` with
`CONTENT_IMPORT_PROFILE=tools/import-profiles/liftoff-expanded-drones.json`.
It writes its own library and does not overwrite the existing 17-part library.
Recompress only `hangar-source.glb` for the runtime library, then sync content.
`review_native_antennas.py` renders read-only review assemblies from saved blends.
Preserve proprietary/unconfirmed permission metadata and the private repository.
