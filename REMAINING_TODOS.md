# Remaining deployment work and maintenance decisions

Reviewed 2026-10-24. The Tailwind/DaisyUI migration is committed as `090c80af`; the security closure changes are reviewable in the current diff. Directus remains **11.17.4**. This document separates repository implementation from operator acceptance: no production deployment, remote CI execution, credential retirement or production database cutover was performed here.

## Owner decisions resolved

No unresolved mandatory policy choice remains for this deployment. The owner explicitly retained existing candidate access tokens on 2026-10-24; this is a deliberate `retain` selection rather than the previous unresolved `review` state.

| Item                                                        | Recorded decision                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Candidate invitation credentials (`candidate.access_token`) | Retain existing tokens and invitation links; no rotation or replacement invitations for this deployment |
| Municipality preview links                                  | Retain, per the owner's earlier decision                                                                |
| Directus version                                            | Keep 11.17.4 with the reviewed backports                                                                |
| Browser-exposed shared identity                             | Retire after replacement private access is working                                                      |

A CMS hostname migration, separate runtime/migrator DB roles and TypeScript 7 remain later enhancements. The rollout preserves the existing CMS hostname. Native-platform acceptance, actual server configuration, credentials, backup restoration and integrations remain verification tasks rather than new policy choices. The release maintainer must reassess the pinned-image review by **2026-11-24**.

## Repository closure

- [x] Nuxt/TypeScript phases 0–8, Blökkli 2, Tailwind 4.3.3/DaisyUI 5.7.50, strict checking, zero-warning lint and maintained-source formatting.
- [x] Private CMS access, bounded public DTOs, protected candidate/editor sessions, nonce CSP, CAPTCHA replay prevention, atomic Redis abuse controls and deployment/import sequencing.
- [x] Pinned Directus authorization-before-side-effect backports, authenticated manual-flow checks, sensitive-settings field restrictions including old persisted wildcard grants, mail-template traversal/symlink rejection, and AI attachment downloads through validated HTTP agents. AI remains enabled; its configured providers require target acceptance.
- [x] Rebuilt-image dependency review and locked replacements, including Sharp/libvips, Nodemailer, LiquidJS, proxy-addr, simple-git and Zod. All fourteen extension toolchains now override affected Zod 4 copies with 4.6.7. Exact vendor source/version drift refuses the build.
- [x] Complete paginated search reconciliation across all document types, parent publication checks, successful asynchronous task verification and fail-closed search readiness. Search additionally rechecks live publication/member visibility before returning cached hits. Canonical hook IDs match the frontend index.
- [x] Optional startup-check alignment for private service and current editorial roles; missing required secrets fail and production checks reject elevated flags, database ownership and direct/nested membership of privileged roles. The legacy `KEY` identifier is retained; only actual signing credentials receive secret-strength checks. Documented `replace-with-` credential placeholders are rejected. Checked against the imported local permissions without enabling checks on an unprepared production host.
- [x] PR and weekly quality workflow for strict checking, lint/format, unit/CLI regressions, all extension builds and the rebuilt-image advisory review. Manual deployed acceptance workflow covers public routes, CSP and styles. Existing explicit full HTTPS/security profiles remain available for isolated writable fixtures. A manual `native-frontend.yml` workflow now installs/builds on macOS and Windows without application credentials; execution on those runners is still unverified until the owner runs it.

See [SECURITY_HARDENING.md](SECURITY_HARDENING.md#security-closure-review--2026-10-24) for current evidence and advisory dispositions. Passing local checks does not establish that these changes or workflow protections are installed on a remote target.

## Required deployment acceptance

Follow [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) in order. These are rollout actions, not missing framework migration phases.

1. Keep a fresh off-host database/uploads/configuration/proxy backup, preserve `docker/core-storage/<environment>.compose.json`, verify restoration on isolated staging and budget disk/RAM for old data, dumps, images and builds. Do not rerun already completed PostgreSQL/Meilisearch major upgrades.
2. Deploy matching source/locks/images and all extension bundles to staging. Use `start_production.sh --import --prepare-only` for the first access split, then provision private service identities before starting the frontend. The maintenance container is a fallback, not an editorial write lock.
3. Rehearse the non-superuser database application-role cutover on restored staging data with actual imports/extensions and backup restoration, then apply it on production. Keep the bootstrap operator separate. Enable optional startup checks only after the host meets them.
4. Configure canonical `PUBLIC_URL`, private service credentials and a unique strong `ALTCHA_SECRET`. Install the host nginx changes, run `nginx -t`, reload, and verify real loopback/firewall boundaries, allowed origins, resource limits and the disabled cache/TUS/WebSocket/MCP surfaces.
5. After replacement access is live, retire the formerly browser-exposed identity and all aliases. Review `src/directus/cli/credential-rotation.yaml`; candidate access tokens and preview links are explicitly set to **retain**. Rotate other known/example/exposed credentials through their own provider/account workflows. Environment bootstrap passwords do not change existing accounts.
6. Confirm search reconciliation completes, public search excludes private/unpublished/obsolete records and identified stale application/CDN responses are purged. Do not `FLUSHALL` Redis. Review historical URL-bearing log retention separately.
7. Verify the deployed public/candidate/editor/media flows and real configured integrations, inspect CSP/rate-limit/Redis failures and record revision/date/restore/smoke evidence. The earlier staging homepage hydration warning requires a fresh deployed check. Do not run writable full workflows against production data.
8. Once merged/pushed by the owner, verify the workflows run remotely and configure required checks in repository branch protection. Local workflow review cannot establish remote activation or permissions.

## Explicit upstream patch maintenance

- **node-forge:** retain the source-hash-verified PKCS#1 backport and nonempty-NULL protection until an independently reviewed fixed upstream release is compatible. The raw frontend audit still reports seven high graph entries for that dependency chain; no blanket suppression or framework downgrade was added. The raw audit workflow deliberately keeps these visible.
- **Pinned image:** raw findings remain in the machine-readable image report. `audit:directus-image:reviewed` requires exact package/version/advisory dispositions, the production configuration controls and passing image regressions. Unknown findings and an expired review fail. The current review expires **2026-11-24**; renew it with evidence rather than extending the date mechanically.
- **Directus source/dependency overlays:** keep the original source hashes, exact dependency replacements and compatible API regressions. A new base image/layout requires a fresh review. Do not upgrade Directus beyond 11.17.4 without explicit authorization.

## Choices and later enhancements

- **CMS origin:** a separate hostname is recommended defense in depth and can use the same physical server. The deployment checklist retains the current origin; a hostname migration needs coordinated DNS/TLS, host-only cookies, restricted CORS, public URLs and retirement of old-origin sessions/UI. A shared origin still increases the consequences of website XSS for logged-in CMS users.
- **Developer platforms/browser support:** Linux host/container builds and Chromium/Firefox/WebKit checks are recorded. Run `.github/workflows/native-frontend.yml` after pushing, or native macOS/Windows installs/dev/builds on those machines; do not copy `node_modules` across platforms. Confirm the Tailwind browser floor fits the audience (Safari 16.4+, Chrome 111+, Firefox 128+); exact historical minimum versions were not exercised.
- **Candidate credential lifecycle:** existing access tokens are retained by owner decision. Future expiry, hashing at rest, replacement invitations and removal of legacy bearer/path entry points are separate enhancements. Encrypted sessions and fragment invitations do not revoke pre-existing bearer credentials. Preview sensitivity remains low per the owner's decision.
- **Database privileges:** the app-role tool separates the bootstrap operator but retains schema DDL needed by code-first imports. A separate runtime/migrator role is a future tightening, not an implemented split.
- **TypeScript/Blökkli:** keep TypeScript 6.0.3 until TS 7 is supported by Vue/tooling/editor peers. Blökkli's alpha status remains an ongoing compatibility risk.
- **Build delivery:** immutable CI-built artifacts could reduce deployment disk/RAM requirements; this is an optional workflow change.

## Integration and coverage acceptance

Actual authenticated StadtLandZahl DTO parity, SMTP/Listmonk delivery and double opt-in, provider-backed AI/Unsplash, external bookings and analytics arrival require configured target environments. No real external booking or production credential rotation was performed by the local tests. StadtLandZahl's OpenAPI generation remains deferred (20 operations, 12 response schemas, eight without response schemas).

[FEATURES.md](FEATURES.md) retains targeted/partial/manual/no-dedicated coverage labels. Long-lived/multi-tab/session expiry, native platforms and real recovery exercises should gain coverage where useful; do not slow the default suite with the explicit full HTTPS/infrastructure profiles. Search's conservative pre-delete hook may temporarily hide a result if a database deletion later fails; reconciliation repairs it and live visibility checks prevent disclosure.
