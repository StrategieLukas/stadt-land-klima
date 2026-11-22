# Production backup and image retention

Production has independent nightly and release backup paths:

- The nightly root-owned `staedtechallenge-backup` systemd job sends logical
  database dumps, upload files and private configuration directly to encrypted
  Restic storage on Hetzner Storage Box. Restic deduplicates file content; no
  complete local uploads tar is needed for this path. Credentials and SSH keys
  remain in the existing root-owned configuration.
- `slk release backup` makes a local application rollback checkpoint. Its uploads
  tar is deliberately a complete, independently recoverable volume export. It is
  not an incremental backup and was previously retained indefinitely. Each release
  added roughly 700 MB of uploads even when little changed.
- Automatic `slk release update` checkpoints are also sent by the fixed root-owned
  `slk-release-backup.service` to encrypted Restic storage. It reads back every
  payload checksum; the deploy coordinator restores the matching dump into a
  temporary database and verifies captured application/translation-memory counts.
  This requires the one-time [host installation](PRODUCTION_UPDATE.md).

Keep **five** complete local rollback checkpoints and **five** nightly cloud
snapshots for this application. These are separate recovery scopes. Five local
sets currently need roughly 3.6 GiB. Retention does not replace the pre-deployment
off-host verification requirement. Portable recovery bundles and explicitly named
legacy bootstrap/migration recovery artifacts are separate and never recursively
deleted by these commands.

Keep five automatic release cloud snapshots in the separate
`<application-tag>-release` scope as well. Their retention cannot expire the five
nightly snapshots. Snapshot creation never initializes or silently switches an
unavailable remote repository. Backup credentials remain root-only; deploy may
only start the fixed backup service, without arbitrary systemd arguments.

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

Use the [reproducible host installer](HOST_REPRODUCIBILITY.md) after the approved
application release. `slk host plan|install|verify` owns the complete installed
backup implementation, timer, standalone retention helpers, pinned root-owned
Node binary, application boot unit and production Caddy configuration. No manual
editing of an installed backup script is required. The former unversioned Bash
entrypoint is retired by installation; the service runs `bin/cli/host-backup.ts`'s
reviewed, root-owned copy instead.

The job keeps the existing private Restic configuration, exclusive backup lock,
logical dump validation, Sunday integrity sampling and Prometheus metrics. A
failed cloud backup, scoped retention or integrity check prevents local cleanup.
An existing initialized Restic repository is required: a network/authentication
failure must never trigger an attempted repository initialization. Upload files
are read directly by Restic without a local full-upload archive. Production's
existing unit remains named `staedtechallenge-backup` for monitoring continuity.

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
preserves layers required by those images. Cleanup holds the project's automatic-update, release
and stack-operation locks and never prunes volumes or restarts services. Raw
Podman builds outside the CLI also need to finish before maintenance. An unknown
Compose project is refused before cleanup, so a project typo cannot bypass its locks.
