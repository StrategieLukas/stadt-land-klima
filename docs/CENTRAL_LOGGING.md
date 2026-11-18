# Vector → VictoriaLogs → Grafana

The selected setup is **Vector 0.62.0 on each application host**, an authenticated
HTTPS ingestion route on the monitoring server, **VictoriaLogs 1.54.0**, and the
VictoriaLogs Grafana plugin. Existing VictoriaMetrics metrics remain configured.
Application-host artifacts use `slk host plan/install/verify`; monitoring uses the
existing Podman Quadlet manager and separate additive drop-ins.
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

## 1. Prepare the monitoring Quadlets

Monitoring already uses Podman Quadlets. Follow the concrete
[monitoring Quadlet guide](MONITORING_QUADLETS.md) using the same Podman owner and
systemd manager as the existing Grafana. It includes discovery commands for the
current unit filenames, network scope, proxy placement and plugin storage.
Preserve the existing Grafana/VictoriaMetrics services, data and networks.
The guide starts with an automated `slk monitoring plan/install/verify` installer,
including generated credentials, configuration, validation and rollback.

## 2. Install VictoriaLogs as a Quadlet

Install the supplied `slk-logs.network`, `slk-victorialogs.volume` and
`slk-victorialogs.container`. The digest-pinned, non-root/read-only backend uses a
persistent named volume and an internal network, with no published host port by
default. Regenerate/start through systemd; generated services are not manually
enabled. The guide covers rootless startup/linger and existing rootful scope.

Defaults remain 30 days/20 GiB retention, a 512 MiB cache budget and a 1 GiB
systemd memory limit. Disk limits are periodically enforced, not filesystem quotas.
Keep free space and test backup/restore of the named volume. The earlier native
monitoring service has been replaced; do not install both backends.

## 3. Connect HTTPS ingestion

Attach the existing Caddy Quadlet to `slk-logs` with the additive network drop-in.
Its private upstream is **`slk-victorialogs:9428`**. Keep its current networks and
reviewed `http.handlers.rate_limit` module. If Caddy is native on the host, the
Quadlet guide provides a separate **loopback-only** publish drop-in and upstream.

Create DNS for `logs.stadt-land-klima.de`, retain TLS/ACME reachability, and add
`ingestion.caddy.example` to the existing Caddy config. Generate distinct per-host
passwords and hashes through the existing proxy's operator workflow. Preserve the
Grafana site and private Caddy administration/configuration. The supplied route:

- accepts authenticated POST to `/insert/jsonline`, without query parameters;
- limits each source IP to 20 requests/second before authentication, with a 2 MB
  compressed-body limit (not a decompressed-data limit);
- strips credentials/cookies and fixes parser fields plus tenant 0/0 upstream;
- denies other public paths, including query/admin APIs.

Check from the application host:

```bash
curl --silent --output /dev/null --write-out '%{http_code}\n' --request POST https://logs.stadt-land-klima.de/insert/jsonline
curl --silent --output /dev/null --write-out '%{http_code}\n' https://logs.stadt-land-klima.de/select/logsql/query
```

Expect **401**, then **404**. Labels are not authorization between untrusted teams;
this is one trusted SLK tenant. Use source-IP firewall restrictions when practical.

## 4. Connect Grafana on the private network

Use the additive network drop-in for Grafana's actual `.container` source file,
and install the signed VictoriaLogs plugin 0.33.1 through its existing declarative
plugin mechanism/persistent storage, preserving all current plugins and data.
Provision the supplied datasource file using the optional read-only file drop-in,
or add the source through Grafana UI. The private datasource URL is:

```text
http://slk-victorialogs:9428
```

`localhost` inside Grafana is its own container. Keep the existing VictoriaMetrics
metrics source/default. The [Quadlet guide](MONITORING_QUADLETS.md) provides the
commands, plugin version checks, discovery paths and native-proxy alternative.

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
`http://slk-victorialogs:9428/metrics` from a monitoring container on `slk-logs`. A remote scraper cannot reach
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
node --test bin/cli/monitoring-quadlet.test.ts
SLK_TEST_LOGGING_QUADLET=1 node --test bin/cli/monitoring-quadlet.test.ts
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
