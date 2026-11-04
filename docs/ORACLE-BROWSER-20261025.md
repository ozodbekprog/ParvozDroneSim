# Oracle browser update — 25 October 2026

**Release 20261025-browser-03 is live and finalized**, at
https://parvoz-drone-sim.duckdns.org/ and the existing alias
https://drone-liftoff-uz.duckdns.org/. Finalized 18:14:21 UTC / 23:14 Tashkent.
Fresh readback confirms current, healthy containers and the exact new client on
both hosts. This is the user-authorized multiplayer test beta.

## Published release

- Directory/current: /opt/liftoff/releases/20261025-browser-03.
- Runtime source: 2d003d296f51052b18b6172a38e01073938e5c29, branch codex/demand-pilots.
- Image: sha256:644e4b762b7bc5faa984f5d36176020f43ad0410d985a5e6fbf75bcf23624253.
- Client: index-BMjsxyqU.js, SHA-256
  3d5462b181cb7805800ec19f78ea4b76e9c6d6bfc95124670ce3c75efe97b3d8.
- Archive: 991,217 bytes, SHA-256
  5cf28f22608c94681529175e8bbea7e9a6c88b7a2908a1300344aabc6ac7e9bb.
  All 33 archive members and 418 staged inventory files verified; 31 changed,
  387 reused. All 132 delivery assets (1,789,800,866 bytes) are unchanged.
- Protocol13/revision2132caf43c0e38df, admission20 and $0 are preserved.
- Canonical source content remains read-only in the retained
  20261020-optimization-01/content directory. Env files compare byte-identically
  with the prior release. Existing liftoff_game-data remains mounted writable;
  delivery assets use the new release's exact read-only directory.

The update includes packed exact collision trees, cancellable worker preparation,
retirement of decoded map physics across flight/menu/Hangar transitions, focus
validation in F4 capture, and already committed classroom/report features. Flight
parameters and aircraft IDs are preserved. During real browser checks, candidate
browser-02 exposed a cancellation error: clearing world.map left its old sun
effect rendering. It was rolled back after draining while the correction was
validated. The final release retains map/light references until replacement,
prevents incomplete-scene reuse and no longer starts another background map
load immediately after cancellation. Browser-02 is retained as a rejected image;
its acceptance checks must not be reused for the corrected client.

## Verification and backups

Full suite **565/565**, transition checks **22/22**, production build and content
validation pass. VM rebuild and all 418 inventory hashes pass, allowing only the
recorded host-specific import-cache stamps to regenerate. The opt-in stopped-
container image builder passed its tests and actual VM checks: original image
layers, startup command, user, environment and healthcheck remain identical, with
one new patch layer. Production data/env were never mounted in that container.
No retained image was pruned or paid disk added. Final free disk: 1,326,071,808 bytes.

Isolated temporary-database Pine/Green two-client races pass. External HTTPS API,
WSS, asset checks and two-client Pine/Green races pass. All 132 public files pass
exact HEAD lengths, immutable caching and byte-range checks **from the VM**.
Both public hosts return the exact new client. The external full inventory probe
timed out on this connection; this is not counted as a pass. Public Edge checks
on the final client pass: cancel Green loading → select Minus Two → flight/HUD →
menu → rendered Kestrel Hangar → menu → flight again. No captured JavaScript
errors in that final run. These are functional checks, not hardware FPS acceptance.

Fresh pre- and post-update backups were uploaded, downloaded from the private
bucket and independently restored **on the VM**, including integrity and rollback-
write checks. Every original non-session player row is preserved: 4 users,
5 records, 4 achievements, 1 fleet, 2 replays, 1 weekly record; other player tables
are empty. Private rows/digests remain on the VM. Seven dated cloud copies and the
active backup timer are preserved. No local database was uploaded.

- Pre: /home/liftoff/pre-browser-cloud-20261025-03.sqlite, SHA-256
  a217610bd73b2e7c2a6efb3565551232c4559be753606918ceae5215a47eddb8.
- Post: /home/liftoff/post-browser-cloud-20261025-03.sqlite, SHA-256
  43d556a3b8d6fe5ac61be65103abba1a393c69d7e1356a5be5e9e3341777b177.
  Restored/compared at 18:13:25 UTC, before finalizing current.

## Access recovery and continuation

SSH recovery completed after three approved graceful zero-player boots. Existing
keys and boot configuration are preserved. The protected local guest key is
C:/Users/User/.ssh/parvoz-oracle-recovery-20261025, outside the repo and never
printed/uploaded. Public fingerprint:
SHA256:pWMJ0vDyizjkvex7RrudaEaehhZfHepL4iX9+PNJHzQ.
Original RSA fingerprint SHA256:e0YQNjsr/n0UrPV647jG1xCZPBER6jLIxOu2y+nn/88
is retained, with a byte-identical authorized-keys backup on the VM.

The user approved exact TCP22 source rotations as this computer's IP changed;
the final saved source is **213.230.78.242/32**. HTTP/HTTPS/ICMP/egress are
unchanged. No IAM permission or paid resource was added. After normal SSH worked,
the user approved deletion of the temporary serial connection; the console now
explicitly reports that this instance has no console connection. Guest SSH was
verified again afterward. All local serial sessions are closed.

Rollback remains the actual prior running release
/opt/liftoff/releases/20261023-stability-03, image
sha256:a9c840316ead73e0aa170ec75ab0c76fa648e617748ab8ee7aa48b5c09485a69;
the new deploy/previous-release.txt records it. The 21 October release/image and
all earlier retained rollback images remain. No production volume was deleted.
Ignored evidence/archive/proofs and fresh final VM inventory are under
 data/oracle-browser-20261025/ (release-final-03.json is the next baseline).
Do not repeat completed staging, exports, access recovery, backups or activation.

The three local copied delta stages under data/oracle-patch-20261025-browser-*
remain: automatic execution review rejected their deletion, including a second
attempt with exact verified literal paths. All three archive hashes were checked
again and separate PATCH/RELEASE inventories preserved. Do not treat cleanup as
completed or try another deletion mechanism to bypass that policy. VM incoming
patches are also retained; release directories/images are intentionally kept.

UHD620 at true720p/60FPS remains untested. Low triangle budgets, shorter cold map
downloads and smaller client bundles remain open. Streaming/Low packaging
experiments and Three r186 are separate local tools, not integrated in this
release; map download sizes are unchanged. Ironworks stays retired; provenance
and the user-authorized Liftoff multiplayer-test scope are preserved without
asserting a redistribution license or expanding admission.
