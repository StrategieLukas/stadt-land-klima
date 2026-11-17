# Vector → VictoriaLogs → Grafana

The selected setup is **Vector 0.62.0 on each application host**, an authenticated
HTTPS ingestion route on the monitoring server, **VictoriaLogs 1.54.0**, and the
VictoriaLogs Grafana plugin. Existing VictoriaMetrics metrics remain configured.
The files in `podman/logging/` are integrated with `slk host plan/install/verify`.
Nothing is installed or deployed by preparing this branch.

```text
Podman containers ─┐
Host Caddy/jobs ───┴→ journald → Vector → HTTPS Caddy → VictoriaLogs
                               disk buffer             ↑
                                              existing Grafana
```

Read [the release security review](LOGGING_SECURITY_REVIEW.md) before installation.
It records archive/binary hashes, the VictoriaLogs Go scan, and Vector source-lock
advisory findings and limitations. A checksum or passing configuration test is not
a complete dependency security attestation.

## 1. Prepare the monitoring server

These commands assume **Linux x64, systemd, native Caddy and native Grafana** on
the monitoring machine. If either runs in a container, use an explicit private
network connection: container loopback is not host loopback. Keep the raw
VictoriaLogs port private. Preserve the existing Grafana/VictoriaMetrics stack.

Use an administrator-owned reviewed checkout, represented below by
`/path/to/stadt-land-klima`. This guide does not authorize a production deployment.
Use `deploy` for ordinary application release operations and the existing
administrator workflow for host services. Do not edit tracked files on a server.

Reserve persistent disk space for `/var/lib/victorialogs`. The supplied limits are
30 days and 20 GiB; **the earlier limit wins**. The disk limit is periodically
checked and is not a hard filesystem quota. Reserve additional free space and
alert before exhaustion. Adjust the private installed `limits.env` to the actual
machine, expected traffic and retention needs.

## 2. Install VictoriaLogs on the monitoring server

After reviewing the selected release, download and verify the Linux x64 archive.
Prerequisites: `curl`, `tar`, `sha256sum`, systemd and the normal account tools.

```bash
set -euo pipefail
umask 077
mkdir -p /root/slk-monitoring-install
cd /root/slk-monitoring-install
curl --fail --location --proto '=https' --tlsv1.2 --output victoria-logs.tar.gz https://github.com/VictoriaMetrics/VictoriaLogs/releases/download/v1.54.0/victoria-logs-linux-amd64-v1.54.0.tar.gz
printf '%s  %s\n' '739e78c82294520b6079bc8a6ae32a1f9fb95a543092929a53a2fe9ab7383016' victoria-logs.tar.gz | sha256sum --check -
tar -xzf victoria-logs.tar.gz
printf '%s  %s\n' '46aaf57c79c30c81dd047f150fcedff065f182369fb9e65a0de4032f91d40005' victoria-logs-prod | sha256sum --check -
install -o root -g root -m 0755 victoria-logs-prod /usr/local/bin/victoria-logs
/usr/local/bin/victoria-logs --version
```

Create the dedicated account if absent. Inspect any existing account/service
before reusing it; the `useradd` command is for a new installation.

```bash
useradd --system --user-group --home-dir /var/lib/victorialogs --no-create-home --shell /usr/sbin/nologin victorialogs
install -d -o root -g victorialogs -m 0750 /etc/victorialogs
install -d -o victorialogs -g victorialogs -m 0700 /var/lib/victorialogs
install -o root -g victorialogs -m 0640 /path/to/stadt-land-klima/podman/logging/monitoring/limits.env.example /etc/victorialogs/limits.env
install -o root -g root -m 0644 /path/to/stadt-land-klima/podman/logging/monitoring/victorialogs.service /etc/systemd/system/victorialogs.service
systemd-analyze verify /etc/systemd/system/victorialogs.service
systemctl daemon-reload
systemctl enable --now victorialogs.service
curl --fail http://127.0.0.1:9428/health
```

The service binds only to loopback. Its cache budget is 512 MiB, with a 1 GiB
systemd process limit and four concurrent queries. Cache limits are not estimates
of total RAM usage. Monitor actual use and tune before increasing traffic.
Keep `/var/lib/victorialogs` outside the checkout and include it in a consistent,
tested backup/recovery plan. One local disk is not a highly available backend.

## 3. Connect HTTPS ingestion through the existing Caddy

Create DNS for **`logs.stadt-land-klima.de`** pointing to the monitoring server.
Allow HTTPS to its existing Caddy and preserve its certificate issuance setup.
Do not expose 9428, the query APIs, or the collector metrics port publicly.

Create a separate random password of 32–256 printable ASCII characters per host
in the password manager. Use `caddy hash-password` interactively to produce its
hash. Do not put plaintext passwords in process arguments, shell history or Git.

Merge [ingestion.caddy.example](../podman/logging/monitoring/ingestion.caddy.example)
into the monitoring server's installed Caddy configuration. Replace the hash
placeholder and add the username/hash for each application host. The supplied
host example uses username `slk-production`. Preserve the existing Grafana site,
Caddy administration socket, TLS policy and runtime log filtering.

Use the project-reviewed Caddy build with `http.handlers.rate_limit`, as described
in [the Caddy guide](../caddy/README.md). Check `caddy list-modules`; a stock binary
without this module must fail validation. Preserve the limiter when installing a
compatible reviewed binary. Validate with the server's normal Caddy configuration/
environment and reload its existing service. The prepared route:

- accepts only authenticated POST requests to `/insert/jsonline`, without queries;
- limits each source IP to 20 requests/second before authentication and bounds
  compressed request bodies to 2 MB;
- removes authorization, cookies and client-controlled `VL-*` headers upstream;
- fixes the tenant to `AccountID=0`, `ProjectID=0` and fixes parser/stream fields;
- forwards to private `127.0.0.1:9428`, denying other public paths.

The original message remains searchable. Only project, environment, host and
service identify streams; request IDs, user IDs and dynamic unit instances do not.
Trusted hosts share one tenant; labels are not authorization between untrusted
teams. Use source-IP firewall restrictions when hosts have stable egress IPs.
The body limit does not bound decompressed data; keep credentials restricted and
monitor backend resources. This setup uses gzip from a trusted local agent.

Check the unauthenticated/public boundaries:

```bash
curl --silent --output /dev/null --write-out '%{http_code}\n' --request POST https://logs.stadt-land-klima.de/insert/jsonline
curl --silent --output /dev/null --write-out '%{http_code}\n' https://logs.stadt-land-klima.de/select/logsql/query
```

Expect **401**, then **404**. The later collector canary verifies authenticated
insertion, not just availability of the web server.

## 4. Connect the existing Grafana

Install the signed **VictoriaLogs data-source plugin**, ID
`victoriametrics-logs-datasource` (reviewed current version **0.33.1**), using your
Grafana instance's supported plugin installation workflow. Review its compatibility
with the installed Grafana version; the current plugin requires Grafana 10.4+.
Follow [the official installation instructions](https://grafana.com/grafana/plugins/victoriametrics-logs-datasource/installation/).
For a standard native Grafana package with the current CLI, installation is:

```bash
grafana cli plugins install victoriametrics-logs-datasource 0.33.1
systemctl restart grafana-server
```

Use the equivalent existing management workflow if your CLI/service names differ.
Restart/reload Grafana as required, preserving its configuration.

Add a VictoriaLogs data source named **Stadt-Land-Klima Logs** with URL
**`http://127.0.0.1:9428`**, then use Save & test. This is the Grafana server's
connection, not a browser URL. For containerized Grafana, adapt the private
network connection instead of publishing VictoriaLogs.

Alternatively merge/install the supplied
[grafana-datasource.yaml](../podman/logging/monitoring/grafana-datasource.yaml)
into Grafana's existing provisioning directory after checking UID/name collisions.
Its UID is `slk-victorialogs`. Keep VictoriaMetrics and its default data-source
status. Restrict access to these logs to authorized operators.

## 5. Install the Vector binary on each application host

Use the root-owned reviewed checkout from the existing
[host installation workflow](HOST_REPRODUCIBILITY.md). The host profile is the
existing production retained-datastore profile; it is not fresh-host/staging
provisioning. The log environment label does not change the application target.

Install the reviewed archive binary, which the host verifier checks by SHA-256:

```bash
set -euo pipefail
umask 077
mkdir -p /root/slk-vector-install
cd /root/slk-vector-install
curl --fail --location --proto '=https' --tlsv1.2 --output vector.tar.gz https://github.com/vectordotdev/vector/releases/download/v0.62.0/vector-0.62.0-x86_64-unknown-linux-gnu.tar.gz
printf '%s  %s\n' 'e9d9cb3ee12288544c813453d0548524ab2bcc8f7e81b601f5e9d378fa6ac2f6' vector.tar.gz | sha256sum --check -
tar -xzf vector.tar.gz
printf '%s  %s\n' 'af2fe313d74e539914d1497898c1a4e338c3adcaa24605b7eee4116e983c3899' vector-x86_64-unknown-linux-gnu/bin/vector | sha256sum --check -
install -o root -g root -m 0755 vector-x86_64-unknown-linux-gnu/bin/vector /usr/local/bin/vector
/usr/local/bin/vector --version
```

This GNU/Linux binary requires the host's libc/zlib runtime libraries. Keep OS
security updates current. It does not install the vendor's default service or
package-repository keys. Inspect any existing Vector installation before replacing
it; preserve unrelated collectors. Create the dedicated service account if absent:

```bash
useradd --system --user-group --home-dir /var/lib/slk-vector --no-create-home --shell /usr/sbin/nologin slk-vector
install -d -o root -g root -m 0700 /root/.config/slk
install -o root -g root -m 0600 /path/to/stadt-land-klima/podman/logging/logging.env.example /root/.config/slk/logging.env
```

Set the private `logging.env` endpoint, distinct host name, environment and
username. Store the matching gateway password as **raw text**, root-owned mode
0600, at `/root/.config/slk/victorialogs-password`. A final newline is allowed.
Do not export the password as an environment variable or put it in configuration.

Add this reference to the existing root-only host dotenv:

```dotenv
SLK_HOST_LOGGING_CONFIG=/root/.config/slk/logging.env
```

From the root-owned reviewed repository, run:

```bash
./bin/slk host plan --config /root/.config/slk/host.env --node-binary /root/node-v24.22.3-linux-x64/bin/node
./bin/slk host install --config /root/.config/slk/host.env --node-binary /root/node-v24.22.3-linux-x64/bin/node
./bin/slk host verify --config /root/.config/slk/host.env
```

Logging adds four drift-checked files: `vector.yaml` and `normalize.vrl` under
`/etc/slk/vector/`, `/etc/systemd/system/slk-vector.service`, and
`/etc/systemd/journald.conf.d/60-slk-logging.conf`. The private password is not in
these artifacts or reports. systemd loads it with `LoadCredential` and binds its
private credential directory read-only for Vector's native secret-file backend.
No shell launcher or environment interpolation is enabled. The existing encrypted
Restic host backup includes the opted-in logging settings and password file; it
does not treat the live Vector queue as an application backup.

The installer enables boot startup but does not start Vector or restart journald.
It preserves the existing application/data/backup workflow. If the earlier SLK
Alloy prototype was installed, explicitly stop/retire its SLK unit/config first;
the verifier refuses to silently leave both collectors installed. Preserve
unrelated Alloy/Vector units and any retained state until reviewed.

## 6. Validate and activate the application host

```bash
/usr/local/bin/vector validate --no-environment --deny-warnings /etc/slk/vector/vector.yaml
systemd-analyze verify /etc/systemd/system/slk-vector.service
systemd-tmpfiles --create --prefix /var/log/journal
systemctl restart systemd-journald
journalctl --flush
systemctl enable --now slk-vector.service
systemctl status slk-vector.service
curl --fail http://127.0.0.1:9598/metrics
```

The first validation checks configuration/VRL without reading secrets or contacting
the endpoint. Service startup then resolves the actual systemd credential and
opens the journal. Verify read permission for both host and rootless Podman
entries on the actual machine; host ACL/namespace differences need acceptance.
The account has journal-read membership, no engine socket/root privileges, and no
access to application home-directory dotenv files. Metrics bind only to loopback;
Vector's administrative API is disabled. Metrics availability is not delivery proof.

The collector reads all retained readable host journal records across boots. The
single project/environment configuration assumes one SLK deployment per host;
mixed-environment hosts require reviewed per-project routing before activation.

## 7. Confirm delivery in Grafana and test recovery

Emit a non-sensitive canary on the application host:

```bash
logger --tag slk-log-canary slk-central-logging-canary
```

In Grafana Explore, select the new VictoriaLogs source and query with **LogsQL**:

```text
project:="stadt-land-klima" host:="slk-production-1" "slk-central-logging-canary"
```

Inspect records from each expected service: `directus`, `nuxt`, `postgresql`,
`redis`, `meilisearch`, `caddy`, and applicable jobs. Services appear only after
emitting records. Generate benign events; do not enable unrestricted debug dumps.
`service_name` strips container replica suffixes and systemd template instances.

Application failure alerts should use parsed application severity, not journal
priority. The collector records where the level came from:

```text
project:="stadt-land-klima" level_source:="application" level:in(error,fatal)
```

Plain third-party messages retain journal priority with `level_source=journal`;
ordinary stderr startup messages must not become application failure alarms.
Build panels for service/environment, request status, duration and recent logs.

Configure your existing VictoriaMetrics collection to scrape Vector's private
`127.0.0.1:9598/metrics` **from that application host**, and VictoriaLogs' private
`127.0.0.1:9428/metrics` from the monitoring host. A remote scraper cannot reach
another host's loopback without an explicitly secured connection. Reuse the
existing local metrics agent where available; do not publish these ports.
Watch `component_errors_total`, `component_discarded_events_total`, buffer size,
sent-event counters, service failures, and free disk. Use the metrics actually
exported by the pinned release when building alerts.

For acceptance, block ingestion briefly, emit numbered canaries, restart/kill the
collector while blocked, restore connectivity and count recovered/missing/duplicate
records. Then verify reboot and actual host journal cursors. This branch's
isolated real-binary test covers a TLS outage, SIGKILL, buffer replay and querying
the real VictoriaLogs backend, not production installation or power-loss durability.

## Coverage and operational limits

- The 1 GiB disk buffer blocks when full; the persistent journal is capped at
  512 MiB/three days and reserves 1 GiB free space. These are upper bounds, not
  guaranteed outage durations. Journald burst suppression must also be monitored.
- Acknowledgments/cursors and disk buffering improve recovery, but do not promise
  exactly-once delivery. Unsynchronized writes, permanent HTTP errors, exhausted
  storage, corrupt disks and journal rotation can lose records. Duplicates remain
  possible. Do not delete cursor/buffer state as an automatic retry.
- The outgoing envelope excludes journal command lines and other raw metadata.
  The original MESSAGE is preserved; arbitrary infrastructure messages can still
  contain personal information or secrets. Review their source logging and restrict
  operator access. The collector does not undo an existing application's redaction.
- File-only logs and interactive command output need explicit capture. Prefer
  systemd services/timers for scheduled jobs. Add reviewed, explicit file inputs
  with appropriate permissions for third-party file loggers; do not sweep private
  `.reports/`, backups, home directories or dotenv files.
- Browser logging remains the bounded existing diagnostics endpoint. Directus
  activity history stays separate database audit data. Newsletter/mail and other
  machines require their own collector/integration.
- Rotate the per-host gateway hash and private password together, restarting Vector
  to reload the systemd credential. Permanent 401 responses can discard batches;
  coordinate rotation and alert on authentication failures.
- Back up and restore the monitoring store/config separately. Retention/disk caps
  may remove older logs earlier than 30 days. A single monitoring server remains a
  failure domain, even when the application collector has a durable buffer.

To retire collection, stop/disable `slk-vector.service`, remove only its four
installed artifacts and the opt-in setting, reload systemd, and apply the
journald change in the maintenance window. Preserve journal/buffer data and
credentials until their retention/recovery needs are resolved. Verification
rejects abandoned SLK logging artifacts after the option is removed.

## Verification commands and references

```bash
node --test bin/cli/host-logging.test.ts bin/cli/host-maintenance.test.ts
SLK_TEST_VECTOR_BINARY=/absolute/path/to/vector SLK_TEST_VICTORIALOGS_BINARY=/absolute/path/to/victoria-logs node --test bin/cli/host-logging.integration.test.ts
./bin/slk check ready
```

Privileged installation, systemd credential mounts, journal permissions, actual
DNS/TLS, deployed plugin compatibility, reboot and storage restore remain host
acceptance checks. [Component comparison](LOGGING_ALTERNATIVES.md).

- [Vector journald](https://vector.dev/docs/reference/configuration/sources/journald/)
- [Vector HTTP/disk buffering](https://vector.dev/docs/reference/configuration/sinks/http/)
- [Vector secret-file backend](https://vector.dev/docs/reference/configuration/secrets/)
- [VictoriaLogs Vector ingestion](https://docs.victoriametrics.com/victorialogs/data-ingestion/vector/)
- [VictoriaLogs retention/storage](https://docs.victoriametrics.com/victorialogs/)
- [VictoriaLogs Grafana integration](https://docs.victoriametrics.com/victorialogs/integrations/grafana/)
