# Parvoz rebrand and GitHub - 13 October 2026

**Completed and published:** https://parvoz-drone-sim.duckdns.org/ . Product:
**Parvoz Drone Simulator**, short **Parvoz Drone Sim**, wordmark **PARVOZ**.
Permanent private repository: https://github.com/Fayzullo637/ParvozDroneSim,
branch `main`. Ordinary commit/push after each verified change is authorized
and required by AGENTS.md; preserve private visibility and Liftoff provenance.

## Saved project and identity

- Canonical code/content/editable artwork and all 592 initial LFS objects
  (about 2.6 GB) were pushed; the initial baseline tag points to `59d0972`.
  Git restore/build/content verification succeeded without D: content junctions.
- Verified duplicate stages, old delivery hashes and temporary caches were
  removed. Retain the scene-02/test-01 full archives and Ironworks ZIP.
  See GITHUB-CLEANUP-20261013.md and GITHUB-WORKFLOW.md.
- Rebrand code `cc84eba` changes browser/menu name, server log, npm package,
  local editor/Unity labels and user download names. The temporary P mark is
  not a selected final graphic identity; see BRANDING-PARVOZ.md.
- Legacy storage keys, backup format, database/volume names, physics and Kestrel
  ID remain compatible. Build/content and local-backup checks passed.

## Verified Oracle release

Release `/opt/liftoff/releases/20261013-parvoz-01` is healthy and `current`
points there. Finalization verified at **2026-10-13 18:02 UTC**. Protocol **9**,
revision **4233a00856896de1**, three maps, 17 routes and six drones remain.
Details, full image IDs and backup hashes: ORACLE-DEPLOYMENT.md.

The code-only archive is **118,447 bytes**, SHA-256
`294b3dc76a08d8dde81afe1227c5287f11ad042f84c52f0a774506c0fbf59283`.
All 359 reused/changed files were hashed on the VM. All **55 delivery assets /
814,088,978 bytes** were reused. No unchanged assets were reuploaded or art
exports repeated. The first installer stopped at a temporary directory access
error before production changes; moving the verified package into the service
user's own home resolved it without widening the Ubuntu home permissions.

The user completed DuckDNS access, registered the new name and approved the
exact Oracle SSH source replacement to **144.124.196.42/32**, TCP 22. DNS lookup
verified **84.8.106.32**; SSH succeeded from the approved IP. The console session
expired after Save, so there was no console-row readback. Both public addresses
pass HTTPS, health/API, WebSocket, asset HEAD/range/cache. Internal/editor paths
remain closed. Production env differs only in GAME_DOMAIN, a quoted two-host
list; backup env is unchanged. Admission remains **20** and budget **$0**.

Two-client guest race smoke passed readiness, stale-revision rejection,
countdown, input acknowledgments and authoritative movement. Browser verified
PARVOZ guest/main menu, Minus Two Free Flight/HUD and return, with no captured
errors. Proofs: `data/parvoz-live-menu-20261013.jpg`,
`data/parvoz-live-flight-20261013.jpg`. Cold first flight downloaded 62.7 MB;
UHD 620 frame-rate, full course completion and 100-player acceptance remain
unconfirmed. The isolated local preview on port 2597 is stopped.

Pre/post backups were uploaded, downloaded from the private bucket and restored
on the VM and this computer. All existing users (3), records (4), career (0),
achievements (3) and owned_parts (0) rows match exactly. Guest sessions changed
9 to 12. Backup timer is active; seven-copy retention is preserved. Verification
copies and reports stay local/ignored; no production DB was replaced.

## Rollback and continuation

The previous untagged image was unavailable at finalization. Retained scene-02
sources rebuilt `liftoff-game:rollback-scene-02`; an isolated container verified
its old Vector FPV title, health, protocol/revision, catalog and admission.
`deploy/previous-release.txt` now references that valid image and the scene-02
directory. The original record is retained for audit. No production rollback
was executed. The deploy script now tags the old image before rebuilding and
checks availability before draining; two regression tests passed (`bbcf200`).

The old https://drone-liftoff-uz.duckdns.org/ remains a working alias. Browser
settings, sessions and replays belong to their original origin; use the existing
local backup export/import to move browser data. Account progress uses the
same production database on both addresses.

Do not rerun completed registration, installation, restore, finalization or
asset exports. The patch is not a standalone full-release backup: retain the
baseline archives, Git/LFS sources and Ironworks ZIP. Ironworks stays retired.
