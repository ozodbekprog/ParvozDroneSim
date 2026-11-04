# Verified disk cleanup and Git preparation — 13 October 2026

The user requested removal of obsolete backup duplicates and GitHub history for
rollback and continuation on another computer. Oracle was not changed.

The measured logical file total on C: (excluding external junction targets and
Git's own storage) decreased from **12,288,506,578** to approximately
**5,152,550,616 bytes**. These are file sizes, not a claim about physical disk
allocation: the release stage included hard links. Git/LFS adds its own local
cache separately. The canonical Git snapshot is approximately 2.8 GB, including
about 2.7 GB of LFS assets.

## Removed after verification

- Expanded current and previous Oracle stages; complete `.tar.gz` archives and
  separate `RELEASE.json` inventory sidecars remain. Both archives passed every
  inventory hash/size check: current **364 files**, previous **361 files**.
- Superseded, never deployed `20261013-ui-01` stage and old `20261005-01` archive.
- Expanded Ironworks archive and isolated restore stage. All **32 files** in
  each map folder matched the retained ZIP. The successful restore result was
  saved separately. Matching original files were removed; the distinct old
  map definition and old course/mission definitions remain.
- Unreferenced old hashed delivery files and temporary probe assets. All **55
  active asset URLs** remain available. Fixed fallback textures were preserved.
- The npm download cache and 16 abandoned `.beta-test-*` fixture directories.

Deletion used an explicit list with absolute workspace bounds checked before
mutation. Two `node_modules` junction entries inside discarded stages were
removed without recursion before deleting the stages; the shared dependency
folder was retained. External D: caches and junction targets were untouched.

## Retained operational backups

| Archive | SHA-256 |
| --- | --- |
| `data/oracle-release-20261013-scene-02.tar.gz` | `e29f1c66c51b527b64d50afab35af62263b2342d7b11892bfcdceab7a42447fd` |
| `data/oracle-release-20261013-test-01.tar.gz` | `183a62dea0534182c0c1ef7c3b09c480cd721d47b923cc36cec3473015f0df6e` |
| `backups/ironworks-v2-20261013.zip` | `e41c0a34ae3892a38406a3ae177389e0f5d0978cab6c8d218d3e0e8b9723f3da` |

The two release archives and player database backups remain local and ignored.
Ironworks ZIP and SHA sidecar are included in the canonical Git/LFS snapshot.
Ironworks remains retired. No source regeneration, recovery, database replacement
or production release was performed.

## Git and verification

Git and Git LFS are initialized. `.gitignore` excludes secrets, databases,
dependencies, generated delivery/cache files, fixture folders, autosaves and
intermediate `*.prepared.glb`. `.gitattributes` tracks editable artwork, models,
images and the Ironworks ZIP using LFS. Candidate text files were checked for
private keys, GitHub tokens, AWS access keys and JWTs; none were found. No plain
Git file exceeds 50 MiB.

`npm run content:sync` and `npm run content:check` passed after cleanup:
**3 maps, 17 routes, 6 drones, 15 parts, 3 missions, 3 tutorials**. Content
revision remains **4233a00856896de1**. See [GITHUB-WORKFLOW.md](GITHUB-WORKFLOW.md)
for routine pushes, cloning and non-destructive rollback. Publication status is
recorded there once the user supplies the destination repository.

The initial Git commit (`aee8502`, branch `main`) passed `git lfs fsck --objects`.
All 1,307 tracked entries are regular files: no symlinks or submodules. A separate
restore from that commit regenerated hashed deliveries without D: content/cache
junctions, built successfully and passed content validation with the identical
revision. Installed `node_modules` was shared during this local build. The
temporary restore and its export archive were removed after verification; the
result and build log remain in `data/`. The user then supplied the private
`Fayzullo637/ParvozDroneSim` repository. Initial push of `main` and the baseline
tag completed: remote SHA matched `59d09720bd1f560d9844676646531503768a4fa6`;
all 592 initial LFS objects (about 2.6 GB) uploaded successfully.
