# Automatic Test Suite

The suite is a TypeScript runner under `bin/test_suite`. It creates disposable Directus data, drives the Directus backend app with Playwright where user-visible backend behavior matters, verifies frontend pages in a browser, and cleans up the created data.

## Running

Use the development wrapper from the repository root (or `./test_dev.sh` from `bin/`):

```bash
./bin/test_dev.sh
./bin/test_dev.sh --full
```

Or call the suite directly:

```bash
./bin/test_suite/run_tests.sh <backend-url> <frontend-url> <absolute-path-to-src/directus/.env> [--full]
```

`run_tests.sh` installs local npm dependencies on first run and launches the TypeScript runner with `tsx`.

Measured on the reviewed local stack: **109 isolated tests in about 2–4 seconds**;
**about 35 seconds total** for the fast wrapper (109 isolated + 12 integration steps);
**90 full workflow steps in about 5 minutes**. These are observed timings, not
hardcoded time budgets; cold dependency/browser installs are separate.

The default **fast** profile runs all isolated tests, then the real CMS/API/browser
jobs and public-navigation regressions, plus the three-language shared-state flow (SSR/hydration, theme persistence and search controls). The **full** profile additionally retains
all existing registration, editorial, candidate, PDF, import/export, contact,
mail-authorization, tour and data workflows. It takes several minutes; it remains
the release check. Both profiles print their names, per-step durations and totals. Run CMS fixture
profiles/security/editor suites serially: catalog and municipality hooks fan out
across the shared database. Isolated unit tests need no such serialization.
Browser checks wait for Nuxt hydration and specific content rather than waiting
for all map tiles/analytics requests to become idle. Do not describe the fast
profile as the complete workflow suite.

For a quick public sanity check against an existing deployment:

```bash
cd bin/test_suite
npm run test:unit
npm run test:public -- https://staging.stadt-land-klima.de
```

`npm run test:boundaries` runs Phase 7 editor/visualization checks: all bundle/prop registrations, malformed/cyclic/duplicate block trees, draft history, actual adapter mutation/recovery/identity handling, supported native/compiled Vega interpreter execution, runtime loader URL/credential policy, MapLibre style/geometry validation and actual map-constructor/error branches. These tests need no services or GPU. `phase7.types.ts` adds negative compiler checks against actual installed Blökkli declarations. The default isolated suite includes all of these cases.

`npm run test:pages` runs the focused Phase 6 contracts in `src/phase6.test.ts`: route/query values, page/template-check coverage, projection/privacy, submission/PDF/newsletter validation, candidate answer ownership, nullable statistics, SLZ metadata, search filtering/sanitization, signed CAPTCHA metadata/replay and municipality project filters. The fast public-navigation flow also solves a challenge with the actual installed ALTCHA web component, checks draft news/series filtering and exercises native chart navigation. `test:unit` needs no running services. Phase 4 cases in `src/phase4.test.ts` check translation generation and real compiler key rejection, session validation/SSR isolation/auth races, malformed external replies, pagination cycles, cache retries and late search responses. It runs actual handlers, helpers, the adapter,
and Vue search reactivity with transport boundaries replaced. Stadt.Land.Zahl
fixtures cover current/older/incomplete/unpublished assessments and upstream
failure without live credentials. `test:public` needs no environment file or CMS
login. It opens eight public pages with two browser workers and blocks every
non-GET/HEAD request. It checks HTTP errors, hydrated content, measure links and
Vue hydration mismatches. It works with the earlier staging deployment as well
as the branch's same-origin public APIs; passing pages do not prove API parity
between versions. It never runs the writable CMS fixture suite on staging.

`./bin/test_staging.sh` preserves the previous **full, writable** staging workflow;
it creates and removes CMS fixtures and must not be used as a read-only smoke test.

Mail webhook authorization is part of the full suite. It checks anonymous,
Frontend, LokalteamMitglied and LokalteamAdmin rejection before any mail operation,
and administrator access. Without an SMTP capture, the administrator probe uses
empty recipients to avoid sending test messages and checks the flow's execution
steps instead. `npm run test:mail-client` separately tests the Nuxt caller's
credential handling, private destination routing (including public URL aliases),
redirects and failures.

For delivery checks, point a disposable development Directus deployment at a
local Mailpit SMTP server, then run this from the repository root:

```bash
TEST_MAILPIT_URL=http://127.0.0.1:18025 ./bin/test_dev.sh --full
```

The capture API
must belong to that same test SMTP server; keep it bound to loopback. The suite
then verifies successful authorized webhook delivery and both registration mails,
including the welcome activation link. Restore the development SMTP configuration
and remove captured messages after testing. This does not test production mail
delivery or inbox placement. Never direct these capture checks to production.

The focused Blökkli browser regression runs separately against the development
stack (`localhost:8080` and `localhost:8081`):

```bash
cd bin/test_suite
npm run test:blokkli
```

It checks inline edits, autosave failure feedback, local draft preview, updates
in an open preview, failed publication, server draft recovery, publication,
and server-rendered content after reload. Its disposable page, blocks and edit
state are removed afterwards. It uses the admin credentials in `src/directus/.env`.

## What It Covers

The full profile executes:

1. `add_user_flows`: localteam-admin visibility, editor invite screen, editor creation, invited user creation, role assignment, localteam junction, Directus list visibility, and expected invitation email.
2. `rating_wahlcheck_flow`: ratings completion, preview locking/unlocking, score publish/unpublish through the Directus checkbox interface, ranking visibility, published municipality detail checks on desktop and mobile, sector-card visibility, municipality PDF generation, Wahlcheck thesis generation, extra thesis creation, candidate setup, review request, WahlcheckAdmin approval, candidate mail token generation, public candidate answer forms, public Wahlcheck overview, and public Wahlcheck result wizard.
3. `register_localteam_flow`: frontend registration page entry, new localteam request with real Altcha/browser submit, Directus user/localteam/municipality creation, localteam-admin junction, success-state copy, expected welcome email, and the existing-localteam contact path.
4. `erfolgsprojekte_articles_flow`: LokalteamMitglied article contribution without publish access, ErfolgsprojekteRedaktion create/edit/delete/publish access, fully populated published article detail checks on desktop and mobile, projects overview visibility, all overview filters, and savings sort behavior.
5. `ratings_import_export_flow`: global import/export bookmark fields and scope, native JSON export/import with scalar UUID relations, all five ratings as numbers and strings, null ratings, edited notes, and rejection of unsupported rating values. Uses disposable fixture ratings and restores their original values. The export dialog itself is checked manually.

## Test Rules

- Backend visibility must be checked by opening the Directus app and reading rendered HTML. Do not infer visible behavior from permissions alone when the app can be opened.
- Programmatic API calls are acceptable for high-volume setup or bulk data entry, but the critical user-facing controls must still be verified in the UI.
- All generated emails use `@stadt-land-klima.de` test addresses. The suite prints one combined manual email checklist at the end because local development usually has SMTP disabled.
- Every created resource must be cleaned up, including users, editor records, localteams, municipalities, ratings, scores, elections, questions, candidates, and answers.
- Cleanup must delete in foreign-key-safe order.

## Relevant Pages

- Rankings page: `/municipalities?v=<measure_catalog.name>`, for example `/municipalities?v=beta`.
- Register localteam page: `/register_localteam` and `/register_localteam?ars=<ars>&name=<municipality>`.
- Projects overview/detail pages: `/projects` and `/projects/<slug>`.
- Municipality detail/preview page: `/municipalities/<slug>?v=<measure_catalog.name>` and `/municipalities/<slug>?v=<measure_catalog.name>&preview=<token>`.
- Overall Wahlcheck page: `/elections/wahlcheck`.
- Municipality Wahlcheck page: `/elections/wahlcheck/<slug>`.
- Candidate thesis form: `/elections/thesen/<access_token>`.

## Public reads and navigation

Both profiles execute `src/flows/publicNavigationFlow.ts`. Disposable CMS
fixtures exercise every visible catalog (including dotted version names), published
measures, descriptions and version switching, sector filters, comparison ratings,
map/statistics data, public tools, organisation teams, the combined news feed,
parent-scoped CMS blocks, embedded pages and root/nested Vega charts. It checks
unpublished-score and draft-parent exclusions and browser errors during navigation.
The browser uses real Nuxt links for catalog/detail/filter interactions; the remaining
page transitions use the hydrated router and assert that the document is retained.
External map tiles, Stadt.Land.Zahl datasets, exhaustive chart controls and visual
layout still require manual review; these are not implied by a passing HTTP status.

Mounted checks explicitly verify rendered statistics/history charts, organisation
team tasks, carousel project cards, a search cloud's publication filtering, and
rapid chart/detail unmounts. Team and cloud browser cases supply deterministic
public response fixtures; separate real API assertions verify CMS projections.
`publicReads.test.ts` additionally covers pagination boundaries, dotted catalog
names/map coordinates, actual score joins, interface aliases, private parent/tour
report scope, chart collection/field allowlists, same-catalog publication coverage,
and catalog-ID-to-name search enrichment. These checks catch empty fallback widgets
that a heading/HTTP-200-only smoke test would miss.

Check the TypeScript test harness separately with `npm run typecheck`. The other
standalone checks are `test:contracts`, `test:blokkli:adapter`, `test:blokkli`,
`test:mail-client`, `test:security:helpers`, `test:security:preview`, and
`test:security:migration`; security commands requiring service URLs also need the
backend, frontend and `.env` arguments shown above. Migration asset scanning must
use the **freshly built** public directory via `TEST_FRONTEND_BUILD_DIR`.

Phase 8 permanent-check regressions are in `src/phase8.test.ts`: source/config coverage, deliberate strict compiler failures, build/mount wiring, checked search documents, Node proxy forwarding and unknown Directus error shapes. `phase5.test.ts` also checks actual native button click forwarding and attributes. `publicReads.test.ts` covers navigation singleton reads and nested public projection. These isolated tests are included in `npm run test:unit` and require no services. The full application gate is `npm --prefix src/frontend run typecheck`; it includes `lint:types` across all maintained TS/Vue and checked JS tooling. `.ts-baseline.txt` and its refresh command have been retired.

For focused tour/editor acceptance without rerunning unrelated workflows:

```bash
npm run test:tours -- http://localhost:8081 http://localhost:8080 ../../src/directus/.env
```

This runs the existing Tour Series assertions with disposable fixture setup/cleanup. Keep it serial with all other fixture suites. The shared Blökkli pointer helper pans the transformed artboard using real wheel events, keeps field clicks clear of fixed toolbars and waits for canvas hit testing; it does not use synthetic DOM editing events.

Directus extension regressions run with `npm run test:extensions` (`src/directusExtensions.test.ts`) and are included in `test:unit`. They check all 14 compiler/prebuild configurations and source inclusion, consent endpoint authentication/schema resolution, service-role exemptions and required legal agreements, report database wiring, Unsplash authentication and actual radio-selector rendering. They add about a second when run alone and need no services. From the repository root, `./bin/check_extensions.sh` checks extension sources; `./bin/check_extensions.sh --build` also builds the bundles, with each package’s `prebuild` enforcing its compiler. Install each extension’s locked dependencies first with `npm ci` in its directory. See `DIRECTUS_EXTENSION_TYPES_REVIEW.md` for the negative build proofs and runtime verification.

CLI regressions run through `npm run test:cli` and are included in `test:unit`. Install the CLI lockfile first (`npm --prefix ../../src/directus/cli ci --include=dev`). These cases use isolated HTTP/filesystem fixtures and add roughly 10 seconds. Compiler-negative/startup probes remain in `npm --prefix ../../src/directus/cli run test:gates`; live flow/dashboard and tour migration tests are separate serialized commands.

Security follow-up: `securityHardening.test.ts` is part of the fast unit gate and covers actual sanitizer, quota, math, form, session, search, PDF, mail-escape and core guard/cutover implementations. `TEST_REDIS_URL=redis://<local-redis>:6379 npm run test:security:redis` separately checks the real Lua window with 100 parallel requests across two clients and removes only its unique test key. Do not point it at production. `npm run audit:dependencies -- /private/report/directory` audits all maintained npm lockfiles, writes JSON reports and exits 1 for high/critical findings or 2 for registry/tool failures. The weekly GitHub workflow deliberately fails on known findings and requires no deployment secrets.

`npm run test:security:nginx` starts a disposable loopback-only nginx with stub upstreams and a temporary self-signed certificate, exercises the real checked-in host config, and removes the container/certificate afterward. Docker plus OpenSSL are required. It tests opaque query rejection, normal bracket queries, WebSocket disabling, trusted peer headers and security/private-referrer headers; it sends no exploit to Directus. This integration test stays outside the default browser suite.
