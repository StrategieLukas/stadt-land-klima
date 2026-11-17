# Connect the existing monitoring Quadlets

VictoriaLogs joins Grafana and the ingestion proxy on a dedicated **internal
Podman network**. Grafana uses **`http://slk-victorialogs:9428`**. The default backend
has **no published port**. The application-host Vector configuration remains a
native journal reader; only the monitoring deployment changes here.

```text
Vector on application host ─HTTPS→ Caddy Quadlet ─┐
Existing Grafana Quadlet ────────────────────────┴→ VictoriaLogs Quadlet
                          internal slk-logs network       │
                                              persistent named volume
```

The supplied files are under `podman/logging/monitoring/`. They do not replace your
Grafana/VictoriaMetrics Quadlets or migrate their data. Review the current
[security findings](LOGGING_SECURITY_REVIEW.md) before live activation. No remote
installation is authorized or performed by preparing these files.

## 1. Identify the existing Podman owner and unit filenames

Use the **same Podman user and systemd manager as Grafana**. For rootless hosting,
log in as that deployment account (normally `deploy`) and use `systemctl --user`.
Do not run `sudo podman` against an existing rootless stack: it sees different
containers, networks and volumes.

```bash
podman ps --format '{{.Names}}  {{.Image}}'
podman network ls
systemctl --user list-unit-files --type=service
systemctl --user show grafana.service -p SourcePath -p FragmentPath
```

Replace `grafana.service` with the actual service name. Rootless source Quadlets
normally live in `~/.config/containers/systemd/`. Drop-in directories use the
**source filename** (`grafana.container.d`), not the generated `.service` filename.
Run privileged host changes through the existing administrator workflow.

If the existing stack is rootful, keep its current manager: use
`/etc/containers/systemd/` and `systemctl` without `--user` for the corresponding
steps. `%h` then refers to the root manager's home. Do not convert between rootful
and rootless hosting as part of this change. The container itself runs as UID/GID
1000 with no added capabilities in either profile.

The default connection assumes Grafana and containerized Caddy share this Podman
owner/scope. Networks with the same name under different users are not the same
network. If the proxy is in another scope, resolve that private connection first;
there is no public backend port workaround in the supplied defaults.

## 2. Install the backend Quadlets

Obtain the reviewed repository revision on the monitoring server. In these
examples `/path/to/stadt-land-klima` is that checkout. Use existing deployment
processes; do not edit tracked files on the server.

First check for name collisions: `slk-logs` network, `slk-victorialogs` container
and volume, and matching Quadlet files. Preserve unrelated resources. The supplied
network must be internal; do not silently reuse a non-internal network of that name.

For rootless hosting, as the existing deployment user:

```bash
install -d -m 0700 ~/.config/containers/systemd
install -m 0644 /path/to/stadt-land-klima/podman/logging/monitoring/slk-logs.network ~/.config/containers/systemd/
install -m 0644 /path/to/stadt-land-klima/podman/logging/monitoring/slk-victorialogs.volume ~/.config/containers/systemd/
install -m 0644 /path/to/stadt-land-klima/podman/logging/monitoring/slk-victorialogs.container ~/.config/containers/systemd/
podman pull docker.io/victoriametrics/victoria-logs:v1.54.0@sha256:cfe25bbded16c3ad6c5d15685abab5c3342f4b5602fba72fe6ec202015bf63e3
QUADLET_UNIT_DIRS="$HOME/.config/containers/systemd" /usr/lib/systemd/system-generators/podman-system-generator --user --dryrun
systemctl --user daemon-reload
systemctl --user start slk-victorialogs.service
systemctl --user status slk-victorialogs.service
podman healthcheck run slk-victorialogs
podman port slk-victorialogs
```

`podman port` should print nothing. The generated service depends on the network
and volume units. Quadlet's `[Install]` creates boot dependencies; **do not run
`systemctl enable` on generated services**. Rootless boot also requires the
existing account's linger setup (`loginctl show-user deploy -p Linger`); have the
administrator retain/enable it if needed. No generated `.service` needs hand editing.

The `.container` pins the image digest, runs non-root/capless/read-only with
no-new-privileges, retains journald output, and uses the named volume
`slk-victorialogs`. `:U` ownership initialization applies only to that Podman-owned
volume. There are no writable host-directory binds or engine sockets. Preserve
and verify the host's existing seccomp/LSM confinement.

Defaults are 30 days and 20 GiB retention (whichever removes data first), a 512 MiB
cache budget, 1 GiB systemd memory limit, four concurrent queries and 256 PIDs.
These are starting budgets, not measured capacity or hard disk quotas. Review
retention/disk settings in Git before changing them. Verify effective resource
limits on the actual host. Keep free space and alert before saturation.

The health command directly executes the server binary; the image has no shell.
It checks TCP acceptance, not correct HTTP responses or successful ingestion. The
later Grafana/canary checks remain necessary.

## 3. Attach Grafana without replacing its existing networks

Suppose the source file is `grafana.container`; substitute its actual name:

```bash
install -d -m 0755 ~/.config/containers/systemd/grafana.container.d
install -m 0644 /path/to/stadt-land-klima/podman/logging/monitoring/network-client.conf.example ~/.config/containers/systemd/grafana.container.d/50-slk-logs.conf
```

This adds `Network=slk-logs.network`; it does not reset existing `Network=` values,
change the image, replace volumes, or overwrite environment/plugin lists. Review
other existing drop-ins for resets/overrides and verify generated units before
restarting. Grafana retains its existing external/plugin-download connectivity.

Install the signed **VictoriaLogs plugin 0.33.1**, ID
`victoriametrics-logs-datasource`, using the existing Grafana mechanism. Prefer
adding `victoriametrics-logs-datasource@0.33.1` to its existing declarative plugin
preinstall list/image build; preserve every existing entry. Supported current
Grafana images use `GF_PLUGINS_PREINSTALL`. Check the installed Grafana version and
[official plugin/image guidance](https://grafana.com/docs/grafana/latest/setup-grafana/configure-docker/).
Do not blindly replace a plugin list with a new `Environment=` assignment.

If your existing workflow uses persistent plugin storage and the image contains
the Grafana CLI, install through that workflow, for example:

```bash
podman exec GRAFANA_CONTAINER_NAME grafana cli plugins install victoriametrics-logs-datasource 0.33.1
```

Use this only after confirming the configured plugin path (normally
`/var/lib/grafana/plugins`) is on its existing persistent volume; installation into
an ephemeral container layer disappears on recreation. Keep signed-plugin checks
enabled. The plugin requires compatible Grafana (currently 10.4+); deployed
compatibility has not been verified by local fixtures.

## 4. Provision the data source

Install the prepared non-secret datasource file at a host path dedicated to it:

```bash
install -d -m 0700 ~/.config/slk-monitoring
install -m 0644 /path/to/stadt-land-klima/podman/logging/monitoring/grafana-datasource.yaml ~/.config/slk-monitoring/slk-victorialogs.yaml
install -m 0644 /path/to/stadt-land-klima/podman/logging/monitoring/grafana-provisioning.conf.example ~/.config/containers/systemd/grafana.container.d/60-slk-logs-provisioning.conf
systemctl --user daemon-reload
systemctl --user restart grafana.service
```

The drop-in binds only this datasource file read-only into Grafana's standard
provisioning directory. If `GF_PATHS_PROVISIONING` is customized, adapt the target
path in a reviewed drop-in first. SELinux `:Z` labeling applies to this dedicated
new file, not the whole existing configuration tree. Check existing datasource
name/UID collisions before installing (`slk-victorialogs`). Preserve the existing
VictoriaMetrics source and its default status.

Alternatively add it through Grafana UI: **VictoriaLogs** type, **Stadt-Land-Klima
Logs** name, **`http://slk-victorialogs:9428`** URL. Do not use `localhost`: that would
refer to Grafana's own container. Use Save & test and verify actual querying.

## 5. Attach the proxy and install ingestion routing

For Caddy in the same Podman scope, add the same network drop-in under its actual
source filename, for example `caddy.container.d/50-slk-logs.conf`. Keep all its
existing networks and public HTTPS/ACME listeners. Add the supplied
`ingestion.caddy.example` to its existing maintained Caddy configuration, replacing
the password hash placeholder. Its upstream is **`slk-victorialogs:9428`**.

The Caddy binary must include the reviewed `http.handlers.rate_limit` module.
For an existing Caddy container you can inspect it without exposing secrets:

```bash
podman exec CADDY_CONTAINER_NAME /usr/bin/caddy list-modules
podman exec -it CADDY_CONTAINER_NAME /usr/bin/caddy hash-password
```

Stock Caddy does not contain that rate-limit module. If it is missing, use the
existing proxy image-build workflow to include the pinned module and build
protections from `caddy/Containerfile`, preserving any current DNS/auth modules.
Do not silently remove the rate guard. The repository's runtime image uses UID
1000 and expects high container ports; review the monitoring proxy's listener,
volume permissions and published ports before adopting that image. Validate the
merged Caddy configuration with the resulting binary before restarting it.

Generate one distinct username/hash and matching private application-host password
per sender. Use the existing Caddy config mount and operator reload workflow;
do not replace its whole Caddyfile or unrelated sites. If a new file bind is
needed, declare it in the existing Quadlet. Restart the Caddy Quadlet after adding
its network drop-in, then validate/reload through its existing admin socket.
The rate-limit, authentication, query/body and tenant/header guards are unchanged.

Create DNS for `logs.stadt-land-klima.de` pointing to this proxy and retain its
certificate issuance reachability. Keep browser SSO/challenges off this machine
ingestion route; it uses per-host credentials over verified HTTPS. No query/admin
route is exposed publicly. See [central logging](CENTRAL_LOGGING.md#3-connect-https-ingestion)
for expected unauthenticated responses and the application-host setup.

### If Caddy is a native host service

Use the prepared `loopback-publish.conf.example` under
`slk-victorialogs.container.d/50-loopback.conf`, regenerate/restart VictoriaLogs,
and point the **installed Caddy copy** at `127.0.0.1:9428`. It publishes only
loopback. Grafana still uses container DNS on `slk-logs`.

Do not use `0.0.0.0:9428`, `Network=host` or a public query proxy to fix connectivity.
A proxy container in another Podman user/scope needs a deliberate private routing
solution; this loopback option is specifically for a host-native proxy.

## 6. Monitor, back up and accept

A metrics scraper already running in a container can join `slk-logs` using the same
additive drop-in and scrape **`http://slk-victorialogs:9428/metrics`**. Do not publish
9428 just for scraping. Vector's application-host metrics remain on host loopback
9598 and require a local scraper or explicitly secured path.

Back up the named volume `slk-victorialogs` and the reviewed Quadlets/configuration.
For a simple consistent maintenance backup, stop the backend, export/snapshot the
volume through Podman into the existing encrypted backup workflow, then restart
it even if backup fails. Verify the resulting backup/read-back separately. Vector
buffers during that outage. Never remove/prune the volume during image updates;
recreating the container must retain it. One monitoring machine/disk is still a
failure domain.

Complete application-host Vector activation and canaries in
[CENTRAL_LOGGING.md](CENTRAL_LOGGING.md#5-install-the-vector-binary-on-each-application-host).
Verify private DNS from Grafana/proxy, authenticated insertion, searchable records,
service restarts, reboot, effective limits and outage recovery on the real host.
The local tests check Quadlet generation, additive networking, the pinned image's
non-root private API/health and named-volume persistence across recreation; they
do not claim that your existing Grafana/plugin/proxy has been deployed or tested.

References: [Podman Quadlet units](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html)
and [Grafana container/plugin configuration](https://grafana.com/docs/grafana/latest/setup-grafana/configure-docker/).
