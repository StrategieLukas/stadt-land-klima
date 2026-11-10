# Full Docker production export

`bin/full-export.sh` preserves the production backup workflow previously run from
`/tmp/slk-prod-backup.XXXXXX`. It is a Bash script and uses the existing Docker
Compose/storage selector and application SQL exporter. It needs no Node runtime.
The separate `portable-backup.ts` tool also supports Podman; this script targets
the original **Docker** deployment.

## Run on the source host

First put the public gateway in maintenance and pause scheduled jobs, external
writers, restart automation and deployments. The script does not manage nginx,
Caddy, systemd, cron or other hosts. Then run as the account with local Docker
access (and sudo permission to read database-owned files):

```bash
./bin/full-export.sh --writers-stopped
```

The checkout is resolved from the script location, so it works from any working
directory. It creates `backups/full-export-<UTC timestamp>-<random>/` inside that
checkout. Choose a new destination explicitly with `--output backups/NAME`.
Destinations must stay under this checkout's `backups/`; existing backups cannot
be overwritten. Concurrent exports are rejected by a lock in `backups/`.

Host files outside the checkout must be included explicitly, for example:

```bash
./bin/full-export.sh --writers-stopped \
  --config nginx=/etc/nginx/sites-available/stadt-land-klima.de \
  --config host=/path/to/private/host.env
```

Add other gateway snippets, certificates or integration configuration as needed.
Files are copied without executing them. Remote object-storage upload locations
and custom PostgreSQL tablespaces require separate backup plans and are refused.
This does not back up external SMTP, newsletter or other remote services.

The script checks existing source containers before changing their state. It
stops frontend/Directus before cache/search, starts **the existing DB container**,
waits for readiness and exports SQL before stopping PostgreSQL cleanly. No
`compose up`, pull, build, image change, container creation or upgrade is performed.
It loads an existing `docker/core-storage/production.compose.json` overlay through
the common selector. It disconnects stdin itself, preventing Compose commands
from consuming an operator's shell program.

**Application/data services remain stopped on success.** On failure the script
reports the stage, line and private output directory and never automatically
restarts services. Inspect their state before using the normal startup workflow;
keep maintenance enabled until the restored/live site has passed acceptance.

## Contents and verification

- `directus.sql`: the existing application SQL export.
- `postgres-all.sql.gz`: logical export of all databases, roles and role password
  hashes. Both SQL exports use the container-local bootstrap operator.
- `checkout-and-data.tar.gz`: the actual checkout, including Git metadata, local
  source edits/deletions, env files, built extensions, uploads and bind-mounted
  database/search data located inside it. ACLs, xattrs and numeric ownership are
  recorded. Backup/report directories, dependency trees, frontend `.nuxt`/`.output`
  and numbered core dumps are excluded.
- `frontend-output.tar`: the contents of `/frontend/.output`, captured separately.
- `mount-N.tar` and `mounts.tsv`: actual named/anonymous volume and external bind
  contents. This includes Redis `/data`, migrated database/search volumes and
  external uploads when present. Each archive contains the destination basename;
  restore it into the destination's **parent**, using the TSV mapping. Generated
  mounts excluded from the checkout tar are captured separately too. tmpfs is
  transient and excluded.
- `images.tar`, `images.json`, `containers.json`, `containers.txt`: the exact project
  images and private runtime metadata, including maintenance containers when
  present. Image bytes are saved, rather than just listing image names/digests.
- `git-commit.txt`, `git-status.txt`, `database-image.txt`, `project.txt`: source
  identification. Optional Git index locks are disabled so a root-run backup does
  not rewrite the deploy user's Git index.
- `config-*`, `configs.tsv`, `errors.log`, `RESTORE.md`, `SHA256SUMS`: extra private
  configuration, diagnostics, these instructions and checksums. `SHA256SUMS` is
  published only after all stages, archive checks and final source-state checks
  succeed. A failed export is retained for diagnostics and has no completion marker.

All new output is private (directory 0700, files 0600). When run as root, output
ownership is assigned to the checkout owner, without altering the source files.
The bundle contains credentials, personal data and potentially TLS private keys.
Keep it encrypted in your existing private off-host backup storage. After copying
**the entire directory**, verify it on the destination:

```bash
cd /path/to/copied-export
sha256sum --check SHA256SUMS
```

Checksums and archive listings detect corruption/incomplete transfers; they do not
prove a restore or authenticate an untrusted bundle. Capture and restoration on
real production-shaped storage remain operator acceptance checks.

## Restore on a different host

Use a fresh isolated target, empty storage and a trusted verified export. Keep
public traffic and outbound delivery/jobs disabled until acceptance. Do not
extract into or restore over an existing deployment. Containers and images contain
executable code; inspect private metadata without publishing its credentials.

1. Extract the checkout archive into an empty directory. The snapshot already
   contains `.git` and the actual working tree; do not overlay it onto a separately
   checked-out commit, which could reintroduce deleted source files. Review
   original paths, ownership and modes. GNU tar needs `--acls --xattrs` to restore
   that metadata; preserve numeric ownership only when target UID/GID mappings
   intentionally match the source. Use `--no-same-owner` for source/user files
   when adapting accounts, and set service data ownership for the target users.
2. Load `images.tar` with `docker load -i /path/to/images.tar`. Match image IDs to
   target image tags using `containers.json` and `images.json`; do not pull newer
   images during recovery. Saved images require the same supported CPU
   architecture. Provide the documented engine/host prerequisites separately.
3. Adapt target project names, host bind paths, private `config-*` paths and
   `docker/core-storage` overlays. Create new target volumes; never reuse original
   host-specific names blindly. For every `mounts.tsv` row, extract its archive
   into the intended empty destination parent, preserving file modes and setting
   ownership for that target service. Restore `frontend-output.tar` into the empty
   frontend output directory. Do this while target services are stopped.
4. Choose **one** PostgreSQL recovery path. A cold data-directory restore needs
   the original compatible PostgreSQL/PostGIS image, extensions and ownership.
   Never start newer raw data with an older server or treat cold restore as a
   major-version upgrade. Alternatively restore the logical SQL into a fresh
   compatible cluster providing the required extensions. Use a unique temporary
   bootstrap operator/scratch DB to avoid role conflicts with `pg_dumpall` output,
   then feed the decompressed SQL to `psql -X -v ON_ERROR_STOP=1`. Handle pre-created
   target databases and source connection/ownership statements explicitly in a
   reviewed working copy; retain the original dump. `directus.sql` is an alternative
   application-only export and includes cleanup statements—do not apply both
   database exports to the same restored data.
5. Search/Redis cold data require their captured versions. Preserve signing,
   database, service and search keys. Source dependencies excluded from the archive
   can be reinstalled from lockfiles when needed; Docker Directus's normal startup
   installs CLI dependencies and therefore requires network access. Changed
   frontend build inputs/environment can require a normal output rebuild too.
   This is a portable application/data backup, not a complete offline host image.
6. Verify database schemas, extensions, ownership/grants, row counts, sequences and
   logins; uploads against CMS file references; search documents/settings/keys;
   Redis/session state; frontend output; editing/publishing/PDFs; and integration
   destinations. Only then enable delivery/jobs and public traffic. Keep the
   original source and verified export until the recovery is accepted.

Automated fixture tests exercise the shell orchestration, stdin isolation,
existing-container/overlay selection, cold bind and named-volume archives, saved
images, config copying, corruption checks, failure markers and restart detection.
They use a fake Docker engine and real tar/gzip/checksum operations. A live
PostgreSQL restore, image load and cross-host ownership rehearsal remain manual.
