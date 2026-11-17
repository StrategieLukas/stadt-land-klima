# Central logging: application host and monitoring server

The prepared default is one host-level **Grafana Alloy 1.22.0** journal reader per
application machine, sending through an authenticated HTTPS gateway to
**Loki 3.7.10** on the monitoring machine. Existing VictoriaMetrics/Prometheus
metrics remain configured. [Component alternatives](LOGGING_ALTERNATIVES.md)
compare resource use, security, resilience and operational effort.

**Current activation hold:** the published Alloy/Loki binaries have known scan
findings. Read [the binary security review](LOGGING_SECURITY_REVIEW.md) first.
The host installer rejects the affected Alloy Go build; replace/review binaries
and update pins before following the activation steps below.

This is prepared configuration, not evidence of an installation. Nothing enables
logging unless the operator opts in. No application release, host installation,
DNS change or remote deployment is performed by preparing these files.

```text
Directus / Nuxt / PostgreSQL / Redis / Meilisearch / maintenance
                                  stdout/stderr → Podman journald
Host Caddy / backup service / OS services → systemd journal
                                              ↓
                      slk-alloy (unprivileged, outbound HTTPS)
                                              ↓
        logs.stadt-land-klima.de → Caddy authentication → local Loki
                                                         ↑
                                  existing Grafana → private query API
```

## 1. Prepare the monitoring machine

These instructions assume Linux x64, systemd, native Grafana and host Caddy on
the monitoring machine. Run its privileged setup as its administrator. Keep all
existing Grafana/VictoriaMetrics configuration. If Grafana or Caddy runs in a
container, first adapt the private network connection: container loopback is not
host loopback. Do not expose port 3100 publicly to solve this.

Obtain the reviewed repository revision on that machine. Commands below use
`/path/to/stadt-land-klima` as its checkout; replace it with the actual path.
Provision storage outside the repository for `/var/lib/loki`. Start with a disk
budget appropriate to measured traffic; 30 days is a time policy, not a disk
quota. Alert before disk exhaustion and retain free space. Loki's filesystem
backend does not enforce a storage-size limit.

## 2. Install and verify Loki

Use the official release archive, verify its checksum, and install its extracted
binary. These commands assume `curl`, `unzip`, `sha256sum` and `awk` are available:

```bash
set -euo pipefail
umask 077
mkdir -p /root/slk-loki-install
cd /root/slk-loki-install
curl --fail --location --proto '=https' --tlsv1.2 --output loki-linux-amd64.zip https://github.com/grafana/loki/releases/download/v3.7.10/loki-linux-amd64.zip
curl --fail --location --proto '=https' --tlsv1.2 --output SHA256SUMS https://github.com/grafana/loki/releases/download/v3.7.10/SHA256SUMS
awk '$2 == "loki-linux-amd64.zip" || $2 == "*loki-linux-amd64.zip"' SHA256SUMS > loki.sha256
test -s loki.sha256
sha256sum --check loki.sha256
unzip loki-linux-amd64.zip
go run golang.org/x/vuln/cmd/govulncheck@v1.9.0 -mode=binary ./loki-linux-amd64
install -o root -g root -m 0755 loki-linux-amd64 /usr/local/bin/loki
/usr/local/bin/loki --version
```

The current pinned vendor build fails this scan: stop before installation until
the security review is resolved and the artifact/pins are updated. Never disable
the scan to continue. The scanner requires a supported Go toolchain and network
access to the official Go vulnerability database.

Create a dedicated `loki` system account/group if absent. Inspect any pre-existing
account/service before reusing it; preserve unrelated monitoring services.

```bash
useradd --system --user-group --home-dir /var/lib/loki --no-create-home --shell /usr/sbin/nologin loki
install -d -o root -g loki -m 0750 /etc/loki
install -d -o loki -g loki -m 0700 /var/lib/loki
install -o root -g loki -m 0640 /path/to/stadt-land-klima/podman/logging/monitoring/loki.yaml /etc/loki/loki.yaml
install -o root -g root -m 0644 /path/to/stadt-land-klima/podman/logging/monitoring/loki.service /etc/systemd/system/loki.service
runuser -u loki -- /usr/local/bin/loki -config.file=/etc/loki/loki.yaml -verify-config=true
systemd-analyze verify /etc/systemd/system/loki.service
systemctl daemon-reload
systemctl enable --now loki.service
curl --fail http://127.0.0.1:3100/ready
```

Readiness may take a short time after startup. The supplied single-process config
uses TSDB/v13, 30-day compactor retention, persistent ingester WAL, bounded query
concurrency and loopback HTTP/gRPC listeners. `auth_enabled: false` selects a
single tenant; it does **not** make the API safe to publish. Single-node local
storage survives process restarts, not loss of the monitoring machine or disk.
Back up the configuration and persistent data consistently; test restoration.

## 3. Add the protected HTTPS ingestion site

Create DNS for `logs.stadt-land-klima.de` pointing to the monitoring machine.
Permit HTTPS to its existing Caddy; keep Loki's ports 3100/9096 private. Caddy's
normal certificate issuance also needs its existing HTTP/ACME reachability.

Create a distinct random password of at least 32 characters for each application
host, stored in the password manager. Use `caddy hash-password` interactively to
produce its hash; do not pass plaintext in process arguments or shell history.

Merge [ingestion.caddy.example](../podman/logging/monitoring/ingestion.caddy.example)
into the monitoring machine's installed Caddy configuration. Replace the hash
placeholder, and add one username/hash per host inside `basic_auth`. The supplied
host example uses username `slk-production`. Preserve the existing Grafana site,
certificate settings and private Caddy administration socket. Do not copy this
file over the whole existing Caddyfile.

Validate using the monitoring server's normal Caddy command/environment, then
reload through its existing service. The route permits only authenticated POST
requests to `/loki/api/v1/push`, bounds bodies to 2 MB, and denies other paths.
Query/admin APIs are not forwarded publicly. Gateway authorization and cookies
are stripped before forwarding to Loki. Add source-IP allowlisting at the
firewall if the application hosts have stable egress addresses. Basic auth needs
TLS; keep hostname/certificate verification enabled.

Check the authentication boundary without a credential:

```bash
curl --silent --output /dev/null --write-out '%{http_code}\n' --request POST https://logs.stadt-land-klima.de/loki/api/v1/push
curl --silent --output /dev/null --write-out '%{http_code}\n' https://logs.stadt-land-klima.de/loki/api/v1/labels
```

Expect `401` then `404`. The later Alloy canary verifies authenticated delivery.
The write-only account can submit any label values to this single tenant; labels
are organizational metadata, not authorization. Separate tenants and gateway
enforced identities are needed if mutually untrusted teams share this backend.

## 4. Add Grafana's log data source

In the existing Grafana at <https://monitoring.stadt-land-klima.de/>, add a **Loki**
data source named **Stadt-Land-Klima Logs**, URL `http://127.0.0.1:3100`, and test
the connection. This URL is resolved by the Grafana server. For native co-hosted
Grafana it reaches Loki privately; no browser credential or public query route
is needed. Keep the VictoriaMetrics source and its default status.

Alternatively install [grafana-datasource.yaml](../podman/logging/monitoring/grafana-datasource.yaml)
as a new file in Grafana's existing `provisioning/datasources/` directory and
reload provisioning through the normal Grafana administration procedure. Check
for existing data source UID/name collisions first. Limit Grafana viewer access
to authorized operators: host logs can contain personal or operational data.

## 5. Opt in on the application host

Do this only during an authorized host installation. Preparation in a branch
does not authorize a production deployment. Use the existing root-owned reviewed
checkout and [host installation workflow](HOST_REPRODUCIBILITY.md). Run ordinary
application release operations as `deploy`; privileged service installation uses
the existing administrator workflow. Do not edit tracked files on the server.

Install Alloy 1.22.0 from Grafana's signed APT repository using the
[official Linux instructions](https://grafana.com/docs/alloy/latest/set-up/install/linux/).
Inspect `apt-cache policy alloy` and select the exact 1.22.0 package version shown
there, rather than installing an unreviewed newer release. The host installer
requires `/usr/bin/alloy`, its dedicated `alloy` user/group, this product version,
and a Go build fixing GO-2026-6859 (1.26.11/1.27.4 or newer supported branches).
The published 1.22.0 archive reviewed here does not meet that runtime requirement;
do not install it unchanged. Review a patched vendor package or reproducible
build first and rerun the binary scan. A newer product release needs a reviewed
pin change in Git.
The default packaged service is not used by SLK. If the package was installed
specifically for this task, disable/stop its stock `alloy.service` before enabling
`slk-alloy.service`. If an existing collector is already in use, preserve it and
resolve the port/configuration overlap before proceeding.

As root, install the example as a private file:

```bash
install -d -o root -g root -m 0700 /root/.config/slk
install -o root -g root -m 0600 /path/to/stadt-land-klima/podman/logging/logging.env.example /root/.config/slk/logging.env
```

Set its endpoint, distinct host name, environment and username. Store the same
password registered in step 3 as raw text in
`/root/.config/slk/loki-password`, root-owned mode 0600. A final newline is allowed;
the value must be 32–256 printable ASCII characters. Keep passwords out of Git,
chat, command arguments and logs. These private files are parsed/read as data,
never sourced as shell code.

Add this reference to the existing root-only host dotenv:

```dotenv
SLK_HOST_LOGGING_CONFIG=/root/.config/slk/logging.env
```

The current `slk host` profile is the existing production retained-datastore
profile; this change does not turn it into fresh-host or staging provisioning.
The log environment label alone does not change the application deployment target.

Run the existing commands with the reviewed Node binary:

```bash
./bin/slk host plan --config /root/.config/slk/host.env --node-binary /root/node-v24.22.3-linux-x64/bin/node
./bin/slk host install --config /root/.config/slk/host.env --node-binary /root/node-v24.22.3-linux-x64/bin/node
./bin/slk host verify --config /root/.config/slk/host.env
```

Logging adds three verified files: `/etc/slk/alloy/config.alloy`,
`/etc/systemd/system/slk-alloy.service`, and
`/etc/systemd/journald.conf.d/60-slk-logging.conf`. Secrets are neither copied into
the generated Alloy config nor included in the JSON report. systemd loads the
password as a private service credential. The installer enables the collector
for boot but does not start it or restart journald/application containers.

Validate and activate after the monitoring endpoint is ready:

```bash
/usr/bin/alloy validate /etc/slk/alloy/config.alloy
systemd-analyze verify /etc/systemd/system/slk-alloy.service
systemd-tmpfiles --create --prefix /var/log/journal
systemctl restart systemd-journald
journalctl --flush
systemctl enable --now slk-alloy.service
systemctl status slk-alloy.service
curl --fail http://127.0.0.1:12345/-/ready
```

Verify journal access as the service identity, including rootless container
entries. The unit grants `systemd-journal` supplementary membership; it grants no
engine socket, root privilege, application secret access or home-directory access.
Host-specific journal ACL/storage differences need actual host acceptance.
Alloy diagnostics listen only on loopback; profiling/support bundles are disabled.
Do not publish that port. Its readiness endpoint alone does not prove delivery.

## 6. Verify coverage, delivery and failure handling

Generate a non-sensitive canary on the application host:

```bash
logger --tag slk-log-canary slk-central-logging-canary
```

In Grafana Explore select the new data source and query:

```logql
{project="stadt-land-klima", host="slk-production-1"} |= "slk-central-logging-canary"
```

Then inspect `{project="stadt-land-klima"}` by `service_name`: expect `directus`,
`nuxt`, `postgresql`, `redis`, `meilisearch`, `caddy`, and applicable host jobs.
Container names are normalized using the configured Podman project, without
container IDs or systemd template instances as indexed labels. Services only
appear after emitting a message. Generate controlled benign events rather than
enabling unrestricted debug logs. Confirm each host/environment separately.

Configure panels for recent logs, error rate by service, and request status and
duration from JSON fields. For Nuxt/Directus failure alerts, select the structured
server `severity` field rather than treating transport/journal priority as an
application failure:

```logql
{project="stadt-land-klima", service_name=~"nuxt|directus"} | json | severity=~"error|fatal"
```

Use parsed Caddy error/status fields for gateway alerts. Plain third-party
messages fall back to journal priority; some services emit ordinary startup
messages on stderr, so a generic `level="error"` count across all services is not
a reliable application-failure alarm. Keep request/user/resource IDs in the JSON
body, not index labels.

Use the existing metrics collection to scrape Alloy's **private** `/metrics`
endpoint and Loki's private `/metrics` endpoint. A collector on each application
host can scrape loopback Alloy and remote-write metrics to VictoriaMetrics; a
remote scraper cannot reach loopback without an explicitly secured path. Do not
open 12345/3100 to the internet just for scraping. Useful Alloy counters include
`loki_write_sent_entries_total`, `loki_write_dropped_entries_total` and
`loki_write_batch_retries_total`. Alert on drops, sustained retries, service
failure, and journal/Loki disk pressure; a quiet dashboard is not proof of health.

During acceptance, briefly block ingestion, emit canaries, restore connectivity,
and verify ordered recovery and counters. Separately restart the collector while
blocked and document any missing records. Run the same checks after reboot.

## Scope and resilience limits

- All readable journal **MESSAGE** records are forwarded, including other host
  services. Full journal envelopes/command lines are not serialized. Application
  redaction remains intact, but arbitrary infrastructure messages may contain
  personal data, file paths or errors. Review source policies and restrict access.
- Files and interactive output are not automatically in the journal. Use systemd
  services/timers for scheduled backup/import/release jobs. For an explicitly
  chosen interactive job, `systemd-run --user --wait --collect --unit=slk-manual-job`
  can run its actual command with journal output. Inspect its source for sensitive
  diagnostics first. Do not sweep private `.reports/`, dotenv files or backups.
- A third-party file-only logger needs an explicit reviewed `loki.source.file`
  entry and read permission in the checked configuration, followed by host
  reinstall. No unbounded filesystem wildcard is included. Newsletter/mail and
  other machines need their own collector or explicit integration.
- Browser console output is not a server log. Only the existing bounded client
  diagnostics are forwarded. Native Directus activity history remains database
  audit data; it is not exported by this collector.
- Journal storage is persistent and capped at 512 MiB/three days, with 1 GiB free
  space reserved. These are upper bounds, not a guaranteed recovery window.
  Journald can rate-limit bursts; monitor suppression. Alloy initially reads at
  most 24 hours and persists its cursor under `/var/lib/slk-alloy`.
- Stable Alloy retries recoverable failures indefinitely here, but its outbound
  log backlog is not a durable delivery queue. An abrupt restart/OOM, a journal
  rotation, permanent HTTP 4xx, or an outage exceeding available storage can lose
  records. A persisted cursor is not an acknowledgment from Loki. Do not advertise
  exactly-once or lossless delivery. The current disk WAL requires experimental
  features and is deliberately disabled. Choose Vector/Fluent Bit with tested
  disk buffering if restart-surviving backlogs are required.
- Historical replay can duplicate records or encounter Loki's old/out-of-order
  entry limits. Do not delete cursor state as an automatic retry. Keep local
  evidence and coordinate an explicit replay when needed.
- Password rotation requires changing the gateway hash and private host password,
  then restarting the collector so systemd reloads the credential. Coordinate the
  switch; avoid prolonged 401s because permanent errors are dropped.

To retire this integration explicitly, disable/stop `slk-alloy.service`, remove
only its three installed files, remove `SLK_HOST_LOGGING_CONFIG`, reload systemd
and apply the journald change in the approved maintenance window. Preserve
journal data, `/var/lib/slk-alloy`, secrets and unrelated collectors until their
retention/recovery requirements are resolved. `host verify` refuses to silently
ignore installed logging files after the option is removed.

## Validation and references

Targeted tests: `node --test bin/cli/host-logging.test.ts bin/cli/host-maintenance.test.ts`.
Run the real-binary pipeline test with
`SLK_TEST_ALLOY_BINARY=/absolute/path/to/alloy node --test bin/cli/host-logging.test.ts`.
Its temporary HTTP fixture replaces the journal source; it never exports real
host logs or treats a vulnerable binary as approved for installation.
Real release-binary validation and source/level pipeline checks complement unit
coverage; privileged installation, TLS/DNS, systemd reboot, monitoring-server
querying and outage acceptance remain separate deployment checks.

- [Alloy journal source](https://grafana.com/docs/alloy/latest/reference/components/loki/loki.source.journal/)
- [Alloy writer, retries and experimental WAL](https://grafana.com/docs/alloy/latest/reference/components/loki/loki.write/)
- [Loki authentication](https://grafana.com/docs/loki/latest/operations/authentication/)
- [Loki retention](https://grafana.com/docs/loki/latest/operations/storage/retention/)
- [Filesystem storage limits](https://grafana.com/docs/loki/latest/operations/storage/filesystem/)
- [Grafana Loki data source](https://grafana.com/docs/grafana/latest/datasources/loki/configure/)
