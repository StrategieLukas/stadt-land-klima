# Project decisions

Canonical record of current architecture, security constraints, role boundaries,
version choices and maintenance obligations. Read this with [AGENTS.md](AGENTS.md)
before changing the project. Manifests, checked YAML and executable tests define
the implementation; this document explains why it is arranged this way.
Historical migration plans and superseded validation counts have been retired.
[FEATURES.md](FEATURES.md) maps functionality to exact regression coverage.
[README.md](README.md) and the component runbooks contain operator commands.

## Version policy

| Area              | Repository selection                                        | Constraint                                                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CMS               | Directus **11.17.4**                                        | Do not upgrade beyond this version. Maintain reviewed source/dependency backports.                                                                                                             |
| Frontend          | Nuxt 4.6.4, Vite 8.3.8, Vue 3.5.45                          | Keep framework/builder peers compatible, the Blökkli virtual-file integration intact and all runtime-discovered CAPTCHA/schema/sanitizer/map packages explicitly prebundled for dev hydration. |
| Editor            | Blökkli 2.0.0-alpha.74                                      | Exact pin; test adapter, persisted content and browser editing before changing it.                                                                                                             |
| Frontend compiler | TypeScript 6.0.3, vue-tsc 3.3.14                            | TS 7 is deferred until Vue, typescript-eslint and Blökkli peer/API compatibility is verified. Do not force peer overrides.                                                                     |
| Styling           | Tailwind 4.3.5, DaisyUI 5.7.50                              | One Vite pipeline; CSS owns scanning/themes, explicitly loaded `tailwind.config.js` owns shared tokens.                                                                                        |
| Runtime           | Frontend Node 24.22.3; Directus Node 22.23.5                | Use the pinned supported runtime and locked installations; verify actual running binaries after rebuilding.                                                                                    |
| Stateful services | PostgreSQL 17/PostGIS 3.6, Meilisearch 1.56.2, Redis 8.10.3 | Exact image/digest selection is in Compose. Never attach an incompatible major image to existing data.                                                                                         |
| Other tooling     | Typst 0.15.1; Caddy 2.11.9 for gateway and maintenance      | Keep download checksums, image pins and gateway-module review.                                                                                                                                 |

Native platform bindings remain optional. Install independently on each OS/CPU;
do not copy `node_modules` across platforms or use `--omit=optional`. Linux
validation does not establish native macOS/Windows execution. The manual
`native-frontend.yml` workflow covers those installations. Tailwind's selected
browser floor is Safari 16.4+, Chrome 111+ and Firefox 128+; older browser support
requires a separate product decision.

The Directus cap is an owner constraint. Any separately authorized major upgrade
must recheck licensed custom-policy enforcement beyond trial/grace periods,
startup npm/tsx availability, authenticated readiness, extension host ranges,
proxy trust and restored-data/import/editor compatibility. A successful bootstrap
alone does not establish preserved authorization.

## CMS configuration and roles

All schema, policy, role, flow and translation configuration is code-first under
`src/directus/`. Apply changes through the importer; do not replace YAML imports
with SQL edits. Policies import before roles; references in role YAML use names,
not instance-specific UUIDs. Existing primary-key definitions must match the
actual database column. Supported text interfaces use `meta.options.trim: true`.

**Never alter `src/directus/roles/public.yaml` or public-role permissions to make
website requests work.** Add the minimum fields and publication/ownership filters
to the private service policy and expose a checked Nuxt DTO. Existing legacy
policies are compatibility/deployment state, not templates for new access.

| Identity / policy family                 | Intended authority                                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Frontend-Server                          | Private Nuxt service; scoped website reads, never browser configuration.                                                   |
| Frontend-Public                          | Minimal public-asset identity; currently no frontend token consumer. Public asset safety cannot depend on token secrecy.   |
| Frontend-Preview                         | Isolated private verifier; distinct from individual municipality preview links.                                            |
| Legacy Frontend                          | Retire after replacement access works; never reuse for new browser integrations.                                           |
| Content-Translation-Worker               | Private translation job/memory controls, separate from public readers and ordinary CMS authority.                          |
| LokalteamAdmin / LokalteamMitglied       | Existing local-team ownership through the user/team junction and scoped policies. A URL slug is not proof of membership.   |
| BlokkliEditor / Blokkli-Editor           | Personal editorial access, scoped draft/publication operations.                                                            |
| ErfolgsprojekteRedaktion / Planungsteam  | Existing editorial and article-editor invitation workflows; preserve their distinct authority.                             |
| Maßnahmenteam, Recruiter, WahlcheckAdmin | Named editorial responsibilities defined by their checked policies.                                                        |
| API and remaining roles                  | Keep the exact checked allowlists in `src/directus/{roles,policies}`; do not infer administrator access from a role label. |

Administrator role invitations offer only the six maintained roles:
ErfolgsprojekteRedaktion, Maßnahmenteam, Planungsteam, Recruiter, WahlcheckAdmin
and BlokkliEditor. Exclude service/local-team roles and roles/accounts with direct
or inherited administrator policies. Resend only an unaccepted invitation in the
same role; never reassign an active, suspended, archived or differently assigned
account. Use Directus's native invitation URL and acceptance/password flow.
The shared helper awaits mail because the pinned native generic sender does not;
new account creation rolls back on send failure. Advisory locks prevent duplicate
invites. Persistent rate limits are shared across both invitation interfaces.
Local-team invitations remain a separate supported workflow.

## Public data boundaries

- Browser components call checked same-origin Nuxt endpoints. CMS SDK clients and
  service credentials remain server-only. The client Directus plugin supplies
  locale/translations, not a CMS client.
- Public routes select explicit fields, validate CMS responses and return explicit
  DTOs. SSR HTML, hydration state, files, search indexes and social metadata are
  all disclosure boundaries. Anonymous handlers never fall back to admin access.
- Published blocks require a supported published owner and their own publication
  state. Tour reports additionally require the published stop/report/tour chain.
  File bytes/metadata and ranges have separate visibility checks.
- Search collects a complete published snapshot before pruning, paginates every
  existing ID, waits for successful asynchronous tasks and stays unavailable on
  failed reconciliation. Every returned dynamic hit is checked against live
  publication/member visibility and its canonical URL. Conservative pre-delete
  removal can temporarily hide a result; reconciliation repairs availability.
- StadtLandZahl proxy paths, methods, targets, redirects and payloads are bounded;
  credentials stay private. GraphQL used for StadtLandZahl is separate from the
  disabled Directus GraphQL surface. Dataset/render specs retain checked URL,
  geometry and value boundaries; no unrestricted credential proxy is allowed.
- Canonical/social/sitemap URLs derive from configured `PUBLIC_URL` or the runtime
  site override, not incoming Host headers. Token and editor-preview pages are
  noindex and omit canonical/social URLs.

## Sessions and credentials

Website editors use encrypted HttpOnly cookies containing opaque session IDs and
CSRF material. Personal CMS access/refresh credentials live in Redis for seven
days. Refresh locks and conditional writes prevent concurrent refresh/logout
from resurrecting a session. An expected-user check rejects stale-tab identities.
The editor proxy enforces the person's permissions, origin/CSRF checks and bounded
allowed routes; it is not a generic CMS/auth/GraphQL proxy. Publish bodies are
bounded at 5 MB and uploads at 50 MB. Credentials are stripped from responses;
private media uses no-store/sandbox controls.

Candidate exchange creates a two-hour encrypted HttpOnly session, validates origin
and CSRF, and rechecks the database credential. New invitations use
`/elections/thesen#token=<UUID>` and remove the fragment after exchange. Legacy
path/bearer entry points remain supported. Answer writes check candidate/election
ownership, published questions, Berlin-calendar deadlines, scores 0–4 or explicit
null, lengths, batch size, duplicates and unexpected fields. Candidate/preview
navigation suppresses analytics and uses private referrer handling.

Credential policy is [credential-rotation.yaml](src/directus/cli/credential-rotation.yaml).
It inventories 28 families without secret values; owners/dates are planning
metadata, not a background rotation scheduler. Keep unverified dates null.

| Family / action                                     | Decision and consequences                                                                                                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy browser Frontend                             | Revoke only after the private access split passes acceptance. The tool only suspends legacy Frontend-role users; any other exposed identity needs explicit handling. |
| Existing candidate invitation tokens                | **Retain**, by owner decision of 2026-10-24. No automatic rotation or replacement invitations.                                                                       |
| Municipality preview links                          | **Retain**, classified low sensitivity by the owner. Separate from the private verifier service token.                                                               |
| Personal passwords, 2FA and sessions                | Account-specific lifecycle/offboarding/incident handling; avoid blanket resets without cause.                                                                        |
| Server, verifier, worker, admin and provider tokens | Private, scoped and reviewed; update all aliases/replicas together when rotating the underlying credential.                                                          |
| ALTCHA / session secrets                            | Strong unique private keys, at least 32 characters. Unset independent cookie keys derive from ALTCHA; changing a relevant key invalidates sessions.                  |
| Database/bootstrap passwords                        | Rotate the persisted account and then its consumers. Editing `POSTGRES_PASSWORD` or `ADMIN_PASSWORD` alone does not change existing accounts.                        |
| Directus `SECRET`                                   | Coordinate session and encrypted-data recovery on restored staging before changing it.                                                                               |
| Legacy `KEY`                                        | Retained identifier; do not apply signing-secret requirements to it.                                                                                                 |

Retirement plans are private mode-0600 artifacts, bound to policy scope, instance,
website and credential inventory. Version-1 plans must be regenerated. Both plan
and apply require an unchanged policy selection; mismatches fail before writes.
Read-only identity-bound DB lookups recover static tokens concealed by the admin
API. Reapplying the same plan resumes partial work. The tool sends no mail and
does not rotate external provider credentials. Never restore exposed tokens as
rollback. Commands are in [the deployment runbook](DEPLOYMENT_CHECKLIST.md).

## Abuse prevention and browser security

- All writes and expensive reads use centralized `rateLimitConfig.ts`. Redis
  sliding windows use server time, atomic Lua and unique event IDs. Mutations and
  expensive operations fail closed; read fallback is bounded. Delivery, request,
  form-copy and media budgets have distinct scopes.
- ALTCHA is purpose/expiry bound and single use through atomic Redis replay
  prevention. Signed math challenges check purpose, time, MAC and answer shape;
  they are an additional abuse control, not proof of a human submitter.
- Generic form mail resolves the exact saved form on a published owner. Trusted
  content controls recipient, fields and copy behavior. Registration webhooks
  require private administrator authentication and a fixed welcome template;
  configured aliases provide UUIDs only, requests use the private CMS URL and
  reject redirects. Newsletter lists are allowlisted with existing double opt-in.
- Shared SSR/browser sanitization constrains HTML/SVG and URL protocols. Static
  checked-in SVG exceptions remain explicit. Nonce CSP excludes script
  `unsafe-inline`/`unsafe-eval`; style attributes remain supported for Vue/maps/
  charts. Vega uses its AST interpreter and browser Zod avoids JIT evaluation.
- Analytics is a locally pinned Plausible asset with source digest and SHA-384
  integrity metadata. Repinning requires review. CAPTCHA uses the same-origin
  worker and external CSS. Calendar booking uses a lazy native iframe.
- PDF execution bounds input, time, termination and output buffers; Typst downloads
  are checksum verified. CSV export escapes spreadsheet formula prefixes.

## Pinned Directus and dependency security

The pinned CMS image applies exact-source guards before startup. Unknown source
digests/layouts fail the build. Keep authorization-before-side-effect checks,
authenticated manual-flow execution, sensitive-settings restrictions (including
old wildcard grants), contained templates/includes/symlinks, validated AI/import
outbound connections, dangerous deep-path/depth rejection, geometry subtype
validation and final resolved image-dimension limits. AI remains enabled.

Compose forces response caching and TUS off, production WebSocket/MCP entrypoints
off, and limits asset transforms (`SLK_ASSET_TRANSFORM_CONCURRENCY`, default 8).
Redis is still required for sessions, quotas and synchronization. Retain locked
deployed-library replacements and tested stream-json 1.x own-property/depth
backports; toolchain audits alone do not inspect the bundled vendor image.

The frontend resolves Nitro's actual listener to upstream node-forge 1.4.3.
`scripts/check-node-forge.mts` verifies its version and RSA source hash without
modifying installed dependencies. Signature-forgery regressions and local HTTPS
certificate generation remain automated gates. The former 1.4.0 source backport
is retired; reassess the integrity guard when upgrading the fixed upstream release.

`audit:directus-image` retains raw findings. The reviewed gate additionally checks
production controls, vendor regressions and the exact package/version/advisory
list in `bin/test_suite/src/lib/imageAdvisoryReview.ts`. **The review expires
2026-11-24.** Unknown findings/versions and expired reviews fail; renew with
evidence. Current dispositions cover disabled Directus response caching,
validated unspecified-IP fetching, bounded own-property stream-json handling,
source-verified deepmerge own-property writes,
absent JSONC code and narrowly reviewed Linux/CLI esbuild/PM2 reachability.

The 2026-11-12 dependency refresh upgrades compatible direct/transitive packages,
including upstream node-forge and the SDK's decode-uri-component override. Raw
audits remain mandatory and reports are never suppressed. TypeScript stays 6.0.3
because typescript-eslint requires <6.1 and Blökkli accepts 5/6; Nuxt 4 requires
DevTools 3.4.4. Directus SDK 18.1.1/types 18.1.0 require Vue 3.5.43 and Knex 3.1.0
in extension tooling, while the frontend uses Vue 3.5.45. Express 4 type definitions
match the pinned CMS host; Node type definitions match each supported runtime.
Vendor replacements retain the pinned host APIs; Hono node-server 2.1.7,
minimatch 11 and glob 14 replacements also pass the actual vendor regressions.
Deepmerge 4.3.1 has no fixed upstream release: exact-hash CJS/UMD backports use
own data properties, preventing destination setters/prototype mutation while
preserving nested and array merges. Raw advisory output is retained. Undici remains on the latest compatible 7.x API family used by
the pinned storage drivers; a separate major-family replacement requires vendor
integration validation, beyond satisfying Node engine ranges.
The rebuilt Directus runtime passed all 12 vendor regressions and the expiring
review gate on 2026-11-12; eight raw findings retain individually verified
dispositions. Stateful PostgreSQL remains on major 17 for storage compatibility;
major-format changes require the logical migration workflow.

## Logging

Application logs use fixed event codes and allowlisted metadata with `userId`,
`actorType` and string `severity` (plus Pino's numeric level). Use verified database
identities; anonymous callers/jobs have explicit actor types and null user IDs.
Directus async context preserves the original caller across elevated internal
writes and isolates concurrent requests. Scheduled jobs inherit no prior caller.

Allowed: request IDs, static route templates, method/status/duration, resource IDs,
changed field names, counters and checked publication flags. Excluded: bodies,
query values/raw URLs, names/email, headers/cookies/tokens, raw user agents/IPs/IP
hashes, research, rendered mail, raw exceptions/stacks/provider responses. Normalize
user agents to coarse family/version/OS/bot signals; these do not prove bot identity.

Use `info` for success and ordinary 400/404/405/422 input rejection; `warn` for
auth/permission denials, conflict/throttling, optional degradation and untrusted
browser diagnostics; `error` for failed functionality and unexpected server 5xx.
Alarm on structured server severity, not all stderr. Group related event/request
records. Client telemetry accepts fixed codes only (2 KiB, five/minute, duplicate
suppression); it cannot manufacture error alarms. Development HMR exception
forwarding is excluded for the same privacy reason.

Directus native HTTP auto-logging is replaced by safe completion logging with
`LOGGER_HTTP_AUTO_LOGGING=false`, `LOG_STYLE=raw` and source-verified error-printer
patches. Nuxt has a custom safe error handler. Mutations bypassing SDK events need
an explicit safe success audit after commit. Native `directus_activity` history,
including existing IP metadata, is retained separately; stdout privacy does not
purge it or infrastructure history. Collector/alert routing and retention remain
operator configuration. Rebuild changed extension bundles and the CMS image
together; regenerate logging manifests and inspect controlled deployed canaries.

## Editorial and publication invariants

- Municipality publication and preview use independent `published` and
  `preview_enabled` flags. Both require the acting user's current verification.
  Publishing additionally checks actual approved assessments for every published
  measure at 100%; never trust submitted/cached completion alone. Preview can be
  incomplete, stays out of rankings and never automatically publishes at 100%.
  Preview links are scoped to the selected catalogue. The deprecated
  `creator_verified` mirror grants no access. Inactive legacy flow YAML is retained
  to disable old deployed flows during import; deleting it can leave them active.
- Registration uses exactly one visible backend catalogue and actual
  `localteam_id`. Current-catalogue publication determines its completed state;
  otherwise distinguish absent team, zero/missing progress and work in progress.
  Do not infer team existence from URL/external slugs or another catalogue.
  Registration status and public ranking eligibility have distinct contracts.
- Score/rank hooks recalculate affected municipality/catalogue pairs, regroup all
  bulk rating changes and rank across the catalogue. Measure updates/deletes
  capture old publication/catalogue state before mutation. Progress/source/note
  edits do not affect scores. Keep the active trigger reference beside the hook.
- Blökkli content uses immutable owner IDs. Drafts have local/server recovery,
  revision conflict checks and atomic publication; removed blocks are archived.
  Reject unsupported, malformed or cyclic persisted bundles without truncation.
  Runtime V2 visibility/context mapping preserves existing V1 records without
  persisting editor-only context. Register props/defaults/nesting/editable fields
  together as specified in AGENTS.md and `shared/editorBlocks.ts`.
- Project map location priority is an explicit valid project point, its linked
  municipality point, then a unique normalized published name/state match.
  Ambiguous/invalid locations are not guessed; unlocated projects remain listed.
  Coordinates/place names are public facts, not automatic translation input.
- German UI uses proper umlauts and `:` for gendered terms. Use informal `du`;
  candidate/party correspondence uses formal `Sie`. New UI copy requires DE/EN/IT
  keys. Use shared brand tokens and preserve CanonicalButton styling.

## Runtime environment

Private dotenv files are mounted read-only into the services and loaded by
`podman/environment` on every process start. They are excluded from image contexts
and from frontend artifact fingerprints. No native secret snapshot or Compose
`env_file` embeds their values in container creation metadata. Restart an existing
container after editing its mounted file; no image rebuild is needed for runtime
configuration. Files must remain private, owned by the operator and mode 0600/0400.

The small static launcher uses Go because PostgreSQL and Meilisearch have no
JavaScript runtime. Its parser follows the existing dotenv grammar, preserves
literal dollars/backslashes and never evaluates shell code. Source, tests and
license are maintained together. Node application/configuration code stays
TypeScript. Hard security flags remain enforced by Compose; mutable settings such
as provider credentials and CORS are read from the mounted files.

The frontend translates legacy names into Nuxt runtime aliases using
`shared/runtimeEnvironment.ts`; explicit `NUXT_*` overrides win. Nuxt's runtime
configuration has secret-free build defaults. Only explicit public fields enter
browser payloads. The configured public CMS asset origin also updates CSP image/media
allowlists at process start; credentials and malformed URLs are rejected. Source/runtime/output fingerprints still reject altered or stale
artifacts, but changing dotenv values does not invalidate output. `compose exec`
through `bin/slk stack` reloads the same files and preserves explicit command env
overrides. Do not bypass it when a CLI operation needs application credentials.

Bootstrap database credentials do not rotate persisted database accounts. Changes
to published ports, mounts, image versions or resource limits require a Compose
recreation; those are infrastructure changes, not runtime dotenv changes.

## Deployment and recovery

**Owner decision, 2026-11-12: Podman only, Caddy only.** Docker deployment files and
gateway configurations/tests are retired. `bin/slk` is the single checked
TypeScript operations CLI; no maintained shell scripts remain under `bin`.
Its stack, CMS, database, extension, deployment and test groups share the provider. Maintenance uses the same reviewed Caddy image family on an unprivileged
port. Do not reintroduce another engine/proxy path. Existing private data/backups
from the old deployment are preserved; source cleanup never deletes them.

Development acceptance on the installed Podman 5.4.2/podman-compose 1.6.0 host
allows a verified AppArmor-enabled kernel where rootless Podman reports no
effective LSM support. Production preflight still requires effective AppArmor or
SELinux and rejects this host. Never present development acceptance as production
confinement certification. Selected dotenv files mask canonical library paths
read-only; maintenance metadata lives in the private XDG runtime directory.

Keep capless non-root services, read-only production roots, private networks,
rootless mappings, seccomp and runtime confinement audits. Keep JIT/thread/PDF
fallback compatibility. Production app/CMS/maintenance listeners are loopback
only; DB/cache/search are private. The selected gateway overwrites trusted peer
headers and enforces route/query/body limits, nonce-compatible fallback headers,
CORS/referrers and separate API/page/static budgets. Only the explicit Wahlcheck
embed route permits the checked HTTPS LocalZero/GermanZero partner origins.
Maintenance is a fallback, not an editorial write lock.

A separate CMS hostname limits website-XSS impact on Data Studio sessions even
on the same host. Path, HttpOnly and SameSite do not isolate browser origins.
Coordinate DNS/TLS, public/private URLs, cookies/CORS and retirement of old-origin
UI/sessions. The retained Caddy host-cutover instructions describe apex/www
automatic HTTPS and an isolated CMS; verify actual host configuration separately.

The Caddy build pins its rate-limit module and x/net 0.62.0. Its import graph
excludes deprecated x/crypto/openpgp (GO-2026-5932), and fails if it appears. This
is a reachability disposition, not a clean raw audit. Preserve the graph and
module manifests in the image and reassess new binaries/findings. Bound peer-state
memory and retain independent rate budgets.

Preserve verified off-host DB/uploads/configuration/proxy backups and any
`podman/core-storage/<environment>.compose.json` overlay. Existing migration tools
remain explicit recovery/upgrade operations, not recurring startup jobs. Separate
restored storage is verified before activation; keep originals/image IDs for
rollback. Never mount newer data into older binaries or use `down -v` for upgrades.
Keep registered DB migrations, tour preflights and seeds needed for restored/fresh
installations. The historical >95% publication SQL is retired; only guarded CMS
publication remains.

The database-role tool retains the bootstrap operator, creates a restricted app
login owning application objects for imports/DDL, and rejects drift/active clients
and unexpected ownership. It preserves PostGIS objects transactionally and checks
inherited privilege memberships/database ownership. Separate runtime/migrator
roles remain future work. Rehearse real CMS import and restore on staging.

All overlap choices in [the cleanup report](docs/REPOSITORY_CLEANUP.md) are resolved
by keeping their described complementary mechanisms except **CMS user invitation
consolidation**, the sole pending decision. Keep both search composables; their
contexts/contracts differ. Keep layered rate limits and search reconciliation.

## Quality gates and remaining work

There is no TypeScript diagnostic baseline. Builds enforce strict app/server/
shared/node/Vue checking, source inclusion, unsafe-value/promise lint, checked
scripts/tooling, translations, logging manifests and source backports. Extensions
run strict `tsc`/`vue-tsc` before bundling; dynamic host callback typing is narrower
than frontend unsafe-type enforcement. CLI implementation is TypeScript with a
minimal executable bootstrap and fail-fast imports; multi-request imports are
not universally transactional. ESLint rejects warnings; formatting is separate.

Run `cd bin && ./slk test dev` and wait for completion. Also run the relevant strict,
lint/format and targeted checks, and curl localhost:8080 after frontend changes.
Explicit full HTTPS/editor/image/proxy/storage tests use disposable environments;
do not run writable fixture suites against production. The quality workflow and
dependency audit run weekly/for relevant changes; remote activation and branch
protection still require actual repository administration.

Remaining acceptance/maintenance tasks:

1. Review fresh dependency/image findings and renew exact image dispositions
   before 2026-11-24. A local source patch does not waive new advisories.
2. On each deployment target verify restored backups, effective secrets, DB role,
   proxy/network/resource limits, matching images/compiled extensions/imports,
   public search and configured credentials. Record revision/date/results.
3. Check real SMTP/Listmonk double opt-in, authenticated StadtLandZahl parity,
   AI/Unsplash providers, external booking and analytics arrival. Local mocks
   do not establish these integrations. SMTP routes must reach the actual host,
   with canonical TLS hostname verification preserved.
4. Verify native OS installs, deployed light/dark/mobile/editor interactions,
   certificate renewal, reboot/systemd recovery and long-lived/multi-tab sessions.
5. Future separately scoped choices: TS 7/stable Blökkli, candidate expiry/hashing
   and legacy-token entrypoint retirement, runtime/migrator DB split and immutable
   CI-built deployment artifacts. Existing candidate/preview retention stays in force.
6. StadtLandZahl OpenAPI generation remains incomplete (historical assessment:
   20 operations, only 12 response schemas). Recheck actual contracts and live
   authenticated parity before replacing maintained clients with generated ones.

Documentation records repository intent and explicitly dated evidence; it is not
proof of a current production deployment, credential rotation or security sign-off.

Builds disable Nuxt telemetry and install the full locked build toolchain even
when NODE_ENV=production. Noninteractive builder runs use `-T`. GitHub workflows
pin checkout 7.0.1, setup-node 7.1.0 and upload-artifact 7.0.2 by full commit IDs;
release compatibility was checked against the official action release notes.
Local workflow validation does not establish an actual hosted-runner execution.

## Upstream integration (2026-11-12)

- Preserve the feedback/UI fixes, safe legacy CMS HTML normalization, authored
  homepage/editor-state guards and isolated CMS-origin routing from main.
- Rootless production may use the administrator-installed, exact-source
  `slk-rootless` AppArmor profile. Validate its enforcing kernel label, protected
  policy source and denied writable canary; audit inherited container labels.
  The development-only enabled-kernel fallback never establishes production acceptance.
- The TypeScript `bin/slk` remains the sole bin entrypoint. It exposes portable
  Podman backup create/verify, guarded release coordination and CMS-origin
  checkpoint/restore. Preserve the tested upstream release protocol internally.
- Do not reintroduce native per-key environment secrets or build-time credentials:
  mounted dotenv reloads remain authoritative. Release volume overrides use the
  shared flattening provider. Portable dumps reload the mounted DB operator environment.
- Consolidate the newly introduced Docker-only full-export duplicate into the
  portable Podman capture. Keep database-only, sanitized, release-recovery and
  complete portable backups distinct by their recovery scope.
