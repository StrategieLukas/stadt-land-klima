# Stadt.Land.Klima!

Nuxt frontend and Directus CMS with PostgreSQL/PostGIS, Redis and Meilisearch.
Deployment uses **rootless Podman and Caddy**. Directus stays **11.17.4**.

- [Project decisions](PROJECT_DECISIONS.md): architecture, roles, security and current owner decisions.
- [Podman operations](PODMAN.md): host requirements, private runtime mounts, build/start/restart, storage and recovery.
- [Deployment acceptance](DEPLOYMENT_CHECKLIST.md) and [Caddy gateway](caddy/README.md).
- [Feature/test inventory](FEATURES.md), [cleanup decisions and search differences](docs/REPOSITORY_CLEANUP.md).
- [Agent instructions](AGENTS.md), [CMS translations](DYNAMIC_CONTENT_TRANSLATION.md), [CLI](src/directus/cli/README.md), [test suite](bin/test_suite/README.md).

Designs: https://www.figma.com/design/xOUA8jmhBBreYvmZRdlFSn/Stadt.Land.Klima!

## Operations CLI

Install the locked operator tools with `npm ci --prefix bin`, then use
`./bin/slk --help` or `./bin/slk <group> --help`. All former bin shell scripts are
replaced by this TypeScript CLI. Commands default to development; select
`--env production` explicitly for production. Put tool/provider arguments after
`--`, for example `./bin/slk database sql --env production -- -c 'SELECT 1'`.

## Development

Prepare the host and four private dotenv files as described in [PODMAN.md](PODMAN.md#private-runtime-configuration), then:

```bash
./bin/slk stack build --env development && ./bin/slk stack start --env development --import
```

Frontend: http://localhost:8080; CMS: http://localhost:8081. Frontend source
hot-reloads. Import the code-first configuration using:

```bash
./bin/slk stack compose --env development -- exec -T directus /directus/cli/import-all.sh
```

Configure the private CLI administrator token in the host Directus dotenv file.
On a fresh installation, create it through authenticated CMS administration;
bootstrap passwords do not reset persisted accounts. Use the service provisioner
from the deployment checklist for private server/preview identities. Never put a
CMS service token into public runtime configuration.

## Production and runtime configuration

```bash
./bin/slk stack build --env production
./bin/slk stack start --env production --import
```

Use the ordered [deployment checklist](DEPLOYMENT_CHECKLIST.md) on staging first.
`start --import --prepare-only` keeps frontend stopped during setup. The updater
backs up before updating/importing; `--no-backup` is an explicit recovery choice.
Maintenance uses Caddy on loopback 9090; application/CMS ports are loopback 9000/9001.

Private dotenv files are read-only mounts, never image inputs. Their values are
loaded on every container start, including legacy frontend-to-Nuxt runtime aliases.
After changing settings, restart the affected service:

```bash
./bin/slk stack restart --env production frontend
./bin/slk stack restart --env production directus
```

No rebuild is required for runtime keys. Image/source changes still require a
build; published-port/mount/resource changes require recreation. Persisted account
passwords must be rotated in the actual service as well as its private config.

## Configuration, extensions and migrations

The source of truth is `src/directus/` YAML; never replace its importer with SQL
permission edits or broaden public-role access. Policies import before roles.
The normal importer retains supported legacy-content preflights, outbox triggers
and idempotent seeds needed by restored/fresh databases.

After an extension change install/build its locked dependencies, then rebuild the
Podman Directus image and restart/recreate the CMS to load its compiled bundle.
`./bin/slk extensions build` checks all maintained packages. Deployment
must use matching source, locks, bundles and YAML.

```bash
./bin/slk cms migrate --env production
```

The migration launcher backs up, imports YAML and applies pending registered
migrations. Use `development` for local fixtures. Core-service major upgrades use
explicit verified restores, not image-tag changes over old data. Keep private
`podman/core-storage/` overlays in off-host backups; never use `down -v` for upgrades.
See [PODMAN.md](PODMAN.md#storage-and-recovery).

## Database application-role cutover

Rehearse this on restored staging data with real imports and backup restoration.
Keep the separate bootstrap operator and a private directory for the plan:

```bash
slk_private="$(mktemp -d /tmp/slk-role.XXXXXX)"
chmod 700 "$slk_private"
./bin/slk database role --env production -- plan "$slk_private/database-role.json" slk_app
```

Review the private plan (it contains the generated password), stop frontend and
CMS, and keep PostgreSQL running. Then:

```bash
./bin/slk stack compose --env production -- stop frontend directus
./bin/slk database role --env production -- apply "$slk_private/database-role.json"
```

Copy the resulting application-role values into `src/directus/.env`. Keep
`podman/database/.env` as the separate bootstrap operator. The tool refuses drift,
active clients, unexpected ownership and an existing target role; ownership
changes are transactional and preserve PostGIS members. It retains application
DDL for imports, not cluster administration. Separate runtime/migrator roles are
future work. Do not rerun apply after success or restore SUPERUSER as a shortcut.

## Checks

```bash
cd bin
./slk test dev
```

Wait for completion. The default suite runs unit/CLI and fast live CMS/browser
flows; `./slk test full` is writable and requires disposable data. Additional root checks:

```bash
npm --prefix src/frontend run typecheck
npm --prefix src/frontend run lint
npm --prefix src/frontend run lintExtensions
npm --prefix src/frontend run format:check
npm --prefix src/directus/cli test
npm --prefix bin/test_suite run typecheck
npm --prefix bin/test_suite run test:runtime-environment
curl --fail http://localhost:8080/
```

The env launcher uses Go 1.27.4+ for native tests; container builds supply the
reviewed Go builder. See [test instructions](bin/test_suite/README.md) for image,
proxy, storage, disclosure and read-only deployment profiles. Dependency audits
retain raw advisories and expiring reviewed dispositions.

## Newsletter SMTP routing on staging

The newsletter service is operated separately in `/home/deploy/newsletter`.
Its application needs the SMTP hostname to reach the host's published mail
listener, rather than container loopback. Preserve its existing host-gateway
mapping when moving that separately managed service:

```yaml
extra_hosts:
  - "mail.stadt-land-klima.de:host-gateway"
```

Keep the SMTP hostname, credentials and TLS hostname verification in Listmonk
settings. The recorded staging connectivity and STARTTLS/authentication checks
did not send email; actual delivery still needs acceptance. This repository change
does not rename or deploy files in that external service directory.

Canonical/social/sitemap URLs use runtime `PUBLIC_URL` (or explicit
`NUXT_PUBLIC_SITE_URL`), not incoming Host headers. SEO translations are checked
in German/English/Italian. Newsletter/Listmonk and other external integrations
remain separately operated; preserve actual routing and TLS hostname verification.
