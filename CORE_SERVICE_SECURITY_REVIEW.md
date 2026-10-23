# Core service security update — reviewed 22 October 2026

> Historical checkpoint. This retains the core hotfix and recovery history. Later hardening added logical-storage integration coverage and targeted Directus safeguards. The current instruction explicitly retains Directus 11.17.4. Current status: [implemented hardening](SECURITY_HARDENING.md) and [remaining work/decisions](REMAINING_TODOS.md).

## Integration into the security-hardening branch

Main's core-service hotfixes and removal of the retired Stadt-Land-Zahl Docker
network are integrated into `0000-security-updates`. The development override no
longer requires that external network either. PostgreSQL 17.11/PostGIS 3.6.4,
Meilisearch 1.55.0, Redis 8.10.2, the migration utility and startup guards are
retained. The user reports successful staging and production deployments of the
main-branch hotfix.

This branch retains its newer frontend Node 24.22.1, Typst 0.15.1 with its verified
checksum, npm 11.21.1 and Nuxt/Vite/Blökkli/TypeScript stack. Directus remains
11.17.4 on Node 22.23.4 with one locked Undici patch layer. Maintenance remains a
local image built from nginx 1.30.6 with Alpine package updates. The historical
version table and verification results below describe the main-branch rollout;
they do not downgrade those newer branch dependencies or prove its separate
application-hardening work complete.

For deployments of this branch, `build_production.sh` builds maintenance along
with the application images. Pull `cache` separately; maintenance has a build
definition rather than an upstream image entry, so the historical
`pull cache maintenance` command below applies only to main's configuration.
The migration/start sequence otherwise remains the same. Do not rerun a major
data migration on the already upgraded staging/production directories; the
utility detects matching formats and exits without data changes.

Merge validation on 22 October:

- Frontend, Directus and maintenance images build successfully. Runtime checks
  confirm Node 24.22.1 / 22.23.4, npm 11.21.1, Typst 0.15.1 and Undici 7.30.1
  for both optional storage drivers. Database/search/cache report 17.11 / 1.55.0 /
  8.10.2 respectively.
- `cd bin && ./test_dev.sh`: 83 passed, zero failed, including municipality PDF
  generation and disposable-fixture cleanup. Production email delivery remains
  manual-only.
- Contract/typecheck-gate tests: eight passed; adapter tests: seven passed;
  disclosure helpers: three passed; Blokkli browser persistence: two passed;
  migration security: 22 passed.
- The frontend typecheck/lint gate passes against its existing diagnostic
  baseline. A fresh isolated Nuxt 4.6.2 production build succeeds; all 294 public
  script/map/JSON/HTML artifacts pass the configured-credential disclosure scan.
- Production preview smoke checks pass for `/`, `/jobs`, `/api/public/jobs` and
  content search. Development remains available on localhost:8080.
- All three Compose variants validate; local startup succeeds using only the
  default project network. Migration startup guards, shell syntax/ShellCheck,
  helper TypeScript checking and maintenance nginx configuration checks pass.

Original staged and unstaged user changes are preserved separately from the
merge. No additional database migration or production deployment was performed.

The core-service changes below are in commit `b62515fb`. Their original local
migration and application checks ran on 21 October. Integration checks on
22 October use the local development stack; this merge does not deploy to staging
or production.

## Declared images versus running containers

The previous security branch declared Redis 8.8.3. Switching to main changed the
Compose file back to `redis:6` without recreating that container. Docker did not
resolve the Redis 6 tag to Redis 8. A branch checkout changes files, not existing
containers. Redis is now explicitly pinned to 8.10.2 on main.

## Changes

| Component              | Previous local runtime/configuration | Updated target                                                       |
| ---------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| PostgreSQL / PostGIS   | 13.5 / 3.1.4, Alpine 3.14            | 17.11 / 3.6.4, pinned official image digest                          |
| Meilisearch            | 1.8.4                                | 1.55.0                                                               |
| Maintenance nginx      | 1.27 image tag                       | 1.30.6 stable                                                        |
| Optional macOS pgAdmin | Unpinned image, publicly bound port  | 9.18, loopback port only                                             |
| Typst                  | 0.14.1                               | 0.14.2, verified archive checksum                                    |
| Directus OS            | Base-image package versions          | Alpine security package updates during build                         |
| Directus application   | 11.17.4                              | Still 11.17.4; security upgrade pending the licensing decision below |

PostgreSQL 13 lost upstream support on 13 November 2025. PostgreSQL 17 is supported
until November 2029 and retains this project's existing data mount layout.
The 13-to-17 move is a logical dump/restore, not an in-place directory upgrade.
Indexes are rebuilt under the new libc/PostGIS versions during restore.
[PostgreSQL versioning](https://www.postgresql.org/support/versioning/),
[official PostGIS images](https://github.com/postgis/docker-postgis).

Meilisearch 1.8 data cannot use the newer direct database-upgrade mechanism,
which requires at least 1.12. The migration exports a portable dump and imports
it into a separate directory, preserving the original directory.
[Meilisearch upgrade documentation](https://www.meilisearch.com/docs/resources/migration/updating).

nginx 1.30.6 includes current stable security fixes. pgAdmin 9.18 includes four
published security fixes. Typst 0.14.2 fixes the plugin WebAssembly memory-safety
issue in 0.14.0/0.14.1 while retaining the existing 0.14 feature series.
[nginx advisories](https://nginx.org/en/security_advisories.html),
[pgAdmin 9.18](https://www.pgadmin.org/news/),
[Typst 0.14.2](https://github.com/typst/typst/releases/tag/v0.14.2).

## Production / staging deployment

Run from the repository root on staging first. Keep the existing database and
search containers: `stop` is supported; do not run `down` before migration.
External database/search writers must also be stopped for the maintenance window.

```bash
git pull --ff-only
./bin/build_production.sh
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml pull cache maintenance
./bin/upgrade_core_services.sh production
./bin/upgrade_core_services.sh production --apply
./bin/start_production.sh
```

The read-only command prints the source image identities and targets. `--apply`
activates maintenance through the existing stop script, stops frontend/Directus,
and temporarily starts the existing database/search containers with their old
images for export. It restores all non-template databases, global roles and
privileges into a separate PostgreSQL cluster, then imports the search dump into
a separate Meilisearch directory. Application table counts and content hashes
must match; geometry is compared as lossless EWKB, including SRID. Search index
counts, old settings (including nested values) and API-key permissions must match.
New settings introduced by Meilisearch retain their upstream defaults.

The existing bootstrap database user's configured password is verified and then
rehash-converted from legacy MD5 to SCRAM without changing its plaintext value.
Other legacy MD5/passwordless login roles and custom tablespaces cause a controlled
stop for manual migration, rather than silently breaking authentication.

Only verified replacement directories are cut over. Backups, private resolved
environment files and original data directories are retained. The backup folder
contains passwords/hashes and must stay private. The script prints its exact path.
It leaves applications stopped until the normal start script runs. Startup guards
reject incompatible old data before service recreation. Re-running a completed
migration detects matching formats and makes no data changes.

The automated cutover supports the repository's standard Linux bind mounts.
Named-volume/macOS installations and custom mount layouts require a separate
logical dump/restore migration. `CORE_UPGRADE_TIMEOUT_SECONDS` defaults to 3600
for large search imports. No npm-cache clearing or Directus YAML import is needed.

Verify running versions, not just image tags:

```bash
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml exec -T db postgres --version
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml exec -T meilisearch meilisearch --version
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml exec -T cache redis-server --version
docker compose -f docker-compose.yaml -f docker-compose.prod.yaml exec -T directus typst --version
curl --fail http://localhost:9000/
curl --fail http://localhost:9001/server/health
```

## Recovery

Before cutover, failures leave original data directories in place. Applications
remain stopped. New attempts use separate directories and backup folders.
After cutover, original directories have `.before-<run-id>` suffixes; replacement
data is never a backwards-compatible input for the old PostgreSQL or Meilisearch.

For rollback, keep maintenance active, stop application/database/search containers,
and preserve the replacement directories separately before restoring both original
directory names. A new backup's `rollback.compose.yaml` pins the exact old local
image IDs; append it after the normal Compose files to recreate database/search
with those images. Existing old images must not be pruned during the rollout.
Use that override for application startup as well, bypassing the new-format startup
guard. Check application health before deactivating maintenance. Writes made after
the upgrade require a separate recovery decision; restoring old directories alone
does not preserve those new writes. Rollback is manual and was not applied to the
working local database.

## Verification

- Full local migration preserved three databases: directus, postgres and staging_db.
  All application table counts and content hashes matched, including geometry.
- Search dump import preserved the existing index count, document counts, settings
  and API-key permissions. New nested defaults are permitted without changing old
  settings. The old frontend SDK passed indexing, filtering, highlighting,
  multi-search, anonymous-access denial and index-scoped API-key isolation checks.
- Both primary service health checks returned HTTP 200. nginx configuration and
  HTTP checks passed. pgAdmin image reports 9.18. Redis client smoke checks passed.
- Municipality and election PDFs generated successfully with the patched Typst.
- Shell syntax, ShellCheck, isolated TypeScript checking, Compose validation,
  old-data startup rejection, new-data acceptance and migration idempotence passed.
- `bin/test_dev.sh`: 14 passed, one unchanged preview failure. The local environment
  still uses the migration branch's token names, while main expects DIRECTUS_TOKEN.
- Existing PDF limitations surfaced with unrated/incomplete records: missing
  sector dictionaries and sorting null ratings. The old Typst 0.14.1 binary also
  fails the null-rating sort; complete rated-record PDFs pass on 0.14.2. Those
  application behavior fixes are outside this dependency update.

## Unresolved Directus application advisories

**Current instruction: keep Directus at 11.17.4.** The earlier statement that this cap was lifted is superseded. The October 22 assessment found no newer published 11.x patch; this paragraph is not a new registry check. Updating Node, PostgreSQL, Redis or Alpine does not fix Directus application code vulnerabilities. Subsequent exact-source deep/geometry/transform guards and disabled entry points are recorded in [completed hardening](SECURITY_HARDENING.md#runtime-and-pinned-directus-safeguards); remaining vendor risks are in [remaining work](REMAINING_TODOS.md#pinned-directus-and-vendor-findings).
In particular, upstream lists an unauthenticated persistent denial of service in
the `deep` query parser for versions below 12.2.0. Permission restrictions do not
prevent that middleware from being reached. No destructive exploit was run.
[GHSA-gwvv-rr68-cmv6](https://github.com/directus/directus/security/advisories/GHSA-gwvv-rr68-cmv6).

Other published affected ranges include public-mode WebSocket authorization bypass
(fixed in 12.1.0), PostGIS geometry collection-creation SQL injection (12.1.0), and
image-transform dimension denial of service (12.2.0). Their prerequisites differ;
do not treat every published advisory as a demonstrated exploit on this deployment.
Subsequent narrow geometry/transform guards and disabled WebSockets reduce these paths; they are not a complete vendor patch set. Reassess remaining prerequisites and residual exposure before changing the pin.
[WebSockets](https://github.com/directus/directus/security/advisories/GHSA-97xr-jchp-xm3c),
[geometry SQL injection](https://github.com/directus/directus/security/advisories/GHSA-chfm-g7r3-vv42),
[image dimensions](https://github.com/directus/directus/security/advisories/GHSA-7vcx-mhxq-9j96).

### Directus 12 upgrade prerequisites

Directus 12 introduces active licensing. Upstream states that custom access-policy
rules are ignored without a license enabling them, following a 30-day grace
period for upgraded installations. Over-limit installations can also enter an
API/login lockdown. This application depends on custom rules for private and
team-scoped content. A successful upgrade or a passing test during the grace
period would not establish that those boundaries remain enforced afterward.
No license key or token was found in the local Directus/DB environment files;
that does not establish the licensing status of staging or production.
[Directus 12 licensing and breaking changes](https://directus.com/docs/releases/breaking-changes/version-12).

Directus 12 is not authorized under the current instruction. The following prerequisites are retained as historical research for a separately authorized future decision. No Directus 12 bootstrap or license registration was performed. Subsequent targeted 11.17.4 safeguards are implemented, but do not constitute an upstream-supported or complete application security update.

The licensed-upgrade path also requires concrete compatibility work:

- The hardened Directus 12 image removes runtime `npm`/`npx`. Both current startup
  scripts install CLI dependencies at startup, and production invokes `npx tsx`.
  Dependency installation and the TypeScript runner must move into the image or
  be supplied explicitly before using that image.
- Production readiness and the test helper call `/server/health` without
  authentication. Directus 12 requires authentication there. Public
  `/server/ping` checks liveness only; dependency readiness needs an authenticated
  health check.
- Fourteen custom extensions declare host compatibility with `^11.0.0`.
  Their compatibility ranges must change only after build/runtime verification,
  including the custom interfaces, Blökkli persistence and search hooks.
- Review reverse-proxy trust explicitly: the default changes to false. Do not
  replace it with unrestricted trust without checking the deployment's proxy path.
- Recheck the separately installed Undici patch against the new image. Its pnpm
  layout and dependency versions are implementation-specific; a fixed upstream
  dependency can replace the workaround after resolution checks.
- Validate the code-first importer, scoped permission tests, content versioning,
  rich-text editor behavior and custom interface styling against a restored copy
  of the database before production migration.

These prerequisites are findings, not implemented changes. The commands earlier
in this document deploy the current Directus 11.17.4 configuration and therefore
require the current targeted safeguards and the residual-vendor-risk review linked above.
