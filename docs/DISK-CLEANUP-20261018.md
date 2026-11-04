# Local disk cleanup - 18 October 2026

**31 October update:** The newer [cleanup inventory](PROJECT-CLEANUP-20261031.md)
supersedes this document's statements about retained temporary files. Two full
release archives remain: 16 and 18 October. The 15 October release archive,
superseded patch archives/stages and old comparison exports were removed.
The historical verification record below remains unchanged.

The user requested removal of project rubbish after the folder grew to roughly
68 GB. This was a local cleanup; Oracle and player databases were not changed.
Pine Valley/The Green imports and the other chat's unfinished code were retained.

## Verified removal

- Ten expanded release/patch/source stages: **16,937,693,297 bytes**. Every file
  was hashed first. Recovery is provided by the two retained complete releases,
  17 independently hash-checked LFS objects, or the extras archive below.
  Junction entries were unlinked before deleting stages, preserving their shared
  content, dependencies and Ironworks targets. This also removed the recursive
  `data/contact-source` references back into the working project.
- Old dated backup trees: **9,705,104,377 bytes**. All **257** editable `.blend`,
  JSON and PNG files are retained in a verified archive. **123 old GLB exports**
  from these backup trees were discarded. Current GLBs, original import resources,
  prepared/material-reuse caches and canonical Blender sources remain intact.
- Four superseded archives: **2,539,979,586 bytes**. These are the 13 October
  scene/test full releases and 14 October native / 15 October flight deltas.
  Their old inventory sidecars remain; use the newer complete releases below.
- **22** old Blender autosaves and completed geometry-audit GLBs on D:
  **1,986,677,611 bytes**. Main editable files and their cache inputs remain.
- Abandoned Git LFS temporary files were a major additional contributor. During
  analysis, `.git/lfs/tmp` grew from about **1.43 GiB** to over **16 GiB** while
  background `git hash-object` / `git-lfs filter-process` jobs ran. Two sweeps
  removed **29,941,597,542 bytes** in 227 files; some were generated during the
  cleanup, so this is gross removal, not net disk savings. Only files unchanged
  for at least 45 seconds and permitting exclusive read access were removed.
  Active/recent files, `.git/lfs/objects`, refs, index and history were preserved.

The initial free-space reading was C: **54,126,653,440 bytes**, D:
**4,443,414,528 bytes**. After the main cleanup it was C:
**72,951,369,728 bytes**, D: **10,239,082,496 bytes**: approximately **24.62 GB
net freed**, despite concurrent map work. Further closed-temp cleanup may increase
this. Counts of logical files exclude junction targets and inaccessible test
fixtures; they must not be presented as exact physical disk allocation.

## Retained recovery files

All four archives were streamed back and every entry's size/SHA-256 compared
with the source. Inventory sidecars include per-file hashes and original paths.
The release archives contain sources/runtime content, not production secrets or
player data. Their `RELEASE.json` is the original local staging record; verified
publication status remains in ORACLE-DEPLOYMENT.md and saved online metadata.

| Archive in `data/` | Files | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `oracle-release-20261016-hangar-race-01.tar.gz` | 489 | 1,505,044,065 | `9bcbfca9fde302b227745a2b895593919603f00a16b751c6e037b254982c7e8b` |
| `oracle-release-20261015-contacts-01.tar.gz` | 462 | 1,483,879,164 | `4a04941ca37839217a030584c41d2c23fa95fbe1863cb0bc8d8f35c4ab911913` |
| `legacy-editable-sources-20261018.tar.gz` | 257 | 2,077,895,708 | `2c281ac32f14201e5d57a5b16539a03a1c546e69ee1ae1c4e184c46f43efdb43` |
| `superseded-stage-extras-20261018.tar.gz` | 504 | 9,988,715 | `8faddab1745b443c4a51fba96e438c2a10704d8853d79dd1147ee7cd307eea80` |

Release archives restore directly into a separate empty release directory. The
legacy archive uses `c-data/` and `d-import/` prefixes; inspect its inventory and
restore selected files manually. Extras retain project-relative paths. Never
extract over an active project or activate a retired map automatically.

The larger temporary full-backup consolidation was verified, then removed after
the editable-only archive passed verification. Its inventory is retained as a
record of discarded derived exports; its `.tar.gz` no longer exists.

## Preserved and checked

Ironworks ZIP and its checksum sidecar, Git/LFS history, all player DB copies,
dependencies, current content and canonical source junctions remain. The active
local catalog's **80 assets** all exist at their expected sizes. Protected
Hangar/Arena sources, recovery caches and both unfinished forest/green-map task
folders were checked. No full build/export/import was repeated for this cleanup.

Reports and one-time scripts are ignored under `data/cleanup-*20261018*` and
`data/*-20261018.inventory.json`. Completed deletion scripts are not restart
commands. Do not rerun them; for a future cleanup, inventory again and protect
active work. The remaining major storage is real editable content, import caches,
the Git LFS object cache and the retained recovery archives.

During the continuing map import on 18 October, background `hash-object` /
`git-lfs filter-process` operations accumulated another **54,274,427,652 bytes**
in LFS temporary files. A new inventory and exclusive-open check removed
**389 closed files / 51,263,494,916 bytes**, unchanged for more than 90 seconds;
19 open/recent files were skipped. History, LFS objects, index and sources were
untouched. The one-time report is
`data/liftoff-forest-green-20261018/closed-lfs-temp-cleanup.json`; do not rerun its
deletion script as a continuation command. Pine Valley's completed source and
five courses were subsequently committed/pushed as `8e27d91` so the unfinished
files are no longer repeatedly treated as untracked binary content.

## Finalized learning release archive — 18 October

After learning-01 was verified online, its complete secret-free delivery stage
was saved as `data/oracle-release-20261018-learning-01.tar.gz`:
**646 files / 2,817,901,744 archive bytes**, SHA-256
`2724c91c968d1f7f1871e4a5cba0ac3f41ac1c831d7fd54e20cd36f0cda98a95`.
The adjacent `.inventory.json` records every file's size and SHA-256. All 645
deployed inventory files and the finalized RELEASE.json were matched first;
the archive was then streamed back and every member independently checked.
It contains delivery sources/runtime files, not production envs, player DBs,
node_modules, import caches or editable Blender art. Canonical art remains in
Git/LFS. Restore this archive into a separate empty directory.

The four retained patch/supplement archives were also streamed and matched
against every expanded file. Only these five exact local expanded directories
were then removed: `oracle-release-20261018-learning-01`,
`oracle-patch-20261018-learning-01`, `oracle-supplement-20261018-learning-01`,
`oracle-shared-assets-20261018-learning-01` and
`oracle-deploy-repair-20261018-learning-01`. This removed **824 files /
4,696,116,402 logical bytes**; it is gross stage removal, not net disk savings.
Archives, inventories, current content, editable sources, D: caches and older
recovery archives are preserved. Reports are ignored under
`data/liftoff-forest-green-20261018/final-stage-archive-verification.json` and
`final-local-stage-cleanup.json`. Do not rerun their one-time cleanup helper.

This local cleanup does not remove the active Oracle release. Its
`public/content/assets` directory is a required read-only container mount and
must remain. Publication and backups: [ORACLE-DEPLOYMENT.md](ORACLE-DEPLOYMENT.md).
