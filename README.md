# Stadt.Land.Klima!

## Wichtige Dokumente

- [Implemented security hardening](SECURITY_HARDENING.md)
- [Remaining work and decisions](REMAINING_TODOS.md)
- [Administrator role invitations](ROLE_INVITATIONS.md)
- [DeepL CMS translation setup, usage controls and operation](DYNAMIC_CONTENT_TRANSLATION.md)
- [Rootless Podman setup, security controls and Docker migration](PODMAN.md)
- [Optional Caddy gateway configuration and nginx migration](caddy/README.md)

Designs (Figma): https://www.figma.com/design/xOUA8jmhBBreYvmZRdlFSn/Stadt.Land.Klima!

## Preparations

0. On Windows install Linux (i.e. Ubuntu) on Virtual Machine:
1. Install Docker for your machine (https://docs.docker.com/engine/install/, https://docs.docker.com/desktop/)
2. Clone this repo into your desired folder
3. Copy example env-files and adjust to your needs:

```
cd stadt-land-klima/
cp docker/db/.env.example docker/db/.env
cp src/directus/.env.example src/directus/.env
cp src/frontend/.env.example src/frontend/.env
cp docker/meilisearch/.env.example docker/meilisearch/.env
```

Setting "CACHE_ENABLED=false" for development is recommended to quickly see changes made to data in the backend.

## Installation:

Docker needs to be running
Give Permission to folder to write files and also subfolder: This is not optimal!

```
$ cd stadt-land-klima/
$ cd bin
$ ./start_development.sh
```

This may take some time.
When finished and started check http://localhost:8081 if directus started correctly.
In a new Terminal run :

```
$ cd stadt-land-klima/
$ cd bin
$ ./directus_bash.sh
$ ./directus-cli auth:set-token
$ source .env
$ cli/import-all.sh
$ cli/import-all.sh
$ ./directus-cli auth:set-frontend-token
```

Now open http://localhost:8081 in your browser and login with the credentials provided in the .env file.
To see the frontend open http://localhost:8080.

## Start in development

```
$ cd bin
$ ./start_development.sh
```

Directus will run on port 8081 and the frontend on port 8080

Now open `http://localhost:8081` in your browser and login with the credentials provided in the .env file.
To see the frontend open `http://localhost:8080`.

## Start in production

```
$ cd bin
$ ./start_production.sh
```

Directus will run on port 9001 and the frontend on port 9000.

## Stop

```
$ cd bin
$ ./stop.sh
```

## Update on production

Update to latest commit in current branch.

```
$ cd bin
$ ./update_production.sh
```

## Directus CLI

With the custom directus-cli you can import and export configuration.

To get a list of supported commands do:

```
$ cd bin
$ ./directus_bash.sh
```

then within the directus container:

```
$ ./directus-cli --help
```

For the cli tool to access directus it needs a static token for authentication.
Create one via the directus web interface or use the following command:

```
$ ./directus-cli auth:set-token
```

This will create a token in directus and save it to the .env file.
You might have to reload the .env file in the containers shell. (e.g. with `source .env`)

### My local Directus instance is empty

If your local Directus has no schemas/roles/objects, then you need to use the Directus-CLI tool to import them. This effectively reads the .yaml-files from the code and puts them into the running directus instance.
To import all roles, you can use (more infos using the `--help` flag):

```
$ ./directus-cli import:roles
```

### I changed things locally in Directus, but I have no changes to commit?

If you created changes through the Directus-UI, they need to be exported first using the Directus-CLI tool. This effectively saves the configuration state of your local running directus instance as .yaml files.
The following command will export any changes made to the database schema:

```
$ ./directus-cli export:schema [dest]
```

The Directus-CLI has a `--help` flag to show all available exports and imports.

# Deployment Notes

## Dependency maintenance and security review

Completed branch changes are documented in [SECURITY_HARDENING.md](SECURITY_HARDENING.md); deployment actions, residual advisories and decisions are in [REMAINING_TODOS.md](REMAINING_TODOS.md). Directus stays on **11.17.4**. The frontend uses Node **24.22.1** and the Directus image uses Node **22.23.4**. The separate optional storage-driver Undici copy is locked to **7.30.1**. Production builds also rebuild the OS-updated maintenance nginx image.

Use the Docker runtimes or the project's patched Node version for local npm commands and install from lockfiles with `npm ci`. From the repository root, use `nvm install && nvm use` or the existing manager's `.node-version` support. Rebuild/recreate running applications to apply runtime changes; clearing the npm cache is not normally required.

Production frontend startup reuses `.output` only when its private fingerprint matches the source, translations, effective environment, Node/platform/libc and output bytes. Container identity changes do not invalidate it. A changed release, configuration or damaged/missing artifact runs `npm ci` and the full checked build before serving; failed builds are never stamped. Ordinary restarts therefore do not need build memory. Keep sufficient build capacity for deployments; see [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md).

The implemented access split keeps privileged CMS access behind authorized Nuxt endpoints. Public DTOs, SSR/hydration payloads, candidate/editor sessions and assets have explicit boundaries; see the [architecture record](SECURITY_HARDENING.md#architecture-and-public-data-boundaries). Production credential retirement remains a separate coordinated action.

Rebuild each extension after changing its dependencies, then restart Directus so
it loads the rebuilt `dist` bundles. Every maintained extension now runs its compiler
in `prebuild` (`vue-tsc` for packages with Vue components, otherwise `tsc`).
After installing locked dependencies with `npm ci` in each package, run
`./bin/check_extensions.sh` from the repository root for checks, or
`./bin/check_extensions.sh --build` for all checked builds.
See [DIRECTUS_EXTENSION_TYPES_REVIEW.md](DIRECTUS_EXTENSION_TYPES_REVIEW.md). Run `cd bin && ./test_dev.sh`, the Blökkli
persistence test in `bin/test_suite`, the CLI tour-migration test inside Directus,
and the CSV tests in `src/directus/extensions/hook-measure-rating-reports`.
Verify a frontend production build as well as `curl http://localhost:8080`.

The PostgreSQL/PostGIS and Meilisearch server upgrades require explicit,
data-preserving migrations; do not change their image tags over existing data
directories. Nuxt 4 and Blökkli 2 are implemented. Tailwind **4.3.3** and DaisyUI **5.7.50** now use the Vite integration and custom themes; see [migration and target acceptance](REMAINING_TODOS.md#choices-and-later-enhancements).

## Authenticated registration mail flows

`notifyAdminNewLocalteam` and `sendWelcomeNewLocalteam` require an authenticated
Directus administrator before any mail operation. Nuxt sends its existing private
`DIRECTUS_ADMIN_TOKEN`; never use the browser-visible `DIRECTUS_TOKEN` for this.
The welcome flow uses a fixed template. Flow UUIDs and the emailed activation
link stay unchanged. The article-submission notification uses the same protected
admin flow and has also been updated.

Deploy the updated Nuxt callers first, then import the protected YAML flows. The
caller retains the fixed template field so it also works with the previous flow
during that deployment sequence. Importing the protected flows first requires
temporarily disabling registration until the callers are updated. Both
`DIRECTUS_FLOW_NOTIFY_ADMIN` and `DIRECTUS_FLOW_WELCOME_EMAIL` can retain public
Directus URL aliases. The server extracts only their flow UUIDs and sends all
authenticated requests through `SERVER_DIRECTUS_URL`; redirects are rejected to
protect the private credential. After importing, use each flow's actual UUID from the
Directus Flows UI; the example `<flow-id>` placeholders cannot send mail.
Existing SMTP settings continue to apply. These webhooks
are called by the Nuxt registration workflow; manually creating a localteam in
the CMS does not independently trigger them.

Run `npm run test:mail-client` from `bin/test_suite` for the mail-client checks.
The full suite tests both flows against public, Frontend, local-team and
administrator identities. See `bin/test_suite/README.md` for optional SMTP capture
that also verifies registration delivery and activation-link content.

- `./bin/update_production.sh` imports the Directus YAML configuration and fixture content after the services restart. To import without rebuilding, run `./bin/import-all.sh` from any directory.
- To apply code-first Directus configuration followed by pending JavaScript
  migrations, run this from the repository root while the production stack is
  running:
  ```
  ./bin/run_directus_migrations.sh production
  ```
  The launcher creates a database backup first, imports the Directus YAML
  configuration, and then runs `directus database migrate:latest` inside the
  Directus container. Use `development` instead of `production` for the local
  development stack.
- For Docker/PDF permission errors, check the container UID/GID and grant access only to required upload/temp/output directories. Do not use recursive or world-writable `chmod 777`; review host ownership before changing permissions. See [host hardening follow-up](REMAINING_TODOS.md#required-deployment-acceptance).
- `./bin/update_production.sh` backs up the database by default. Use `--no-backup` when the database is unavailable and the update must proceed without that export.
- Migrate ratings from one version to another using ./directus-cli migrate <old> <new>. Avoid using this when the "new" version is already in use, as it overwrites all ratings that do not need re-evaluation.

### Erfolgsprojekte tours and legacy links

Tours use `success_project_tours` and `success_project_tour_stops`. Each stop owns
its visit metadata, report fields, Blökkli content, ordered uploaded image/video
gallery and related projects. Tour overview pages have their own Blökkli content
area, scoped to the immutable tour ID. Published projects appear as canonical
actions beside the stop report link and on the stop page. The canonical routes are
`/projects/tours/:tourSlug` and `/projects/tours/:tourSlug/:stopSlug`.

A published stop is visible only under a published tour. Its separate
`report_status` lets the itinerary remain visible while report text, cover,
gallery and blocks are drafts. Published retrospective reports appear once in
the news feed after the visit ends; tour stops do not appear in the events feed.
Exclusively owned report uploads use the `tour-report-media` folder and Frontend
publication permissions. Existing public assets shared with other content remain
public. Authorized editors can preview drafts on the same stop page.

Run `/directus/cli/import-all.sh` inside the Directus container from the repository
root. Before the final YAML snapshot can remove legacy report collections, it
runs `cli/migrateSuccessProjectTours.ts --prepare` to back up source records and
import an additive schema, then transfers and verifies content in a transaction.
Recovery backups include legacy news journey-photo selections with their order,
captions and credits, alongside separate report media. They are written with
restricted permissions under
`/directus/uploads/migration-backups/`. Keep a full database/uploads backup for
production rollback. Reruns preserve existing native records; conflicting
sources/destinations abort instead of overwriting editorial changes.

For an existing legacy deployment, preserve host-local configuration changes and
take fresh database and uploads backups before updating the code. Keep maintenance
enabled while Directus runs the staged import, then restart Directus and start
the updated frontend. Verify native tour/stop pages, legacy redirects, ordinary
events/news and editorial access before ending maintenance. The current
`bin/update_production.sh` starts the frontend and ends maintenance before its
import step, so that ordering needs special handling for this schema transition.
Its startup health gate also prevents the import from running while
`/server/health` returns HTTP 503; resolve the failing service first. Check disk
headroom before the production workflow's uncached image rebuilds. Development
mock reports/media must not be seeded on staging or production.

Legacy tour event/report records and unmigrated tour news transfer directly into
stops, preserving UUIDs, nested blocks, drafts, media credits/order and project
links. Original news records remain as hidden redirect/recovery metadata. Old
tour overview, event-stop and migrated news URLs permanently redirect, preserving
query strings and fragments. Unpublished tours/stops remain unavailable through
legacy URLs. Ordinary events, event series and news remain separate.

The post-import seed creates native Tour Ost 2026 records; the development-only
`cli/seedTourDemoContent.ts` adds clearly marked synthetic reports/media only to
unreported stops. It never runs during production imports.

Targeted regression: `bin/test_suite/src/runTourOnly.ts` uses the existing Tour
Series flow; `npm run test:tour-migration` from `src/directus/cli` exercises data
transfers and rollback in an isolated database schema. The complete development
suite is `./test_dev.sh --full` from `bin/`. `./test_dev.sh` runs the fast isolated
and public CMS/browser regression profile. For an anonymous, read-only deployment
check, run `npm run test:public -- https://staging.stadt-land-klima.de` from
`bin/test_suite`; this blocks all non-GET/HEAD browser requests. See
`bin/test_suite/README.md` for profile scope and commands.

## Lint and security follow-up

From `src/frontend`, `npm run lint` and `npm run lintExtensions` enforce zero ESLint warnings. Frontend unsafe TypeScript operations, unhandled promises and unsanitized HTML remain errors. Extension lint uses its own configuration alongside `./bin/check_extensions.sh --build`; it does not load the frontend tsconfig. Formatting is separate: `npm run format:check` / `npm run format` now check/write maintained sources across the repository using the shared root configuration. Directus YAML exports, generated bundles, lockfiles and pinned public/vendor files retain their serializer layout or exact bytes. Avoid formatting pinned files under `public/vendor`.

Website editor login uses an HttpOnly cookie and server-side Redis credentials. Existing website users must sign in once after upgrading from localStorage sessions. Keep Redis available; sessions and mutations fail closed during an outage. Set a strong private `ALTCHA_SECRET` and canonical `PUBLIC_URL`; optionally set independent `EDITOR_SESSION_SECRET` and `CANDIDATE_SESSION_SECRET` values of at least 32 characters. Data Studio has a separate browser session; deploy it on a separate origin if isolating that session is required.

Directus stays at **11.17.4**. The image build verifies exact vendor source before applying the checked deep/geometry/asset guards; unexpected bytes fail the build. Rebuild/recreate Directus to install these guards. Compose disables response caching and TUS and limits transform concurrency. Reload the host nginx configuration as well: it blocks unused Directus GraphQL/hash routes and supplies the fallback security headers. Nuxt supplies the enforced per-response nonce policy. See [remaining work](REMAINING_TODOS.md) for advisory limits and deployment checks.

### Logical core storage migration

The default migration keeps the existing Linux bind-directory cutover. For named volumes, custom bind paths or macOS, explicitly select logical migration:

```bash
./bin/upgrade_core_services.sh development --logical          # inspect only
./bin/upgrade_core_services.sh development --logical --apply  # maintenance and verified restore
# Use production or mac instead of development for those installations.
```

First keep an off-host backup and stop external database/search writers. This exports all non-template databases and roles, verifies restored row hashes, and imports/checks a Meilisearch dump. It activates fresh named volumes only after validation; original mounts and private backups remain intact. Normal start/stop/build scripts load the generated `docker/core-storage/<environment>.compose.json` automatically. **Back up that host-specific directory.** For ad-hoc Compose commands that create containers, include this file after the normal environment files; `docker compose down -v` must not be used as an upgrade step.

Before cutover, failures retain original mounts. After cutover, keep writers stopped if recovery is needed. The private backup includes `rollback.compose.json` with original image IDs and mounts. For inspection/recovery, append that file after the generated storage overlay in the Compose command. Restore the previous host overlay from `previous.compose.json` / `previous.volumes` if present; otherwise remove only the generated host overlay after saving a copy. A rollback to older images also requires restoring the corresponding image configuration before using normal startup again. Never mount a newer database's data into an older image. Do not delete source volumes or the verified backup until the rollout has been accepted.

`npm run test:core:logical` in `bin/test_suite` exercises the real script using disposable databases, spatial rows, roles, named/custom storage and search data. It is explicit and separate from the fast default suite; macOS host execution still needs platform verification.

### Planned credential retirement

Production rotation remains a deliberate operator action after the access split is deployed. The new CLI supports a read-only plan and resumable apply. Run inside Directus with its configured private administrator `CLI_DIRECTUS_STATIC_TOKEN`:

```bash
# From the repository root; select the appropriate Compose files on your host.
docker compose exec -T -e DIRECTUS_URL=http://127.0.0.1:8055 \
  -e PUBLIC_URL=https://www.stadt-land-klima.de directus \
  node /directus/cli/tasks/retireCredentials.ts plan /directus/.tmp/credential-retirement.json \
    --policy /directus/cli/credential-rotation.yaml

# Copy the plan and .links.json to a private off-container backup, review both,
# coordinate replacement invitations, and pause credential-issuing writers first.
docker compose exec -T -e DIRECTUS_URL=http://127.0.0.1:8055 \
  -e PUBLIC_URL=https://www.stadt-land-klima.de directus \
  node /directus/cli/tasks/retireCredentials.ts apply /directus/.tmp/credential-retirement.json \
    --policy /directus/cli/credential-rotation.yaml
```

Review [credential-rotation.yaml](src/directus/cli/credential-rotation.yaml) first. It contains references and decisions, never secret values. Its selected policy revokes the legacy Frontend identity and explicitly retains both candidate access tokens and low-sensitivity municipality preview links, per the owner decisions. `review` and `retain` skip execution. A later change of either family to `rotate` requires a new owner decision and coordinated replacement links. Other credential families are manual operator decisions; their `rotation_interval_days`, `last_rotated_on`, `next_review_on` and owner fields are planning metadata, not scheduled automation. Leave unknown production dates null; do not record rotation until it actually happens.

Both commands require `--policy`. Inside the Directus container, existing database credentials resolve concealed static user tokens through identity-bound read-only lookups, so token drift is checked against the real value. Plans are version 2, bound to the selected families, instance, website and selected credential inventory. Changing the selected scope before apply rejects the plan before writes; old version 1 plans must be regenerated. Unselected credential collections are not read or modified. Retiring the legacy account before deploying the access split can break the currently deployed website.

The plan is mode 0600 and may contain new bearer credentials; do not commit, publish or attach it to logs. Applying suspends only selected legacy Frontend-role accounts and rotates only selected candidate/preview families, then clears the CMS cache when credentials were in scope. Re-running the same plan resumes a partial failure. It does not change Frontend-Server/Public accounts, rotate external provider/environment secrets or send email. No replacement candidate invitations are required by the selected policy. Verify search reconciliation separately.

### Frontend node-forge backport

The current registry has no fixed node-forge release for CVE-2026-85393. Frontend `npm ci` applies a source-hash-verified backport; the build/typecheck gate runs `npm run security:check` and refuses an unpatched or unexpectedly modified installation. If lifecycle scripts were intentionally disabled, run `node scripts/patch-node-forge.mts` from `src/frontend` before building. Do not edit dependency files manually or spoof a version to silence audit: raw npm audit still reports seven high graph entries. Track upstream replacement and evidence in [the hardening follow-up](SECURITY_HARDENING.md#frontend-audit-backport-and-formatting-follow-up).

### Security branch deployment

Use [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for the ordered server procedure and [SECURITY_DECISIONS.md](SECURITY_DECISIONS.md) for the origin-risk explanation, Directus options, credential inventory and node-forge replacement paths. `start_production.sh --import` imports before starting the frontend; `--prepare-only` leaves the frontend stopped for setup. The updater uses the ordered import automatically. The maintenance service is an nginx fallback, not a general traffic gate. Directus can remain reachable during operator setup.

`provisionServiceUsers.ts` resolves all three roles/users before writes, creates missing Frontend-Server/Public/Preview identities and reuses strong existing tokens. It refuses conflicting or disabled accounts instead of silently assigning new roles or rotating tokens. Service emails use the owned `stadt-land-klima.de` domain because Directus rejects reserved `.local` addresses. On reruns, its administrator API conceals tokens; the container CLI recovers an existing token through a read-only database query bound to the checked user, role, email and active status. Redirect output to a private mode-0600 file. Set the private server and preview-verifier tokens in `src/frontend/.env`; the public-asset identity currently has no frontend consumer. The example environment no longer advertises the retired browser token.

### Database application-role cutover

The commands use `slk_compose` and the private `slk_private` directory defined in step 1 of [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md). Keep the same operator shell.

Rehearse this on a restored staging copy, including the real schema import and normal backup/restore. The tool has an isolated spatial/DDL regression test; that does not prove every production extension's requirements.

```bash
./bin/harden_database_role.sh production plan "$slk_private/database-role.json" slk_app
# Review this private plan locally. It contains the generated password.
"${slk_compose[@]}" stop frontend directus
./bin/harden_database_role.sh production apply "$slk_private/database-role.json"
```

Keep PostgreSQL running and close other SQL clients. Plan performs no database writes. Apply rejects other connections, existing target roles and inventory/instance drift; role creation and ownership changes are transactional. It supports the reviewed public-schema layout, leaves extension/bootstrap/database ownership alone, removes public schema CREATE from PUBLIC, and gives the new non-superuser ownership of application objects for normal imports/migrations. It is not a split between separate runtime and schema-migration identities.

Copy the two values from `database-role.json.env` into **`src/directus/.env`**. Keep **`docker/db/.env`** as the separate bootstrap operator. Changing those bootstrap environment values does not rotate the actual PostgreSQL account. If its old password was shared/exposed, rotate it separately: open `"${slk_compose[@]}" exec db sh -ec 'exec psql -U "$POSTGRES_USER" -d postgres'`, run `\password`, then `\q`, and privately update `docker/db/.env` to match. Do not put passwords in shell command arguments/history. Restart Directus and rerun the import using the new app login:

```bash
./bin/start_production.sh --import --prepare-only
```

Do not rerun apply after success; it intentionally refuses to overwrite an existing role. Keep the plan/snippet private for controlled recovery. An unexpected schema/owner is a stop-and-review condition, not a reason to grant SUPERUSER back to the application.

The tool uses the existing Directus DB configuration to connect as the bootstrap superuser. It is an explicit operational role/ownership migration, not a replacement for YAML schema/permission imports. It accepts only a new role, binds the plan to the PostgreSQL cluster/database/operator/catalog inventory, refuses active clients and custom mixed-owner/non-public application layouts, and preserves PostGIS extension members. Empty extension-support schemas are retained. The app owns its tables/types/routines and can perform migrations but cannot create databases/roles, replicate or bypass row security. A separate runtime-versus-migrator identity is not implemented. Check custom SQL audit systems separately: the tool disables ordinary statement/duration logging for its password statement, but cannot control external audit capture.

`npm --prefix src/directus/cli run test:database-role` runs a disposable PostgreSQL/PostGIS container and checks read-only planning, instance/schema drift, active-client rejection, atomic rollback, generated/serial IDs, spatial data, app DDL and denied cluster administration. It also verifies the bootstrap can still dump the database. It is opt-in and takes a few seconds locally. The normal CLI suite covers deployment ordering and backup/restore operator/overlay selection. Full existing-data Directus startup/import and backup restoration on the target remain staging acceptance.

### Tailwind 4 / DaisyUI 5

The frontend uses Tailwind 4.3.3 with `@tailwindcss/vite` and DaisyUI 5.7.50. The CSS entry `src/frontend/assets/css/main.css` owns plugins, custom themes, dark mode, source scanning and runtime rating sources. Shared colors/fonts/typography remain in `tailwind.config.js`, explicitly loaded via `@config`; there is no ignored JS safelist or second Tailwind PostCSS pipeline. Keep brand green `#AFCA0B`, distinct `ff-green`, and the persisted theme IDs unchanged.

Use `npm ci` independently on each local machine and in the server container. Native compiler packages are optional platform dependencies; never use `--omit=optional` or copy `node_modules` across operating systems. The browser floor is Safari 16.4+, Chrome 111+ and Firefox 128+; native macOS/Windows execution still requires target acceptance. A CSS-only deployment needs a frontend rebuild/recreation, with templates/configuration/manifests/lockfile deployed together; it needs no Directus upgrade/import.

`npm --prefix bin/test_suite run test:styles -- http://localhost:8080` is the explicit light/dark desktop/mobile style/interaction gate. Select another installed engine with `TEST_STYLE_BROWSER=firefox` or `webkit`. The default unit suite separately compiles the real stylesheet and checks dynamic rating classes, theme IDs, optional bindings and persisted editor variants. See [test-suite instructions](bin/test_suite/README.md) for production HTTPS and engine setup.

## Security release verification

The pinned Directus 11.17.4 image applies exact-source guards and locked dependency replacements. Rebuild it when the security layer changes. `npm --prefix bin/test_suite run test:security:image` exercises the actual image without application database writes; `audit:directus-image` preserves raw advisory output, while `audit:directus-image:reviewed` additionally requires exact current dispositions, configuration controls and passing vendor regressions. The review expires on 2026-11-24; new advisories or an expired review fail the reviewed gate. CI archives raw image reports.

`.github/workflows/quality.yml` runs PR quality/extension/image gates. The manually triggered deployed acceptance workflow uses read-only public/CSP/style checks and requires a real search result. Keep the explicit full writable HTTPS suite on isolated fixtures. Follow [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for credentials, database roles, proxy configuration and actual target acceptance; [REMAINING_TODOS.md](REMAINING_TODOS.md) separates those actions from optional later improvements.

## Newsletter SMTP routing on staging

The newsletter service is operated separately from this repository in
`/home/deploy/newsletter/docker-compose.yml`. Its `app` service needs this mapping
so the SMTP hostname reaches the host's published mail listener rather than
loopback inside the listmonk container:

```yaml
extra_hosts:
  - "mail.stadt-land-klima.de:host-gateway"
```

This was applied on 2026-10-25 after signup requests failed with HTTP 502 and
listmonk logged `dial tcp 127.0.0.1:587: connect: connection refused`. The SMTP
hostname and credentials stay in listmonk settings. TLS verification remains
enabled. Only the newsletter app was recreated, retaining the same image.
Container connectivity and SMTP TLS/authentication were checked without sending
mail. A private Compose backup is retained alongside the service configuration
as `docker-compose.yml.before-smtp-routing-20261025T092239Z`.

## Search and messenger previews

Set `PUBLIC_URL` to the externally reachable website origin when building the frontend (currently `https://future.stadt-land-klima.de`; later `https://stadt-land-klima.de`). An existing build can use `NUXT_PUBLIC_SITE_URL` as a runtime override. Canonical links, Open Graph URLs, robots.txt and sitemap.xml use this configured origin instead of incoming host headers. `CLIENT_DIRECTUS_URL` must be a publicly reachable CMS URL or same-origin path so anonymous crawlers can fetch published preview images.

Public pages render their title, summary and image in the initial HTML. Detail pages reuse the checked public CMS excerpts; missing excerpts use localized defaults. The existing logo is the fallback image. SEO copy lives in `src/directus/translations/{de-DE,en-GB,it-IT}/seo.*.yaml`; after edits, run `npm run translations:generate` in `src/frontend` and the normal Directus YAML importer. The generated fallback keeps metadata available before import or during a translation outage. No additional public CMS permissions are needed. Candidate-token and editor-preview pages use noindex and omit canonical/social URLs.

Run `npm run test:seo -- http://localhost:8080` in `bin/test_suite` for SSR metadata tests, anonymous image requests, configured robots/sitemap checks and hydrated navigation. Messenger services may retain old preview data after deployment; verify a newly shared URL and refresh the service's preview cache where supported.
