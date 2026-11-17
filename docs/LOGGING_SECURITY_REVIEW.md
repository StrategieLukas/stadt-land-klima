# Logging binary review — 2026-11-17

**Activation is pending patched/reviewed binaries.** Repository configuration is
prepared, but the currently published Linux x64 archives below are not a clean
security baseline. Do not bypass the installer guard or interpret successful
syntax/pipeline tests as vulnerability clearance. No binaries are committed or
installed by this change.

`govulncheck` v1.9.0 in binary mode returned vulnerability findings (tool status 3)
for the official release artifacts:

| Artifact                              | Archive SHA-256                                                    | Build runtime | Findings                                               |
| ------------------------------------- | ------------------------------------------------------------------ | ------------- | ------------------------------------------------------ |
| Alloy 1.22.0, `alloy-linux-amd64.zip` | `62d177feb18c9b6ffd636c8273aa82a6afc75a507d096ff951749df23c3176f9` | Go 1.27.3     | GO-2026-6859; GO-2026-5932; GO-2022-0646; GO-2022-0635 |
| Loki 3.7.10, `loki-linux-amd64.zip`   | `200e74f7e631969bd0f2a066a2e1d33cdea9b3c0801aaaa7d78947c4ac29bddb` | Go 1.26.10    | GO-2026-6859; GO-2022-0646; GO-2022-0635               |

Checksums authenticate matching the published archive, not its security.
Raw scan output stays in private `.reports/logging-tools/` and is not committed.
Reproduce against the actual intended installed binary, not just its version tag:

```bash
go run golang.org/x/vuln/cmd/govulncheck@v1.9.0 -mode=binary /path/to/alloy
go run golang.org/x/vuln/cmd/govulncheck@v1.9.0 -mode=binary /path/to/loki
```

## Interpretation

- [GO-2026-6859](https://pkg.go.dev/vuln/GO-2026-6859) concerns an HTTP/1 server
  crash through a MaxBytesReader header race. The listed release builds predate
  the fixes in Go 1.26.11/1.27.4. The host installer rejects affected/unknown Alloy
  build runtimes. This is separate from checking the product version.
- [GO-2026-5932](https://pkg.go.dev/vuln/GO-2026-5932) identifies legacy unsafe
  OpenPGP code included in Alloy's broad distribution. No OpenPGP integration is
  configured here, but no source-level reachability proof is claimed.
- [GO-2022-0646](https://pkg.go.dev/vuln/GO-2022-0646) and
  [GO-2022-0635](https://pkg.go.dev/vuln/GO-2022-0635) concern AWS S3 client-side
  crypto code. This setup uses local filesystem Loki storage and no AWS collector,
  reducing the configured paths into that code. That is a configuration assessment,
  not a clean scan or a demonstrated absence from the linked binary.

Binary symbol scanning is conservative and does not establish an exploitable
path through the configured components. Equally, an unused configured feature,
a loopback listener or gateway authentication does not remove a binary finding.
Keep raw findings visible; do not suppress advisories to obtain a pass.

## Before activation

Prefer a patched supported vendor package/release, updating the version pin,
checksums and tests in Git together. Alternatively review a reproducible build of
the pinned source with a fixed supported Go runtime, and assess the remaining
module findings against that exact artifact/source graph. The installer runtime
guard only addresses the known Go advisory; it is not a complete binary scanner.
Repeat vulnerability, syntax, pipeline and isolated gateway checks, then perform
the authorized host/monitoring acceptance in [the runbook](CENTRAL_LOGGING.md).

The alternative collector/backend comparison remains relevant: a narrower
distribution and stable disk buffering may justify choosing Vector/Fluent Bit and/or
VictoriaLogs. Their actual release artifacts need their own review; the comparison
does not certify them free of vulnerabilities.
