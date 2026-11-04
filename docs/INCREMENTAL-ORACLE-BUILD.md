# Incremental Oracle image build

The optional `DEPLOY_INCREMENTAL=1 bash deploy/deploy.sh` mode preserves the
existing deployment sequence: isolated release directory, host build/content
checks, retained rollback image, drain, healthy restart and public verification.
The default remains the full Docker build.

Use this mode for a small application update with unchanged runtime dependencies
and retained immutable delivery assets. The helper requires an exact previous
image SHA, an identical package lock and runtime dependency configuration, a
valid source commit, matching release/catalog revisions, every previous asset
URL, byte length and SHA-256 against the previous image, and at most 128 MiB of
newly added delivery assets by default. A measured content update can explicitly
set `DEPLOY_INCREMENTAL_ASSET_MIB` between 128 and 1024. The helper checks free
disk for five times the new asset bytes plus a 512 MiB reserve before copying
the context. All dependency, old-asset hash, rollback and drain checks still
apply. This override does not permit replacing or removing old delivery files. It
inherits the previous image's Node runtime, production dependencies, command,
health check and data-volume configuration, then adds the current server,
shared code, client dist, backup/import tools, catalog, recipes and new assets.
Changes to runtime dependencies or replacement/removal of existing delivery
files require a full build. A superseded URL may leave the active catalog only
when its exact bytes/hash remain in the new release inventory; the helper still
hashes that retained file against the previous image. This keeps cached clients
and rollback working while a map selects a newly hashed material delivery.
Review other public-file changes separately; this
helper copies only the explicit runtime paths listed above.

The 18 October five-map local catalog retains all 80 published assets and adds
32 files / 859,091,848 bytes including the real map thumbnails. It needs an explicit
1024 MiB allowance; the default remains 128 MiB. The disk guard requires at least
4,832,330,152 free bytes
at image-build time, after staging and host dependencies. Unit checks cover the
default cap, this measured payload, insufficient disk and invalid overrides.
The first real 18 October image build passed the earlier 3x guard with
3,497,996,288 free bytes, then exhausted disk while unpacking the exported
containerd layer. Production was not drained or activated. The corrected guard
accounts for BuildKit's retained context/cache and packed/unpacked layers; its
regression case rejects that measured insufficient space. Unused build cache can
be discarded after checking active builds; retained images and player volumes
must remain. See ORACLE-DEPLOYMENT.md for actual publication status.

The helper reads the previous image without network or player-volume access,
retains a rollback tag, creates a temporary build context under the candidate
directory and removes that context on exit. It never prunes images, releases or
volumes. Public delivery files remain available from the complete candidate
directory mounted by Caddy. Production database and env files stay separate.

For a packaged delta, `tools/stage-oracle-delta.js` reconstructs an empty
candidate directory and verifies every source and final inventory SHA-256.
Its arguments are previous directory, candidate directory, extracted patch,
previous release name, new release name, expected revision and protocol.
Copy private server env files separately after this check. The helper shares
duplicate binary resources inside the candidate with hardlinks; cross-release
links are limited to content-addressed published assets. Mutable code and JSON
definitions are copied. Cross-filesystem links fall back to ordinary copies.
It rejects nonempty candidates, private paths, changed payloads and removed
baseline files, and never activates a release. Do not edit linked binary assets
in place; future content changes must create a new release and asset URL.
The delta/staging fixture tests cover reconstruction, independent mutable files
and refusal of damaged uploads.

When the previous expanded local stage was already archived and removed,
`node tools/prepare-incremental-update.js RELEASE FINALIZED_INVENTORY_JSON LIVE_CATALOG_JSON`
prepares a fresh delta directly from that verified inventory and current local
runtime sources. Check the final build/content first, fetch a fresh live catalog,
and commit the checked sources before running it. It refuses changed baselines,
private paths and a pre-existing patch directory. Superseded immutable URLs and
old client files remain in the inventory. New duplicate binaries upload once.
It does not reconstruct the old stage, copy player data or activate production.
The VM staging helper then verifies every retained and uploaded byte against
the actual previous release before the ordinary deployment checks.

For a client patch with **identical content revision and deliveries**, the explicit
`--read-only-content-source` option omits duplicate canonical `content/` files
from the new VM directory. It retains the source release in
`RELEASE.json.sourceContentRelease`; staging records its verified sibling
`sourceContentDirectory`. The host build must mount that directory at
`/app/content` **read-only** alongside the candidate at `/app`. This mode never
deletes or rewrites old sources, assets or images. The new runtime still has
its own complete published asset directory. Preserve the recorded source
release for later builds, or prepare a full source candidate for a content
change. The fixture verifies unchanged-content enforcement, the explicit
omission inventory and reconstruction without source copies.

For a content change after a source-sharing release, use the explicit
`--full-content-sources` mode instead. It collects enabled definitions, referenced
runtime resources and implicit models/thumbnails into a complete new canonical
source inventory. Editable Blender files, disabled packages and unrelated project
files stay outside the upload. Canonical binary files matching a retained
content-addressed delivery are reused by verified SHA-256 instead of uploaded
again. The existing staging helper links those binaries through its own candidate
asset directory; JSON/code remain independent. Never edit linked deployed binary
sources in place. This mode does not carry `sourceContentRelease`, so the normal
host build reads the new candidate's complete `content/` directory. The fixture
verifies this transition, full reconstruction and exclusion of editable sources.

For large content updates, `DEPLOY_SHARED_ASSETS=1` explicitly keeps delivery
assets in the retained release directory rather than copying them into another
Docker layer. Compose mounts exactly `./public/content/assets` into the game at
`/app/public/content/assets`, read-only; Caddy already reads the same public
release tree. The image still contains the application, catalog and recipes.
The helper verifies the resolved Compose mount, rejects symlink directories,
checks the size and complete hash of every new content-addressed file against
the verified RELEASE.json inventory, retains
the payload cap, and reserves 512 MiB for the small application build. Normal
image builds keep the five-copy asset reserve. The image records shared mode
in `org.parvoz.shared-assets=1`.

Collision JSON URLs use the fingerprint of compact JSON, while delivery files
retain readable formatting. Their actual byte SHA-256 is therefore checked
against the release inventory, not assumed to equal the compact-content URL.
The collision regression and all 32 real added deliveries are verified.

Such an image requires its matching release directory and asset mount for
recovery. Keep that directory; use its Compose file for restart/rollback.
Previous self-contained images and release files remain available. Isolated
verification must mount the same directory read-only with a temporary player
database before activation. This avoids changing older release assets or
removing rollback images to create build space.

On 16 October 2026 the full Hangar/Race candidate build exhausted temporary disk
space before drain or activation. Only unused Docker build cache was pruned;
the running and rollback images were preserved. The incremental build reused
76 delivery assets and added four files (6,493,791 bytes), using a 17.70 MB
build context. An isolated container with a temporary database verified two
account sessions, accessory/tuning synchronization, stale-write rejection and
persistence across server restart. This is deployment infrastructure
verification, not the final publication record; see
[ORACLE-DEPLOYMENT.md](ORACLE-DEPLOYMENT.md) for the actual active release.
