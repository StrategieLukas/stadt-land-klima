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

| Identity / policy family                | Intended authority                                                                                                                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend-Server                         | Private Nuxt service; scoped website reads, never browser configuration.                                                                                                                                                                                |
| Frontend-Public                         | Minimal public-asset identity; currently no frontend token consumer. Public asset safety cannot depend on token secrecy.                                                                                                                                |
| Frontend-Preview                        | Isolated private verifier; distinct from individual municipality preview links.                                                                                                                                                                         |
| Legacy Frontend                         | Retire after replacement access works; never reuse for new browser integrations.                                                                                                                                                                        |
| Content-Translation-Worker              | Private translation job/memory controls, separate from public readers and ordinary CMS authority.                                                                                                                                                       |
| LokalteamAdmin / LokalteamMitglied      | Existing local-team ownership through the user/team junction and scoped policies. A URL slug is not proof of membership.                                                                                                                                |
| BlokkliEditor / Blokkli-Editor          | Personal editorial access, scoped draft/publication operations.                                                                                                                                                                                         |
| ErfolgsprojekteRedaktion / Planungsteam | Existing editorial and article-editor invitation workflows; preserve their distinct authority.                                                                                                                                                          |
| Maßnahmenteam                           | Read-only measures/ratings including drafts and archived catalogues, related scores/templates and Maßnahmen panels; no other-user data, internal notes, contacts or preview secrets. Own-account/consent permissions remain inherited from MinimalUser. |
| Recruiter, WahlcheckAdmin               | Named editorial responsibilities defined by their checked policies.                                                                                                                                                                                     |
| API and remaining roles                 | Keep the exact checked allowlists in `src/directus/{roles,policies}`; do not infer administrator access from a role label.                                                                                                                              |

Wahlcheck administration is split by the non-null boolean `is_localzero` on
`elections` and `directus_users` (default `false`, meaning SLK). Administrators
assign the user flag; personal profile updates cannot change it. The
`WahlcheckAdmin` policy matches election categories for elections, questions,
candidates and both ends of answers, preserving existing deletion conditions.
Election creation presets the caller's category and validation prevents category
changes. Local teams can set their own election's flag. This classification is
independent of the public `?theme=localzero` styling parameter.
The election-check category hook validates question/candidate election IDs using
the caller's permissions before create/reassignment, refusing nested election
payloads. Question comments are restricted to readable question IDs for
Wahlcheck admins because their generic item references cannot be joined by YAML.
Local-team selectors include matching-category elections and teams without any
elections, allowing first-time setup. Existing records require explicit
reclassification if they belong to LocalZero. Permissions from additional roles
or direct policies remain additive; assign scoped Wahlcheck admins only the
intended policy set.

Native Insights metric/chart query callbacks use GraphQL, which Caddy intentionally
blocks on both CMS origins. Maintained Allgemein/Maßnahmen panels therefore use
`slk-rest-metric` / `slk-rest-pie-chart` from the community-activity bundle. These
reuse native query builders, options and renderers with the current CMS user's
REST authority; no service credentials or new server endpoint are involved.
Requests are serialized to respect gateway budgets, stale queries are cancelled,
and failed reads show an error/retry rather than a false zero. Dashboard variables
remain resolved by Directus. Native dashboard refresh/auto-refresh is retained
through the SDK-exposed Insights store, and each panel also has a refresh control.

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
The pinned mail flow operation is source-hash patched to await `MailService.send`
and reject cancelled/failed sends with sanitized errors. Native per-flow and
global mail rate limits remain in place; no Directus version upgrade is involved.
Registration reports its email step only after the welcome flow accepts a message
containing the password-reset link. Generating a link or requesting the native
fire-and-forget password-reset endpoint is not delivery confirmation. Transport
acceptance does not prove inbox delivery.

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

`bin/slk cache flush` invalidates application caches through the selected local
stack's private runtime and project mutation lock. Directus cache clearing uses
its existing authenticated API, pinned to container loopback; restarting Directus
also clears extension-local caches. Frontend writers stop before development
response/compiler cache removal; restarting frontend clears Nitro production
memory storage and module-local caches. Redis sessions, proof replay records,
rate limits, delivery quotas and locks are durable security/coordination state,
not flushable application caches: never use FLUSHDB/FLUSHALL or restart Redis for
this command. Preserve content, persisted translations, search indexes, uploads,
`.data/kv`, dependencies and stamped production output. External upstream and
browser caches are outside the local stack boundary. A dry run has no side
effects; mutating runs require existing application containers and attempt
frontend recovery after failures. No new public administration endpoint is added.

The frontend resolves Nitro's actual listener to upstream node-forge 1.4.3.
`scripts/check-node-forge.mts` verifies its version and RSA source hash without
modifying installed dependencies. Signature-forgery regressions and local HTTPS
certificate generation remain automated gates. The former 1.4.0 source backport
is retired; reassess the integrity guard when upgrading the fixed upstream release.

`audit:directus-image` retains raw findings. The reviewed gate additionally checks
production controls, vendor regressions and the exact package/version/advisory
list in `bin/test_suite/src/lib/imageAdvisoryReview.ts`. **The review expires
2026-12-04.** Unknown findings/versions and expired reviews fail; renew with
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

Optional host journal collection is maintained in `podman/logging/` and installed
and drift-checked by `slk host plan/install/verify` when the root-only host dotenv
references `SLK_HOST_LOGGING_CONFIG`. The selected stack is **Vector + VictoriaLogs**.
Vector runs as a dedicated unprivileged journal reader, uses a systemd-loaded
per-host credential and sends filtered JSON lines over authenticated HTTPS. Its
1 GiB disk buffer blocks when full; acknowledgments and persistent cursors support
restart recovery across boots. It receives no engine socket or application dotenv.
Native secret-file lookup keeps environment interpolation disabled. The admin API
is disabled; metrics bind only to loopback. Exact release binary hashes are pinned.
The monitoring backend uses Podman Quadlets: single-node VictoriaLogs on a
dedicated internal network and named volume, with additive Grafana/proxy network
drop-ins and no published backend port by default. Query access uses private
container DNS; a native proxy can opt in to loopback-only publishing. Retention
is 30 days with a disk cap. Existing VictoriaMetrics
stays the metrics backend. Host journals are bounded to 512 MiB/three days.
`slk monitoring plan/install/verify` automates the same-owner monitoring setup with
private JSON settings, discovered running Quadlets, preserved INI/environment
plugin lists, generated file credentials, merged Caddy routing and private
rollback snapshots. It validates before activation, verifies authenticated HTTPS
delivery with a harmless canary and restores previous files/services on caught
failure, retaining data volumes. A missing Caddy rate-limit module can trigger a
reviewed binary overlay onto the current image only if existing module names
remain available; custom modules need integration before activation. No remote
deployment, DNS changes, unsigned-plugin bypass or application-host restart is
implied. Native/deployed acceptance and exact-artifact security review still apply.
Disk limits and retries do not establish exactly-once/power-loss durability.
See `docs/CENTRAL_LOGGING.md`, `docs/LOGGING_ALTERNATIVES.md` and the dated release
findings in `docs/LOGGING_SECURITY_REVIEW.md` before activation. The VictoriaLogs
binary Go scan passed; Vector source-lock advisory matches still need an exact
artifact/host review. No remote installation is implied by these checked files.

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
`shared/runtimeEnvironment.mts`; explicit `NUXT_*` overrides win.
The helper's `.mts` extension declares its ESM format for direct Node runtime
and operations imports.
Nuxt's runtime configuration has secret-free build defaults. Only explicit public fields enter
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

**Owner-authorized development exception, 2026-11-17:** `stack` commands accept
`--unsafe-skip-podman-version-check` only for `--env development`. This per-command
opt-in prints a warning and skips only the engine version check; it makes no
compatibility or security-patch claim for older engines. CLI, runtime and direct
host-helper entrypoints reject the override outside development. Other host,
private-file and container checks remain mandatory; production retains its normal
Podman minimum and confinement requirements.

Image-build preflight validates the host without reading runtime dotenv files or
applying runtime/storage mount overlays. Runtime operations, including `doctor`,
retain private-file checks. Legacy Docker database/search dotenv files require an
explicit private copy into the Podman paths; never silently generate replacement
credentials or fall back to legacy configuration.

Normal startup must verify the application schema before custom Directus
migrations run. Fresh/partial schemas require the explicit `start --import`
workflow. The unpublished core-only helper overrides file configuration and
binds to container loopback; only an empty core database with zero users may
recover its first administrator from configured credentials through the pinned
Directus 11.17.4 bootstrap service. Existing accounts and databases with application
tables must never be repaired by resetting credentials or skipping migrations.
Only initial administrator creation may use the configured CLI token when no
explicit `ADMIN_TOKEN` exists. Refuse weak/example initial tokens; never apply
this fallback to an existing user.
Development mail uses a local sendmail logger, pinned through the mounted-env launcher
and a private empty Directus file configuration; production mail transport and
stored SMTP credentials are preserved. Private setup readiness checks the
database-backed API; the normal service retains its complete health check.
Development frontend startup/restart must provision/reuse the restricted website
service identities and synchronize private Nuxt credentials before recreation.
Use the existing service-user provisioner; never substitute public-role access or
rotate existing tokens to fix a configuration mismatch. Check CMS-backed layout
and catalogue APIs before reporting readiness; an HTML shell alone is insufficient.
Production service-user setup remains an explicit operator action.
Required asset folders are code-first YAML imported before data migrations.
Preserve existing folders by name and refuse ID collisions instead of renaming a
private folder or moving its assets into the public namespace.

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

Nuxt's shared modules remain external during Vite SSR bundling and are bundled by
Nitro afterwards. Keep `vite.build.rolldownOptions.makeAbsoluteExternalsRelative`
false so nested SSR chunks preserve absolute shared source identities for that
second pass. Do not replace this with generated-path aliases or copy shared source
files into build output. The production build gate verifies this integration.

Application changes require `./bin/slk check ready` and completion before finishing
or an authorized push. Read-only investigations use targeted evidence, and
qualifying documentation-only changes use the explicit formatting, diff and link
checks in [documentation-only validation](docs/CHECKS.md#documentation-only-validation).
Review the entire unpublished range; mixed or uncertain changes require the full
application path. This scoping rule does not change CLI plans or CI gates.
The TypeScript plan in `bin/cli/check-plan.ts` supplies both local gates and all
four GitHub Actions
workflows; `bin/cli/checks.test.ts` checks workflow coverage. The runner keeps
complete private logs and incremental/final JSON reports under `.reports/checks/`,
with bounded diagnostic tails for agents. Prefer summary output with a short tail;
inspect failed results and saved logs instead of dumping full JSON or rerunning
commands for more output. An unchanged verified application tree needs no repeat
full run solely for a documentation commit or transfer. Exit codes, signals,
timeouts and prerequisites determine outcomes; diagnostic text is never parsed
to infer a pass.
For application changes, selected runs do not replace complete verification. After investigating current upstream fixes, an authorized push may proceed with documented, currently unresolvable dependency advisories as its only remaining failures; audit exit statuses and findings stay unchanged. Exception eligibility is manually reviewed and never converts the check report or CI to a pass. Native matrix and deployed
revision acceptance remain explicit separate environments. See [check runner
reference](docs/CHECKS.md). Curl localhost:8080 after frontend changes.
Explicit full HTTPS/editor/image/proxy/storage tests use disposable environments;
do not run writable fixture suites against production. The quality workflow and
dependency audit run weekly/for relevant changes; remote activation and branch
protection still require actual repository administration.

Remaining acceptance/maintenance tasks:

1. Review fresh dependency/image findings and renew exact image dispositions
   before 2026-12-04. A local source patch does not waive new advisories.
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

## Image advisory reassessment (2026-11-27)

Rechecked the GitHub Advisory Database and its current fixed-version metadata for
all eight image findings on 27 November 2026. The rebuilt Linux image passed all
14 `podman/directus/security-patches/test-runtime.ts` regressions, including share
ownership/target authorization, connection-time SSRF rejection, hostile JSON keys
and depth bounds. An isolated image probe confirmed that the 1.x JSONC parser is
absent; maintained container commands run Directus directly, without PM2 or an
esbuild development server. The existing cache-off and IP-deny-list controls stay
mandatory and are checked by `directusImageAudit.ts --reviewed`. The next review
expires on 4 December 2026; new findings or changed versions still fail.

| Package / finding                                                                            | Current upstream fix | Maintained disposition and evidence                                                                                                                                                         |
| -------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Directus 11.17.4 — [GHSA-c6w9-5g5j-jh2p](https://github.com/advisories/GHSA-c6w9-5g5j-jh2p)  | 12.0.0               | Above the 11.17.4 cap. Response caching remains disabled in Compose and the effective-library probe.                                                                                        |
| Directus 11.17.4 — [GHSA-j5h6-vqc3-phqh](https://github.com/advisories/GHSA-j5h6-vqc3-phqh)  | 12.0.0               | Above the cap. Retain the exact-source unspecified-address backport, connection-time address checks and deny-list; rebuilt-image tests reject literal, DNS and redirected loopback targets. |
| Directus 11.17.4 — [GHSA-7h45-q5jx-7r87](https://github.com/advisories/GHSA-7h45-q5jx-7r87)  | 12.3.1               | Above the cap. Retain the upstream share-update backport; rebuilt-image tests cover creator changes and effective full/partial target changes before mutation.                              |
| stream-json 1.9.1 — [GHSA-hqr4-qq8f-hg3x](https://github.com/advisories/GHSA-hqr4-qq8f-hg3x) | 3.6.0                | The reported JSONC implementation does not exist in the maintained 1.x package. Keep the Directus-compatible 1.x API and the runtime absence check.                                         |
| stream-json 1.9.1 — [GHSA-mjw6-4jj6-33hc](https://github.com/advisories/GHSA-mjw6-4jj6-33hc) | 3.6.0                | Keep the compatible own-data-property backport. The actual image retains hostile keys without inherited privileges.                                                                         |
| stream-json 1.9.1 — [GHSA-528h-pc64-c93x](https://github.com/advisories/GHSA-528h-pc64-c93x) | 3.5.0                | Keep compatible parser/assembler depth bounds. The actual image rejects excessive nesting before filter work.                                                                               |
| esbuild 0.27.3 — [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr)    | 0.28.1               | The advisory concerns a Windows development server. The audited runtime is Linux and runs no esbuild development server; project build tooling already has its separately locked version.   |
| pm2 6.0.14 — [GHSA-x5gf-qvw8-r2rm](https://github.com/advisories/GHSA-x5gf-qvw8-r2rm)        | 7.0.0                | The affected monitoring CLI is not used by maintained startup commands. No request-controlled expression is sent to it.                                                                     |

The [deepmerge advisory GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
was withdrawn upstream on 16 November 2026 and is absent from the current eight
raw findings. Keep the existing own-property backport and regression as defense
in depth. This reassessment changes no dependency version, security control or
raw audit result; the dated disposition is renewed only with the evidence above.
Deployed and native-host acceptance still require their own environments.

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

## Service failure handling

Routine production application updates use `slk release update --env production`
or the production `deploy update` alias. The coordinator fast-forwards main only
after a complete local checkpoint, checksum-verified encrypted off-host backup,
and isolated database restore/count comparison (including paid translation memory).
It never upgrades/recreates datastore containers. Runtime input hashes control base
image rebuilds; application revision labels and actual public DTO reads verify
cutover. Existing guarded activation handles rollback, including post-cutover read
failures. Private dotenv files remain runtime inputs rather than build inputs.

The release backup service is installed from reviewed root-owned source. Its only
deployment-user elevation is the exact fixed `systemctl start slk-release-backup.service`
command. It validates private checkpoint files, uses the existing root-only Restic
credentials, and reads back every payload before recording evidence as deploy. It
does not execute user-writable checkout code as root. Release cloud snapshots use
a separately bounded five-snapshot tag scope; nightly backup scope is unchanged.
Application runners use journalled user services with `KillMode=process`, so SSH
disconnects and runner cleanup cannot shut down the application monitors. Periodic
separate-host disaster recovery tests still require their own environment.

Directus must not mount an autoloaded `/directus/.env`. Its library loader can override
protected process values from that file, re-enabling response caching and serving stale
translation results after direct database commits. The launcher supplies private values
through `/run/slk-env`; production CMS restarts recreate its mounts. Runtime/image audits
check the effective library flags for cache, TUS, WebSockets and MCP, and reject a second
autoloaded dotenv. Data-service containers remain intact during these application updates.

An interrupted CMS settings PATCH is verified through bounded authenticated reads of
every intended value. The importer continues only when all values match, and never
replays the ambiguous write. Missing, masked or different values and authorization
failures stop deployment. Errors omit private setting values. A real dropped-socket
regression covers the single-write recovery path.

The pinned Directus runtime backports the upstream 12.3.1 share-update guard for
GHSA-7h45-q5jx-7r87: share creators cannot be reassigned and changes to item/collection
are checked against share permission before mutation. Full and partial target changes,
denied side effects and ordinary edits have targeted rebuilt-image coverage. Directus
remains on 11.17.4.

CMS translation generation targets are an ordered, validated private job setting, initially
English only. Language changes invalidate pending plans while preserving purchased field
and sentence memory and lifetime usage. The private reader may read ready fields and units
to reconstruct changed bodies with German fallback only for missing sentences; public
requests never generate work. Operator-only configure/run/clear controls preserve budgets
and ambiguous-request quarantine. Source mutations requeue the configured targets after
30 seconds; idle reconciliation runs every six hours. Editorial/current content precedes
progress notes and historical catalogues within each configured language.

Translation persistence authorization errors (including bare proxy 401/403 responses)
stop generation until private credentials are repaired and the process restarts.
Prepared translation reads remain available. Do not replace worker credentials
with administrator authority or rotate an existing service token as an automatic
retry. Production start, frontend restart and release activation/rollback call the
guarded `provisionTranslationWorker.ts` tool before frontend starts. It checks the
parentless role, single non-admin/non-app policy without collection permissions,
and absence of direct user policies. A missing account uses its configured strong
token; an existing account keeps its token. Deployment atomically synchronises only
the selected private frontend dotenv (0600), with credentials confined to stdin and
captured private output. Conflicts fail startup instead of silently repurposing users.
`--prepare-only` leaves provisioning until the actual frontend start.

The build profile and deployment identity are separate. `SLK_DEPLOYMENT_TARGET`
accepts production/staging/future/development; production profiles default to
production and development profiles always disable generation. Staging/preview host
configuration must select staging/future even with production builds. The mounted
launcher locks this setting and forces background generation off outside production,
regardless of copied generation switches. Prepared reads and explicit bounded sample
commands remain available. Production deployment still requires explicit authorization;
repository changes and read-only diagnosis do not authorize a live deployment.

Job share images reuse the checked published-job route and its read-only prepared
translations through an internal Nuxt request. A single measured SVG layout per
format produces PNGs for previews, downloads and native file sharing through the
existing Resvg dependency. Bundled YAML-derived labels and a narrowly packaged
original logo keep crawler output independent of browser execution and CMS label
import timing. The renderer accepts no caller-supplied text, CSS, dimensions or
asset URLs. Organisation artwork is a bounded, transformed raster read from the
configured CMS; failures retain text identity. The in-process render cache is
content-addressed, bounded to 64 entries / 32 MiB / 60 seconds with two concurrent
jobs, and public-job authorization is repeated before cache/ETag reuse. Canonical
job metadata uses only the explicitly allowed same-origin image route. Native
sharing remains user-mediated; no social credentials or automatic posting exist.

Weekly measure-rating CSV mail is a production-only side effect. Directus receives
and locks the same `SLK_DEPLOYMENT_TARGET` as the frontend. The report extension
requires `SLK_ENV=production`, `SLK_DEPLOYMENT_TARGET=production` and an HTTPS
`PUBLIC_URL` on `stadt-land-klima.de` or `www.stadt-land-klima.de`. Missing or unknown
deployment identities fail closed.
`REPORT_ENABLED=false` disables both scheduling and execution; enabling it cannot
bypass the production checks. Staging/future production builds must never mail
these reports. Current staging can be stopped immediately with Directus's supported
extension disable control; private `REPORT_ENABLED=false` preserves the intended
state for subsequent guarded releases. No mail is sent to verify configuration.

Production host maintenance is installed from a clean reviewed Git revision using
`slk host plan/install/verify` and private dotenv references. Root-owned copies of
the standalone TypeScript backup/retention code use a SHA-256 pinned Node binary,
without executing deployment-user-writable code as root at backup time. The host
installer also owns the retained-datastore boot unit, production Caddy entrypoint
and AppArmor policy; hashes, owners and modes are verified against Git. Existing
secret files, datastores, uploads and purchased translation cache/usage remain
persistent state. Cloud failures prevent local retention. Installed source drift
requires a reviewed Git fix and reinstallation, rather than an on-host hotfix.
See [host reproducibility](docs/HOST_REPRODUCIBILITY.md).

Release checkpoints and the database CLI share private CMS database settings.
`DB_DATABASE` selects the live application database after a restore/cutover;
`POSTGRES_DB` remains the datastore initialization default. Dump execution still
loads the bootstrap identity from native or mounted datastore settings, without
placing its password in arguments. Approving a checkpoint requires restored live
data validation, including purchased translation memory, beyond schema checks.

CMS catalogue reads share concurrent requests and a 30-second fresh metadata cache.
The editor alone may use a successful result up to five minutes old during a
transient upstream failure. Validation on save never uses stale-on-error metadata.
Authentication failures and invalid metadata are not hidden by this fallback.
Climate lookup diagnostics retain status/category, never raw upstream payloads,
URLs or credentials; uncertain lookups continue to leave existing values alone.

Legacy CMS image-button artwork is presentation data, not translatable prose. The checked asset-ID allowlist in `legacyImageButtons.ts` replaces only known image-only links from trusted CMS/legacy origins with `CanonicalButton` instances using manual DE/EN/IT keys. Destinations stay authored; photos, foreign assets and editor source HTML are preserved. `CmsHtml` sanitizes before either HTML or Vue-node rendering, and normalizes implicit table bodies for hydration. This avoids OCR, SVG text rewriting and additional provider billing.

## Data dashboard SSR and publication-aware reuse

The `/data` explorer opts into the full-width layout using typed
`PageMeta.contentWidth`, with its hero constrained to the standard centered page
width and gutters; other routes retain the standard container. Product matrices
use container queries and the same remaining-cell calculation. From 1024px, the
chooser and histogram form the left column; compact filters/search, the map and
legend form the right column. Both columns have equal width in an unboxed
desktop grid. Chooser, filters, map, histogram and information panels
use consistent themed borders, corner radii and internal padding. Column edges
and top panels align; picker focus-ring padding is offset within its panel so
card edges align with its heading without clipping the selection/focus outline.
Full product information occupies a separate row below both columns, centered at
the same standard page width and gutters as the hero. The chooser grows to show all cards
without an internal scrollbar or automatic card scrolling; selected cards retain a 4px
theme-aware ring with a surface offset and separate keyboard-focus indicator.
Portrait layouts order the collapsible chooser, controls, map, product information
and histogram. Product
links from the explorer open `/data/{canonicalMunicipalitySlug}#{collectionId}`;
the municipality resolver retains ARS-disambiguated slug identity. Fragment-only
navigation does not remount the municipality page or start a route-loading state.

Overview, full selected-product metadata, regions and interactive histogram feeds
use keyed Nuxt async data and reuse SSR payloads at hydration. The checked collection
endpoint's existing `metadata_only=true` response loads alongside the overview;
obsolete requests cancel and collection identity is checked before display.
The product information row renders complete product, ordered narrative-step,
overview-visual and active-metric descriptions. Whitespace-normalized exact duplicate
paragraphs and headings are removed; distinct explanations remain. Metadata failure
retains available overview information with a localized retry, never a previous
product's metadata. Single-metric selectors, repeated standalone scope/unit captions
and duplicate attribution are omitted; map attribution remains available even if
WebGL fails. Municipality product catalogues/anchors and the
first product's metadata/render/summary arrive through SSR; other sections load
near the viewport or when targeted by a fragment. Standalone product URLs keep
working with parallel SSR product reads. Collection charts render sanitized SVG
previews for both themes during SSR and replace them atomically with an interactive
client canvas in the reserved frame. MapLibre remains client-rendered. The overview map placeholder uses the same bordered
frame and explicit full-width sizing as the rendered map, including the portrait
aspect ratio and height cap. The page reserves that frame outside `ClientOnly`
so the asynchronous map component cannot collapse it while mounting. A gray pulse
covers map initialization until its first load; dashboard and shared chart
placeholders use the existing `bg-gray-200`
theme mapping with reduced-motion support. Histogram loading retains the chart's
height rather than inserting an extra visible loading row. Full HTML is not
shared-cached because the layout contains locale/session-specific content;
draft/preview no-store rules remain.

Data-product score colors use project-defined thresholds when available, with
relative quintiles only as fallback. KPI targets remain explicitly defined. The
backend read representation groups `score_segments` from exact persisted snapshot
memberships and fixed labels; it retains original quintile segments for older
consumers and fallback. Render specs select the appropriate dataset and color
field. The frontend checks palette labels and per-bin count conservation before
binding it. Tile score labels coalesce the fixed score with the persisted relative
class; a versioned cache key excludes old representations. The authorized API-only
slk-data2 change is recorded in `docs/patches/threshold-first-overview-colors.patch`;
it changes neither publication pointers nor pipeline/controller state.

Data products without a published overview keep a reserved map frame with a
localized static pending message. Only explicit backend missing-projection/config
codes are treated as pending; transport and other API failures retain an error
state. An unavailable overview never leaves an endless loading pulse or empty
filter panel, and product information plus municipality search stay available.

Collection chart theme changes update a palette signal in the existing Vega view;
they do not refetch data, recompile charts, reset zoom or create a second live view.
SSR renders the two SVG palettes from one interpreter-backed headless view, without
a native Canvas dependency. Only same-origin collection scalar feeds
(`timeseries`, `histogram`, `summary`) can be loaded by the SSR renderer, through
the checked proxy. SVG permits sanitized geometry/text and local paint references,
with isolated IDs. A request-scoped feed cache deduplicates those reads (24 feeds,
1 MiB each and 4 MiB total, with a shared three-second I/O budget);
preview generation is capped at eight charts per
request and 256 KiB per SVG. Hydration reuses the loaded feed bodies only while
the input specification matches; it does not download them again. The two previews
and their data are kept in that page’s Nuxt payload, without a shared HTML or
cross-session observation cache. Unsupported/oversized/failed previews retain the
browser renderer. Browser-only lazy sections hydrate normally; changing theme
reuses their loaded chart as well. The existing locked Vega interpreter is declared
as a direct dependency for the server renderer. Backend cache/withdrawal rules,
API access and Directus versions remain unchanged.

Data summaries permit null attribution, license and effective-date metadata fields
without rejecting otherwise valid observations. Shared attribution resolution uses
non-empty summary sources, collection sources, then aggregate metadata, accepting
the existing snake_case/camelCase aliases. Whitespace-normalized identical rows
are deduplicated; distinct source/license statements remain. The same resolved
credits feed the visible attribution blocks and chart exports. The index renders
collection source/license metadata in its centered information row and retains
plain overview attribution when structured metadata is unavailable. Map credits
remain independent. Labels use existing DE/EN/IT translation keys; valid effective
dates use the selected locale and Europe/Berlin timezone, and invalid dates are
omitted. Source/license links allow only HTTP(S) URLs without credentials; their
text is rendered through escaped Vue interpolation. Dark map boundaries use
`#344454` consistently at creation and on theme changes, with light outlines and
selection emphasis preserved. No backend endpoints or caching rules change.

The SLZ proxy optionally retains checked public JSON bodies only when upstream
supplies positive public cache permission and validators. Entries are bounded
(128 / 8 MiB, maximum 1 MiB each and 60 seconds), keyed by upstream/query,
representation and a hash of the private service identity. Every reuse requires
upstream conditional revalidation; errors invalidate the entry without stale
fallback. No-store/private, Set-Cookie, unsupported Vary, member/search responses
and errors are excluded. Tile bytes and upstream cache restrictions are preserved.
Publication/withdrawal/snapshot checks before 304 are required in the backend
handoff. No dependencies or private credentials were added to browser state.
