# Production backup and image retention

Production has two independent backup paths:

- The nightly root-owned `staedtechallenge-backup` systemd job sends logical
  database dumps, upload files and private configuration directly to encrypted
  Restic storage on Hetzner Storage Box. Restic deduplicates file content; no
  complete local uploads tar is needed for this path. Credentials and SSH keys
  remain in the existing root-owned configuration.
- `slk release backup` makes a local application rollback checkpoint. Its uploads
  tar is deliberately a complete, independently recoverable volume export. It is
  not an incremental backup and was previously retained indefinitely. Each release
  added roughly 700 MB of uploads even when little changed.

Keep **five** complete local rollback checkpoints and **five** nightly cloud
snapshots for this application. These are separate recovery scopes. Five local
sets currently need roughly 3.6 GiB. Retention does not replace the pre-deployment
off-host verification requirement. Portable recovery bundles and explicitly named
legacy bootstrap/migration recovery artifacts are separate and never recursively
deleted by these commands.

## Commands

Commands default to a dry-run; `--apply` makes the changes:

```bash
./bin/slk backup retain
./bin/slk backup retain --apply
./bin/slk images retain --project slk-podman-future
./bin/slk images retain --project slk-podman-future --apply
```

Local retention orders complete checkpoints by checksum-manifest capture time,
not directory modification time. It verifies every surviving checkpoint, takes
each expired checkpoint's release lock, invalidates `backup.verified`, then
deletes only recognised payloads. It preserves operator notes and manifests;
expired records cannot pass activation. Incomplete/unrecognised artifacts are
reported as skipped for operator review. A busy release is skipped. New release
backups apply this policy after successfully writing their manifest.

Cloud retention runs with the existing private Restic environment:

```bash
./bin/slk backup retain-cloud --host slk-prod --tag staedtechallenge
./bin/slk backup retain-cloud --host slk-prod --tag staedtechallenge --apply
```

The host and app tag are mandatory. Grouping is by host, so a changed input path
does not create another five-snapshot group. This replaces the former seven daily,
five weekly and twelve monthly policy. Never run an unfiltered repository-wide
forget operation.

## Nightly host installation

The existing cloud service continues to back up files directly. Install reviewed
copies of the standalone TypeScript helpers as root-owned mode-0644 files under
`/usr/local/lib/slk/`: `bin/cli/{cloud,release,image}-retention.ts`. Use a trusted,
root-owned Node 24 binary at `/usr/local/lib/slk/node`; do not execute a
deployment-user-writable runtime or checkout as root. Keep the service's existing
root-only Restic config, backup lock, dump validation, integrity checks and metrics.

Replace its old `restic forget` policy block with:

```bash
/usr/local/lib/slk/node /usr/local/lib/slk/cloud-retention.ts \
  --host slk-prod --tag staedtechallenge --apply
```

After successful remote backup/retention and integrity checks, run the deployment
user helpers using the service's existing `app()` function:

```bash
app /usr/local/lib/slk/node /usr/local/lib/slk/release-retention.ts --apply
app /usr/local/lib/slk/node /usr/local/lib/slk/image-retention.ts \
  --project "$PROJECT" --apply
```

These calls must not run after a failed cloud backup. Install helper updates from
reviewed source when deploying maintenance changes. Production's existing unit is
named `staedtechallenge-backup`, despite backing up the Stadt-Land-Klima project.

## Why the images accumulated

Every release uses new application tags. Podman/Buildah also retains untagged
intermediate build images and cached layers; deleting a container does not remove
them. The former deployment/nightly jobs had no image retention step. Production
had 233 unique image IDs (180 untagged), most carrying Buildah metadata. The
default `podman images` count also includes multiple tag rows for the same ID.
This is accumulated build/release history, not evidence of extra running apps.

The Directus application Containerfile copies CLI/extension sources before its
combined dependency-install and extension-build step. Source edits therefore
invalidate that large build layer, even when dependency locks are unchanged.
Its later recursive ownership step adds another layer. This amplifies cache
growth across frequent releases; retention was missing from the lifecycle.
Production's 360 layer directories all had matching storage metadata, so the
inspection found no unregistered orphan-layer directories. Filesystem allocation
can exceed Podman's image payload estimate; actual free space is the acceptance
measure for cleanup.

Image retention protects every existing container, the two latest successfully
activated release tags, all named non-release/runtime/datastore images, and
explicit rollback/recovery tags. Failed newer builds cannot displace the previous
successful release. Temporary stopped containers protect retained images during
`podman image prune --all`; they never start or create anonymous volumes. Podman
preserves layers required by those images. Cleanup holds the project's release
and stack-operation locks and never prunes volumes or restarts services. Raw
Podman builds outside the CLI also need to finish before maintenance. An unknown
Compose project is refused before cleanup, so a project typo cannot bypass its locks.
