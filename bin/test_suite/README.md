# Automatic Test Suite

The suite is a TypeScript runner under `bin/test_suite`. It creates disposable Directus data, drives the Directus backend app with Playwright where user-visible backend behavior matters, verifies frontend pages in a browser, and cleans up the created data.

## Running

Use the wrapper scripts from `bin/`:

```bash
./bin/test_dev.sh
./bin/test_staging.sh
```

Or call the suite directly:

```bash
./bin/test_suite/run_tests.sh <backend-url> <frontend-url> <absolute-path-to-src/directus/.env>
```

`run_tests.sh` installs local npm dependencies on first run and launches the TypeScript runner with `tsx`.

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
TEST_MAILPIT_URL=http://127.0.0.1:18025 ./bin/test_dev.sh
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

The current suite executes:

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
