# Flight and atlas UV repair — 15 October 2026

User reported all aircraft/maps on the public site: difficult takeoff below
80% throttle, passing through walls/leaving maps after impact, misplaced textures.
They clarified that a direction was held while raising throttle.

## Reproduced causes and repairs

- Overlapping mesh triangles each applied the same stale penetration. A 100-face
  floor fixture moved a drone 5 m instead of 5 cm. Requery the contact after each
  correction instead of accumulating stale depths.
- Collision ran only after the whole 60 Hz command. A 120 m/s approach crossed
  both a thin box wall and a mesh wall. Resolve each 240 Hz dynamics step and
  sweep sphere faces/edges/vertices for motions large enough to tunnel. Project
  remaining motion along contacts; use the same code in authority and prediction.
- At 50% throttle plus full pitch/roll, the craft flipped before clearing the
  floor. Direction authority now increases with clearance from the last support
  surface, reaching full rates above the rotor footprint. Airborne spawns and
  existing airborne rates, Kestrel ID/specifications and throttle curve are intact.
  Holding full pitch/roll in Acro after takeoff still requests a roll/flip.
- Map/course import inverted UV0 after Blender's glTF conversion. The original
  Minus Two poster probe matched 0/4 UVs; all four were V-inverted. Keep Blender's
  primary UV conversion; retain the separate Unity lightmap sampling convention.
  Repair primary UVs in the three editable maps and 14 native course sources,
  then regenerate deliveries from prepared geometry using existing KTX2 textures.

## Verified locally

- 241 full-suite tests passed, including duplicate surfaces, fast two-sided box
  and mesh impacts, fast landings, takeoff with a direction, prediction/replay,
  and 15 actual imported-map/stock-drone takeoffs at 50% throttle.
- Root build and content validation passed: 3 maps / 17 routes / 5 aircraft /
  36 parts. Protocol 11; content revision `4d221c5be747e24c`.
- Actual compressed atlas comparison: Minus Two 19/19, Hangar 34/34,
  Arena 1,463/1,463 matching source coordinates, including texture transforms.
- All 17 regenerated deliveries retain identical encoded texture bindings,
  alpha modes, vertex and index counts. Prepared non-UV geometry hashes match.
- Local two-client transport checks passed on all three maps: stale content
  rejection, controller/asset readiness, acknowledgement and authoritative flight.
- Original editable sources, raw/prepared deliveries and their SHA-256 backups
  remain in `data/map-uv-repair-20261015/before/`. Per-file completion records
  prevent double inversion. Reuse them; do not rerun full extraction or assembly.

## Publication

**Published and finalized as `20261015-flight-01` at 03:21 Tashkent**, preserving
the verified `20261015-ui-01` interface. HTTPS/health/WebSocket/all 71 assets and
two-client checks on all three maps passed. The exact grounded launch trigger
was checked through live authoritative input frames: Kestrel/Luma gained
2.16 m / 2.37 m at 50% throttle plus launch pitch, without crashing.
Browser guest entry and Low rendering passed; unreliable in-app key-hold
delivery is excluded from public keyboard acceptance.

Fresh before/final-after cloud downloads restored independently on VM and locally.
All original users (4), records (4), career (0), achievements (3), owned_parts (0)
rows matched exactly; sessions rose 21 → 31 during QA. Before SHA-256
`25e94aa8dfd16dd75475275e4f1ff8f49227c81d4e63f3d6894d0f6b51935890`;
after `b7128e9bbe458593445fcc4452c65f062cce88b81699429de64cc98744e2b1b0`.
Production env/volume, admission 20, backup timer and seven-copy retention remain.
Current symlink/container directory is finalized; previous UI directory/image
retained for rollback. See `ORACLE-DEPLOYMENT.md` for exact image/archive details.

Continuation: the current source/cache UVs are already repaired. Do not rerun
the inversion or repeat completed imports, uploads, backup or finalization.
For a new unrelated change, check Git status/remote and the real server baseline.
Another chat has ongoing uncommitted memory/cache changes; they were not included
in this release. `data/oracle-release-20261015-flight-01/` and its reviewed delta
remain; canonical editable sources are pushed through LFS. Evidence:
[UV close-ups and browser scenes](flight-uv-evidence-20261015/README.md).

Custom world-space/triplanar shader approximations, UHD 620 performance and
full manual acceptance of every native course remain unconfirmed. No new
Liftoff extraction, Ironworks restoration, admission increase or paid service.
