# Harborworks live workshop modeling

`tools/blender/live_harborworks.py` is an incremental modeling script for execution **inside the already open Harborworks Blender scene through Blender MCP**. It does not open a scene, launch Blender, save a `.blend`, export a GLB, modify race JSON, or download assets. The caller owns scene backups, visual inspection, saving, and package export.

**Executed and published on 1 October 2026.** The native workshop stages ran through MCP in Blender 5.1; the session then painted surface textures, rendered the camera preview, saved `content/maps/harborworks/map.blend` and exported its current `model.glb` and `collision.json`. `authoring.json` records `liveBlenderMCP=true` and the publication date; `data/live-blender-modeling.json` records the resulting package. The workshop extends the earlier spacious native harbour baseline.

## Run in the live scene

Use three separate MCP `execute_blender_code` calls so each stage can be inspected:

```python
import runpy
hw = runpy.run_path(r'C:\DroneLiftoffUz\tools\blender\live_harborworks.py')
print(hw['phase1']())
```

```python
print(hw['phase2']())
```

```python
print(hw['phase3']())
```

If MCP execution namespaces do not persist, repeat the `runpy.run_path` line before a later phase. All persistent state is in native Blender objects. Phases 1 and 2 replace only their own tagged objects on rerun. Phase 2 requires phase 1. Repeating phase 1 preserves phase 2 details, which fit the same fixed shell.

## Authored geometry

The workshop is centered on Quayside Circuit gate 2: game coordinates `(-32, 5.4, 72)`, ground origin in Blender `(-32, -72, 0)`. Its long axis follows Blender `(-0.821, +0.570, 0)`. The shell is 22 m wide and 24 m deep; eaves are approximately 10.5 m and the raised monitor ridge is 14.6 m. Both ends have broad open hangar apertures. The side middle bays remain open above the spandrels.

Phase 1 creates masonry plinths, extruded I-section columns, column footings, window reveals with real openings, triangulated roof trusses, two pitched standing-seam roof slopes, raised divided clerestory glazing, a pitched monitor cap, parked sliding door leaves and portal braces. It replaces only objects beginning with `harborworks-dock-circuit pilot feature 2`. An existing proxy is removed only when its world center and dimensions match a replaced object's center and dimensions. Other map geometry, authoring routes, and proxies remain intact.

Phase 2 adds recessed divided window assemblies, modeled masonry joints, hollow U-section gutters, downpipes, four service workbenches with legs and shelves, folded tool racks, polygon-extruded open-jaw wrenches, modeled bench vices, shaped fluid bottles, cable reels, suspended fixtures, bollards, aisle paint and mesh entrance lettering. It uses standard Principled materials and planar mesh UVs. Geometric detail remains editable mesh geometry. Small details remain noncolliding. Structural members, roofs, windows, plinths, doors and bench tops get simplified un-beveled mesh collision proxies.

Individual named geometry lives in `09 Harborworks crafted pilot workshop`. Proxies live in `COLLISION_PROXIES`, carry `flightCollider`, `collisionType='mesh'`, and `authoring_only`, and are hidden from render and normal viewport drawing. Both visible objects and proxies carry `harbor_live_workshop_v1` with their phase number. Bevel modifiers remain editable in the native scene and can be applied on export copies by the normal exporter.

Phase 3 checks clearance and aims the existing pilot camera from Blender `(-13.93, -84.55, 6.4)` into the new workshop. It does not render or save. If a clearance hit is found, its return value requests review and includes the affected race segment and object.

After these stages, `live_surface_materials.apply()` painted compatible wood, stone, mineral and metal surfaces with color and normal PNGs in `textures/blender-painted/`, packed the images and supplied UVs where needed. `live_publish.preview()` rendered `thumbnail.png` at 900 × 506 pixels; `live_publish.publish()` backed up the package, saved the editable scene and exported the current runtime files. Follow [LIVE-BLENDER-MODELING.md](LIVE-BLENDER-MODELING.md) for this publication sequence and the saved-file CLI workflow.

## Validation and limits

The published whole-map package contains **48 material batches, 129,212 triangles, 254,379 position vertices and 45 embedded images**. `model.glb` is **11,699,932 bytes**; compressed `map.blend` is **5,506,951 bytes**. The live journal records **3,450 scene objects** and two preserved courses. `collision.json` contains **685 proxies: 608 boxes and 77 meshes**. These are current whole-map figures, including the surrounding baseline and earlier flight features.

The workshop's `check_clearance()` uses exact segment-versus-inflated-bounds checks with 0.45 m inflation for straight paths connecting spawn, checkpoints and lap closure. `live_check.check()` checks new proxies near spawn and gate centres. Neither establishes full gate-volume or curved-flight-envelope clearance. Earlier standalone helper counts and baseline box-only checks are historical; present runtime course clearance and extended flight tests need separate evidence.
