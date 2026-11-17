# Production host installation and verification

Application releases come from a clean Git checkout and the private frontend,
Directus and host dotenv files. Images and generated frontend output are built
artifacts; database content, paid translation memory/usage, uploads, certificates,
SSH keys and Restic data remain persistent state. Do not delete or reset them to
make a host appear clean. Installed executable/configuration copies must be
derivable from reviewed Git source, with no handwritten hotfix dependency.

The retained-datastore profile deliberately starts the existing database, cache
and search containers without upgrading or recreating them. It is appropriate
for production's existing native-secret datastore transition, rather than fresh
host/database provisioning. Requirements: Linux x64, rootless Podman, the existing
unprivileged deployment account and its user systemd manager/linger, AppArmor,
Caddy with the modules built by `caddy/Containerfile`, Restic and an initialized
encrypted repository. Existing Caddy certificates/ACME storage and private Restic
SSH credentials must be restored separately on a replacement machine.

## Private configuration

Install `podman/host.env.example` as root-owned mode 0600 at
`/root/.config/slk/host.env`, preserving the existing secret files it references.
Its application dotenv is owned by the deployment user (0600). It supplies the
existing `SLK_PODMAN_PROJECT`, `SLK_DEPLOYMENT_TARGET=production`, release tag and
frontend/Directus dotenv paths. Web/CMS ports default to 9000/9001; explicit
`SLK_PODMAN_WEB_PORT` and `SLK_PODMAN_CMS_PORT` are respected by the boot unit.
Configuration is parsed as dotenv data, never evaluated as shell code.

The root-only backup dotenv contains `RESTIC_REPOSITORY` and
`RESTIC_PASSWORD_FILE`; its other entries are not injected into the process.
Retain its existing password file, SSH key and host-key verification. The installer
does not modify secrets, application dotenv files or translation controls. Keep
the approved production limits (1,000,000 total / 500,000 daily) in the private
Directus dotenv. Target languages are durable private CMS job configuration;
English is the code default. Verify `targets: ["en-GB"]` and effective limits with
the existing [translation operator controls](../DYNAMIC_CONTENT_TRANSLATION.md).
Never recreate the usage/cache tables or enable generation locally for this work.

## Review, install and verify

After the PR is merged, deploy that exact merged revision with the existing
`slk release` protocol as the deployment user. Never edit tracked server files.
For privileged host installation use a **root-owned, reviewed checkout** of that
same revision, rather than executing a deployment-user-writable checkout as root.
A root-owned clone made with `git clone --no-hardlinks` is suitable; check out the
expected merged SHA explicitly. Install the CLI's locked dependencies with
`npm ci --prefix bin --ignore-scripts` in that checkout.

Use Node from `.node-version` (24.22.3). The installer checks the reviewed Linux x64
binary SHA-256 before copying it into `/usr/local/lib/slk/node`. The official
`node-v24.22.3-linux-x64.tar.xz` archive hash is
`4f2b175a6d53a5c617a80dba2676238a0688cef28c6da4eba35c7d844e66fcfb`;
the extracted `bin/node` hash is
`a7ec1b37e6ff9d187e4198c5b6df9a4eb1c74dd31804fb3bac55cc4ceca1ac01`.
Both pins live in `bin/cli/host-maintenance.ts` and must change with the reviewed
runtime version. This installer does not download or execute an unverified runtime.

From the root-owned checkout, using that Node version:

```bash
./bin/slk host plan --config /root/.config/slk/host.env --node-binary /root/node-v24.22.3-linux-x64/bin/node
./bin/slk host install --config /root/.config/slk/host.env --node-binary /root/node-v24.22.3-linux-x64/bin/node
./bin/slk host verify --config /root/.config/slk/host.env
```

`plan` is read-only. `install` requires a clean checkout, excludes a concurrent
backup using its existing lock, copies reviewed files with explicit ownership and
modes, retires `/usr/local/sbin/staedtechallenge-backup`, reloads systemd definitions
and enables the existing nightly timer and application boot service. It writes
the user unit as the deployment account. It does not start/restart application or
data containers, reload Caddy/AppArmor, execute a backup or contact DeepL.

`verify` also requires a clean checkout and returns nonzero on byte/owner/mode
drift, unexpected helper files or a remaining legacy backup entrypoint. JSON reports contain revision, paths, hashes
and match results, without dotenv contents. The installed files comprise:

- `/usr/local/lib/slk/node` and five standalone TypeScript backup/retention helpers;
- the backup service and timer, plus the deployment user's application boot unit;
- `/etc/apparmor.d/slk-rootless`;
- Caddy's service, production entrypoint and five imported configuration files.

After installation, explicitly validate/reload Caddy with its existing service
environment and AppArmor during the approved deployment. Verify both systemd
timers/units and public read-only acceptance, installed file hashes, OCI revision
labels and effective CMS/translation configuration. Confirm the next nightly job
and remote snapshot/read-back separately; unit tests cannot attest cloud storage.
Production verification still requires deployment authorization.

Archive necessary private evidence off-host, then remove obsolete diagnostic JS,
source-transfer bundles and temporary override files introduced during incident
work. Check `git status --porcelain`, `slk host verify` and the effective container
mounts/commands. Preserve unrelated pre-existing monitoring units and operating
system files. Generated systemd enablement links, logs and release/backup records
are expected host state, rather than manually maintained application code.

## Optional central logging

Set `SLK_HOST_LOGGING_CONFIG` in the private root-only host dotenv to opt in to
reviewed Alloy journal forwarding. The installer then checks the packaged Alloy
version/account and private settings/credential permissions, installs the Alloy
configuration, hardened service and bounded persistent-journal drop-in, and
includes them in the usual content/owner/mode verification. It enables the
collector for boot without starting it or restarting journald. Existing hosts
without this option keep their current manifest. Removing the option does not
silently retire installed collection; explicit retirement is required.

Follow [central logging](CENTRAL_LOGGING.md) for monitoring-server configuration,
private credential provisioning, activation and canary/outage acceptance. Compare
[component alternatives](LOGGING_ALTERNATIVES.md) before choosing durability
requirements. Existing application/data/backup installation behavior is preserved.

## Regression coverage

`bin/cli/host-maintenance.test.ts` covers rejected unsafe settings, private dotenv
and symlink rules, installed-content/mode drift, retained-datastore unit generation,
complete helper dependencies, failed cloud operations blocking local cleanup and
corrupt dumps preserving the previous validated archive. `caddySecurity.ts`
validates the production entrypoint with the other profiles in a disposable Caddy
container. Actual root installation, systemd activation/reboot, cloud transport,
certificate renewal and deployed application behavior require host acceptance.
