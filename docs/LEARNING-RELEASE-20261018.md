# Learning and maps release - completed 18 October 2026

**Published and finalized:** https://parvoz-drone-sim.duckdns.org/ . Release
**20261018-learning-01**, source **e4826767728209ff2e6eaad1002471d8dd7c3469**, protocol **13**,
revision **4274546e0bac3771**, finalized **2026-10-18T08:22:35.302Z**.
This supersedes pending notes in earlier handoffs. Do not repeat imports,
Blender exports, compression, course recovery, upload, backups or finalization.

## Delivered

- Pine Valley: five authored Liftoff courses with native lap counts, props,
  collisions and a practice route. The Green: six authored courses plus practice.
  Both retain editable Blender scenes, course sources and provenance.
- Seven general piloting lessons: steady hover; climb/descent; yaw without
  drift; braking/landing; wide turns; narrow gates; first Acro steps. Both new
  maps also have an introductory lesson. Total: twelve lessons, five maps,
  30 routes, 112 delivery assets / 1,763,690,874 bytes.
- Real map-card thumbnails and a scrollable five-map list. Existing flight
  settings and Kestrel ID are preserved. Ironworks remains retired.
- Setup education is a [separate Hangar workshop proposal](TUNING-LEARNING-PROPOSAL-20261018.md),
  independent of piloting. Comparison, recommended format, progression and
  additional Betaflight topics are documented; curriculum code was not requested.

## Verified and remaining limits

The full 397-test suite, two extra authored-lap cases, seven affected content
tests and twelve deployment checks pass; these overlapping counts are not a
new combined suite total. Root, staged and VM build/content checks pass.
All 645 release inventory files, the exact public client and all 112 public
assets match. Public HTTPS/alias/health and two-client multiplayer pass on both
new maps. Public browser checks cover map cards, native course names/laps,
twelve lessons and The Green lesson startup/HUD. See [public evidence](online-evidence-20261018/README.md).
Both complete maps, workshops, lesson HUDs and course tours were also checked
locally at fixed 1280×720 / Low / adaptive off.

Both maps exceed the Low triangle/draw-call budgets. Vegetation LOD/batching
and actual UHD 620 performance measurement remain necessary. **60 FPS, 100
players and artistic acceptance are not confirmed.** See [measured costs](NEW-MAPS-LOW-20261018.md).
The test publication does not assert a Liftoff redistribution license.

## Production and recovery

Current: `/opt/liftoff/releases/20261018-learning-01`. Production accounts,
progress, env files, data volume and admission 20 are preserved; Always Free / $0.
Fresh OCI before/after restores, integrity and every original player row were
verified on VM. The backup timer is active and seven cloud copies are retained.
[Oracle deployment](ORACLE-DEPLOYMENT.md) records exact backup/image hashes.

The running image uses the new release's **public/content/assets read-only**;
retain that directory as a runtime dependency. Previous release
`20261016-hangar-race-01` and its image remain for rollback. No old-release
hardlink deduplication was applied. Raw player DB download and that broad change
were rejected by automatic approval; do not retry the saved operations.

Non-sensitive online metadata and aggregate reports remain under
`data/liftoff-forest-green-20261018/`. The full local delivery stage is saved as
`data/oracle-release-20261018-learning-01.tar.gz`: 646 files, 2,817,901,744 bytes,
SHA-256 `2724c91c968d1f7f1871e4a5cba0ac3f41ac1c831d7fd54e20cd36f0cda98a95`.
Every archived member matched its independent size/hash inventory. The five
duplicate expanded stages were removed only after all recovery archives passed
verification; see [the cleanup record](DISK-CLEANUP-20261018.md). Canonical
editable art stays in Git/LFS; import caches stay on D:. Do not remove active
VM assets or redo completed art.
