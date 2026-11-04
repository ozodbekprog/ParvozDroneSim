# Menu loading, Auto graphics and replays — 15 October 2026

The user reported repeated waits when opening menus, selecting map cards,
changing drones/components, Auto choosing Low on a powerful computer, and asked
to check replays. Target system memory is 4–8 GB. This repair builds on the
published flight/collision/atlas corrections in `20261015-flight-01`.

## Causes and changes

- Map cards changed the full menu background to the selected location, parsing
  a large model before the player even launched. Selection now uses existing
  static map thumbnails and retains the loaded background. Flight launch still
  prepares the actual location.
- A component change recreated the airframe and every part, loading three LODs
  for each. Inspection now loads one close LOD and swaps only the changed part
  category. Existing geometry stays visible until replacements are ready;
  superseded requests cannot install older selections.
- Leaving the Hangar destroyed the inspected drone. Keep one hidden inspection
  drone for the return; remove flight participants normally.
- Byte caching avoided repeated downloads but released parsed models as soon
  as their last reference disappeared. Add an idle parsed-model LRU: at most
  20 entries and a conservative CPU/GPU estimate of 48 MiB on ≤4 GB/unknown
  devices, 96 MiB above 4 GB. Active references are pinned; oversized models
  are evicted rather than keeping every map resident.
- Fleet cards used five extra model renders on every new page. Five saved,
  real stock-drone thumbnails replace that work. Modified builds retain their
  generated previews; visual cache keys exclude nonvisual tuning.
- Auto ignored GPU identity and inherited stale preset fields. Detect the
  actual graphics adapter where available; discrete desktop GPUs start at High,
  UHD 620/software at Low, unknown desktops at Medium. A discrete GPU with a
  4 GB memory hint starts at Medium. Explicit manual presets remain respected.
  Menu/loading frame times no longer reduce flight resolution.
- Replay listings cloned every flight including all frames into memory.
  IndexedDB v2 adds small metadata rows, migrating existing flights one at a
  time. Full frame export is preserved. Save/rename/import/delete keep both
  stores consistent.
- Replay playback started before model/graphics preparation and reloaded the
  world during viewer rendering. Preparation now completes before its clock
  starts. Viewer controls do not reload the world; returning to the library
  releases the selected frame payload. The pause-menu blur excludes replay
  viewing so the actual scene stays clear.

## Verification

All **248 tests** passed, including real GLB part swaps, shared-geometry identity,
idle cache reuse/eviction, cancellation, initial-menu request joining, automatic
preset selection, and IndexedDB migration/export/mutations. The production build
passed. Build was repeated after the final replay blur correction in the isolated
candidate; no flight physics or UV sources were regenerated.

Actual Chrome checks: all five saved stock images loaded; the warm Hangar
returned with no busy state; Gecko DAL → HQ → DAL propeller changes rendered;
Arena/Minus Two card selection kept the menu scene ready. Auto selected High
and 100% on this computer. A real local flight was saved, opened, sought to its
end, played at 2× and switched between FPV/Chase; its library survived reload.
Keyboard-hold delivery through the browser tool is not a flight-input acceptance
test. These checks do not prove target-laptop FPS or total RAM use on a 4 GB PC.

Evidence: [actual UI captures](loading-repair-evidence-20261015/README.md).
First uncached maps/parts still require downloading, decoding and GPU setup;
browser cache eviction and reloading the page can require that work again.
The idle cache budget is not a total application RAM cap.

## Publication

Published **20261015-loading-01**, finalized `2026-10-15T03:18:31.839Z`:
protocol 11, revision `91a4b5db45d47a74`, source commit **7155fdd**.
Public HTTPS/health/WebSocket, all 76 assets (898,105,235 bytes), retained previous
assets, alias, protected paths and two-client Gecko/Dquad smoke passed. Public
Chrome confirmed Auto High/100%, warm Hangar, static cards, flight and replay
save/open/seek/speed/FPV/Chase. All five captured JPEGs are verified 1920×1080.

The 387,420-byte patch reused 430 files; all 457 reconstructed source files were
verified before deployment. Standard race drain, healthy containers, unchanged
server env and retained flight-01 rollback image were verified. Fresh before/after
cloud backups restored on VM and locally; all original account/progress rows
matched exactly. Current symlink is finalized, admission remains 20.
Full release/image/backup hashes: [ORACLE-DEPLOYMENT.md](ORACLE-DEPLOYMENT.md).
Next release baseline: ignored `data/loading-online-release-20261015.json`.
Keep imported-content provenance and online-test permission metadata, retired
Ironworks, production player data, admission 20 and Always Free/$0 scope.
