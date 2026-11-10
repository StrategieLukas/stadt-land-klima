# Portable application backup and recovery

For the original production Docker workflow, use [`full-export.sh`](full-export.sh)
and its [capture/restore guide](FULL_EXPORT.md). It stops existing app/data services
and captures cold checkout data as well as logical SQL and external mounts.
The Node tool below also supports Podman and requires services to be stopped first.

The earlier tooling is `bin/podman-release.sh … backup` (release recovery snapshots)
and `bin/db_exports/export_db.sh` (database only). Neither is a complete portable
application backup. The standalone Node 24+ tool below captures a recovery bundle.
It has no npm dependencies and never stops/restarts services or changes host setup.
Git history must be available locally (shallow checkouts are refused).
Its output must be a **new directory under this checkout's `backups/`**; a failed
capture has no valid `SHA256SUMS` and must not be used. Do not reuse its directory.

## Capture on the source host

Do this as the account that owns the local engine (the deployment user for rootless
Podman). No SSH, deployment or production shutdown is performed by this tool.
The examples here are operator instructions, not steps already executed.

1. Enable maintenance at the public gateway. Pause scheduled jobs, deployment and
   restart automation and **all external database/upload/search/cache writers**.
   Gracefully stop `frontend` and `directus`, then `cache` and `meilisearch` through
   the normal production Compose selector. Keep `db` running. Never use `down -v`.
   For Podman, source the trusted private host env in your operator shell first,
   then use `bin/podman.sh production compose stop frontend directus` and
   `bin/podman.sh production compose stop cache meilisearch`. Docker hosts must use
   `core_compose production` from `bin/lib/core-service-data.sh` and its
   `CORE_COMPOSE` array so migrated storage overlays are honored.
2. Record the actual Compose project (`SLK_PODMAN_PROJECT` for Podman), and run:

   ```bash
   node bin/lib/portable-backup.ts create \
     --engine podman --project ACTUAL_PROJECT \
     --output backups/production-YYYYMMDD-HHMMSS --writers-stopped \
     --config host=/home/deploy/.config/slk/production.env
   ```

   Use `--engine docker` for Docker. Container selection uses exact project/service
   labels, including stopped containers. The Docker default local context is used;
   remote engine/context overrides are refused. The four required env files default
   to `docker/db/.env`, `docker/meilisearch/.env`, `src/directus/.env`,
   `src/frontend/.env`. The existing `SLK_PODMAN_{DB,MEILI,DIRECTUS,FRONTEND}_ENV_FILE`
   variables select private paths. Alternatively override individual inputs with
   `--config db=/path`, `--config meilisearch=/path`, `--config directus=/path` and
   `--config frontend=/path`.

   Add `--config` arguments for host configuration outside the checkout: for
   example `--config systemd=/home/deploy/.config/systemd/user/slk.service` and
   `--config gateway=/etc/caddy/Caddyfile`. Labels use lowercase letters, digits
   and hyphens. Files are copied as private bytes, never sourced or printed.
   Include additional gateway snippets, TLS material or external integration
   configuration explicitly if required; this is an application backup, not a
   full operating-system or external-service backup.

3. Keep writers stopped until capture completes. The script requires one running
   database and stopped app/cache/search containers, and clean cache/search exits.
   The `--writers-stopped` flag attests that you also stopped writers the tool cannot
   discover. Do not restart services during capture. Resume them through the normal
   startup workflow after a successful capture or after resolving a failed capture.
4. Copy the **entire directory** to private off-host storage, keeping the directory
   mode 0700 and files 0600. It contains personal data, role password hashes,
   API/signing keys and possibly TLS keys. Encrypt it using your existing backup
   storage/transport. Check integrity at the destination:

   ```bash
   node /path/to/checkout/bin/lib/portable-backup.ts verify /path/to/copied-bundle
   # Or, with standard Unix tools:
   cd /path/to/copied-bundle
   sha256sum --check SHA256SUMS
   ```

   Checksums detect incomplete/corrupt copies, not malicious replacement. Keep the
   checksum file in trusted storage. A restoration rehearsal is necessary before
   treating a backup as proven recoverable.

## Contents and portability

- `globals.sql`: all PostgreSQL roles, grants and password hashes, from the separate
  bootstrap operator. Restricted application credentials are never used for dumps.
- `database-N.dump`: custom-format logical dump of **every non-template database**,
  including `postgres`, with ownership, sequences, extensions and large objects.
  Each archive is checked with the source `pg_restore --list`.
- `uploads.tar`, `redis.tar`, `search.tar`, `frontend-output.tar`: directory-content
  archives from the actual containers, independent of bind-mount/volume names.
  Redis/search must be stopped cleanly, preserving their persisted sessions,
  synchronization state, indexes, settings and search API keys.
- `images.tar`: Docker archive of the five exact runtime image IDs. Loadable by
  either engine on the **same Linux CPU architecture**. This avoids depending on
  registries or npm to recover existing runtime images. Maintenance/gateway images
  and host security tooling are provisioned separately using the maintained docs.
- `repository.bundle`: all locally available Git refs/history, so release and
  maintenance tooling can run from a real checkout on the recovery host.
- `source.tar.gz`: current checkout including local source edits, built extensions,
  ignored env files and storage overlays. Excludes Git internals, dependency trees,
  frontend generated output, uploads, raw database/search data, backups, reports,
  logs and crash dumps. Dependencies can be rebuilt from lockfiles with network
  access; the captured runtime images/output are available for offline recovery.
- `config-*`, `manifest.json`, `RESTORE.md`, `SHA256SUMS`: private configuration,
  actual source container metadata/image IDs/database names, this guide and hashes.
  Manifest container metadata can contain credentials; never publish it.

The supported upload location is local `/directus/uploads`. Nonstandard storage
and custom PostgreSQL tablespaces are refused. Back up S3/object storage, external
Listmonk/SLZ/SMTP systems and host gateway configuration separately when used.
Search and Redis cold data require their captured versions; do not combine recovery
with an upgrade. PostgreSQL logical dumps are portable to a compatible PostgreSQL /
PostGIS server with the required extensions; test version changes separately.

## Restore on another host

Restore only into a **fresh isolated project**, with new empty target storage. Keep
it unreachable from public traffic and disable outbound mail/webhooks/jobs during
acceptance. Never restore over production or an existing accepted instance.

1. Verify checksums **before** extracting/loading. Use only a trusted bundle: SQL,
   images and source are executable content. Set `umask 077`. Clone
   `repository.bundle` **without checking out files**, reset its index to the manifest
   revision, then extract the actual captured tree. This preserves local edits and
   deletions without reintroducing deleted files from Git:

   ```bash
   git clone --no-checkout /path/to/repository.bundle /path/to/new-checkout
   git -C /path/to/new-checkout reset --mixed CAPTURED_REVISION_FROM_MANIFEST
   tar --no-same-owner -xzf /path/to/source.tar.gz -C /path/to/new-checkout
   ```

   Review any captured local source edits before use.
   Review `manifest.json` and copy private `config-*` files into new private paths.
   Adapt host paths, project/ports, service URLs and storage overlays to the new
   host; never reuse original absolute bind paths or old volume names. Retain the
   signing/session/service/search keys. Recreate native Podman secrets from the
   saved env files using the normal `bin/podman.sh` setup; secret IDs from the old
   host are not portable.

2. Provision the documented engine/security prerequisites (`PODMAN.md` or
   `README.md`). Load images with `podman --remote=false load -i images.tar` or
   `docker load -i images.tar`. For every service, tag its saved `Image` ID to the
   target Compose image name from `Config.Image` in the manifest. Do not rebuild
   or pull application images during offline recovery. Docker and Podman storage
   names may differ; directory contents are restored through target containers.
3. Create/start only the new database. Bootstrap it with a **new unique superuser
   name absent from `globals.sql`** (e.g. a random `slk_restore_*`) and a distinct
   scratch database, rather than the original application/operator role. These
   temporary values avoid duplicate-role conflicts. The image must provide the
   captured PostgreSQL/PostGIS extensions. Keep original target application env
   credentials for use after the restore.
4. Restore roles and then databases. Set `engine` to `docker` or `podman`, `target_db`
   to the new DB container ID, `restore_operator` to the unique bootstrap name,
   `scratch_db` to the scratch database and `bundle` to the verified directory:

   ```bash
   "$engine" exec -i "$target_db" psql -X -v ON_ERROR_STOP=1 \
     -U "$restore_operator" -d "$scratch_db" < "$bundle/globals.sql"
   for dump in "$bundle"/database-*.dump; do
     "$engine" exec -i "$target_db" pg_restore --exit-on-error \
       --clean --if-exists --create -U "$restore_operator" -d "$scratch_db" < "$dump"
   done
   ```

   All database dumps must restore successfully. Verify database names, ownership,
   extensions, row counts, sequences and original operator/app logins. Remove the
   temporary bootstrap role/scratch DB only after verifying original operator
   access and reviewing ownership of any bootstrap objects. Do not import YAML
   until the original data has been restored and checked.

5. With target apps/cache/search stopped, restore their archives into **empty**
   mounted target paths. For Podman, use the new project's Compose wrapper, whose
   service users already match its user namespace:

   ```bash
   restore_directory() {
     ./bin/podman.sh production compose run --rm --no-deps -T \
       --entrypoint sh "$1" -ec '
         test -z "$(find "$1" -mindepth 1 -maxdepth 1 -print -quit)"
         tar --no-same-owner -xf - -C "$1"
       ' sh "$2" < "$3"
   }
   restore_directory directus /directus/uploads "$bundle/uploads.tar"
   restore_directory cache /data "$bundle/redis.tar"
   restore_directory meilisearch /meili_data "$bundle/search.tar"
   restore_directory frontend /frontend/.output "$bundle/frontend-output.tar"
   ```

   The frontend output mount is read-only during normal runtime: use a private
   **target-only** Compose overlay making that mount writable for restoration, then
   remove the override. Docker targets can use the same helper with their target
   `CORE_COMPOSE` array, explicitly selecting the target service UID. Docker Redis
   has no persistent cache mount by default: add a target-only `/data` volume first.
   Restore ownership as the target service user using `--no-same-owner`; never chown
   original source mounts. No raw PostgreSQL data directory is copied.

6. Start the target data services, then Directus/frontend using restored images
   and credentials. The frontend output fingerprint includes environment/source
   inputs: if host-specific inputs change, rebuild it with the normal target
   workflow (requires build dependencies/network) before starting the frontend.
   Verify uploads against `directus_files` (including private files), roles/login,
   editing/publishing, PDFs, search settings/documents, sessions and integration
   endpoints. Run the relevant application acceptance checks in isolation. Review
   delivery settings before enabling jobs/outbound traffic. Keep the source and
   the original bundle intact until the recovery is accepted.

The tool's automated tests cover capture orchestration with a fake engine,
archive transfer, failure handling and corruption checks. Real production capture,
cross-host restore, ownership mappings and application acceptance remain manual
recovery checks; checksum verification alone does not establish them.

The archive interface follows the official [Podman copy](https://docs.podman.io/en/latest/markdown/podman-cp.1.html) and [image save](https://docs.podman.io/en/latest/markdown/podman-save.1.html) documentation.
