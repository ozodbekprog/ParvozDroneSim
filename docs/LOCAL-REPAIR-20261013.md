# Local repair and map retirement — 13 October 2026

Initial scope: local version only. Subsequently the user explicitly authorized
an Oracle online multiplayer test including the Liftoff resources. These repairs
are included in the running 13 October release; see ORACLE-DEPLOYMENT.md for
actual publication, verified backups and the completed current-symlink readback.

## Corrected

- Loading layout: `.menu-scene-status` lived in unused `style.css`. The actual
  client imports `menu-refinement.css`; adding the rules there keeps the status
  out of flex layout. Browser computed position changed from static to absolute.
- UV: imported drone meshes received a second V inversion after Blender's glTF
  conversion. A UV-only comparison restored carbon and battery labels. Original
  Luma mesh comparison: old delivery 0/10,214 matched UVs, corrected editable
  export 58,501/58,501. Armattan and the scoped workshop kit received the same
  correction. Environment-map UVs were not changed.
- Luma honors the original frame's `batteryAtBottom` runtime flag; saved editor
  placement had left it above the frame. All LODs and the editable source updated.
- Kestrel's source axis normalization pointed motor bells down. Blender source
  rotated about forward; local rotor positions corrected to retain physical
  index sides. Base and alternative components checked. Visual rotor animation
  now rotates about body up even with inverted source pivots. Flight parameters
  and Kestrel ID retained.
- Pending/failed garage loading now retains the last menu camera and FOV until
  the new scene commits. This closes a camera jump exposed by failure injection.
- Ironworks retired with a self-contained, verified ZIP and original folders
  preserved. Only three imported Liftoff maps remain active, with 17 routes.

## Verification

- Production-style local build and content validation passed.
- Final complete suite: 209/209 passed. Real GLB geometry/part tests, source UV
  comparison, rotor direction and failed-scene camera regression included.
- Isolated single-folder archive restore: one map, two routes, two missions;
  validates with existing Kestrel/parts scaffolding, no player DB.
- Browser: native workshop HTTP 503 -> inline Retry -> successful loading after
  a controlled three-second delay. Layout rectangles equal before, during and
  after: 1280x720. Visible map Loading with a six-second download delay also
  preserved the Flight setup rectangle exactly; last background remained visible.
  A second HTTP 503 run confirmed the last menu camera stays intact. Temporary
  fixtures stopped after QA.
- Low renderer at true 1280x720: Luma, Armattan and Kestrel inspected; screenshots
  `luma-fixed-low.png`, `armattan-fixed-low.png`, `kestrel-fixed-low.png` under
  `data/checkpoint-proof/`. In-game workshop proof retained separately.
- Final game Workbench: existing Luma copy keeps its cyan paint, corrected
  underslung battery and carbon atlas. No console errors on the fresh local
  client. Proof: `data/checkpoint-proof/workbench-fixed-20261013.png`.

## Sources, caches and continuation

Previous sources/models are preserved under `data/art-repair-20261013/before/`.
Editable corrected sources remain in each drone folder and the workshop folder.
Source repair: `tools/blender/repair_drone_imports.py`. Delivery exporter:
`tools/repair-drone-deliveries.js`. Do not repeat source recovery or this completed
repair unless inputs change. Import scripts now preserve the corrected convention.

Older public candidate at `data/menu-qa/release-20261010` predates this repair and
contains retired Ironworks. It is not the current local release and was not
deployed. No redistribution permission for Liftoff is established.

Still unverified: UHD 620 60 FPS, eight-drone target-hardware runs and complete
manual native race runs. Existing imported-map Low triangle budgets are exceeded;
this functional repair is not performance acceptance or artistic approval.
