# One-command production updates

Run from the repository root as the **deploy** user:

```bash
./bin/slk release update --env production
```

`slk deploy update --env production` is an alias. Neither command deploys a
feature branch: merge the desired changes into `origin/main` first. No per-release
tag, previous revision, manual YAML import or restart command is needed.

The updater automatically uses the sole private `~/.config/slk/production.env` or
legacy `~/.config/slk/future.env`. The filename `future.env` does not select the
retired environment: its explicit `SLK_DEPLOYMENT_TARGET=production`, project,
ports and environment-file paths remain authoritative. If both files exist,
select one explicitly:

```bash
./bin/slk release update /home/deploy/.config/slk/future.env --env production
```

## One-time installation

Merge the updater into main. Update the deploy checkout to that reviewed revision
once and install its CLI dependencies with `npm ci --prefix bin`. The first
checkout must preserve the ignored private dotenv files; never copy examples over
them. Subsequent invocations fetch, fast-forward main and install CLI dependencies
automatically, including when starting from a detached release checkout.

The cloud backup credentials remain root-only. From a clean, reviewed **root-owned
checkout**, update the existing reproducible host installation once:

```bash
./bin/slk host plan --config /root/.config/slk/host.env
./bin/slk host install --config /root/.config/slk/host.env
./bin/slk host verify --config /root/.config/slk/host.env
```

Use the actual root-only host configuration on other hosts. Do not run deployment
user writable source as root. The installer provides the standalone root-owned
release backup helper and a sudo rule allowing only:

```text
/usr/bin/systemctl start slk-release-backup.service
```

It grants no shell, arbitrary systemd unit, root execution of checkout code, or
read access to backup credentials. The fixed service validates a private release
request and the exact checkpoint payloads. The installer checks its sudoers file
with `visudo` before installing it. Existing Restic storage must already be
initialized. An unavailable helper or permission fails the update before changing
the running applications.

Use the pinned Node runtime and Git 2.38+. The updater can re-execute the matching
installed `/usr/local/lib/slk/node` or user-local Node binary automatically.
Production needs its existing rootless Podman/systemd/AppArmor setup. Preflight
requires 8 GiB free image-store space, 512 MiB available RAM and 4.5 GiB
available RAM plus swap before starting. No datastore image upgrade is part of an application
update.

## Update sequence

1. Run host preflight and start a journalled user service with an exclusive project
   update lock. The job survives an SSH disconnect. `KillMode=process` preserves
   application monitors when the runner finishes.
2. Fetch `origin/main`. Require a clean working tree, a fast-forwardable local main,
   no tracked private dotenv files, and refusal of main that is strictly older than the deployed revision. Squashed PRs
   and rebases are supported: approved main is authoritative, and deployed source
   is archived before switching.
3. Capture the actual configured application database, representative table counts,
   uploads, active frontend output, deployed source revision, private environment
   files, host config and application boot unit. Existing checkpoints are never
   overwritten. Row-count changes during the dump require a retry.
4. Ask the fixed root-owned service to back up that checkpoint to encrypted remote
   Restic storage and read back every payload to verify its checksum. Credentials
   never enter the deploy process. Keep five release snapshots in the separate
   `<application-tag>-release` scope, independently of the five nightly snapshots.
5. Restore the checksum-identical dump into a randomly named temporary database,
   compare municipality/election/paid translation-memory counts with the captured
   baseline, then drop only that temporary database. This automates verification
   of the off-host backup's exact bytes; periodic disaster recovery on a separate
   host remains an operator responsibility.
6. Check out and fast-forward main, synchronize submodules, install locked CLI
   dependencies and rebuild runtime images only when their tracked build inputs
   changed. Build/stage application images and fingerprinted frontend output while
   the old application keeps serving requests. The separate frontend builder has
   a 4 GiB memory / 8 GiB total memory-and-swap budget and a 3 GiB Node heap by
   default; `SLK_FRONTEND_BUILD_MEMORY_LIMIT` and `SLK_FRONTEND_BUILD_SWAP_LIMIT`
   configure its resource limits independently of the serving frontend.
7. Activate through the existing release coordinator: maintenance, saved previous
   output, application container replacement, YAML import, translation-worker
   provisioning, output switch and runtime audit. PostgreSQL, Redis and
   Meilisearch containers remain running.
8. Check real CMS-backed public JSON APIs through both loopback and the configured public HTTPS origin, plus both running revision labels. Application
   activation failures invoke the existing rollback; a failed post-activation read
   or revision check also rolls the application back. Backups remain available for
   operator-led database recovery; application rollback does not reverse arbitrary
   schema migrations.

An already deployed main revision is a no-op apart from selecting main. Runtime
dotenv edits still use `slk stack restart frontend directus --env production`
under the selected host environment; they do not require a Git release.

## Progress and recovery

The command prints its user service name. Follow that job with:

```bash
journalctl --user -u SERVICE_NAME -f
```

Checkpoints and `stage.ok`, `activate.ok`, `rollback.ok`, `update.ok` records are
under `~/.local/state/slk-releases/release-REVISION/`. Failures retain their logs
and backups. Re-running uses a new revision-prefix tag rather than overwriting an
earlier attempt. Failed fetches, backup verification or builds do not stop the
live application. Never create `backup.verified` manually to bypass a failed
automatic check.

After changing runtime pins or root-owned backup code, update the reviewed host
installation as required. The updater does not grant itself new host privileges,
upgrade datastores, change gateway policy, or rewrite root-owned host services.
