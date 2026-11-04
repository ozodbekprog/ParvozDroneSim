# Browser performance publication — 26 October 2026

## Live release — final readback 13:55 UTC / 18:55 Tashkent

**Release `20261026-collision-01` is serving players on both HTTPS hosts.**
Activation completed after rooms drained to zero. This section supersedes all
historical pending-upload/access notes below. Final browser checks and the
`current` pointer switch are still incomplete; do not report full finalization.

| Item | Verified value |
| --- | --- |
| Running Compose directory | `/opt/liftoff/releases/20261026-collision-01` |
| Runtime source | `b26c2a98940760a6ccf62bc4968a458e37c94b5e` |
| Separate Caddy correction | `bea19c068e291ec55e463ef731aa9392794d281b` |
| Image | `sha256:f9c082ffa8ff507fd151a4fb89b782dd8addd8172d17fd12f4c41e043f8ed693` |
| Content | protocol 13, revision `0fe968941a806c66` |
| Client | `/assets/index-OPei9JC_.js` |
| Client SHA-256 | `28767042155b8a9683da8bf575c1fa810035ccab6f1a9c967d06b4b456c85473` |
| Current pointer, still old | `/opt/liftoff/releases/20261025-browser-03` |
| Rollback image | `sha256:644e4b762b7bc5faa984f5d36176020f43ad0410d985a5e6fbf75bcf23624253` |
| Admission / budget | 20 / $0 Always Free |
| Free disk at readback | 906,137,600 bytes |

Fresh VM build/content reproduced 466 runtime inventory entries and verified
194 canonical sources; the host-specific cache index difference is recorded.
Isolated and external public two-client races on Pine Valley and The Green
pass. Real Caddy tests cover all 35 binary collision ranges and gzip decoding
of the largest collision sidecar. Public HEAD, range and immutable-cache checks
pass for all 202 retained/current assets: 167 catalog URLs and 35 retained URLs.
The public catalog has 1,885,782,494 delivery bytes. Both HTTPS hosts serve the
exact new client and revision; health and admission checks pass again at
`2026-10-26T13:55:51.549Z`. Local `readback-pending.log` records that verification.
VM `DELIVERY-VERIFICATION.json` records the full delivery checks.

Internal/editor paths return 404. `/.env` and `/deploy/production.env` return
only the exact ordinary SPA index HTML (200, 863 bytes); no env bytes are served.
Production dependency audit reports zero vulnerabilities; npm install also
reported two development dependency warnings.

Shipped: lossless embedded-image deduplication (71.75 MB less map delivery),
shared cancellable Meshopt decoding, visible-texture prewarming, WebGL2 scenery
instancing/interleaved-attribute fix and validated lossless `.pcol` collisions.
The `3d-tiles-renderer` comparison remains development QA only; flight visual
streaming is not integrated. Node RSS measurements in the collision report do
not establish browser memory or target hardware FPS.

### Backups and data preservation

Fresh pre-activation cloud copy was independently downloaded/restored on the VM:
`/home/liftoff/pre-collision-cloud-20261026-02.sqlite`, SHA-256
`3cb59f579c5e9d1d6f05a406e3bd8ccdca82b7a39ff05d22589dbc3c68ad47dc`.
The earlier `-01` copy has the same verified hash and is retained.
Post-update copy: `/home/liftoff/post-collision-cloud-20261026-01.sqlite`, SHA-256
`469d2d601c81d30ae87c7337fc9e88b8c3f7079514ed06cf1153eac11725b19e`, independently
restored/integrity/rollback-write checked at `2026-10-26T11:22:16.804Z`.
Every original non-session row hash matches: 4 users, 5 records, 4 achievements,
1 fleet, 2 replays and 1 weekly record. Sessions changed from 29 to 33 during
testing. Env files and `liftoff_game-data` are preserved. Seven private cloud
copies are retained and the backup timer remains active. Do not rerun the same
named backup helpers or substitute a local player database.

### Browser evidence and remaining gates

Connected Chrome loaded the exact new client, rendered Minus Two/Luma 5 and
requested `collision-9b8eec648f4abcec.pcol` successfully (200). Actual canvas
1280×720, Low, 100% resolution, adaptation disabled. Screenshot
`data/oracle-collision-20261026/public-minus-two.png` was visually inspected.
Leaving flight and cancelling The Green at the loading dialog returned to setup.
The subsequent Minus Two flight was started, but its Ready state was not
observed before browser control disconnected. Hangar render and Hangar-to-flight
remain unverified. Initial CDP event history was truncated; a complete error-free
browser log is not established.

On continuation, Chrome was absent from browser tool inventory although a
Chrome window remained open. Computer Use stopped with: "could not determine
the current browser URL on Windows with enough confidence to enforce policy."
No further UI input was issued. Separately, the in-app browser lost its WebGPU
device; recovery failed with `Cannot read properties of null (reading
'getSupportedExtensions')`. Chrome rendered successfully, but the in-app browser
failure remains an open limitation. UHD 620 / 60 FPS is unverified.

Continue only these unfinished steps:

1. Restore browser control and observe fresh Minus Two flight after cancellation,
   Hangar rendering, then Hangar-to-flight. Collect a complete log for those runs.
2. Restore temporary Chrome graphics settings: originally High, 100%, exposure
   135%, LOD 150%, textures 1024, adaptation enabled. Clear the temporary CDP
   device metrics override (1280×720 at deviceScaleFactor 1). Do not claim these
   settings were restored during the disconnected turn.
3. Write actual `BROWSER-VERIFICATION.json` evidence satisfying `finalize.sh`;
   transfer as `/home/ubuntu/collision-browser-verification-20261026.json` and
   run the finalizer. It validates backups, delivery proof and healthy exact
   image before switching `current`; do not bypass its browser gates.
4. Read back the finalized pointer, serving image, public client/revision and
   backup timer; update these records and commit/push. Keep rollback assets.

Use `data/oracle-collision-20261026/` and the retained release; no repeated
upload, build, content export, activation or full backup is needed solely to
resume browser QA. SSH currently works with user-approved `195.158.6.35/32`.
All other network rules were preserved. Do not run deployment through the old
`current` pointer or infer the serving version from it. The private repo remains
private; online imported content remains the explicitly authorized multiplayer
test, not a claim of redistribution rights.

## Historical VM verification — 26 October, before activation

SSH was restored after the user approved rotating TCP22 from
`37.110.211.16/32` to the new current connection `195.158.6.35/32`. All other
rules are preserved. The streamed archive was complete: VM staging verified
466 runtime files and 194 canonical sources, without reuploading the payload.
Fresh VM npm ci, build and content validation reproduced revision
`0fe968941a806c66` and every inventory hash (apart from the recorded
host-specific import-cache index). Candidate image:
`sha256:f9c082ffa8ff507fd151a4fb89b782dd8addd8172d17fd12f4c41e043f8ed693`.
Isolated Pine Valley and The Green two-client races passed with temporary data.

The isolated real-Caddy test found that `/content/assets/*.pcol` did not match
nested paths. The asset handler now uses the suffix matcher `*.pcol`, confined
to its existing `/content/assets/*` handler. See Caddy's
[path matching reference](https://caddyserver.com/docs/caddyfile/matchers#path).
This small configuration correction is recorded separately from runtime source
`b26c2a9`; the original archive remains unchanged and the candidate inventory
records the corrected Caddyfile SHA-256
`a6e521405fddc32432fb312ddbe4d08570ca231c5fd67fb31ebe5598d68cef9e`.
Its isolated test passes: 167 asset HEAD checks, all 35 collision ranges,
and gzip decoding/hash validation of the largest 62,571,648-byte sidecar
(10,093,773 gzip bytes, 20,364 colliders). No host ports were published by the
test containers. Production dependency audit reports zero vulnerabilities;
the two install warnings concern development dependencies.

Activation and finalization are still pending at this checkpoint. Historical
access/package notes below explain the completed preparation.

Deployment preparation for `20261026-collision-01`; this paragraph does not
confirm publication. Baseline freshly verified over HTTPS and SSH:
`20261025-browser-03`, revision `2132caf43c0e38df`, protocol 13, healthy,
no active rooms. The user approved replacing only the existing TCP 22 source
from `213.230.78.242/32` with `195.158.3.42/32`. Oracle Console readback and SSH
confirmed the change; all other ingress/egress rules were preserved.

The candidate contains lossless embedded-image deduplication, cancellable Meshopt
decoding, visible texture prewarming, WebGL2 instancing and prepared collision
files. See [binary collision evidence](BINARY-COLLISION-20261026.md).
The 3D Tiles comparison remains a development QA tool and is not integrated
into the flight renderer. Flight defaults, Kestrel and admission 20 are retained.
UHD 620 / 60 FPS acceptance is still unverified.

Deployment safeguards were extended for `.pcol` immutable URLs. Explicit
production-lock validation can reuse the runtime image when only `dev:true`
resolved packages differ; all runtime records and dependency declarations must
remain identical. Fresh VM `npm ci`, build, content and inventory checks remain
required. The default lock validation remains strict. Regression checks: 23/23.

The unchanged canonical sources may be shared even though the new compiler
changes delivery hashes only when `--verified-source-inventory=FILE` supplies
the retained source release inventory. Preparation hashes every canonical file;
VM staging compares that proof with the retained release and hashes the sources
again. The fresh VM build must reproduce the candidate catalog and inventory.
The newly added compiler helper is included explicitly in the delta.

Initial free disk was 1,312,219,136 bytes. Seven obsolete host `node_modules`
directories (5–15 October releases) were removed after checking their retained
lockfiles and real paths. These can be recovered with `npm ci`; source files,
assets, all rollback images and production data were preserved. Free disk after
this cache cleanup: 2,151,800,832 bytes. New immutable assets may be linked from
a frozen, hash-verified incoming patch using `DEPLOY_LINK_PATCH_ASSETS=1` to
avoid storing a second payload copy. Code and mutable files remain independent.

Prepared collision compilation now leaves an existing delivery inode untouched
when rebuilding the host-specific cache and rejects differing bytes at the same
hashed path. The focused immutable-delivery regression passes (1/1).

## Historical checkpoint — 10:28 UTC / 15:28 Tashkent

The following access state and resume instructions are superseded by the live
release section above. Preserve them as history; do not repeat completed work.

**The new release is not uploaded or activated.** The connection changed to
`37.110.211.16` after preparation; SSH to the approved single-IP rule times out.
The user chose to restore the connection using `195.158.3.42`. Do not substitute
another address or broaden the rule based on that reply. Browser controls became
unavailable before another Console action could be performed. The approved
`195.158.3.42/32` rule remains the last verified setting.

The new code and safeguards are pushed as
`b26c2a98940760a6ccf62bc4968a458e37c94b5e` on `codex/demand-pilots`; local and
remote SHA match. The prepared delta references that exact source. Local build,
content validation, 23 deployment regressions and the immutable-delivery test
pass. Earlier implementation verification covered 600 distinct tests.

Retain the ignored prepared files (do not rebuild or delete them to resume):

- `data/oracle-patch-20261026-collision-01/`: PATCH/RELEASE inventories and payload.
- `data/oracle-collision-20261026/candidate.tar.gz`: 728,435,508 bytes,
  SHA-256 `07ec1c16617a2098cc3f2a6ef9c5e38ca47d0d7caa83439c968d6a15c18a001b`.
- `candidate-proof.json`: 466 runtime inventory rows, 75 changed, 391 reused,
  194 exact canonical source rows; client `/assets/index-OPei9JC_.js`, SHA-256
  `28767042155b8a9683da8bf575c1fa810035ccab6f1a9c967d06b4b456c85473`.
- `baseline.json`, `source-inventory.json`, `live-catalog-before.json`: fresh
  remote baseline and retained-source inventory, plus public catalog evidence.
- `upload.mjs`: stream the prepared archive directly to a fresh VM incoming
  directory; no second compressed archive is stored on the nearly full disk.
- `stage.sh`, `build.sh`, `isolated-caddy.sh`, `activate.sh`, `post-backup.sh`:
  prepared helpers; Bash syntax passes. None has been executed for this release.
  The separate early Caddy validation attempt also timed out at SSH; it is not
  a Caddy validation pass.

Fresh pre-update cloud backup was uploaded, downloaded and independently restored
on the VM, including integrity and rollback-write checks. Copy:
`/home/liftoff/pre-collision-cloud-20261026-01.sqlite`, SHA-256
`3cb59f579c5e9d1d6f05a406e3bd8ccdca82b7a39ff05d22589dbc3c68ad47dc`.
It contains 4 users, 5 records, 4 achievements, 1 fleet, 2 replays and 1 weekly
record; non-session row hashes are in `pre-backup.log` and the VM proof. Existing
env files, images, sources and production data have not been replaced.

Public health/API/WebSocket and sampled asset HEAD/range/cache checks passed
again after SSH became blocked. Serving release remains `20261025-browser-03`,
protocol 13 / revision `2132caf43c0e38df`. Candidate revision is
`0fe968941a806c66`, with 167 catalog assets (35 `.pcol`) / 1,885,782,494 bytes;
four unused old GLBs remain in the candidate inventory for cached clients.

To resume: verify the connection and SSH, confirm current/image/revision and disk
again, then upload → stage → VM build → isolated Caddy → isolated multiplayer.
Do not rerun the completed same-day pre-backup script unchanged (it deliberately
refuses to overwrite its verified copy); create a fresh named backup if the
baseline has changed or enough time has elapsed. Activation drains rooms and has
a rollback trap. Complete external public/game/browser checks and a fresh
post-update cloud restore/row comparison before finalizing `current`. Finish the
remaining delivery/browser proof and finalization helpers from the recorded
candidate, without substituting old browser evidence. Preserve admission 20,
the production data volume and the $0 budget.
