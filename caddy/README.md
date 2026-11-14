# Caddy gateway

Caddy is the selected gateway. `Caddyfile` is the production entrypoint;
`Caddyfile.staging` imports the same application/global rules for staging. Use one
entrypoint per instance and preserve the host's actual certificate paths,
authentication settings and private state. Architecture/security decisions are
in [PROJECT_DECISIONS.md](../PROJECT_DECISIONS.md#deployment-and-recovery).

## Build and verification

```bash
podman build -t localhost/slk-caddy:2.11.9 -f caddy/Containerfile caddy
npm --prefix bin/test_suite run test:security:caddy
```

The image pins Caddy 2.11.9, the rate-limit module commit and reviewed Go dependency
replacement. Stock Caddy lacks this module and must fail validation. The package
absence gate and retained module/import inventories remain in the build. The
image runs as 1000:1000, capless on high container ports; no certificates or
application credentials are copied into it.

For a host installation, copy the reviewed binary to `/usr/local/bin/caddy` and
the selected entrypoint, `global.caddy` and `application.caddy` to `/etc/caddy`.
Adapt `caddy.service.example`; the dedicated account needs neither engine access
nor application/database credentials. Its only host listener capability is
NET_BIND_SERVICE. Keep the admin endpoint on the private Unix socket.

```bash
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
caddy reload --address unix//run/caddy/admin.sock --config /etc/caddy/Caddyfile --adapter caddyfile
```

Validate changed files with `caddy fmt`, preserve a known-good private copy and
record actual host reload/reboot acceptance. Do not enable debug/environment
printing in the service.

## Routing and budgets

The maintained rules preserve canonical HTTP/HTTPS redirects, the separate CMS
origin/legacy-route guards, `/backend` prefix stripping, `/ai` timeouts and body
limits, public frontend routing and private route handling. They reject encoded
GraphQL/hash/deep-query/upgrade bypasses, overwrite untrusted forwarding headers
and retain Nuxt nonce CSP alongside fallback headers. Private invitation/preview
routes have no-referrer behavior and omit request-path logging.

Only `/embed/wahlcheck/{slug}` grants the explicit checked HTTPS LocalZero/
GermanZero partner origins; other routes retain self-only framing. Deploy matching
frontend and gateway policies together. Maintenance is a fallback for frontend/CMS
status/connection failures, not a general editorial write lock. It receives GET
without application credentials.

| Budget                  | Caddy windows                     |
| ----------------------- | --------------------------------- |
| CMS/API                 | 21 requests/second and 620/minute |
| AI                      | Shared API windows plus 11/second |
| Frontend/private routes | 61/second and 1860/minute         |
| Immutable Nuxt assets   | 501/second and 6500/minute        |

These are sliding windows keyed by the socket peer. Keep asset/page budgets
separate and bound gateway memory/process use; peer/window state grows with
traffic. A new CDN/load balancer requires a deliberate trusted-proxy/client-IP
review, not trust of arbitrary incoming forwarding headers.

## Certificates and private state

The supplied entrypoints load explicit certificate paths and disable automatic
ACME. Keep private certificate copies readable only by the Caddy service and
coordinate their renewal/reload. Do not give the gateway broad access to unrelated
certificate archives or make keys world-readable. Containers need read-only
configuration/TLS mounts, private bounded writable state and high ports.

### Domain changes on hosts using automatic HTTPS

The former Future host uses an ACME-enabled host configuration, rather than the
manual-certificate entrypoints above. Its active `/etc/caddy/Caddyfile` must name
every public hostname: `stadt-land-klima.de`, `www.stadt-land-klima.de`, and the
separate `directus.stadt-land-klima.de` CMS origin. The apex needs its own valid
certificate even when it immediately redirects to HTTPS `www`. DNS changes alone
do not add hostnames to Caddy's certificate management. Preserve the existing
isolated CMS/legacy-route guards when changing the website hostnames.

Check both A and AAAA records against the server's configured addresses before
reloading. On this host the published IPv6 address is retained in
`/etc/netplan/60-slk-public-ipv6.yaml`, alongside the original addresses and routes.
Keep Netplan input files private, but generate networkd configuration with
`(umask 022; netplan generate)` and verify that `systemd-network` can read the
generated `.network` file before reloading networking. An unreadable generated
file can make networkd select its fallback DHCP configuration.

Validate the proposed Caddyfile as the `caddy` user with the service's state
directories, retain the previous Caddy/Netplan configuration, and reload Caddy.
Verify hostname/chain trust without bypassing TLS validation, the apex-to-`www`
redirect, website/CMS responses, and IPv4/IPv6 reachability. Certificates and
account keys stay in Caddy's private persistent state; its automatic HTTPS handles
renewal. See the [Caddy automatic HTTPS requirements](https://caddyserver.com/docs/automatic-https)
and [Let's Encrypt IPv6 validation rules](https://letsencrypt.org/docs/ipv6-support/).
The 2026-11-10 live cutover passed these checks; a future renewal cycle and reboot
remain separate manual acceptance checks. Application public URLs and asset CORS
origins are a separate part of a domain cutover and must also match the chosen
website origin.

## Maintenance and acceptance

Application deployments run `podman/maintenance/Containerfile` from the same Caddy
image family. It serves the existing HTML, logo and public analytics metadata on
unprivileged port 8080, published to loopback 9090. Config/API admin is disabled;
files use the same fallback/cache behavior. Metadata is a read-only runtime mount,
generated from allowlisted public settings when maintenance starts/restarts;
private application keys never enter that script or image.

The `test:security:caddy` fixture validates all four entrypoints with trusted temporary
TLS and isolated Node upstreams. It covers redirects, query/path/upgrade guards,
forwarding, nonce CSP, referrers/log canaries, body bounds, maintenance fallback and
independent static/page budgets and 180-chunk CMS admin loading. No application database or mail is used. Actual
certificate renewal, rootless engine behavior, host systemd/reboot and full traffic
acceptance remain target checks. `SLK_CADDY_IMAGE` selects a reviewed prebuilt image;
`SLK_CADDY_SECCOMP` applies the derived confinement profile to the fixture.

## Future: isolated Directus origin

`Caddyfile.future` serves the website on `future.stadt-land-klima.de` and the CMS
on `directus.stadt-land-klima.de`, with automatic ACME certificates configured by
`global.future.caddy` and shared `global-options.caddy`. Both hostnames must resolve
to Future before switching the application's public CMS URL. Do not point a Future
CMS hostname at the production server.

Install the maintained files unchanged. `Caddyfile.future-bootstrap` provisions the
second TLS/proxy hostname while the existing website prefix still works; it is an
explicit temporary phase, not a completed security cutover. After activating and
checking the application with its new public CMS origin, select `Caddyfile.future`.
Its `legacy-cms.caddy` redirects GET/HEAD Admin and asset bookmarks, expires the old
host cookies and returns 410 for the former authenticated API and AI aliases.
`/backend` also retains a Nuxt compatibility redirect for other gateway setups.

`directus.caddy` retains denied GraphQL/hash/deep/upgrade routes and separate API
and static budgets. Browser writes from sibling/cross-site origins are denied.
Only the configured CMS origin is allowed by Directus CORS. Website image/SVG
requests have Cookie, Authorization and query access tokens removed, and receive
credential-free CORS for the exact Future website origin. CMS-origin asset requests
retain their personal authorization, so private Admin previews still work.

The deployment environment migration sets secure host-only `__Host-` session and
refresh cookies with SameSite Strict. SameSite alone does not isolate sibling
subdomains. Retire old-origin interactive sessions after cutover; service/static
credentials and candidate/municipality-preview tokens remain untouched.

The real TLS fixture in `bin/test_suite/src/caddySecurity.ts` validates all four
entrypoints, redirects, closed legacy APIs, cross-origin write denial, credential
stripping on public assets, retained private asset authorization, 180 admin chunks,
continued API rate limiting and filtered logs. DNS/ACME and authenticated editorial
flows remain live deployment acceptance checks.
