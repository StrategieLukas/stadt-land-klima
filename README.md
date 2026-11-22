# Stadt.Land.Klima!

Nuxt frontend and Directus CMS with PostgreSQL/PostGIS, Redis and Meilisearch.
Deployment uses **rootless Podman and Caddy**. Directus stays **11.17.4**.

- [Project decisions](PROJECT_DECISIONS.md): architecture, roles, security and current owner decisions.
- [Podman operations](PODMAN.md): host requirements, private runtime mounts, build/start/restart, storage and recovery.
- [Central logging](docs/CENTRAL_LOGGING.md): opt-in host journal forwarding, monitoring-server setup and [component alternatives](docs/LOGGING_ALTERNATIVES.md).
- [Deployment acceptance](DEPLOYMENT_CHECKLIST.md) and [Caddy gateway](caddy/README.md).
- [Feature/test inventory](FEATURES.md), [cleanup decisions and search differences](docs/REPOSITORY_CLEANUP.md).
- [Agent instructions](AGENTS.md), [CMS translations](DYNAMIC_CONTENT_TRANSLATION.md), [CLI](src/directus/cli/README.md), [test suite](bin/test_suite/README.md).

Designs: https://www.figma.com/design/xOUA8jmhBBreYvmZRdlFSn/Stadt.Land.Klima!

## Operations CLI

Use the Node version pinned in `.node-version` before installing or running the
CLI. It requires Node 24 or newer with native TypeScript support; Node 22.14.0
cannot load the CLI's `.ts` entrypoint. With nvm, run these from the repository root:

```bash
nvm install "$(cat .node-version)"
nvm use "$(cat .node-version)"
npm ci --prefix bin
```

Then use
`./bin/slk --help` or `./bin/slk <group> --help`. All former bin shell scripts are
replaced by this TypeScript CLI. Commands default to development; select
`--env production` explicitly for production. Put tool/provider arguments after
`--`, for example `./bin/slk database sql --env production -- -c 'SELECT 1'`.

Help includes a mint-green FIGlet header on color terminals; redirected output is
plain text. `NO_COLOR` disables color and `FORCE_COLOR=1` enables it explicitly.
Incomplete commands print the relevant help and exit with status 1 before any
operation starts. `./bin/slk --version` reports the Git tag/revision and appends
`-dirty` for tracked changes; source archives without Git metadata say so explicitly.

Flush application caches for the selected local stack with:

```bash
./bin/slk cache flush
./bin/slk cache flush --dry-run
```

The command clears Directus caches, restarts CMS/frontend memory caches and
removes development Nuxt/Vite caches. It briefly interrupts both services and
preserves Redis sessions/protection state, stored translations, search indexes
and production output. See [cache operations](PODMAN.md#flushing-application-caches)
for environment selection and scope.

## Development

Prepare the host as described in [PODMAN.md](PODMAN.md#host-requirements). Image
builds do not require runtime credentials; configure the four private dotenv files
before starting services (existing checkouts may need to move their database and
search configuration from `docker/` to `podman/`):

```bash
./bin/slk stack build --env development && ./bin/slk stack start --env development --import
```

For an older development Podman, append
`--unsafe-skip-podman-version-check` to each `stack` command. This explicit,
development-only option skips the engine version check and prints a warning;
all other preflights remain required. See [the override instructions](PODMAN.md#unsafe-development-version-override).

Frontend: http://localhost:8080; CMS: http://localhost:8081. Frontend source
hot-reloads. The first start requires `--import`; normal startup checks the schema
before running custom migrations and reports this requirement on an empty database.
Import the code-first configuration using:

```bash
./bin/slk stack compose --env development -- exec -T directus /directus/cli/import-all.sh
```

Configure the private CLI administrator token in the host Directus dotenv file.
On a fresh installation, create it through authenticated CMS administration;
bootstrap passwords do not reset persisted accounts. Development start/restart
automatically provisions the private website identities and synchronizes the
frontend credentials without rotating existing account tokens. Readiness checks
the layout and catalogue APIs as well as the HTML response. Production identity
setup remains the explicit service-provisioner workflow in the deployment checklist.
Never put a CMS service token into public runtime configuration.

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
./bin/slk check ready
./bin/slk check ready --only static --output json
./bin/slk check quality --list
```

The shared TypeScript check runner is used locally and by all four GitHub Actions
workflows. It prints concise results and bounded failure excerpts while retaining
complete private logs and a JSON report in `.reports/checks/`. Use `--output full`
to stream every byte. Exit statuses determine results; filtered text never decides
whether a check passed. Selected checks include their prerequisites.

See [the check runner reference](docs/CHECKS.md) for setup, profiles, selectors,
timeouts, native/deployed limitations and report handling. The existing
`./bin/slk test dev` and `./bin/slk test full` commands remain available; the full
CMS fixture suite is writable and requires disposable data. The `ready` runner
executes the development suite's unit and live halves once each.

## Newsletter runtime configuration

The frontend's private runtime dotenv must provide `LISTMONK_ENDPOINT`,
`LISTMONK_API_USERNAME`, `LISTMONK_API_TOKEN`, and the numeric default
`LISTMONK_LIST_ID`. The `NUXT_LISTMONK_*` runtime overrides are also supported.
These values are server-only; keep credentials out of Git and public Nuxt config.
The deployed frontend reads the mounted dotenv at startup, so changing it requires
restarting the frontend. A successful frontend build or homepage health check does
not verify newsletter configuration.

Before a release, verify the configured provider's authenticated `/api/lists`
response and that the selected default list exists and uses double opt-in. The
website's read-only `/api/newsletter-lists` route must return the intended public
lists. Missing endpoint/API credentials produce an unavailable newsletter service;
do not replace an existing private dotenv with the empty example during deployment.
Run diagnostic commands through the runtime environment loader: a bare container
`exec` does not inherit the mounted dotenv values loaded by the server process.

Subscription acknowledgement accepts both legacy `data: true` and Listmonk 6's
`data: { has_optin: boolean }`. Actual confirmation-email delivery remains a
separate acceptance check requiring an explicitly approved test recipient.

## Local-team registration mail

Directus needs private `EMAIL_TRANSPORT=smtp`, `EMAIL_FROM`, `EMAIL_SMTP_HOST`,
`EMAIL_SMTP_PORT`, `EMAIL_SMTP_SECURE`, `EMAIL_SMTP_USER` and `EMAIL_SMTP_PASSWORD`.
Keep these in its mounted private dotenv; never commit credentials. Production
must not use the development sendmail logger or `/bin/false`. Restart Directus
through the maintained deployment workflow after updating private settings.

Production connectivity checks on 2026-11-19 found standard ports 465/587 to
`mail.stadt-land-klima.de` unreachable from the application container. The existing
mail server also publishes implicit TLS on port 2465; verify that endpoint from
the target host with certificate verification enabled before selecting it.
`EMAIL_SMTP_SECURE=true` is required for implicit TLS on either 465 or 2465.
Use Nodemailer's [connection verification](https://nodemailer.com/smtp#verifying-the-connection)
to check TLS/authentication without sending email. This does not test sender or
recipient acceptance. Do not disable TLS certificate checks to solve connectivity.

The two administrator-protected registration flows must be configured through
`DIRECTUS_FLOW_NOTIFY_ADMIN` and `DIRECTUS_FLOW_WELCOME_EMAIL` in the frontend's
private dotenv. Rebuild the pinned Directus runtime as well as the frontend when
releasing this fix: the source-verified mail-operation patch makes synchronous
flows await transport acceptance and propagate sanitized send failures. Native
mail rate limits and the checked flow YAML remain unchanged.

`steps.email` confirms an accepted welcome message containing the password link,
not link generation. Registration preserves the created team/account if mail
fails, so do not submit the same registration again as a delivery retry. Re-send
through an approved operator workflow after restoring SMTP. Actual inbox delivery
and newsletter double opt-in need an explicitly approved test recipient.

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

Portable application recovery uses `./bin/slk backup create` and `backup verify`;
see [the recovery guide](bin/PORTABLE_BACKUP.md). Production application release
coordination and private CMS-origin checkpoints are described in
[PODMAN.md](PODMAN.md#application-release-coordination).
