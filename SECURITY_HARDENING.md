# Security hardening implemented on this branch

Current implementation record, consolidated on **2026-10-23** for `0000-security-updates` based on `12ae0873` plus the current working tree. This replaces the uncommitted architecture, migration, phase and security-review documents. The original S01–S17 finding identifiers are retained below for traceability. Committed reviews remain historical checkpoints; this document and [REMAINING_TODOS.md](REMAINING_TODOS.md) describe the current state. [FEATURES.md](FEATURES.md) remains the detailed functionality and regression-coverage inventory.

**Nuxt and TypeScript phases 0–8, the Blökkli 2 migration and the locally implemented hardening are complete. This does not mean every vendor advisory, production operation or integration is resolved.** The core/runtime hotfix was reported successfully deployed to staging and production; deployment of this complete security branch and production credential retirement have not been established by local tests.

## Installed stack

Versions below are from repository manifests/lockfiles or declared runtime images, not a claim that every deployed host already uses them.

| Component                                       | Current version / state                                       |
| ----------------------------------------------- | ------------------------------------------------------------- |
| Nuxt / Vite / Vue                               | 4.6.2 / 8.3.5 / 3.5.44                                        |
| Blökkli                                         | 2.0.0-alpha.73                                                |
| TypeScript / vue-tsc                            | 6.0.3 / 3.3.13                                                |
| ESLint / Nuxt ESLint config / typescript-eslint | 10.13.0 / 1.17.0 / 8.72.0                                     |
| Tailwind CSS / DaisyUI                          | **3.4.19 / 4.12.24**; version 4/5 migration has not happened  |
| Frontend / Directus Node runtimes               | 24.22.1 / 22.23.4                                             |
| Directus                                        | **11.17.4**, explicitly retained; no authorization to upgrade |
| Directus optional storage-driver Undici         | Locked replacement 7.30.1                                     |
| PostgreSQL / PostGIS                            | 17.11 / 3.6.4, digest-pinned `postgis/postgis:17-3.6` image   |
| Meilisearch / Redis                             | 1.55.0 / 8.10.2-alpine                                        |
| Maintenance nginx / Typst                       | 1.30.6-alpine / checksum-verified 0.15.1                      |

The frontend manifest and lockfile both confirm Tailwind 3 and DaisyUI 4. Their next major versions remain a separate coordinated CSS/theme migration. TypeScript 7 is also deferred for actual lint/editor/Vue compatibility.

## Architecture and public data boundaries

The implemented choice is Nuxt server routes with explicit authorization and response contracts. Alternative framework rewrites were evaluated, not implemented. A different framework or a server-held API key alone cannot prevent an endpoint from returning private records. SSR HTML, hydration payloads, browser responses and search indexes all count as public disclosure surfaces.

Completed work for **S01–S04, S06 and S08**:

- Removed the shared privileged Directus credential from browser runtime configuration and client plugins. Maintained website data requests use same-origin Nuxt endpoints and checked DTOs.
- Split private server, limited public-asset and preview-verification identities. Anonymous endpoints do not fall back to an administrator credential. The public-role YAML was left unchanged; roles, permissions, flows and schema remain code-first.
- Added explicit fields, runtime validation and publication/parent/catalog checks before fetching or serializing public records. File metadata and bytes follow their own visibility checks. Draft blocks require a published owner and published block; page/news and nested-content boundaries are checked.
- Bound candidate answers to the authenticated candidate and election, published questions and the Europe/Berlin deadline. Integer scores 0–4 or explicit null, lengths, batch size, duplicate IDs and unexpected fields are validated server-side.
- Tightened local-team relation ownership on creation. The `localteams.elections` reverse relation supports the actual `$CURRENT_USER` rule; migration actor tests cover owned success and foreign denial for both local roles.
- Corrected search lifecycle behavior: UUID and legacy-slug cleanup, pre-delete snapshots, unpublish/draft removal and republish restoration. Existing deployed indexes still need reindexing during rollout.
- Replaced the generic StadtLandZahl credential proxy with permitted paths/methods and private credentials, bounded bodies and origin/target/redirect controls. Live authenticated external integration is a separate verification step.

Implementation is under `src/frontend/server/`, checked contracts under `src/frontend/shared/`, and code-first policy files under `src/directus/`. The inventory identifies exact routes, roles and targeted actor tests; it does not count incidental page loading as feature coverage.

## Candidate and website editor sessions

Candidate exchange now uses an encrypted, HttpOnly, SameSite H3 cookie with a two-hour session, origin/CSRF checks and database credential revalidation. Header session overrides are disabled. New invitations use `/elections/thesen#token=<UUID>`, followed by exchange and URL cleanup. Candidate/preview routes suppress analytics and use private referrer behavior. Municipality previews verify the credential privately and return a constrained projection rather than exposing the shared verifier credential or a general CMS client. Legacy bearer/path entry points remain compatible; their retirement is an operational decision, not a completed removal.

The website editor now uses `/api/editor/session/*` and `/api/editor/cms/[...path]`:

- The encrypted cookie contains an opaque session ID and CSRF material. Personal Directus access/refresh credentials live in Redis with a seven-day session TTL.
- Redis NX refresh locking serializes concurrent refreshes. Conditional updates prevent an in-flight refresh from resurrecting a logged-out session. An expected-user check rejects stale tab identities.
- CMS requests use the person's permissions, with origin/CSRF enforcement and bounded route/query/body handling. Allowed item/file/folder/asset/permission and editor operations do not create an unrestricted auth/system/GraphQL proxy.
- Publish bodies are bounded at 5 MB and uploads at 50 MB. Returned credentials are stripped; private asset responses use sandbox/no-store protections and preserve supported ranges.
- Website JWT localStorage and private-image `access_token` query usage were removed. Users must sign in once after deployment.

This changes the website session, not Data Studio's own browser session. A separate Data Studio origin and old-session retirement remain in [remaining work](REMAINING_TODOS.md#data-studio-isolation).

## Spam, forms and mail

Completed work for **S05, S07 and S13**:

- ALTCHA verification is purpose/expiry bound with atomic Redis replay prevention, strong production-secret checks and no production development bypass.
- Signed mathematical challenges validate purpose, time, MAC and exact answer shape. They are an additional abuse control, not proof that a submitter is human.
- Redis sliding windows use server time and atomic Lua operations with unique event IDs. Keys hash peer identity; production nginx overwrites the trusted `X-Real-IP`. Mutations and expensive PDF requests fail closed when their limiter is unavailable; read fallback is bounded.
- Endpoint and media budgets differ. Invalid contact attempts and successful mail delivery have separate limits.
- Generic form delivery resolves the exact saved form inside published owner content. Recipient, title, accepted fields and copy behavior come from trusted content, with global/form/copy delivery quotas. Caller-supplied recipient overrides and unknown owners/forms/fields cannot select delivery targets.
- Registration mail webhooks require an authenticated administrator and use a fixed welcome template. Configured public flow aliases supply only UUIDs; authenticated execution uses the private CMS base with redirects rejected. Notification HTML is escaped.
- Newsletter requests accept only public allowed lists, with request limits and existing double opt-in. Live SMTP/Listmonk delivery still needs configured-service verification.

Random strings in every contact field are consistent with automated form probing or spam submissions. The sample alone does not identify an operator or prove a particular campaign motive. These changes close replay/routing weaknesses and bound abuse; no claim is made that CAPTCHA eliminates all automation.

## HTML, CSP, analytics and reverse proxy

Completed work for **S09 and S15**:

- Shared SSR/browser sanitization uses `sanitize-html` and `entities`, retaining supported Markdown/SVG while constraining unsafe tags, attributes and URL protocols. HTML sinks require an approved sanitizer; narrowly scoped static-source SVG exceptions are explicit.
- Nuxt Security 2.6.0 enforces fresh per-response script/style nonces. Script `unsafe-inline` and `unsafe-eval` are absent. Style attributes remain deliberately supported for Vue, maps and charts; static SVG style hashes are explicit.
- Browser Zod uses the JIT-free integration, Vega uses its AST interpreter, and chart/tooltip styles are external. CAPTCHA uses external CSS and the same-origin SHA worker. Calendar booking uses a lazy native iframe instead of loading the external SDK.
- Plausible v33 is a reviewed local asset with source digest and SHA-384 SRI manifest. Repinning rejects an unreviewed implementation change. Candidate/preview event suppression works across SPA navigation as well as initial load.
- Maintained nginx configuration adds fallback security headers, HSTS, nosniff, frame restrictions and an explicit CORS allowlist. Production WebSocket/MCP entry points are disabled, app/backend ports are loopback-bound, and proxy buffers accommodate nonce CSP headers.
- Edge guards reject opaque/encoded deep-query bypasses while preserving supported bracketed queries, and block unused Directus GraphQL/hash utilities including encoded/case variants. The separate StadtLandZahl integration is preserved.
- Access logs omit query strings and Referer; legacy candidate access logging is disabled. CSP reports are bounded and retain directive information without token-bearing URLs or script samples. Error/security logging remains enabled.

These controls were exercised against the maintained nginx and production build, not only source-string assertions. Host proxy rollout and remaining upstream/error/CDN log review are still required. Header suppression does not promise to remove nginx's own `Server` header everywhere.

## Runtime and pinned Directus safeguards

**Directus remains 11.17.4.** `docker/directus/security-patches/patch-api.ts` checks exact upstream source digests before applying narrow runtime guards; unexpected source bytes fail the image build:

1. Reject inherited/dotted/bracketed dangerous deep setter paths and excessive nesting, including nested opaque requests through the website proxy. Ordinary field names such as `name` and `length` remain valid.
2. Allowlist geometry subtypes before PostGIS raw DDL construction.
3. Check resolved resize dimensions, including raw canvas expansion, against the 4096 limit rather than checking only input image metadata.

Response caching and TUS are forced off; image transform concurrency is bounded by `SLK_ASSET_TRANSFORM_CONCURRENCY` (default 8). Normal eight-image bursts have regression coverage. Disabling unused WebSocket/MCP/GraphQL/hash paths reduces reachable surfaces. These are targeted mitigations for **S11/S14**, not a complete upstream security backport. Remaining AI/settings, flow/template/service and bundled-library findings are listed in [REMAINING_TODOS.md](REMAINING_TODOS.md#pinned-directus-and-vendor-findings).

The October Node runtime fixes are installed in the declared frontend/Directus images; `patch-undici.ts` also verifies replacement of the separate optional storage-driver copy. The Directus file-import path can reach the native Brotli decoder under relevant upstream/upload conditions. Old runtimes therefore had a plausible availability/memory-safety exposure; this review did not demonstrate exploitation or establish compromise. Node 23 is unsupported and is not a maintained patch target.

Dockerfiles update base OS packages. Maintenance nginx was updated, and Typst downloads are checksum verified. PDF execution uses bounded input, `execFile` timeout/SIGKILL and output buffering rather than an unbounded process. Production frontend/Directus memory defaults are 6 GB/2 GB and configurable; host capacity must be checked before rollout.

For **S16**, `csvjson` was replaced with `csv-stringify`; formula escaping covers all six dangerous leading-character cases while preserving CSV semantics.

## Core services and data-preserving upgrades

For **S17**, the main-branch hotfix and merge brought PostgreSQL 13/PostGIS 3.1 to PostgreSQL 17/PostGIS 3.6, Meilisearch 1.8 to 1.55.0 and Redis to explicit 8.10.2. A `redis:6` image reference does not select an 8.x image by semver; declared tags, old containers and the actual running binary must be inspected separately. Redis supports sessions, quotas, synchronization and other application state even with Directus response caching disabled.

`bin/upgrade_core_services.sh` and startup guards provide explicit migration rather than silently attaching new major images to old data:

- Export all non-template PostgreSQL databases and roles; restore into separate storage, handle SCRAM/bootstrap credential compatibility, and compare restored rows including geometry EWKB hashes.
- Export/import Meilisearch dumps and verify index documents, settings and key permissions. Preserve originals and private backups until validation succeeds.
- Guard Linux directory cutover against collisions and incompatible versions, with recovery metadata and rollback helper.
- Offer explicit `--logical` migration for named volumes/custom paths/macOS layouts, activating fresh named volumes only after verification. Normal scripts load the generated host-specific `docker/core-storage/<environment>.compose.json` overlay. It must be backed up.
- Inspect stored versions even after source containers are removed. Real disposable Linux named/custom-storage tests cover multiple databases, spatial rows, roles and search; native macOS execution remains platform coverage to obtain.

See the retained [core-service review](CORE_SERVICE_SECURITY_REVIEW.md) and [README deployment instructions](README.md#logical-core-storage-migration). Do not repeat an already completed major migration or prune stopped source containers during recovery.

## Framework, editor and TypeScript phases

The Nuxt/Vite/Blökkli stack was upgraded together. The Vite integration retains Blökkli virtual-file handling; obsolete V1 patching was removed. Raw SVG imports preserve `CanonicalButton` behavior. Rolldown native bindings remain optional platform dependencies: installation selects the current OS/CPU rather than requiring all bindings. Linux runtime/build and macOS ARM/Windows x64/Linux ARM resolution checks passed; native execution on those other hosts was not established. Do not share `node_modules` between operating systems.

| Phase                               | Completed result                                                                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Reproducible baseline           | Failure-propagating runner, actor/token-revocation checks, corrected data contracts and explicit feature-coverage inventory.                    |
| 1 — Framework/editor compatibility  | Nuxt 4 and Blökkli 2 adapter/editor migration, then compatible current Nuxt/Vite/TypeScript upgrades.                                           |
| 2 — Checking toolchain              | Compiler, Vue, lint and source-inclusion gates integrated into build/test workflows.                                                            |
| 3 — Typed vertical slice            | Shared contracts and jobs/candidate-write slices with runtime validation and rejecting boundary tests.                                          |
| 4 — Shared state and clients        | Typed plugins, request-scoped locale/translations, state, composables and shared API clients.                                                   |
| 5 — Reusable components             | Maintained Vue component conversion, checked props/emits and repaired component behavior.                                                       |
| 6 — Pages and APIs                  | Maintained pages and API feature families checked end to end; CAPTCHA contract and route regressions repaired.                                  |
| 7 — Editor/visualization boundaries | Checked persisted block model, editor recovery/permissions and constrained external chart/map contracts.                                        |
| 8 — Permanent strictness            | Zero diagnostic baseline across app/server/shared/node and Vue; source inclusion, scripts, checked JS tooling and unsafe/promise lint enforced. |

Strictness includes unchecked-index access, exact optional properties, return/fallthrough checks and exhaustive-switch/unsafe-value/promise rules. No refreshable diagnostic baseline remains. Translation generation/checking covers 1,072 keys in German, English and Italian at the last accepted run.

Blökkli bundle registration, defaults, actual props, nested fields and editable configuration are checked together. Unsupported, malformed or cyclic persistence input is rejected rather than truncated. Revision conflicts, atomic publication, server/local recovery and personal-permission cache isolation are covered. Existing nested content/media-library behavior is retained.

Vega specs/data/endpoints and map inputs have checked boundaries. Renderer URLs reject executable/file/data schemes, protocol-relative URLs and private application routes; fetches omit credentials and reject redirects. External HTTP(S) datasets remain supported: this is not an external-host allowlist. Native renderer vocabulary is preserved, and GPU-dependent rendering/exports still need manual acceptance. StadtLandZahl OpenAPI generation was evaluated but not claimed complete: 20 operations include only 12 response schemas, and live authenticated parity remains unverified.

## Directus extensions, CLI and credential tooling

All 14 maintained extensions enforce strict `tsc`/`vue-tsc` before bundling, with source-inclusion checks and negative compiler probes. Actual host-context, Knex, consent, Unsplash and template issues found by the gates were repaired. [The retained extension review](DIRECTUS_EXTENSION_TYPES_REVIEW.md) records the earlier checkpoint.

The operational CLI implementation is TypeScript; `index.mjs` is a minimal executable bootstrap. The strict gate includes 52 sources at the latest run. Fixed defects include import pagination, asynchronous sequencing, scoped flow-operation keys, source/input validation, language traversal, portable exports and destructive orphan handling when input is missing. Build/startup/import failures propagate. This does not imply that every multi-step import is transactional.

Credential-retirement tooling supports private read-only plans and resumable application. It scopes suspension to legacy Frontend-role accounts, protects Frontend-Server/Public identities, respects candidate UUID and municipality 64-character credential columns, checks instance/website/inventory/token drift and clears relevant cache. Plan/link artifacts are mode 0600 and contain secrets. No production rotation or candidate mail was performed by these local checks. Operator commands are in [README](README.md#planned-credential-retirement).

## Lint, regression suite and repairs found by testing

Frontend and extension ESLint both enforce **zero warnings** with `--max-warnings 0`. Formatting is a separate command. Frontend explicit-any, unsafe-operation, floating-promise and unsafe-HTML rules remain rejecting gates. Extensions use their own host-aware lint configuration plus strict compiler gates; their dynamic callback allowances are not equivalent to frontend unsafe-type enforcement.

The runner propagates setup, assertion and cleanup failures. Disclosure checks inspect/drain HTTP payloads and loaded JavaScript and fail closed on capture errors. Fixtures clean up synthetic records. The default suite is intentionally fast; full HTTPS, infrastructure and migration profiles remain explicit.

Additional regressions repaired during hardening include:

- Tour media now resolves the private server CMS URL rather than requiring public build-time configuration; authorization, drafts and ranges are tested.
- Normal asset bursts no longer hit an accidentally over-restrictive concurrency cap.
- Credential redaction permits the documented draft nesting plus response envelopes while still rejecting excessive depth.
- Escape handling uses the supported global target and cleans up on unmount; browser checks exercise focus and outside interaction.
- Browser fixtures no longer inject unnonced styles that conflict with the real production CSP.

## Last accepted validation evidence

These are the preceding implementation run's results on 2026-10-23, **not new test executions during this documentation consolidation**. Detailed private logs were retained outside the repository under `/tmp/slk-todos-final`; they are local evidence, not durable CI artifacts. [FEATURES.md](FEATURES.md) maps functionality to exact maintained test flows and identifies partial/manual/missing coverage.

| Check                                              | Accepted result                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Frontend strict gate and isolated production build | Passed; 360 maintained sources and all three translation languages checked                                                |
| Frontend / extension ESLint                        | Zero errors and warnings; actual rejecting-rule probes passed                                                             |
| Required `cd bin && ./test_dev.sh`                 | 147 unit/security + 16 CLI cases; 17 browser workflows in 36.20 s, about 55 s total                                       |
| Full HTTPS workflows                               | 95/95, 322.50 s; intentionally outside fast default                                                                       |
| Editor persistence / adversarial disclosure        | 2/2 in 21.59 s / 23/23 in 12.22 s                                                                                         |
| Isolated tour workflows                            | 9/9, 38.99 s                                                                                                              |
| Production CSP                                     | Eight routes, fresh nonces, parser-inserted unnonced script rejection, no observed policy violations                      |
| Real nginx / Redis                                 | Route/query/header/log behavior checked; atomic multi-client quotas checked                                               |
| Logical storage migration                          | Real disposable multi-database/spatial/roles/search restore and source-preservation checks passed                         |
| Extensions / CLI                                   | All 14 builds; strict CLI compilation, 16 cases and negative gates passed                                                 |
| Retirement planning                                | Read-only plan for 188 credentials validated; no production apply                                                         |
| Compose, shell and diff checks                     | Passed                                                                                                                    |
| Dependency audits                                  | 19 lockfiles inspected: frontend has **7 high node-forge graph entries**, zero critical; other 18 have zero high/critical |

The audit is **not clean**. No patched node-forge release was identified in that run. The braces advisory was withdrawn on 2026-10-23, not fixed by upgrading these CSS packages. Extension lockfile audits do not establish that the entire pinned Directus image is free of advisories.

Historical staging read-only checks returned HTTP 200 on eight routes, with seven clean hydrations and a reproducible homepage warning. Local production checks passed; they do not repair the staging deployment or prove real mail, authenticated StadtLandZahl, external bookings or every UI workflow. These limits and the remaining security decisions are tracked in [REMAINING_TODOS.md](REMAINING_TODOS.md).

## Frontend audit backport and formatting follow-up

A fresh frontend audit on 2026-10-23 still reports seven high dependency-graph entries for [CVE-2026-85393 / GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv). The registry still publishes node-forge 1.4.0 with no patched release. The dependency is reached through Nitro → listhen; Nuxt was not downgraded.

`src/frontend/scripts/patch-node-forge.mts` now backports the nested DigestAlgorithm element-count fix proposed in [forge PR 1152](https://github.com/digitalbazaar/forge/pull/1152), pinned to source revision `ceba34402e329f0365134f23fe19898756527d65`. The backport also rejects non-empty ASN.1 NULL parameters: a local RSA probe demonstrated that the open proposal alone still accepts that related padding variant. It verifies the complete original RSA source SHA-256, checks the installed version, applies idempotently during `postinstall`, and rejects missing/modified patches through `security:check` inside the permanent build/typecheck gate. The listhen dependency is constrained to exact node-forge 1.4.0 until reassessment. This is a local reviewed backport with an additional strict NULL-value guard, not an upstream-supported release. The built standalone production output contains no node-forge package; its current dependency path is Nitro/listhen tooling and local TLS. Package versions and audit output remain truthful; the raw audit and periodic audit workflow continue to report the seven entries.

`bin/test_suite/src/nodeForge.test.ts` checks rejection of nested garbage with and without NULL parameters and one-/three-byte non-empty NULL values, acceptance of valid signatures, digest mismatch, source/version drift, missing-patch rejection and idempotence. It also exercises actual listhen-generated localhost HTTPS. Clean `npm ci` applies and verifies the fix. An install using `--ignore-scripts` must run the patch explicitly before building; a missing patch fails the gate.

Formatting now uses root `.prettierrc.json` / `.prettierignore` and `src/frontend/scripts/format-project.mts`. Both `npm --prefix src/frontend run format` and `format:check` enumerate existing Git working files across maintained frontend, extension, CLI, test, tooling and documentation sources. This avoids private Docker data and deleted staged diagnostics. Existing correctness lint remains separate and rejects warnings. Directus YAML exports retain their CLI serializer layout; generated bundles, pinned public/vendor bytes, lockfiles and historical legacy snapshots are excluded. EditorConfig now agrees on double quotes.

The formatting review compared the changed script blocks and all 32 changed JSON files with their pre-format syntax/data; no semantic differences were found. The separately edited AI-registration handler retained its concurrent behavior; its unused missing-parameter template was removed to satisfy lint. Protected code-first YAML and static vendor files were not reformatted. Earlier tables retain their original run's counts; the follow-up results are recorded below.

Accepted follow-up checks (2026-10-23):

| Check                                | Result                                                                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Frontend audit                       | Seven high graph entries, zero moderate/low/critical; raw version-based finding remains visible despite the local backport |
| Frontend checking / production build | Strict 362-source gate and isolated production build passed; final security-helper/script checking passed                  |
| Frontend / extension lint            | Both commands passed with zero errors and warnings                                                                         |
| Formatting                           | Shared repository-wide check passed; syntax/data comparisons found no unintended script/JSON changes                       |
| Required development suite           | 150 unit/security + 16 CLI tests; 17/17 browser workflows in 44.04 s                                                       |
| RSA / local HTTPS regressions        | Three targeted tests passed, including nested garbage, non-empty NULL values and valid certificates                        |
| Full production HTTPS suite          | 95/95 workflows, 321.81 s                                                                                                  |
| Production CSP                       | Eight routes, fresh nonces, hydration and unnonced-script rejection passed                                                 |
| Disclosure / built public artifacts  | 23/23, 12.32 s                                                                                                             |
| Blökkli persistence                  | 2/2, 21.99 s, including nested legacy content, formatting, media and reusable blocks                                       |
| Directus extensions / CLI            | All 14 checked extension builds; CLI 52-source checking, 16 unit cases and two negative enforcement tests passed           |

The initial browser run encountered stale Vite optimized dependencies after installation; refreshing that cache and restarting development restored hydration. The first temporary HTTPS run lacked Node's trust configuration; the accepted rerun used the generated certificate through `NODE_EXTRA_CA_CERTS`, with TLS verification enabled. No assertions, timeouts or lint rules were weakened.

Temporary production containers, TLS/environment artifacts, isolated build and namespaced Redis keys were removed. The normal development services remain available. This follow-up does not deploy production, rotate production credentials or upgrade Directus. The original staged work is preserved; no commit was created.
