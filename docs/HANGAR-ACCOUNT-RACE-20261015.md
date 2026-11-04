# Hangar, account, cameras and Race follow-up — 15 October 2026

## Scope

User reported inspection rotation/zoom stutters, device-local custom copies,
camera clipping and missing drone detail. Requested physical AI opponents in
Race (without aircraft-to-aircraft collision) and a frozen selected aircraft
composition in the home menu. Time Trial remains against the clock.

The request to disguise imported assets to conceal their origin is excluded.
Preserve provenance and permission metadata. A public commercial release needs
original or appropriately licensed replacement art; cosmetic changes do not
establish permission. The existing online-test authorization remains limited.

## Account fleet — local implementation

- Additive `drone_fleets` table and authenticated GET/POST `/api/fleet`.
- Copies, selected aircraft, parts, paint and validated flight-controller tuning
  are saved atomically. Ownership/compatibility are checked server-side.
- Optimistic revisions reject stale writes from another device instead of
  silently replacing the newer Hangar. Failed writes keep the editor draft.
- First cloud access merges old browser copies additively, deduplicating equal
  builds and preserving different same-number copies. A per-device marker
  prevents old local copies resurrecting remote deletions.
- Guests remain local. Server data is mirrored locally after successful writes;
  a full browser store cannot undo a successful cloud save.
- Existing account/progress rows are untouched; backup verification now includes
  the optional new table. No production database has been migrated yet.

Checks: 17 focused tests passed, including two authenticated devices, account
isolation, invalid components, stale update rejection and a server restart.
Production client build passed. Browser acceptance and publication remain pending.

## Local follow-up verified

- Fresh devices use the existing cloud fleet without synthesizing an extra copy
  from `/me`; explicit backup imports merge even after the migration marker.
- Fleet calls are serialized, stale queued saves are rejected, and requests are
  bound to the initiating account token. A conflicted Workbench draft can be
  saved as a new copy while preserving the other device's edits.
- Immutable scenery matrices/LOD lists are cached. Dense preview framing is
  calculated once until model/layout changes. Inspection shaders compile before
  the loading indicator clears.
- FPV uses the visible model camera socket. Swept sphere checks shorten FPV,
  chase and inspection offsets before both-sided thin walls.
- Home shows the selected assembly in a fixed, lit flight pose. Actual in-game
  evidence is under `hangar-evidence-20261015/`.

Validation: 35 focused tests plus the real two-session server/restart fleet test
pass. Production build passes. Deterministic 13-second orbit/zoom probe uses
fixed 1280x720 WebGL2 Low (3 seconds warm-up, 10 recorded). CPU median/p95 changed
from 8.1/33.1 ms to 3.9/6.1 ms; frame median stayed 22.4 ms and p95 changed
44.8 to 33.6 ms. Runs were sequential on this development machine under variable
load, not UHD 620 acceptance. First captures used frame-dependent paths and
are diagnostic only; `*-timed-orbit.json` uses equal wall-clock paths. Baseline
loads pre-change World/LOD from bf3c2b3, sharing other current modules. Occasional
long frames remain, so this is not proof that all stutter is eliminated.

The SOL/xhigh delegates resumed after the usage interruption. Their completed
Race and Blender work is integrated, reviewed and checked. Ordinary solo Race
has three physical opponents and records their replay poses; Time Trial stays
clock-only. See `RACE-AI-20261015.md`. Restored electrical paths, eleven battery
arrangements and optional cosmetic cameras cover all five aircraft; editable
Blender source and provenance are retained. See `DRONE-DETAIL-20261015.md`.
Actual Luma Workbench/battery swap/save and customized home composition were
checked in-game on Low; screenshots are in `drone-detail-evidence-20261016/`.

Final canonical suite: 311 passed, zero failures/skips. Local production and
isolated release builds/content checks pass. Earlier automatic discovery ran
archived duplicate tests and caused a load-generator timing failure; restricting
discovery then exposed a backup CLI glob argument error. Both are repaired;
the final suite includes the actual isolated load check. This is not a production
capacity measurement. Candidate `20261016-hangar-race-01`: protocol 13, revision
`b68f2b229bf64134`, 80 assets / 904,599,026 bytes. Previous 76 assets are unchanged.
Publication status belongs to `ORACLE-DEPLOYMENT.md`; local readiness alone does
not mean the site has updated.

16 October integration update: retry provenance remains fresh after a failed
cloud read, and synthetic `/me` migration is not persisted before successful
account sync. A failed initial additive merge never grants its local fallback
permission to overwrite the newer cloud fleet. Regression checks cover this
data-loss path. CLI backup verification now tolerates a glob test argument;
`npm test` targets canonical `test/*.test.js` to exclude archived source copies.

## Limits and final release checks

1. UHD 620 frame time/4 GB RAM acceptance remains unconfirmed. AI adds three
   physical simulations; no new capacity or sustained 60 FPS claim is made.
2. Camera sweeps cover both-sided mesh/box walls and wide near-plane corners;
   authored camera sockets follow model transforms. Complex concave contact
   behavior and every possible manual camera path have not been exhausted.
3. Published and finalized as **20261016-hangar-race-01**, source **f51e38d**,
   at 00:54 Tashkent on 16 October. Public 80 assets/two-client checks and actual
   browser Race, Luma action-camera save/use, Hangar orbit/zoom and customized
   home passed. Before/after OCI restores passed on VM and locally; all four
   accounts, existing fleet and progress/replay/weekly rows matched exactly.
   Current symlink, retained contacts-01 rollback and exact image/backup hashes
   are recorded in [ORACLE-DEPLOYMENT.md](ORACLE-DEPLOYMENT.md).

The other chat's physical contact work is committed and published as
`20261015-contacts-01` (source 6a9e1be). This follow-up retains that solver and
protocol. Its small physics-file change only carries the cosmetic camera flag.
