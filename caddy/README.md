# Optional Caddy gateway migration

`Caddyfile` is the production alternative to
`nginx/sites-available/stadt-land-klima.de`. `Caddyfile.staging` selects the staging
hostname and imports the same application/security rules. Choose one entrypoint
per Caddy instance. No active nginx configuration or host service is changed by
these files. Review host-specific upstream, certificate, authentication and log
collector settings before cutover.

## Build and verify

The configuration requires Caddy **2.11.7** and the pinned
[`mholt/caddy-ratelimit`](https://github.com/mholt/caddy-ratelimit) module at commit
`5625512f24f6f59d6f64fb3aafe5eecff0b286db`. The module is a separate dependency,
not part of stock Caddy. The checked `Containerfile` pins both official build and
runtime image digests and replaces `golang.org/x/net` with 0.60.0 for the
reviewed HTTP/2 fixes. Go's module checksum verification remains enabled. A stock
binary fails validation rather than starting without the rate limits.

```bash
podman build -t localhost/slk-caddy:2.11.7 -f caddy/Containerfile caddy
# Equivalent disposable test/build through Docker:
npm --prefix bin/test_suite run test:security:caddy
```

The image contains the custom binary, with no application config, certificate or
private environment file copied in. It runs as 1000:1000. File capabilities are
removed, so it can run capless on high container ports. For a host installation,
copy the reviewed binary to `/usr/local/bin/caddy` and the three config files
(`Caddyfile` or staging entrypoint, `global.caddy`, `application.caddy`) into
`/etc/caddy`. Use `caddy.service.example` as the reviewed host service template.
The dedicated `caddy` user receives only `CAP_NET_BIND_SERVICE` to listen on 80/443;
it does not need Docker/Podman group membership, a container socket, application
files, database credentials or broad read capabilities.

Run `caddy fmt --overwrite` on changed Caddy files, then `caddy validate --config
/etc/caddy/Caddyfile --adapter caddyfile`. Reload through the private Unix admin
socket with `caddy reload --address unix//run/caddy/admin.sock --config
/etc/caddy/Caddyfile --adapter caddyfile`. The service omits `--environ` and debug
logging. Administrative access is restricted by the 0700 runtime directory; no
admin TCP listener is exposed. The sample unit applies cgroup budgets, a system
service syscall allowlist and namespace/kernel protections. Validate those
systemd controls and a reboot on the deployment host before rollout.

## Routing and security parity

| nginx behavior                                           | Caddy behavior                                                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP redirects and HTTPS apex redirect                   | Explicit 301 redirects to the fixed HTTPS canonical hostname; unknown Host values do not become redirect destinations                       |
| Existing manually loaded TLS certificates                | TLS 1.2/1.3 with manual certificate paths; host/Certbot renewal remains responsible; automatic ACME is disabled                             |
| HTTP/1.1 and HTTP/2                                      | Explicit h1/h2; no additional HTTP/3/UDP listener                                                                                           |
| `/backend/` → 9001 with prefix removed                   | `handle_path` → `127.0.0.1:9001`; decoded GraphQL/hash paths, opaque JSON `deep=` and Upgrade requests are rejected first                   |
| `/ai/` → CMS `/ai/`                                      | Prefix retained, 10 MiB body limit, one-hour proxy I/O/header timeouts                                                                      |
| Normal frontend → 9000                                   | Prefix retained, 512 MiB body limit, one-hour proxy I/O/header timeouts                                                                     |
| Private legacy paths and `/_nuxt/`                       | Separate frontend branches, 1 MiB nginx-default body limit, 60-second proxy timeouts; private path access logging is skipped                |
| 502/503/504 maintenance fallback for normal frontend/CMS | Both received statuses and connection failures reach 9090; AI/private/assets retain their original error handling                           |
| Peer-derived forwarding headers                          | Caddy's untrusted-client forwarding defaults, explicit `X-Real-IP`, removal of incoming `Forwarded`; spoofed XFF/proto values are discarded |
| Fallback CSP plus application policy                     | App nonce CSP remains intact; fallback frame/object/base restrictions are appended, never substituted for the nonce policy                  |
| Headers on all responses                                 | HSTS, nosniff, frame policy, permissions and referrer policy on success/rejections/error routes; upstream Server/X-Powered-By hidden        |
| Private invitation/preview referrers                     | `no-referrer`, including percent-encoded preview keys; public fallback is `strict-origin-when-cross-origin`                                 |

The static maintenance backend receives GET without Authorization/Cookie headers;
it does not need write bodies or account credentials. This is intentionally more
restrictive than nginx's generic fallback proxy. The fallback remains a routing
fallback, not a complete editorial traffic gate. Gate writes explicitly during
maintenance/cutover.

### Rate-limit differences

nginx uses a leaky bucket; the selected Caddy module uses sliding windows. The
configuration retains independent API, frontend and asset budgets, shared API
accounting for `/backend/` and `/ai/`, an extra AI burst bound, and HTTP 429 with
Retry-After. It does not claim identical timing at window boundaries.

| Class                             | nginx rate / burst      | Caddy short / sustained windows |
| --------------------------------- | ----------------------- | ------------------------------- |
| CMS/API                           | 10/s, burst 20          | 21 / 1s and 620 / 1m            |
| AI                                | Same API zone, burst 10 | Shared API windows plus 11 / 1s |
| Frontend including private routes | 30/s, burst 60          | 61 / 1s and 1860 / 1m           |
| Nuxt immutable chunks             | 100/s, burst 500        | 501 / 1s and 6500 / 1m          |

These preserve initial burst capacity and long-window budgets, with different
refill behavior. The asset budget is separate from navigation/API budgets. The
module retains state across reloads, expires inactive per-peer entries and sweeps
every ten seconds. Unlike nginx's fixed-size zones, its memory grows with peer
count and event windows. The host unit bounds gateway memory/CPU/processes; assess
memory and denial-of-service behavior under deployment traffic before switching.
Limits key on the actual socket peer, not a client-supplied forwarding header.
If a CDN/load balancer is introduced, review explicit trusted proxy ranges,
client-IP extraction and rate keys together; trusting all private ranges would
change the security boundary.

### Privacy and diagnostics

Access logs are JSON summaries: status/size/duration/method, a fixed route class,
allowlisted user-agent family, `actorType=unknown` and `userId=null`. A gateway
cannot authenticate a Directus/website identity from an arbitrary request header;
Nuxt/Directus audit logs retain the authoritative user IDs. Query strings, raw
paths, raw headers, cookies, tokens, response headers and visitor IPs are omitted.
Legacy bearer paths skip access logging altogether.

Runtime logs also drop request/error objects, peer/key fields and replace freeform
messages with a fixed event label. Module name, severity, status and timing fields
remain available without serializing arbitrary exception/request strings. This
also filters the rate module's otherwise unconditional peer-IP logging. Use the
structured application diagnostics and a private operator reproduction to
investigate details. Do not enable Caddy `debug`, `log_credentials`, request/body
logging or rate-limit `log_key`. JSON escaping and fixed labels prevent CRLF or
forged-JSON log records. Connect error-level records to the existing alarm sink;
ordinary denials/rate limits remain info/warn.

## Certificates and configuration

Defaults match production's host upstream ports. Overrides:

| Variable                                       | Default                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `SLK_CADDY_FRONTEND_UPSTREAM`                  | `127.0.0.1:9000`                                                                                            |
| `SLK_CADDY_CMS_UPSTREAM`                       | `127.0.0.1:9001`                                                                                            |
| `SLK_CADDY_MAINTENANCE_UPSTREAM`               | `127.0.0.1:9090`                                                                                            |
| `SLK_CADDY_HTTP_PORT` / `SLK_CADDY_HTTPS_PORT` | 80 / 443                                                                                                    |
| `SLK_CADDY_CERT` / `SLK_CADDY_KEY`             | `/etc/caddy/tls/www.stadt-land-klima.de/{fullchain,privkey}.pem` (staging entrypoint uses its own hostname) |
| `SLK_CADDY_APEX_CERT` / `SLK_CADDY_APEX_KEY`   | `/etc/caddy/tls/stadt-land-klima.de/{fullchain,privkey}.pem`                                                |

Provision only the required certificate/key copies, root-owned with the Caddy
service group, directory mode 0750 and key mode 0640. Use an atomic host renewal
hook to replace copies, validate, and reload after renewal. Do not grant the
service traversal/read access to every Let's Encrypt archive or use world-readable
keys. Preserve the original nginx certificate/renewal arrangement for rollback.
No keys are stored in this repository or the image.

For rootless containers use high listener ports and cap_drop ALL, read-only config
and TLS mounts, private writable `/run/caddy`, and bounded state/temp storage. A
Caddy container cannot use host loopback for the other containers: join only the
Podman edge network and select `frontend:3000`, `directus:8055`, and
`maintenance:8080` as upstreams. Public 80/443 need an explicitly configured host
listener/socket-forwarding arrangement; do not globally lower the unprivileged
port threshold or grant host networking to bypass it. The provided host unit
avoids that extra container networking layer.

## Cutover and rollback

1. Retain nginx configuration/TLS files, a reloadable known-good state, deployment
   backups and proxy logs. Test Caddy against staging/disposable upstreams first.
   Keep the public app's origins/cookie/CORS settings unchanged.
2. Install the reviewed binary/config/certificate copies and validate under the
   dedicated service user's permissions. Use unused high ports for acceptance;
   both proxies cannot own the same public 80/443 sockets simultaneously.
3. Exercise real editor login, preview/candidate links, PDFs/uploads, AI streaming,
   nonce CSP, newsletter and maintenance. Test representative page/assets/API
   bursts and memory budgets. Preserve any active staging basic-auth control in
   the Caddy entrypoint before exposing it; the repository nginx example has it
   commented out, so it is not automatically enabled here.
4. Stop nginx only for the planned socket cutover, start Caddy, then run readiness
   and application checks. If checks fail, stop Caddy, restart the retained nginx
   service and verify readiness. The gateway migration does not change data.
5. Verify renewal/reload and reboot, then update monitoring and deployment automation
   to use one active gateway. Retain rollback files until acceptance.

## Regression coverage and observed validation

`npm run test:security:caddy` builds the pinned image (or uses an explicitly supplied
`SLK_CADDY_IMAGE`), validates both entrypoints, and runs real TLS/proxy tests with
isolated Node upstreams. It verifies canonical redirects, decoded-path/deep/upgrade
guards, spoofed forwarding headers, CSP nonce preservation, normal/encoded private
referrers, body limits, status/connection maintenance fallback, credential-free
fallback requests, private log canaries, a 180-chunk burst and independent page
rate limits. Fixtures are capless, non-root, read-only and loopback-published;
they never contact the application database or send mail. `SLK_CADDY_SECCOMP` can
apply the derived Podman profile to the fixture. The quality workflow runs this
gate alongside the existing nginx regression.

The fixture passed locally with Caddy 2.11.7 and the derived seccomp profile. Full
application traffic, live certificate renewal, the host systemd unit and a real
nginx-to-Caddy cutover remain deployment acceptance checks. See the change's audit
results in [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for the dependency fixes and
the retained parent-module OpenPGP report with an enforced package-absence gate.

References: [Caddy proxy/error handling](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy),
[request matching](https://caddyserver.com/docs/caddyfile/matchers),
[log filters](https://caddyserver.com/docs/caddyfile/directives/log),
[module algorithm and memory model](https://github.com/mholt/caddy-ratelimit).
