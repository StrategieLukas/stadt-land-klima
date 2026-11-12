# Directus configuration CLI

The maintained CLI targets the project's pinned Directus **11.17.4**. It runs
inside the Directus container with the private `CLI_DIRECTUS_STATIC_TOKEN`.
Architecture, role boundaries and version decisions are in
[PROJECT_DECISIONS.md](../../../PROJECT_DECISIONS.md).

## Import and export

For normal code-first application configuration use the repository launcher from
the root (include the actual environment/storage overrides when necessary):

```bash
./bin/podman.sh development compose exec directus /directus/cli/import-all.sh
```

That launcher checks types, preserves/transfers supported legacy tour data before
schema removal, imports configuration in order, installs translation outbox
triggers and seeds maintained native content idempotently. Keep those preflights
for fresh/restored databases. The raw `import:all` command does not include these
application-specific steps.

Inside the container, inspect commands and defaults with:

```bash
./directus-cli --help
./directus-cli import:all --help
./directus-cli export:all --help
```

| Command                                        | Purpose                                                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `import:all [src]`                             | Sequential schema, policies/roles, flows, presets, translations, settings and dashboards; defaults to the current directory. |
| `export:all [dest]`                            | Export portable configuration to the selected base directory.                                                                |
| `import:<kind> [src]` / `export:<kind> [dest]` | Work with schema, policies, roles, flows, presets, translations, settings or dashboards individually.                        |
| `import:roles-and-policies [src]`              | Import policy definitions before attaching them to roles.                                                                    |
| `auth:set-token`                               | Configure the CLI administrator credential.                                                                                  |

Policies contain permissions; roles reference policies by their exact names.
Role parent/children references also use names rather than instance UUIDs. New
website access belongs in the scoped private service policy plus a checked Nuxt
route; never broaden public-role permissions. A missing policy means import order
or references need fixing, not that permissions should be granted elsewhere.

Options depend on the command; use its `--help`:

- `-v`, `--verbose`: additional progress.
- `-f`, `--force`: overwrite existing entries where supported.
- `-r`, `--remove-orphans`: remove entries absent from input; review the source
  inventory first. Missing/malformed source directories fail rather than erase data.
- `-c`, `--clear`: clear exported files where supported. Policy exports always
  clear their YAML destination first; use a dedicated export directory.

Example role file:

```yaml
name: Editor
icon: edit
parent: null
children: []
policies:
  - Editor Policy
```

Exports/imports validate YAML shapes and resolve operation references/layout
coordinates. Mutations are awaited and failures propagate. Multi-request imports
are not universally transactional; keep recoverable backups before applying a
configuration snapshot.

Runtime mounts are read-only. Set a token through authenticated CMS administration
and edit the private host dotenv file for container deployments. `auth:set-token`
requires a writable local `.env` and refuses before rotating the account when it
cannot persist the result; it is not a writer into a read-only runtime mount.

## Development and checks

Implementation is TypeScript; `index.mjs` is the minimal executable bootstrap
using the locked tsx runtime. Mounted source changes are available inside the
container. Install with `npm ci --include=dev`.

```bash
npm run typecheck
npm test
```

The compiler checks strict NodeNext and source inclusion; `build` enforces that
gate. Tests cover commands, failure propagation and negative compiler/build probes.
`test:integration`, `test:tour-migration` and `test:database-role` require disposable
CMS/database environments. Run writable fixture profiles serially. Container
startup/import orchestration refuses compiler failures before administrative work.

## Migrating rating catalogues

`node index.mjs migrate <old> <new>` prompts before copying ratings between
published measures with the same stable measure identifier and local team. For
measures requiring a new rating, it carries only internal notes, current progress
and sources; otherwise it carries the full assessment. A source becomes a draft
only after the matching destination copy is confirmed.

Back up the database first. The migration checks all matches before writes and
refuses missing or ambiguous destinations and conflicting existing work. Archived
sources remain unchanged. Updates check the original rating snapshots to detect
edits during the migration. A failure stops the run and reports safe record IDs
and confirmed counts; review those records before retrying. A retry preserves
populated destinations with the same research when their sources are already
drafts. There is no cross-request transaction: an interrupted run can leave a
confirmed destination copy with its source still published, which a retry can
finish if the destination still matches. Keep editing paused during migration.

Run `npm test` for compiler, source-coverage, migration regression and CLI gates.
