# Caddy dependency review — 2026-10-26

The optional gateway builds Caddy 2.11.7 with the fixed rate-limit module commit
recorded in `Containerfile`, using digest-pinned official build/runtime images.
The observed compiler was Go 1.27.3. Go checksum verification stays enabled.

The first `govulncheck` 1.9.0 binary scan reported five HTTP/2 findings against
`golang.org/x/net` 0.59.0: GO-2026-6603, GO-2026-6610, GO-2026-6611,
GO-2026-6612 and GO-2026-6617. The build now explicitly replaces that dependency
with **0.60.0**, the fixed version reported by the Go advisory database. The
rebuilt binary scan no longer reports those five findings. Proxy/TLS/security
regressions are rerun on the patched binary.

The raw scan still reports **GO-2026-5932**, the advisory for the deprecated
`golang.org/x/crypto/openpgp` family, against the parent x/crypto module. It has no
upstream fixed version. This finding is retained in the review, not described as
a clean raw scan or suppressed across x/crypto.

For this exact Caddy + plugin entrypoint, `go list -mod=readonly -deps` produced
1,030 imported packages, **none** in `golang.org/x/crypto/openpgp` or its child
packages. `go mod why golang.org/x/crypto/openpgp` confirmed that the generated
main module does not need that package; binary string inspection also found no
such package paths. Thus the parent module is present for other crypto functions,
while the affected OpenPGP packages are absent from the gateway's import graph.
No OpenPGP interoperability is implemented by this configuration.

The Containerfile now checks the exact generated entrypoint graph and **fails
if any affected OpenPGP package is introduced**. It retains that import inventory
and the resolved `go.mod`/`go.sum` under `/usr/share/slk-caddy/` in the final image
for inspection. This is an absence check, not a patch to the deprecated library.
Recheck the package inventory and the raw vulnerability report whenever Caddy,
its build image, the dependency replacement or the rate module is changed; any
other finding requires review and must not inherit this disposition.

Runtime limits are separate from dependency review: the host example grants only
NET_BIND_SERVICE, uses a private Unix admin endpoint, read-only configuration and
certificate copies, syscall/namespace controls and cgroup budgets. The high-port
image runs non-root with all capabilities dropped in the integration fixture.
Automatic ACME/PKI provisioning is disabled in the supplied Caddyfiles, and no
admin TCP listener is exposed. Live host unit/renewal/cutover checks remain pending.

References: [HTTP/2 fix](https://pkg.go.dev/vuln/GO-2026-6617),
[OpenPGP advisory and affected package list](https://pkg.go.dev/vuln/GO-2026-5932),
[Caddy 2.11.7 dependency manifest](https://github.com/caddyserver/caddy/blob/v2.11.7/go.mod).
