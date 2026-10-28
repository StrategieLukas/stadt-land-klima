# Rootless Podman deployment

The Podman stack keeps the existing service names, private `.env` contracts,
Docker build definitions/security patches, Directus 11.17.4, code-first importer
and development/production ports. Docker remains available for rollback. Podman
uses its own named volumes and image store; it never opens `docker/data` or the
Docker core-storage overlay.

## Host preparation

Supported target: local Linux x86_64, Podman **5.4+**, `podman-compose` **1.5+**,
Node **24+** with the repository CLI dependencies installed, Netavark/Aardvark container DNS, cgroup v2 with delegated memory/pids,
and AppArmor or SELinux confinement. The existing Typst image build is x86_64.
Use supported distro security releases of Podman, containers-common, the OCI
runtime and libseccomp. The version floor is a compatibility requirement, not a
claim that every release above it is free of vulnerabilities.

Install the host tools through your distribution, including `uidmap`
(`newuidmap`/`newgidmap`), rootless networking (`passt`/pasta), and `podman-compose`.
If the distro's Compose provider is older than 1.5, install a supported release
in an isolated `pipx` environment. The wrapper explicitly selects this provider
and disables remote Podman and pod grouping. It needs no engine socket.

Run the stack as a dedicated deployment account with subordinate UID/GID ranges
in `/etc/subuid` and `/etc/subgid`. An administrator must provision those ranges
and, for unattended boot, enable lingering for that account. Keep its checkout,
container storage and private backups inaccessible to other host users. The
account owns the application containers; access to that account grants access to
their environment credentials and volumes.

Copy the four `.env.example` files as described in [README](README.md#preparations),
replace placeholders and make the real `.env` files mode **0600**, owned by the
operator. Symlinks and group/world access are rejected. The variables
`SLK_PODMAN_DB_ENV_FILE`, `SLK_PODMAN_MEILI_ENV_FILE`,
`SLK_PODMAN_DIRECTUS_ENV_FILE`, and `SLK_PODMAN_FRONTEND_ENV_FILE` can select
private alternative files without changing Docker's configuration.

```bash
npm ci --prefix src/directus/cli
./bin/podman.sh production doctor
./bin/podman.sh production build
```

`doctor` fails if required kernel/runtime controls or environment-file permissions
are missing. It does not install packages, change host ownership, disable host
confinement, open a socket, or alter sysctls. Review any host preparation failure
with the administrator; there is no unconfined/rootful fallback.

## Security boundaries

Every runtime service has `cap_drop: ALL`, `no-new-privileges`, a read-only root,
a non-zero numeric UID/GID, memory and process limits, and journald logging.
PostgreSQL uses 999:999, Redis 999:1000, and the applications, search and maintenance
use 1000:1000. `keep-id:uid=...,gid=...` maps the operator into each image's intended
user, including when the host's primary GID differs. Existing host code is never
recursively chowned. Podman's `:U` ownership initialization applies only to its
own named volumes.

The private database network joins only PostgreSQL and Directus. An internal
services network joins Redis/search and their consumers. Only Directus/frontend
and maintenance join the egress network. Production publishes **loopback-only**
9000/9001/9090. No runtime exposes an engine socket, host namespaces, devices or
added capabilities. nginx maintenance listens unprivileged on container port 8080
and writes only to bounded `/tmp`; its access log is disabled.

Writable persistent storage is limited to database, Redis, search and uploads.
Those mounts are `nosuid,nodev,noexec`. Production frontend output is a read-only
named volume; it retains executable mappings because Nitro dependencies can
include native modules. Source/configuration mounts are read-only with shared
SELinux labels (`:z`) for paths shared between services/builds. SELinux labels
are preserved; `label=disable` is forbidden. Review label changes before running
Podman against a checkout simultaneously used by another confined deployment.
Temporary mounts are bounded, `nosuid,nodev,noexec`; Directus/PDF temporary data
is private to UID 1000. The image contains compiled extensions and checked CLI
dependencies, owned by root and not writable by the runtime user.

### Environment secrets

Private `.env` values are parsed with the existing CLI dotenv dependency and
provisioned as native Podman `type=env` secrets over stdin. The generated Compose
overlay contains only opaque secret references and empty optional values; it has
no credential values or hashes. This avoids podman-compose's expansion of
`env_file` values into process arguments and exception/debug output. Use literal,
quoted dotenv values; resolve any `${VARIABLE}` interpolation used by an old
Compose deployment before migration. Controlled security settings in the Compose
files always take precedence over the private files.

A private manifest at `$XDG_STATE_HOME/slk-podman/<project>/secrets.json` (default
`~/.local/state/...`) tracks opaque versions using private hashes. Changed values
get new random secret names, causing the affected containers to be recreated.
The frontend builder shares exactly the frontend's secret references. The
reference-only overlay is regenerated under `$XDG_RUNTIME_DIR/slk-podman`.
Keep the private environment files, manifest and Podman secret store with host
backups. Old secret versions are retained for rollback; remove them only after
checking container references and the rollback retention period. The default
Podman file secret driver protects access through filesystem permissions; it is
not encrypted at rest. Use host disk encryption or an appropriately configured
Podman encrypted secret driver when required by the deployment policy.

### Seccomp

Each invocation reads Podman's actual distro-maintained seccomp allowlist and
checks its ownership, mode and deny-default action. It derives a stricter profile
in the operator's private `$XDG_RUNTIME_DIR/slk-podman/seccomp.json` (0600), then
explicitly applies it to every service. Distribution profile updates are picked
up on the next invocation; recreate running containers to apply changes.

The derived policy removes existing permissions for kernel administration,
module loading, keyrings, tracing, cross-process memory access, `userfaultfd`,
namespace/mount operations and io_uring. `clone` permits ordinary process/thread
creation while masking all `CLONE_NEW*` flags. `clone3` and io_uring return
`ENOSYS`, preserving libc/libuv feature-detection fallbacks. Node/V8 JIT memory
operations, PostgreSQL shared memory, normal networking and Typst remain governed
by the distro allowlist. It never uses `seccomp=unconfined` or a blanket allow
policy. The x86_64 restriction also ensures that the clone-argument filter is
applied to the correct architecture.

`production audit` checks actual container configuration plus PID 1's
`NoNewPrivs`, `Seccomp`, effective and bounding capabilities. It requires the
expected users, read-only roots, finite limits, and permitted writable volumes.
It reads inspect JSON privately and never prints it.

## Development and normal releases

```bash
./bin/podman.sh development build
./bin/podman.sh development start --import
# Website: http://localhost:8080; CMS: http://localhost:8081
./bin/podman.sh development compose exec -T directus /directus/cli/import-all.sh
./bin/podman.sh development stop
```

Development mounts the frontend source writable for HMR and keeps Linux
node_modules/Nuxt cache in isolated volumes. Directus extensions are compiled in
the image: after editing extensions or CLI source, rebuild and restart Directus
with the same wrapper. Schema/policy/template changes use the importer. Export
commands that write source YAML should run with host CLI tooling and a private
operator credential; runtime containers intentionally cannot edit those files.
Provision service identities/private credentials using the existing deployment
checklist before attempting a fresh production startup. Podman production forces
`SLK_STARTUP_SECURITY_CHECKS=true`, including when the example env file has it
disabled for development. For a fresh database, bootstrap/import/provision through
the loopback-only development profile with the intended production project name,
then stop that profile before starting production with the same project. Follow
the existing service-user and restricted database-role provisioning steps; retain
the generated private credentials. A fresh production database cannot pass the
gates until that setup is complete.

For a prepared or migrated production database:

```bash
./bin/podman.sh production build
./bin/podman.sh production start --import
npm --prefix bin/test_suite run test:podman
./bin/podman.sh production stop
```

`start --import` enables maintenance, stops frontend, starts data/CMS services,
waits for CMS readiness and applies the code-first import. It verifies or prepares
the frontend output, starts frontend, waits for readiness and audits confinement
before removing maintenance. Failures retain maintenance. `start` without
`--import` is appropriate for an unchanged restart.

The frontend build runs in a disposable non-root, capless, seccomp-confined
container with a writable image layer. It receives exactly the server's runtime
environment. Locked dependencies, all strict checks and the production build run
there, followed by the existing source/environment/runtime/output fingerprint.
Nitro builds on the image layer before copying the completed artifact into the
release volume; failure before that copy preserves the previous artifact. Runtime
startup refuses an invalid fingerprint and never installs packages or rebuilds.
`prepare` refuses to overwrite output while the frontend container is running.
Build/start/prepare/stop operations also hold a private per-project deployment lock.
For an unchanged valid artifact it skips the build.

Use `SLK_PODMAN_TAG=<release>` to retain immutable release image tags. Budget
memory using the same `SLK_*_MEMORY_LIMIT` variables as Docker. Separate projects
are selected with `SLK_PODMAN_PROJECT`; its default includes the environment.
For an isolated acceptance instance set `SLK_PODMAN_WEB_PORT`,
`SLK_PODMAN_CMS_PORT`, and `SLK_PODMAN_MAINTENANCE_PORT` to unused unprivileged
ports. Add any persistent choices to the user service environment.

Do not use `compose down -v` or engine prune commands during migration/recovery.
`compose config`, engine inspect output and debug/verbose provider output can
contain credentials: keep them private. Application log sanitization and severity
rules remain the ones in [SECURITY_LOGGING.md](SECURITY_LOGGING.md); configure
journal retention and existing error-level alarm collection for the deployment
account. This setup does not provision an external alarm receiver.

## Migration from Docker with rollback

This procedure moves the engine while retaining the exact PostgreSQL/PostGIS,
Redis and Meilisearch versions and storage format. Complete the existing
[core-service upgrade](README.md#logical-core-storage-migration) first if formats/versions
differ. A database major-version upgrade must use its verified logical migration,
not a cold copy into a different image. Custom tablespaces, external upload
storage and nonstandard data destinations require a reviewed transfer plan.

1. Prepare/build the Podman images, run `doctor`, check free disk space and take
   an off-host backup. Keep the same application revision and private credentials,
   particularly signing/session, database, service-identity and search keys.
   Replacing them can invalidate sessions or break existing accounts. Keep the
   original Docker images, Compose/storage overlays and `.env` files for rollback.
   Review SMTP, Listmonk, SLZ and reverse-proxy settings. Docker-only service
   hostnames/external networks cannot be joined from rootless Podman; supply
   reachable authenticated/TLS service endpoints and test delivery during
   acceptance. Do not grant host networking to bypass this routing step.

2. Put the public site into maintenance at the reverse proxy. Stop all application
   and external writers and pause deployment/restart automation. Capture the
   source service IDs through the existing Compose/storage selector. Keep this
   operator shell and use a private backup directory:

   ```bash
   set -euo pipefail
   umask 077
   source bin/lib/core-service-data.sh
   core_compose production
   slk_docker=("${CORE_COMPOSE[@]}")
   slk_private=$(mktemp -d "$HOME/slk-podman-migration-XXXXXXXX")
   slk_db=$("${slk_docker[@]}" ps -q db)
   slk_cache=$("${slk_docker[@]}" ps -q cache)
   slk_search=$("${slk_docker[@]}" ps -q meilisearch)
   slk_cms=$("${slk_docker[@]}" ps -q directus)
   "${slk_docker[@]}" stop frontend directus
   docker exec "$slk_cache" redis-cli SAVE > /dev/null
   docker exec -i "$slk_db" sh -ec 'exec psql -XqAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
     < bin/lib/core-upgrade-table-checks.sql > "$slk_private/database.before"
   "${slk_docker[@]}" stop db cache meilisearch
   ```

   Wait for clean shutdown. Check source PostgreSQL/PostGIS, Redis and Meilisearch
   image IDs/versions against the target images before proceeding. Export the
   exact old images privately if a registry may no longer retain them. Keep all
   writers stopped until acceptance or rollback completes.

3. Export the stopped services' mounted data using each source image. This also
   handles Docker named volumes selected by the existing storage overlay:

   ```bash
   slk_archive() {
     local container=$1 user=$2 destination=$3 output=$4 image
     image=$(docker inspect --format '{{.Image}}' "$container")
     docker run --rm --network none --read-only --cap-drop ALL \
       --security-opt no-new-privileges --user "$user" \
       --volumes-from "$container:ro" --entrypoint tar "$image" \
       -C "$destination" -cf - . > "$output"
   }
   slk_archive "$slk_db" postgres /var/lib/postgresql/data "$slk_private/database.tar"
   slk_archive "$slk_cache" redis /data "$slk_private/cache.tar"
   slk_archive "$slk_search" 0:0 /meili_data "$slk_private/search.tar"
   slk_archive "$slk_cms" node /directus/uploads "$slk_private/uploads.tar"
   (cd "$slk_private" && sha256sum ./*.tar > SHA256SUMS && sha256sum -c SHA256SUMS)
   ```

   Meilisearch's existing Docker image runs as UID 0; that read-only archive helper
   has no capabilities and only inherits the source mounts. If an existing data
   mount has a different owner, use its actual readable UID. Inspect tar inventories,
   retain the private original archives, and copy/verify them off-host. Back up
   host configuration/overlays separately. Archives contain personal data and
   credentials and must stay private.

4. Select a **fresh Podman project** and restore into its new named volumes.
   Do not restore over a previous attempt or existing accepted deployment. These
   helpers run as the target service's non-root UID; `--no-same-owner` transfers
   files into its intended user mapping without changing Docker's originals:

   ```bash
   export SLK_PODMAN_PROJECT=slk-podman-cutover
   slk_restore() {
     local service=$1 destination=$2 input=$3
     ./bin/podman.sh production compose run --rm --no-deps -T \
       --entrypoint sh "$service" -ec '
         test -z "$(find "$1" -mindepth 1 -maxdepth 1 -print -quit)"
         tar --no-same-owner -xf - -C "$1"
       ' sh "$destination" < "$input"
   }
   slk_restore db /var/lib/postgresql/data "$slk_private/database.tar"
   slk_restore cache /data "$slk_private/cache.tar"
   slk_restore meilisearch /meili_data "$slk_private/search.tar"
   slk_restore directus /directus/uploads "$slk_private/uploads.tar"
   ./bin/podman.sh production compose up -d --no-build db cache meilisearch
   ```

   Wait for data-service health. Compare the restored database row fingerprints
   before starting Directus or importing configuration:

   ```bash
   ./bin/podman.sh production compose exec -T db sh -ec \
     'exec psql -XqAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
     < bin/lib/core-upgrade-table-checks.sql > "$slk_private/database.after"
   diff -u "$slk_private/database.before" "$slk_private/database.after"
   ```

   Verify restored role attributes, ownership/grants, extensions and sequence
   values, Redis session/rate-limit state, search indexes/document counts/settings
   and API keys, and upload inventories/checksums. The cold copy retains all
   databases/roles, search indexes and persistent cache files. Preserve file
   modes from the snapshot; review/harden previously broad upload modes on the
   new volume. Do not alter the original mounts to fix target permissions.

5. Keep the reverse-proxy maintenance gate active. Release Docker's application
   and maintenance listeners, then run `production start --import` on Podman.
   Import failure, invalid frontend output or failed audit retains Podman
   maintenance. Run `npm --prefix bin/test_suite run test:podman`, then the normal
   full application test suite against a disposable acceptance instance. Check
   authenticated editing/publishing/preview, login/session continuity, PDFs,
   uploads, search, newsletter/SMTP delivery and safe logs. Resume public traffic
   and scheduled/external writers only after acceptance. Enable the user service
   with the same project, ports and selected private environment paths. Disable
   the old Docker deployment automation so it cannot become a second writer.

6. Before public traffic/writers resume, rollback is: stop Podman, keep its volumes
   and diagnostics, start the original Docker data services, then the original
   Directus/frontend revision with its preserved config and remove maintenance
   after readiness. The source data and images were never changed by restoration.
   After Podman accepts writes, rollback requires a new consistent backup/transfer
   back to Docker; restarting the old snapshot would lose those new writes.
   Keep both generations and the verified off-host backup until sign-off.

## Boot and acceptance status

Adjust the checkout path in `podman/slk.service.example`, copy it to
`~/.config/systemd/user/slk.service`, and add project/port/environment-file choices.
Run `systemctl --user daemon-reload` and `systemctl --user enable --now slk.service`
after a successful manual release. An administrator enables lingering for the
operator. The host unit must allow Podman/newuidmap to create user namespaces;
container confinement is applied to the child runtimes by Compose. Verify a real
reboot and user logout on the target host before rollout.

Automated regression coverage: `bin/test_suite/src/podman.test.ts` checks pinned
controls, mount/network/privilege boundaries, hostile configuration drift,
private-file modes, derived syscall rules, failed-import maintenance retention,
active-release protection, and native secret transport/rotation. `test:podman` audits an actual
prepared rootless stack and exercises read-only roots, Node threads/children,
Typst and seven HTTP/CSP routes. Full stateful application workflows and the
Docker-to-Podman transfer/reboot/SMTP paths remain deployment acceptance steps.
See the change's validation results for which checks ran on the available host.

References: [Podman runtime options](https://docs.podman.io/en/latest/markdown/podman-run.1.html),
[Compose providers](https://docs.podman.io/en/latest/markdown/podman-compose.1.html).

### Validation in this change (2026-10-26)

- 257 unit/CLI tests passed, including 12 focused Podman cases. Strict test-tooling
  TypeScript and repository formatting checks passed.
- Both application images built from filtered contexts; all maintained Directus
  extensions compiled/type-checked, and extension dev dependencies were pruned.
  Fake environment/key/report canaries were excluded from the resulting images.
- The complete frontend production build passed strict gates under the derived
  seccomp profile. Its fingerprint verified against the read-only runtime image
  and release volume; its static route returned HTTP 200 on localhost:8080.
- Isolated Docker probes passed for PostgreSQL/PostGIS, Redis, Meilisearch and
  maintenance with non-root users, capless processes, read-only roots, NNP and the
  derived seccomp profile. Node workers/children and Typst PDF generation passed.
- The built Directus image passed all 11 native security regressions. Both Compose
  base configurations parsed through podman-compose 1.5 and Docker Compose.
  The actual Podman provider resolved the native-secret overlays and translated
  them to `--secret` references; credential canaries never entered those arguments
  or wrapper failure output. Runtime/builder references and boundaries matched.
- The lockfile audit retains the existing node-forge advisory and seven affected
  frontend graph entries; the source backport and its regression checks passed.
  CLI, test tooling, patch dependencies and every extension had no high/critical
  findings. Node dependency versions were unchanged. The optional Caddy binary/module
  review is documented in [caddy/README.md](caddy/README.md).
- This workstation has no Podman or uidmap installation. Actual rootless startup,
  `test:podman`, a real data cutover, restart/reboot and external SMTP routing were
  not executed. The local `bin/test_dev.sh` unit stages passed; its application
  integration stage could not connect to the unavailable local Directus stack.
  Keep those deployment acceptance checks pending before replacing Docker.
