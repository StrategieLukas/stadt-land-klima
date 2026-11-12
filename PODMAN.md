# Podman deployment

Podman is the only maintained container engine. Caddy is the selected gateway and
maintenance server. Security/version decisions live in
[PROJECT_DECISIONS.md](PROJECT_DECISIONS.md); source changes do not migrate or
remove existing private databases, uploads or backups automatically.

## Host requirements

Use a dedicated non-root Linux deployment account with Podman 5.4+,
`podman-compose` 1.6+, Node 24.22.3+, `curl`, `flock`, subordinate UID/GID ranges,
`newuidmap`/`newgidmap`, Netavark/Aardvark DNS and delegated cgroup-v2 memory/PID
controllers. Production requires effective AppArmor or SELinux confinement and
seccomp. Rootless Podman on this AppArmor host reports no effective LSM support;
development accepts a verified AppArmor-enabled kernel, while production
preflight still refuses this host until effective or verified inherited confinement
is configured. This development exception does not certify
production confinement. The image's
Typst binary currently targets x86_64. Native macOS/Windows/Podman-machine support
is not established by this Linux deployment.

An administrator installs the host packages, provisions subordinate ranges and
enables account lingering for unattended boot. `doctor` validates capabilities;
it does not escalate privileges, disable confinement, expose an engine socket or
modify host ownership. Runtime containers are capless, non-root and read-only;
production code is read-only and cannot be edited by the runtime account.

## Private runtime configuration

From the repository root, create and privately configure:

```bash
cp podman/database/.env.example podman/database/.env
cp podman/meilisearch/.env.example podman/meilisearch/.env
cp src/directus/.env.example src/directus/.env
cp src/frontend/.env.example src/frontend/.env
chmod 600 podman/database/.env podman/meilisearch/.env src/directus/.env src/frontend/.env
npm ci --prefix bin
npm ci --prefix src/directus/cli
```

Use the actual database accounts, canonical/public CMS URLs, private scoped tokens
and unique signing secrets. Never commit real dotenv files. Optional
`SLK_PODMAN_DB_ENV_FILE`, `SLK_PODMAN_MEILI_ENV_FILE`,
`SLK_PODMAN_DIRECTUS_ENV_FILE` and `SLK_PODMAN_FRONTEND_ENV_FILE` select alternate
absolute private files. Symlinks and shared file permissions are rejected.

The wrapper generates a private Compose overlay containing read-only mount paths,
not credential values. Database and search load their own files. Directus and
frontend load their own file followed by the shared Meilisearch file. The static
`slk-env` entrypoint rereads them at each start and exec; no shell expressions are
evaluated. The selected application file also masks `/frontend/.env` or
`/directus/.env` read-only, so library dotenv readers see the same configuration.
Keep file modes 0600 or 0400. Runtime files never enter image contexts
or the frontend builder. The builder emits secret-free runtime defaults.

After editing application dotenv values:

```bash
./bin/slk stack restart --env production frontend
./bin/slk stack restart --env production directus
./bin/slk stack restart --env production meilisearch
```

A restart reruns the entrypoint; no rebuild or output re-stamping is needed.
Use `restart` without service names to restart the existing stack. Infrastructure
changes (ports/mount paths/limits/images) require recreation. Editing bootstrap
DB passwords does not rotate persisted database accounts. Rotate the actual
account and its consumers together.

Legacy frontend names such as `PUBLIC_URL`, `DIRECTUS_FRONTEND_SERVER_TOKEN` and
`DEEPL_API_KEY` are mapped to their Nuxt runtime names on every start. Explicit
`NUXT_*` values take precedence. The mapping is in
`src/frontend/shared/runtimeEnvironment.ts`; only declared public aliases enter
browser payloads. Required pinned CMS protections stay locked even if a dotenv
file contains conflicting values. Mutable CORS/provider configuration is reloaded.

Always use the wrapper for credential-dependent interactive commands:

```bash
./bin/slk stack compose --env production -- exec -T directus /directus/cli/import-all.sh
./bin/slk stack compose --env production -- exec frontend bash
```

It reloads mounted files for `exec`, too. Explicit `-e KEY=value` command overrides
are retained. Direct engine exec does not inherit a PID-1 entrypoint's environment.
Do not paste private values into command arguments; use the mounted file instead.

## Build and start

```bash
./bin/slk stack doctor --env production
./bin/slk stack build --env production
./bin/slk stack start --env production --import
```

The build first creates the static env launcher, pinned patched application base
images and reviewed Caddy image, then the service images. Directus stays 11.17.4.
The frontend build-only service runs strict gates and stamps source/output bytes;
it explicitly installs development build tools even under NODE_ENV=production and
receives no private runtime mounts. Normal source/output/runtime drift still
requires a fresh build; changing runtime settings does not.

`start --import` first runs an unpublished core-only CMS helper to import the
YAML before application hooks/custom migrations require those tables. It uses
a valid CLI token or a temporary administrator JWT; it never rotates existing
credentials. The normal service then runs migrations and all startup checks.
Fresh content prerequisites (including the public asset folder and real
catalogue/legal content) still need provisioning or a consistent restored backup.

`start --import --prepare-only` starts the data services/CMS and imports checked
YAML while leaving frontend stopped and maintenance active. Use it on a prepared
or restored database for service-identity setup; startup checks require the real
restricted database role and imported policy configuration. On a fresh production
database, bootstrap/schema and application-role preparation must be completed
before accepting production startup checks. Do not weaken those checks to expose
an unprepared installation.

Development uses `./bin/slk stack build --env development` followed by
`./bin/slk stack start --env development`. Frontend source hot-reloads; dependencies and
Nuxt cache use separate private volumes. Private tmpfs and named volumes use
Podman `:U` to initialize service ownership; host source binds never use it.
Maintenance metadata contains only public analytics settings and is generated in
`$XDG_RUNTIME_DIR/slk-podman/<project>.maintenance-meta.js`, never in tracked source.
Default ports are 8080/8081 in development
and loopback 9000/9001 in production. Override the wrapper's
`SLK_PODMAN_WEB_PORT`, `SLK_PODMAN_CMS_PORT` and
`SLK_PODMAN_MAINTENANCE_PORT` (plus development `SLK_PODMAN_DB_PORT` and
`SLK_PODMAN_HMR_PORT`) together with the gateway configuration when needed.
`SLK_PODMAN_PROJECT` selects the project; do not reuse another deployment's name.

`./bin/slk --help` is the single operational entrypoint. Stack, CMS, database,
extension, deployment and test subcommands share the checked provider. Use
`slk stack maintenance --env production` to activate maintenance before stopping
writers, or `slk stack stop --env production` to stop the entire stack.
Maintenance is a fallback, not an editorial lock. Gate external/CMS writes during
sensitive work.

## Storage and recovery

Database, Redis, search and uploads use Podman-owned private named volumes.
Frontend output is a separate read-only runtime volume. Do not recursively chown
host source or mount an engine socket. The rootless mapping uses each image's
service UID, even when the operator's primary GID differs.

Keep a verified off-host database/uploads/configuration backup before changing
engines or restoring data. Existing legacy engine storage is intentionally left
untouched by this branch. Transfer from a stopped, consistent backup into fresh
Podman volumes; verify rows/spatial data, sequences, roles, search settings/keys,
Redis continuity and uploaded-file checksums before enabling writers. Do not
attach newer database files to older binaries or prune recovery storage/images.

The explicit `slk database upgrade --logical --apply` path restores to fresh named
volumes and activates them only after verification. It saves private recovery
artifacts and `podman/core-storage/<environment>.compose.json`, which the wrapper
loads automatically. It flattens storage overrides into a private runtime Compose
file to prevent Podman Compose from mounting two sources at one destination. Preserve that host-specific directory. A rollback after
accepting writes needs a fresh consistent transfer; starting an old snapshot
would lose new writes. Normal backups retain the separate bootstrap operator.

## Verification and boot

`npm --prefix bin/test_suite run test:runtime-environment` exercises the actual
static launcher and alias/fingerprint boundaries without a container engine.
`podman.test.ts` checks configuration, hostile drift, private files, seccomp,
restart/exec and failure ordering. `test:podman` audits an actual prepared rootless
production stack; run the full writable application profile only on isolated
fixtures. Caddy proxy and maintenance acceptance need the real runtime as well.

Adapt `podman/slk.service.example`, enable the user unit only after a successful
manual release, and verify an actual reboot/logout on the target. Record effective
kernel confinement, resource limits, certificates, real SMTP/provider delivery
and restore/smoke results. A source/unit test pass is not live Podman acceptance.

## Verified inherited AppArmor confinement

### Ubuntu rootless AppArmor

Ubuntu's Podman reports AppArmor unavailable for rootless containers. The maintained
`podman/apparmor/slk-rootless` policy instead confines the engine and all inherited
container processes. An administrator installs it as root-owned mode 0644 at
`/etc/apparmor.d/slk-rootless`, loads it with `apparmor_parser -r`, and creates an
empty, operator-owned mode 0600 file at
`~/.local/state/slk-apparmor-denied` outside the profile. Keep AppArmor enabled.
The wrapper enters the preloaded policy through `aa-exec`; no rootful engine or
policy-loading privilege is granted to the operator.

Preflight verifies the current stacked label, kernel policyfs enforce mode,
root-owned policy bytes against the maintained file, and denial of opening the
otherwise writable canary. Runtime audit checks PID 1's inherited label as well as
the existing capability/seccomp controls. A `mixed` stack is accepted only when
the named policy is independently verified in enforce mode; Ubuntu's additional
unconfined runtime profiles do not remove this policy's restrictions. Engine
mount/network operations remain available; application capabilities, read-only
mounts and the separate syscall policy continue to constrain payloads.

Ubuntu's packaged pasta profile may also need a narrow host override granting
`mr` to `/usr/bin/pasta{,.avx2}` and signals between pasta and the rootless engine.
Retain and reload its existing policy rather than disabling it. Verify a writable
temporary `/tmp` mount permits ordinary files but rejects writing
`/tmp/slk-apparmor-denied` under the inherited policy before deploying. Temporary private mounts use Podman's `U` option to select the service
UID/GID; Docker-style `uid=`/`gid=` options are not accepted by `--tmpfs`.

Install the host tools through your distribution, including `uidmap`
(`newuidmap`/`newgidmap`), rootless networking (`passt`/pasta), and `podman-compose`.
If the distro's Compose provider is older than 1.6, install a supported release
in an isolated `pipx` environment. The wrapper explicitly selects this provider, disables pod grouping, and forces
`engine.remote=false` through a private `CONTAINERS_CONF_OVERRIDE` file. This avoids
the provider placing global `--remote` flags after the subcommand. It needs no engine socket.

Run the stack as a dedicated deployment account with subordinate UID/GID ranges
in `/etc/subuid` and `/etc/subgid`. An administrator must provision those ranges
and, for unattended boot, enable lingering for that account. Keep its checkout,
container storage and private backups inaccessible to other host users. The
account owns the application containers; access to that account grants access to
their environment credentials and volumes.

Copy the four `.env.example` files as described in [README](README.md#development),
replace placeholders and make the real `.env` files mode **0600**, owned by the
operator. Symlinks and group/world access are rejected. The variables
`SLK_PODMAN_DB_ENV_FILE`, `SLK_PODMAN_MEILI_ENV_FILE`,
`SLK_PODMAN_DIRECTUS_ENV_FILE`, and `SLK_PODMAN_FRONTEND_ENV_FILE` can select
private alternative files without changing tracked deployment files.

```bash
npm ci --prefix src/directus/cli
./bin/slk stack doctor --env production
./bin/slk stack build --env production
```

`doctor` fails if required kernel/runtime controls or environment-file permissions
are missing. It does not install packages, change host ownership, disable host
confinement, open a socket, or alter sysctls. Review any host preparation failure
with the administrator; there is no unconfined/rootful fallback.

## Application release coordination

The production-only `slk release` command accepts `backup`, `stage`,
`stage-prebuilt`, `activate` and `rollback` with a private host config, next tag
and previous tag. It retains the upstream release protocol internally in
`podman/release/run.sh`; operators use the TypeScript CLI.

```bash
./bin/slk release stage /private/host.env release-12345678 release-abcdef01 --env production
```

Tags must contain 8–40 lowercase hexadecimal revision characters and match a clean
checkout. Runtime base images are prepared separately; prebuilt application images
need matching OCI revision labels. Staging never replaces the active output.
Activation requires both stage.ok and an off-host verified backup record, starts
maintenance, snapshots the homepage/output, imports YAML, checks the new app and
rolls back once on failure. Guarded homepage rollback preserves authored blocks
and editor drafts. Data-service containers remain running. Temporary volume
overrides are flattened by the shared runtime provider.

Use `./bin/slk backup create --help` for a complete portable recovery bundle;
see [capture and restoration](bin/PORTABLE_BACKUP.md). The release checkpoint and
database-only exporters do not replace that bundle.

For an isolated CMS origin, `slk cms-origin prepare <host.env> <private-state-dir>
<https-origin>` checkpoints private URL/cookie/CORS configuration. `restore`
refuses drift and restores it during release recovery. Retire old-origin
interactive sessions separately through the checked CMS CLI helper; service
identities and candidate/preview tokens stay intact. See the Caddy origin
instructions and PROJECT_DECISIONS.md for the boundary.
