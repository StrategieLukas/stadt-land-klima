# Security hardening implemented on this branch

Current implementation record, reviewed on **2026-10-24** for `0000-security-updates` through hardening commit `d5391a81` plus the Tailwind/DaisyUI migration in the working tree. This consolidates the earlier architecture, migration, phase and security-review documents. The original S01–S17 finding identifiers are retained below for traceability. Committed reviews remain historical checkpoints; this document and [REMAINING_TODOS.md](REMAINING_TODOS.md) describe the current state. [FEATURES.md](FEATURES.md) remains the detailed functionality and regression-coverage inventory.

**Nuxt and TypeScript phases 0–8, the Blökkli 2 migration and the locally implemented hardening are complete. This does not mean every vendor advisory, production operation or integration is resolved.** The core/runtime hotfix was reported successfully deployed to staging and production; deployment of this complete security branch and production credential retirement have not been established by local tests.

## What remains before finalisation

The implementation and latest local validation are complete at the checkpoint above. **Release closure remains open.** Use [F1–F8 in the finalisation checklist](REMAINING_TODOS.md#finalisation-status-and-order) to record completion of:

1. Review/commit the new Tailwind 4/DaisyUI 5 migration and verify native target-platform acceptance before rollout.
2. Remaining pinned Directus/image assessments and mitigations, plus an explicit disposition for the seven version-based node-forge audit entries while the local backport is used.
3. Actual host/database/secret hardening and the Data Studio origin/session-isolation decision.
4. Staging deployment of the complete stack, code-first import/proxy verification, configured-integration checks and resolution of the deployed homepage hydration warning.
5. Production cutover with a current off-host backup/recovery path, then credential retirement, replacement invitations, search/cache cleanup and verification that old credentials fail.
6. Post-deployment observation, durable CI/release evidence and current feature/debt/security documentation.

The CSS migration is implemented: Tailwind 4.3.3 uses its Vite plugin, DaisyUI 5.7.50 themes and runtime rating sources live in the CSS entry, and shared brand/typography values remain in the explicitly loaded JS configuration. [T1–T7](REMAINING_TODOS.md#tailwind-4-and-daisyui-5-migration) distinguish implemented work from native macOS/Windows and rollout acceptance. This does not remove the independent forge or pinned-Directus findings.

**Finalisation means recorded outcomes for the release gates and an explicit delivery outcome for frontend modernization.** Existing manual/partial feature coverage and unverified integrations remain identified in FEATURES and the TODO document. Do not translate a passing local suite into a claim that deployment, credentials, every integration or every advisory is resolved. The earlier release-checklist update was documentation-only; the later credential-policy update also changes CLI planning/application. The later CSS migration upgrades frontend styling dependencies; no production deployment or actual credential rotation was performed. Validation is recorded separately from the earlier implementation evidence.

## Installed stack

Versions below are from repository manifests/lockfiles or declared runtime images, not a claim that every deployed host already uses them.

| Component                                       | Current version / state                                       |
| ----------------------------------------------- | ------------------------------------------------------------- |
| Nuxt / Vite / Vue                               | 4.6.2 / 8.3.5 / 3.5.44                                        |
| Blökkli                                         | 2.0.0-alpha.73                                                |
| TypeScript / vue-tsc                            | 6.0.3 / 3.3.13                                                |
| ESLint / Nuxt ESLint config / typescript-eslint | 10.13.0 / 1.17.0 / 8.72.0                                     |
| Tailwind CSS / DaisyUI                          | **4.3.3 / 5.7.50**, with the Tailwind Vite integration        |
| Frontend / Directus Node runtimes               | 24.22.1 / 22.23.4                                             |
| Directus                                        | **11.17.4**, explicitly retained; no authorization to upgrade |
| Directus optional storage-driver Undici         | Locked replacement 7.30.1                                     |
| PostgreSQL / PostGIS                            | 17.11 / 3.6.4, digest-pinned `postgis/postgis:17-3.6` image   |
| Meilisearch / Redis                             | 1.55.0 / 8.10.2-alpine                                        |
| Maintenance nginx / Typst                       | 1.30.6-alpine / checksum-verified 0.15.1                      |

The frontend now uses exact Tailwind 4.3.3 / DaisyUI 5.7.50 releases and the Tailwind Vite plugin. See [the CSS migration evidence](#tailwind-4-and-daisyui-5-implementation) and [target acceptance](REMAINING_TODOS.md#tailwind-4-and-daisyui-5-migration). TypeScript 7 remains deferred for actual lint/editor/Vue compatibility.

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

This table retains an earlier 2026-10-23 checkpoint. The later [audit/format follow-up](#frontend-audit-backport-and-formatting-follow-up) supersedes its source/test counts and timing; use that later table for the latest accepted validation. These are recorded implementation results; the separate 2026-10-24 verification note states which checks could be repeated. Detailed private logs were retained outside the repository under `/tmp/slk-todos-final`; they are local evidence, not durable CI artifacts. [FEATURES.md](FEATURES.md) maps functionality to exact maintained test flows and identifies partial/manual/missing coverage.

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

Recorded follow-up checks (2026-10-23 implementation run; the partial 2026-10-24 rerun is documented below):

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

At the end of that implementation run, temporary production containers, TLS/environment artifacts, isolated build and namespaced Redis keys were removed, and the normal development services were available. This is historical run evidence, not a current service-health assertion. This follow-up does not deploy production, rotate production credentials or upgrade Directus. The original staged work is preserved; no commit was created.

## Documentation verification — 2026-10-24

Only REMAINING_TODOS.md and SECURITY_HARDENING.md were edited for that earlier documentation-only finalisation step. Their Prettier checks, local links/anchors and diff whitespace checks pass; application files and the pre-existing Git index remain unchanged. The required `cd bin && ./test_dev.sh` was attempted: 150 unit/security tests and 16 CLI tests passed, then the live workflow runner stopped with `TypeError: fetch failed`. `docker compose ps` showed no running local services, so browser/integration acceptance could not be repeated in this environment. Restart the normal development stack and rerun that command before claiming a fresh complete development result. No services, dependencies, credentials or deployment state were changed for this documentation task.

The 95/95 HTTPS result and other build/CSP/persistence evidence above remain the recorded 2026-10-23 implementation results, not a new 2026-10-24 end-to-end pass.

## Production origin check and remaining Directus options — 2026-10-24

Read-only GET checks followed both supplied URLs to the canonical host. [The frontend](https://stadt-land-klima.de/) returned Nuxt HTML at `https://www.stadt-land-klima.de/`; [the CMS](https://stadt-land-klima.de/backend) redirected to Directus Data Studio at `https://www.stadt-land-klima.de/backend/admin`. Both returned 200 and share exactly the same HTTPS origin. A different path is not a browser origin boundary. No account was logged in and no mutation or exploit request was sent.

The frontend response still contains a non-empty `public.directusToken`. Its value was not printed, committed or used to authenticate requests. Its effective production permissions were not tested; presence alone does not establish compromise. The branch removes this legacy browser service credential, so deploy that access split before retiring its identity. The frontend response did not provide the branch's enforced CSP; the public CMS response supplied its own policy including script `unsafe-eval`. Public headers identify Nuxt, Directus and nginx, but did not establish exact deployed Nuxt/Directus/Node versions, image digests or whether server patches are installed.

Data Studio is Directus's browser administration application. With the current shared origin, website JavaScript has the same browser-storage origin as the CMS and can make same-origin CMS requests. The unauthenticated check cannot inspect a user's logged-in token/cookie storage. Moving the CMS UI/API to a separate hostname (for example an operator-selected CMS subdomain), with host-only cookies and restricted CORS, creates a browser boundary; simply changing `/backend` to another path does not. Update DNS/TLS, Directus public URL, private/public CMS URL configuration, redirects/invitations, upload/assets and any legacy aliases together. Retire old-origin CMS sessions and stop serving the old UI there. Website editor credentials remain in the existing Nuxt session BFF. Keeping the current layout is possible, but retains the shared-origin XSS impact. [Origin definition](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy).

| Option under the Directus 11.17.4 constraint                         | Concrete work                                                                                                                                                                                                                                            | Limit / tradeoff                                                                                                                                                                       |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source-verified security backports (preferred for required features) | Port each applicable upstream authorization/settings/flow/mail fix into the pinned image; enforce the correct check before side effects, retain source digests and add anonymous/app-user/admin regressions. Reassess bundled package copies separately. | Maintenance remains with this project until a supported fixed release can replace them. The three existing guards are not the entire advisory set.                                     |
| Disable or isolate affected capabilities                             | Disable unused AI/manual automation and constrain outbound network access; keep unnecessary services off. Audit app-access identities and sensitive settings projections.                                                                                | AI may be used by the editor; confirm the workflow before disabling it. Turning AI off does not itself hide settings. A check that rejects a request after a mutation is insufficient. |
| Later vendor upgrade                                                 | When separately authorized, evaluate a fixed release, licensing/custom-policy behavior, all extensions, import/startup/readiness scripts and restored data.                                                                                              | Directus must remain 11.17.4 now; no upgrade was performed or assumed approved.                                                                                                        |

The concrete remaining backport targets include:

- **Settings disclosure:** minimal app-access users can receive sensitive settings/custom AI authorization headers; constrain the server response and remove/rotate any affected provider headers. [Advisory](https://github.com/directus/directus/security/advisories/GHSA-r9xq-xp38-j4j3).
- **AI file downloads:** apply validated outbound fetching to AI attachments; network egress restrictions add defense. The generic import deny-list does not cover this fetch path. [Advisory](https://github.com/directus/directus/security/advisories/GHSA-4jw7-6mqj-vrhq).
- **Service authorization ordering:** stop flow/user/share cleanup before authorization succeeds. Existing role rules cannot undo side effects that already occurred. Do not test destructive requests on production. [Advisory](https://github.com/directus/directus/security/advisories/GHSA-p623-wgx3-wxp8).
- **Manual flow authentication:** require an authenticated identity before executing manual triggers. Keep the protected registration webhooks working; webhook and manual triggers are different cases. Public-role YAML remains unchanged. [Advisory](https://github.com/directus/directus/security/advisories/GHSA-fq27-7m2r-q6vm).
- **Mail-template containment:** constrain resolved templates/includes to the configured directory and restrict flow/file administration. The fixed welcome template narrows one caller, not every MailService path. [Advisory](https://github.com/directus/directus/security/advisories/GHSA-5h38-6755-g83w).

## Credential inventory and rotation policy — 2026-10-24

This inventories credential **families referenced by the repository**, not private values or a complete list of production users/accounts. Optional/provider/infrastructure credentials require operator inventory. No production secret was changed. Municipality preview links are classified **low sensitivity and retained**, per the owner's direction; this is distinct from the private preview-verifier service token.

Policy: [credential-rotation.yaml](src/directus/cli/credential-rotation.yaml). Edit `action`, `owner`, optional `rotation_interval_days`, `last_rotated_on` and `next_review_on` for each family. Production dates default to null because no rotation has been verified. Values are `review`, `retain`, `rotate`, `revoke`; null intervals are event-driven/manual planning, not a background scheduler. The retirement CLI executes only `legacy_frontend` (revoke), `candidate_links` (rotate) and `municipality_previews` (rotate). Review/retain skip execution; other families remain manual workflows even if marked rotate. Both plan and apply require the policy; scope-bound version 2 plans reject changed selections and old unbound version 1 plans. See [operator commands](README.md#planned-credential-retirement).

| Family                        | References, not values                                                                                                                            | Sensitivity | Default action | Impact / handling                                                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| legacy_frontend               | `DIRECTUS_TOKEN`; `directus_users.token (legacy Frontend role)`                                                                                   | high        | revoke         | Retire the obsolete shared browser identity after deploying private server access. Inspect its real production permissions; do not reuse its token.                                                                                                   |
| candidate_links               | `candidate.access_token`                                                                                                                          | high        | review         | Can submit election answers. Select rotate only after coordinating replacement invitations; review skips this family.                                                                                                                                 |
| municipality_previews         | `municipalities.preview_token`                                                                                                                    | low         | retain         | Read-only preview links are low sensitivity by owner decision. Keep existing links; rotate only for a specific incident or deliberate invalidation.                                                                                                   |
| frontend_server               | `DIRECTUS_FRONTEND_SERVER_TOKEN`; `NUXT_DIRECTUS_FRONTEND_SERVER_TOKEN`                                                                           | high        | review         | Private scoped service account. Rotate the underlying Directus user token and update every Nuxt instance together if exposed, weak or scheduled.                                                                                                      |
| frontend_public               | `DIRECTUS_FRONTEND_PUBLIC_TOKEN`                                                                                                                  | public      | retain         | Limited public-asset identity. Public readability must be safe regardless of token secrecy; remove the identity if confirmed unused.                                                                                                                  |
| preview_verifier              | `DIRECTUS_PREVIEW_TOKEN`; `NUXT_DIRECTUS_PREVIEW_TOKEN`                                                                                           | medium      | review         | Private verifier service credential, distinct from low-sensitivity municipality preview links; keep its privileges narrow.                                                                                                                            |
| administrator_static_tokens   | `DIRECTUS_ADMIN_TOKEN`; `CLI_DIRECTUS_STATIC_TOKEN`                                                                                               | critical    | review         | These may reference the same Directus user token. Inventory actual identities, rotate each underlying credential once and update all aliases/consumers.                                                                                               |
| administrator_password        | `ADMIN_PASSWORD`; `directus_users.password (administrator)`                                                                                       | critical    | review         | ADMIN_PASSWORD bootstraps a new installation. Editing the environment does not change an existing user password; update through authenticated Directus administration.                                                                                |
| personal_authentication       | `directus_users.password`; `directus_users.tfa_secret`; `Directus access/refresh tokens`; `Redis editor sessions`; `Data Studio browser sessions` | high        | retain         | Per-user passwords and 2FA seeds are distinct from delegated sessions. Access/refresh tokens expire or refresh automatically. Reset passwords, re-enrol 2FA or revoke affected sessions for compromise/offboarding; avoid unnecessary blanket resets. |
| directus_signing_secret       | `SECRET`                                                                                                                                          | critical    | review         | Coordinate JWT/session and stored encrypted-data implications against the pinned Directus implementation. Back up and test recovery before changing.                                                                                                  |
| legacy_instance_key           | `KEY`                                                                                                                                             | public      | retain         | Legacy instance/configuration identifier; verify actual pinned-version use before treating it as an authentication secret or changing it.                                                                                                             |
| captcha_secret                | `ALTCHA_SECRET`; `NUXT_ALTCHA_SECRET`                                                                                                             | high        | review         | Replace development/default or exposed values. Changing this also invalidates sessions whose independent signing keys are unset.                                                                                                                      |
| editor_cookie_secret          | `EDITOR_SESSION_SECRET`; `NUXT_EDITOR_SESSION_SECRET`                                                                                             | high        | review         | If unset, derived from ALTCHA_SECRET. Changing either relevant key invalidates website editor cookies; sign-in is then required.                                                                                                                      |
| candidate_cookie_secret       | `CANDIDATE_SESSION_SECRET`; `NUXT_CANDIDATE_SESSION_SECRET`                                                                                       | high        | review         | If unset, derived from ALTCHA_SECRET. Changing the key invalidates candidate sessions; existing invitation tokens remain a separate decision.                                                                                                         |
| postgres_password             | `docker/db/.env:POSTGRES_PASSWORD`; `src/directus/.env:DB_PASSWORD`                                                                               | critical    | review         | Change the real database role password, then all client secrets. Editing POSTGRES_PASSWORD does not rotate an existing database volume.                                                                                                               |
| meilisearch_keys              | `MEILI_MASTER_KEY`; `MEILISEARCH_MASTER_KEY`; `Meilisearch API keys`                                                                              | high        | review         | Inventory every indexer/search consumer and derived key before replacement; preserve data and verify allowed index/action scope.                                                                                                                      |
| redis_authentication          | `REDIS / REDIS_URL credentials`; `Redis ACL/password if configured`                                                                               | high        | review         | No password is defined in the example URL. Verify production network/ACL configuration; if enabling/changing auth update all Redis clients together.                                                                                                  |
| smtp_password                 | `EMAIL_SMTP_USER`; `EMAIL_SMTP_PASSWORD`                                                                                                          | high        | review         | Provider-managed sending credential. Rotate with delivery verification and keep mail capture separate from real recipients.                                                                                                                           |
| newsletter_api                | `LISTMONK_API_USERNAME`; `LISTMONK_API_TOKEN`                                                                                                     | high        | review         | Provider-managed access to mailing lists/subscriptions. Update Nuxt configuration and verify intended public lists/double opt-in.                                                                                                                     |
| stadtlandzahl_authentication  | `STADTLANDZAHL_BASE_HTTP_BASIC_AUTH_USER`; `STADTLANDZAHL_BASE_HTTP_BASIC_AUTH_PASSWORD`                                                          | high        | review         | Upstream service credential, server-only. Coordinate provider replacement and test authenticated datasets; not publicly verifiable.                                                                                                                   |
| frontend_basic_authentication | `FRONTEND_BASIC_AUTH_USERNAME`; `FRONTEND_BASIC_AUTH_PASSWORD`; `nginx .htpasswd if configured`                                                   | medium      | review         | Optional staging/access gate. Verify which environment actually enables it before rotating or expecting protection.                                                                                                                                   |
| unsplash_key                  | `UNSPLASH_ACCESS_KEY`                                                                                                                             | medium      | review         | Provider-managed API/quota credential. Verify replacement via the authenticated server endpoint.                                                                                                                                                      |
| carto_key                     | `CARTO_BASEMAP_API_KEY`                                                                                                                           | medium      | review         | Server-only tile-proxy credential. Coordinate provider restrictions, quotas and map smoke checks.                                                                                                                                                     |
| mapbox_key                    | `DIRECTUS_MAPBOX_KEY (optional)`; `Directus map-provider settings`                                                                                | medium      | review         | Optional provider credential; verify public/private key type and restrictions before selecting rotation.                                                                                                                                              |
| ai_provider_keys              | `DIRECTUS_AI_*_API_KEY (if used)`; `Directus settings AI provider keys`; `ai_openai_compatible_headers`                                           | high        | review         | May include paid provider access and custom Authorization headers. Review settings disclosure first, then revoke exposed upstream credentials; do not put secret values in this file.                                                                 |
| temporary_account_links       | `Directus invitation/reset/verification tokens`; `Local-team activation links`                                                                    | high        | retain         | Application-managed expiry/single-use lifecycle. Invalidate affected links on incident; this retirement command does not manage them.                                                                                                                 |
| infrastructure_credentials    | `SSH/deploy keys`; `CI/registry/DNS credentials`; `TLS private keys`                                                                              | critical    | review         | Managed outside the application configuration. Inventory with the host/provider operator; no SSH keys or production secret values were inspected here.                                                                                                |
| flow_identifiers              | `DIRECTUS_FLOW_NOTIFY_ADMIN`; `DIRECTUS_FLOW_WELCOME_EMAIL`; `Flow UUIDs`                                                                         | public      | retain         | Route identifiers are not authentication credentials. Keep server-side authorization; changing UUIDs is not a fix for vulnerable flow handling.                                                                                                       |

## Permanent replacement for the node-forge backport

Registry checks on 2026-10-24 still list node-forge **1.4.0**, listhen **1.10.1** and Nuxt **4.6.2** as their latest tags. The referenced [forge fix proposal](https://github.com/digitalbazaar/forge/pull/1152) remains open. There is no verified published upstream replacement to select today.

The supported permanent path is an upstream fixed node-forge release, followed by replacing/removing the local override and patch and retaining the malformed/valid RSA regression vectors. A more structural solution is a maintained listhen release that replaces its forge certificate handling with platform crypto-backed tools; [selfsigned](https://github.com/jfromaniello/selfsigned) 5.5.0 already uses `@peculiar/x509` / `pkijs` instead of forge, but it is not a drop-in replacement for the whole node-forge API. Listhen's CA/signing/encrypted-key/PFX handling and both import modes would need compatibility work and tests. No fork or library substitution was implemented here.

A separately maintained fork can make the patch immutable but transfers upstream maintenance to us; renaming/version-spoofing a package merely to clear audit is not a security fix. Deploying only the generated Nitro artifact keeps this tooling dependency out of that runtime artifact, as checked in the prior build, while developer/build dependency remediation remains necessary. The existing source-verified patch remains the interim implementation; the raw audit is not suppressed.

## Credential-policy validation — 2026-10-24

The policy-scoped CLI update passes strict compilation/source coverage (52 sources), 21 CLI unit cases and both negative enforcement cases. Added cases cover untouched/unread optional credentials, independent candidate-only selection, policy/action validation, scope drift, legacy-plan rejection, empty-scope no-ops and refusal of CLI planning without a policy. The required development command passed 150 unit/security and 21 CLI cases, then could not start live workflows because the local Docker stack remains offline. Formatting, document links and diff checks pass. No production mutation, login, credential rotation, email or provider-key replacement was executed. Raw production HTML containing the browser token was kept outside the repository and removed after recording the redacted finding.

## Deployment and database-role follow-up — 2026-10-24

The prior answer is persisted in [SECURITY_DECISIONS.md](SECURITY_DECISIONS.md), including the full credential-family table and a conditional same-origin XSS threat model. [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) gives the staged server procedure, required legacy-token retirement, secret decisions and separate database-role runbook. The production observations above remain unauthenticated/read-only evidence, not evidence of compromise or exact deployed patch versions.

Implemented locally:

- `start_production.sh --import` now waits for Directus, imports the YAML configuration and only then recreates the frontend. `--prepare-only` leaves the frontend stopped for service-token setup; import failure does not restart it or remove maintenance. Missing curl fails instead of skipping readiness. The updater uses the ordered import. Maintenance is an nginx fallback; it does not isolate a healthy CMS.
- Service-user provisioning now covers Frontend-Server/Public/Preview, reuses existing strong tokens, and rejects conflicting/disabled accounts before any create. The frontend example advertises the private server token rather than the obsolete browser identity.
- Added private read-only PostgreSQL cutover planning and transactional apply. It preserves the bootstrap operator, database/extension ownership and spatial data while creating a new non-superuser app role. It refuses an existing target role, active clients, custom/mixed-owner layouts and cluster/catalog drift. It transfers application-object ownership to support imports/DDL; separate runtime/migration identities are not implemented.
- Backup, restore, sanitized-export and migration launchers now preserve host storage overlays and use the separate bootstrap operator for database administration. No `public.yaml` permissions or Directus version was changed.

Fresh local verification:

| Check                                   | Result                                                                                                                                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Required `cd bin && ./test_dev.sh`      | 150 unit/security cases, 26 CLI cases, 17 fast browser workflows; zero failures; browser phase 36.13 seconds                                                                                                                                                       |
| Strict CLI compilation/source inclusion | 55 checked TypeScript sources                                                                                                                                                                                                                                      |
| CLI negative enforcement                | Both compiler/source-gate and shell/startup fail-closed cases passed                                                                                                                                                                                               |
| Isolated PostgreSQL/PostGIS cutover     | Passed in about 3 seconds: read-only planning, schema/instance/argument drift, active-client refusal, injected rollback, spatial reads, generated/serial IDs, app DDL, denied cluster administration, preserved extension/operator ownership and bootstrap pg_dump |
| Actual local schema / backup            | Read-only plan covered 95 application objects, with no apply; normal database export completed using the operator                                                                                                                                                  |
| Frontend availability                   | Localhost 8080 and Directus 8081/server/health returned HTTP 200                                                                                                                                                                                                   |
| Frontend lint / node-forge gate         | Zero-warning ESLint and exact backport verification passed                                                                                                                                                                                                         |
| Shell syntax / diff review              | Changed shell launchers pass bash syntax checks; final diff reviewed for credential handling and privilege/ownership scope                                                                                                                                         |

No production deployment/rotation, real database ownership cutover, provider change or mail was performed. Development services were started to run the suite. Disposable PostgreSQL fixtures were removed. The pre-existing staged index was preserved unchanged. The remaining vendor advisories, optional startup whitelist, bulk search reindex implementation/execution, real restore/host checks and staging/production acceptance remain open in [REMAINING_TODOS.md](REMAINING_TODOS.md); these operational tools do not backport those vendor fixes.

## Tailwind 4 and DaisyUI 5 implementation

Implemented on **2026-10-24**, after hardening commit `d5391a81` (not pushed). Tailwind **4.3.3**, its Vite plugin **4.3.3** and DaisyUI **5.7.50** are exact manifest/lock selections; Nuxt 4.6.2, Vite 8.3.5, Blökkli 2.0.0-alpha.73 and TypeScript 6.0.3 are unchanged. The [official upgrade tool](https://tailwindcss.com/docs/upgrade-guide) handled standard utility names; the project-specific changes were reviewed and repaired manually.

The app uses one Tailwind Vite pipeline. The CSS entry explicitly loads the supported JS brand/typography configuration, the typography plugin and two DaisyUI custom themes; the obsolete JS safelist is replaced by inline sources for all rating backgrounds/tints, borders/text and dynamic 10%/90% opacity variants. The existing theme IDs, stored light/dark preference and brand colors remain stable. Prettier uses `tailwindStylesheet`; the JS token file remains inside strict checked-tooling coverage.

Visual checks caught a closed desktop sidebar occupying 320 pixels, new card padding that changed list wrapping, and a new DaisyUI dock component colliding with the site's custom mobile dock. Those are corrected. The mobile dock keeps its existing design under a site-specific class. Removed bordered-input/form-control classes and opacity utilities are migrated, and the previous border contrast/card dimensions are preserved. CanonicalButton uses equivalent v4 shadow/shrink utilities with its shared CSS untouched.

The codemod also changed comparisons against the stored editor option `outline`; strict checking caught that and the machine value was restored. The new SSR test checks actual outlined/filled output. An AST review of changed Vue scripts found no remaining changed comparison operands; script string changes are class utilities. No displayed text, translations, public permissions, schema or Directus version was changed.

Locked installation succeeded both on the Linux host and in the existing Debian Node 24 container. CSS-engine bindings remain optional for Linux/macOS/Windows architectures, verified against the complete lockfile. Install dependencies per machine/container; do not copy native `node_modules` between platforms. Actual macOS/Windows execution remains manual target acceptance. Generated production server output uses precompiled CSS and does not need the CSS compiler at runtime.

A fresh audit initially found the low-severity [serialize-javascript advisory](https://github.com/yahoo/serialize-javascript/security/advisories/GHSA-m5mm-p8h7-m29v); the compatible transitive package is now **7.1.4**. The remaining seven high graph entries are the existing version-based node-forge/listhen/Nuxt graph. The source-verified forge backport still passes; no downgrade, major override or audit exception was added.

The new compiler/theme/optional-binding cases run in the default fast unit suite (about 0.4 seconds added locally). The explicit `test:styles` gate checks real desktop/mobile light/dark pages, menu transitions, page centering, card padding, button corners, hydration and request failures. It blocks non-read requests and supports `TEST_STYLE_BROWSER=chromium|firefox|webkit`. Browser-engine and final release evidence is appended after the final runs.

The local HTTPS test harness now supports an explicitly selected `TEST_HTTPS_CERT` public-key pin. Chromium's per-context certificate-error override missed a speculative spinner stylesheet request after opening several contexts; the isolated project-filter flow reproduced it and passed with the specific local certificate pinned. Node clients use `NODE_EXTRA_CA_CERTS` for that certificate. No frontend TLS/CSP setting or browser error assertion was weakened. The new unit case checks opt-in/default behavior, certificate-specific arguments and failure on a missing certificate; only a public fixture certificate is checked in. WebKit's intentional hard-navigation metadata-abort artifact is prevented by waiting for the actual metadata response between test pages.

### CSS migration validation results

Fresh local results for the migration working tree:

| Gate                                        | Result                                                                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Locked installs                             | Linux host and Debian Node 24 frontend container succeeded, retaining optional platform dependencies                                                                                             |
| Strict frontend checking / production build | 362 maintained sources; build completed in 52.8 seconds                                                                                                                                          |
| Required `cd bin && ./test_dev.sh`          | 155 unit/security cases, 26 CLI cases, 17 fast browser workflows; zero failures; browser phase 37.71 seconds                                                                                     |
| Explicit production HTTPS full profile      | 95/95, 320.93 seconds, with the temporary certificate trusted by the controller and pinned for Chromium                                                                                          |
| Editor persistence                          | Both live cases passed, 21.50 seconds, including failed publication/recovery, nested content, media and reusable blocks                                                                          |
| Adversarial disclosure migration            | 23/23, 12.27 seconds, including public built scripts/maps/payload credential checks                                                                                                              |
| Production CSP                              | Eight public routes: fresh nonces, hydration, zero CSP violations and rejection of an unnonced script                                                                                            |
| Style/interaction gate                      | Chromium 5.38s, Firefox 8.73s, WebKit 14.94s; each covers desktop/mobile in both themes. WebKit ran in the matching official Playwright Ubuntu container; Chromium/Firefox ran on the Linux host |
| Lint / formatting / harness                 | Zero-warning frontend ESLint, maintained-source Prettier check, strict harness compilation and diff whitespace checks passed                                                                     |
| Frontend audit / exact guard                | Seven high graph entries, zero critical/moderate/low; node-forge backport verification passes and serialize-javascript is 7.1.4                                                                  |

No real external delivery or authenticated StadtLandZahl parity is implied by these results. Native macOS/Windows execution and deployed-content visual acceptance remain open target checks. No production server/credential action, Directus upgrade or push was performed. The migration remains uncommitted for review. Temporary test runtimes/proxy/private TLS key were removed; the normal development frontend remains available on localhost:8080.
