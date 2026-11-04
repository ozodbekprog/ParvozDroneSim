# Flight lessons and Liftoff maps — 18 October 2026

**Publication update — 18 October:** the integrated client, maps and lessons are
published in finalized release 20261018-learning-01. Earlier pending access,
browser and candidate instructions below are historical. Continue from
[the completed release](LEARNING-RELEASE-20261018.md) and
[verified Oracle state](ORACLE-DEPLOYMENT.md); do not redeploy an older candidate.


Current release continuation: [LEARNING-RELEASE-20261018.md](LEARNING-RELEASE-20261018.md).
The pending-browser/stamping/deployment instructions below are earlier import
history; completed stages must not be repeated.

## User direction

Keep aircraft setup separate from piloting. The proposed setup course belongs
in Hangar / Tuning, with its own entry and progress. It remains a proposal:
[TUNING-LEARNING-PROPOSAL-20261018.md](TUNING-LEARNING-PROPOSAL-20261018.md).
The proposal compares entry points, recommends a separate workshop with inline
help and explains the teaching sequence, current simulation differences and
additional Betaflight topics. No setup course has been implemented.

The user selected **Pine Valley** and **The Green**, including their authored
courses, and explicitly authorized their Oracle multiplayer test. Retain the
proprietary provenance and unconfirmed redistribution metadata. Ironworks stays
retired. Production accounts/progress, admission 20 and the $0 budget remain.

## Piloting lessons

Seven new lessons cover steady hover, climbing/descent, yaw/orientation,
braking/precise landing, wide turns, narrow gates and Acro basics. The three
existing lessons remain. Target holds can require position, airborne state,
speed, heading and flight mode continuously; a fast fly-through does not count.
The HUD shows speed, target heading and hold time. Flight-school pagination keeps
selection and launch attached to the visible page. Kestrel/controller defaults
and flight parameters are preserved.

Earlier browser checks verified both pages, selection, starting Steady hover
and the overspeed hold condition. Full manual completion of every lesson is not
claimed. Screenshot: data/liftoff-forest-green-20261018/flight-school.png.
Each imported map now has its own short takeoff/gates/landing lesson.

The final integrated regression run passed **397 tests**, zero failures, in 348
seconds: data/liftoff-forest-green-20261018/final-five-map-fixed-suite.log.
Root and independent release-candidate builds/content checks pass. Both maps'
hover, landing, checkpoint reset, introductory lesson, timed mission and restart
scenarios pass. Manual full-map Low/browser acceptance remains pending.

## Recovered sources and courses

Profiles: tools/import-profiles/liftoff-pine-valley-demo.json and
tools/import-profiles/liftoff-the-green-demo.json. All source bundles, textures,
terrain and course data are cached under data/liftoff-*-recovery/. Both task-owned
AssetRipper sessions are closed. Do not reload or re-extract the installation.

- Pine Valley: 513 by 513 terrain heights, 2,408 authored tree/shrub instances,
  345,662 authored grass detail instances, 6,886 source objects and 3,426 collision
  proxies. Full editable map.blend and five native courses are saved in Git/LFS
  at 8e27d91. The missing DangerPyramid01 SpecGlossMap was recovered from its
  containing bundle and applied only to the affected courses. Source material
  repair was reviewed in pine-materials-fixed.png; opaque leaf rectangles are
  gone. Actual full-map game/Low review is still required.
- The Green: 513 by 513 terrain heights, eight painted layers, 1,408 authored
  vegetation instances, 8,498 source objects and 20,364 collision proxies.
  Editable map.blend, current materials, provenance and six native courses are
  saved in commit fa66bee; its 13 LFS objects / 1.0 GB push is verified on GitHub.
- All eleven courses retain native gate order, laps, prop geometry, materials,
  collisions and editable track.blend. All course material audits and complete
  Kestrel aperture/approach checks pass. Source start X/Z and yaw are retained.
  Green courses 02/03/04 require vertical clearance of 0.21/0.13/0.02 metres.
  Only Green 06's last checkpoint needs a verified reset pose nearer the portal.
  These adaptations are recorded in the corresponding SOURCE files. All eleven
  courses pass checkpoint reset clearance checks.

Native grass is adapted to static crossed billboards using authored density and
atlases; scatter, wind, tint and distant fading are disclosed in the terrain
report. No source lightmaps were recovered for these two environments. The
reused workshop has a terrain-relative placement that still needs game review.

## Exact runtime continuation

The first Green model measured 589,748,232 bytes. Its replacement shares native
vegetation geometry, retains per-instance placement and limits terrain patch
normal maps to 256 pixels. The current optimized model is **265,604,208 bytes**,
with 21,487,383 triangles across three LODs and 910 textures. The conservative
4 by 4 / 16-byte block texture estimate is 221 MiB before drone/course resources;
this is not a measured full-game GPU result or UHD 620 acceptance.

The new raw export is complete. Do not export Green again just to continue its
checks. Old comparison/cache files are retained as runtime-before-vegetation-reuse.glb
and model-before-vegetation-reuse{.prepared.glb,.glb}. Green automatically continues
in green-final-stages.log: all three LODs have zero missing/moved surfaces across
24,575 deterministic probes. Delivery SHA is
3f3c181bb39221ca3521f91b18ef53fbb7875ac32c1abb2b2fbd247a7f2c6a63.
Three custom shader disclosures were completed without altering the delivery
geometry/textures; the repeated material audit checks 448 materials, zero failures.
Course/package and the separate green-markers.log passed. Local hover, landing,
checkpoint reset, introductory lesson and timed mission/restart checks pass.
Green's runtime is pushed as f694f0e; its editable course guides as a32ad02.
Keep heavy Blender work sequential.

Pine's replacement raw export and optimization are complete: runtime.glb
1,508,592,292 bytes, model.glb 201,436,156 bytes, 33,251,908 triangles across all
LODs and 598 textures. The complete pine-final-stages.log chain passed. All three
LODs have zero missing/moved surfaces over 36,836 probes; delivery SHA is
b17ef7862351e2bb4bdaf15f1524fb0853b0f56ceb01452c338a269843635342.
Material audit: 317 checked, zero failures. Do not restart completed stages.

The final local catalog is five maps / 30 races / twelve lessons, revision
318909ca027f5bb0, 110 assets. All 80 published assets remain; 30 additions total
858,884,790 bytes. The default incremental image cap remains 128 MiB; this measured
content update requires explicit 1024 and at least 3,113,525,282 free bytes at
image-build time. The budget helper tests and Bash syntax check pass.

The full integration run found five AI route failures. Accurate 6 cm waypoint
arrival fixes joins around scenery; short gate departures avoid nearby props;
the A* lower height bound now includes the actual starting altitude during climbs.
All five reproductions finish with zero resets; the complete 397-test run passes.
Two additional authored-lap checks pass: Pine 05 completes all three source laps
and Green 06 both source laps, without recoveries. Log: native-multilap-ai.log.

Candidate data/oracle-release-20261018-learning-01 is prepared, independently
builds/validates and contains the corrected AI files. The two-file source-refresh
helper has already run; do not rerun it. After committing verified final sources,
run finalize-learning-candidate.mjs with that SHA to verify/stamp its inventory,
then package a delta against the fresh task-folder oracle-current-release.json.
It is not uploaded or deployed. Capture actual Low views and thumbnails in the browser;
do not substitute a Blender render for game acceptance. The earlier small Green
probe measured 24,740 triangles / 60 calls / 9.8 MiB at 1280 by 720; that is only
a probe, not the final environment or target-laptop performance.

## Git and disk

Working branch is main. The private origin remains Fayzullo637/ParvozDroneSim.
Prior verified pushes include d911e32 / 3e1b635 (lessons), 69d7f3a / cf2ac29
(setup proposal), a0b6568 / 23dde0b (outdoor materials and gate checks), 22f27af
(delta staging), 8e27d91 (Pine sources), cc40685 (checkpoint reset support), and
c171989 (spatial sibling instancing). Continue small checked commits/pushes and
verify local/remote SHA. Do not include unrelated unfinished changes.

The cleanup described in [DISK-CLEANUP-20261018.md](DISK-CLEANUP-20261018.md)
retained this task and complete release archives. Do not reconstruct deleted old
stages or data/contact-source. The fresh closed-LFS-temp cleanup report is
closed-lfs-temp-cleanup.json in the task folder; its deletion script is a completed
one-time action, not a resume command. History, LFS objects and sources are intact.

## Oracle publication

**Nothing from this task is published.** The active release remains
20261016-hangar-race-01, protocol 13, revision b68f2b229bf64134, three maps / 80
assets. Read-only HTTPS and pinned SSH checks confirmed this again on 18 October.
Fresh baseline inventories are saved in the ignored task folder as
oracle-current-release.json and oracle-catalog-before-learning.json. Do not use
the deleted expanded stages or deploy the stale 20261017-entry-01 UI candidate.

Use C:/Program Files/Git/usr/bin/ssh.exe with the existing key and pinned host
file. Windows system OpenSSH leaves console-error processes after successful
commands here. The authorized single-source TCP22 rule rotation is complete;
proof: oracle-ssh-rule.png. Verified duplicate upload cleanup left 5.37 GiB free;
see ORACLE-DEPLOYMENT.md and oracle-retired-flight-patch-cleanup.json. All release
directories/images, unique manifests and production env/data remain. Retain them and
the production data volume. Measure candidate/delta/build space before uploading.
The stage helper verifies hashes and uses bounded immutable-asset hardlinks;
mutable JSON/code, env and databases must remain independent.

The earlier pre-learning-cloud-20261018.sqlite backup passed VM and local cloud
restore, SHA-256 7303df2883648fe56166e2b2ff690ec0ce0e9140f8ab9b268e25f790e0d43d69.
Counts then: users 4, records 4, career 0, sessions 41, achievements 3,
owned_parts 0, drone_fleets 1. Timer active, rooms zero. Make a fresh uniquely named
pre-release backup/restore immediately before deployment; do not overwrite this
verified copy. Preserve production env/data and rollback image.

Browser inventory still reports **Local browser use is disabled in Work settings**.
The user has already been asked to enable it. Continue independent preparation;
do not bypass this setting, claim final browser acceptance or activate the update
before required affected-gameplay checks. After validation, prepare a fresh
learning release with the explicitly authorized five-map online-test scope,
verify its build/delta/isolated server, backups, drain, HTTPS/health/all assets,
two-client multiplayer and affected game flows. Finalize current symlink only
after successful checks, then update ORACLE-DEPLOYMENT.md with actual evidence.
