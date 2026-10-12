# Stadt.Land.Klima!

## Wichtige Dokumente

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
- If there's a docker permission issue, chmod 777 everything :(
  - This applies specifically to PDF generation as well. At least the typst directory under /directus/extensions (not to be confused with directus-extensions-not-build) must be 777 for PDF generation to create files.
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
suite remains `./test_dev.sh` from `bin/`.
