# Application security logging

## Record contract

Application-owned logs use fixed event codes and allowlisted structured fields.
Every application record contains `userId`, `actorType` and a `severity` string.
Pino records also retain their numeric level. Alarm rules must inspect severity/level,
not treat all stderr output as an error (console warnings also use stderr). A verified website editor or
Directus account is identified by its database ID. Candidate access is identified
by candidate ID and `actorType: candidate`. Anonymous callers, scheduled jobs and
unresolved browser diagnostics have `userId: null` with an explicit actor type;
no identity is invented from an email address, browser claim or IP address.

Nuxt request logging resolves the opaque editor session when present. Login,
logout, token refresh and candidate handlers attach their verified identity to
the current request. Directus hooks use event accountability and asynchronous
request context, retaining the original caller across internally elevated writes.
The context is shared between compiled extension bundles and isolated between
concurrent requests. Scheduled work does not inherit a previous caller.

Allowed metadata includes request IDs, static route templates, method, status,
duration, resource IDs, changed field **names**, completion counters and explicitly
checked publication flags. It excludes bodies, parameter values, query strings,
raw URLs, email addresses, names, cookies, headers, tokens, credentials, rendered
mail, editorial research, raw exceptions, stack traces and provider responses.
Allowlisting is deliberate: redacting a few known property names cannot protect
arbitrary SDK errors or nested request objects.

User-agent information is normalized to browser/tool family, major version, OS,
known bot category and a suspicious-length/control-character flag. The raw header
is never stored; it is attacker-controlled and can contain IPs or secrets. UA
facts are signals for investigation, not proof that a client is a bot. Nuxt logs
contain no IP, forwarded IP, IP hash or geographic identity. Internal rate limiting
continues to use its existing peer budget; its keys are never logged.

## Severity and alarms

- `info`: successful reads/writes, authenticated transitions, completed jobs,
  and ordinary rejected input such as 400/404/405/422. Election workflow
  preconditions (missing questions, recipients or editorial template corrections)
  return 422 instead of generating a server-error alarm.
- `warn`: permission/authentication denials, concurrency conflicts, throttling,
  recoverable optional-service failures, blocked CSP reports and untrusted client
  diagnostics. A normal rejection must not page an operator.
- `error`: unexpected invariants or failed functionality affecting users, such as
  request 5xx responses, failed publication/search persistence or mail delivery.
  Alarm rules should target these server-side error records. Repeated warnings
  can separately support rate/abuse alerts without converting each refusal to an
  application error.

`POST /api/security/client-event` accepts only fixed event codes, rejects arbitrary
fields, bounds the body at 2 KiB and is limited to five requests per minute. The
browser suppresses duplicate codes for one minute. Reports are warnings because
an anonymous client must not be able to manufacture error alarms. Vue and window exception handlers suppress the browser's raw exception printer
after emitting the fixed diagnostic. Nuxt’s development error-overlay plugin is
excluded because it forwards raw browser exceptions over HMR and prints them on
the server; this privacy rule also applies during local development. Server-side
failures remain errors and can be correlated by authenticated user and request.

## Directus and infrastructure

Pinned Directus 11.17.4 already records successful login/logout activity in
`directus_activity`. It also emits login success/failure events and exposes verified
JWT metadata; the security audit hook uses those events without inspecting tokens.
Native activity remains enabled. Its historical database audit metadata, including
Directus' existing IP fields, is separate from the application stdout log contract;
this change does not rewrite or purge audit history or alter public permissions.
Host nginx, Docker daemon and database infrastructure logs have their own operator
retention/access policies; they are not Nuxt application logs.

`LOGGER_HTTP_AUTO_LOGGING=false` replaces the native HTTP printer with the safe
request-completion hook. `LOG_STYLE=raw` emits JSON for collection/alerting. A
source-verified image patches remove native error-object dumping from the HTTP
error handler, action/init emitter, scheduled flows and SMTP verification, including
at debug level. Guards touching the same vendor file are composed before writing
so logging hardening cannot overwrite authorization/mail safeguards. Nuxt uses a custom error handler because Nitro's default handler
prints raw URLs and exceptions. Malformed candidate tokens are rejected before UUID database filters, preventing
invalid input from turning into a database failure/error alarm. The original HTTP
status and ordinary 4xx messages
are retained; unhandled/5xx responses are generic and contain no raw request URL.

State mutations are audited for application and system collections. Publication,
mail sends, registration/rollback, candidate answer saves, block publication, queued
search-index tasks, rating writes with events disabled, and raw database
enrichment/public-folder/completion-counter writes have explicit events where an
SDK mutation hook alone is insufficient. SQL writes
that bypass Directus must add their own safe success event after commit.

## Validation and rollout

`bin/test_suite/src/securityLogging.test.ts` exercises projection, poisoned user
agents, status levels, concurrent actor isolation, real hook registration and the
pinned native error patch, SSR context dispatch and election rejection severity. Its source guard prevents ad hoc runtime console/native
logger calls from returning. Browser telemetry accepts fixed codes only. Existing
publication tests enforce the new ID-only log contract.

Build every modified extension, rebuild the pinned Directus image and recreate the
local/target application containers with the updated Compose configuration. The
custom bundle and image/config must be deployed together so native request logs
are replaced, not merely removed. No schema/permission/public-role changes are
needed. No alert receiver is configured here: route server `severity: error` records
to the existing monitoring system, grouping by event/request ID to avoid duplicate
notifications from related failure and request-completion records. Frontend hot reload applies source changes locally. Review the full diff,
run type/lint/format gates and `bin/test_dev.sh`, then inspect controlled canary
requests in the actual container logs before production rollout.

Dependency audit: the unchanged frontend lockfile reports the existing node-forge
advisory and its parent graph entries. The permanent `security:check` and node-forge
regressions verify the repository's source backport; the lockfile audit deliberately
continues to report the advisory. Extension lockfiles have no high/critical findings.

Production build note: frontend imports of the shared logging modules use
`~/shared/...` aliases. Relative imports were rewritten to invalid external paths
by the Vite 8 SSR build; the Nuxt aliases keep the shared modules resolvable during
Nitro bundling. Validate this boundary with the full `npm run build`, followed by
startup fingerprint verification and the deployed read-only public smoke checks.
