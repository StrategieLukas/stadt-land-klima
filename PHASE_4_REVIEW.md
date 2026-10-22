# TypeScript migration — Phase 4 review

Reviewed 2026-10-22 against `TYPESCRIPT_MIGRATION_PLAN.md` and the working tree based on `fdb73498`. No commit or deployment is part of this change. Phase 0–3 evidence remains in `PHASE_0_3_REVIEW.md`.

## Scope

Phase 4 converts shared application scripts, plugins, state and composables. It does not claim a fully migrated Vue application: components, pages, deeper editor/visualization contracts and final strictness are phases 5–8.

- All maintained JavaScript modules in `shared`, `composables`, `plugins`, `stores` and middleware have been converted to TypeScript; active imports follow their new paths. Pure helpers share locale, translation, answer, sector, score and identity contracts. Scoped type-aware lint prohibits explicit `any`, unsafe assignments/calls/member access/returns and unhandled promises in the migrated scope.
- The two locale plugins expose the same `appEnv`, `locale`, strict `t` and explicit `translateDynamic` injections. The private CMS client stays inside server translation loading; neither plugin exposes an SDK client. SSR records its locale in request-scoped Nuxt state and HTML, and hydration reuses that locale. The editor requires its authenticated personal client.
- Translation tooling parses actual YAML, rejects duplicates/misplaced files and checks **1,071 keys in each of German, English and Italian**. It generates the checked-in `TranslationKey` union. A real compiler test proves that an unknown static key fails while explicitly dynamic CMS keys remain possible. Existing components with their own broad translator casts remain component-migration work.
- Authentication has explicit, validated browser identity/session storage, including the historical role-ID shape. SSR receives a fresh anonymous store and cannot persist a session. Initialization is coalesced; late identity and refresh replies cannot restore a replaced session. SDK refresh/logout commands have distinct names from the composable methods.
- Header geometry, mobile-header visibility, drawer and palette state use request-scoped Nuxt state. Callback bridges are browser-only. Theme storage failure falls back to in-memory state. External dictionary lookup respects the current supported locale.
- Search, catalog, municipality and data composables expose typed values and validate external data. Search generations discard late replies after clearing/replacement; area classification reacts to the selected catalog. Manifest caching separates upstream origins and retries failed validation after a cooldown. Collection loading validates both collection and rendered responses, discards outdated loads and clears diagrams on failure.
- The StadtLandZahl plugin validates area, search, GraphQL connection and render replies. Histogram identifiers are checked before interpolation; pagination rejects missing/repeated cursors, including cycles spanning several pages. Region matching retains the exact ARS prefix guard. Service URL validation rejects unsafe protocols, credentials, query strings and fragments without echoing credentials.
- The unused `shared/directus-calls` modules and unused asset helper have been removed. The unmounted historical tour journal is retained at `docs/legacy/TourSeriesJournalBeforeMap.vue`, outside Nuxt source discovery. Active native tours remain in the regression suite.

## Defects found and repaired

1. **Truncated translation fallback:** `/api/public/translations` returned at most 1,000 entries despite each language having 1,071 keys. The route now uses the typed SDK translation operation, returns the complete set, checks supported languages/query shapes and validates/projects response fields. Invalid upstream data produces a controlled 502.
2. **Unimported/malformed translation sources:** German search/local-team labels were outside language directories; an English local-team label used `en-US` outside the supported source set. They now live in canonical language folders, with the missing Italian label added. Two descriptions containing literal Unicode line separators now use valid quoted YAML. Existing German wording is retained. New shared loading/search strings have de/en/it translations.
3. **Session refresh/logout recursion:** composable methods shadowed SDK command names. Aliased SDK imports now invoke the real operations. Tests verify command arguments and resulting persisted session state.
4. **SSR/client language disagreement:** the browser previously derived a locale independently of SSR. Both plugins now share the serialized locale; tests exercise browser-language negotiation and a saved cookie that overrides it.
5. **Unchecked/stale state:** malformed cached sessions, external responses and configuration now cross explicit validators. Late searches cannot resurrect cleared results. Manifest caches no longer mix origins. Failed chart loading clears both the visible steps and plot-ID map. Unsupported data fails through controlled empty/error paths.
6. **Non-finite helper results:** comparison scores no longer become `NaN` for missing/zero population; missing score colors have a defined fallback. Zero-quality and invalid-quality language preferences are excluded.
7. **Regression harness readiness:** candidate interactions now await actual Nuxt hydration; public Wahlcheck checks also retain client-request settling. The registration fixture now supplies the ancestor identity fields present in the area contract. No assertion has been weakened or changed into an accepted skip. One development run also timed out while draining browser responses; the exact seven-step disclosure flow and nine-step preview suite passed separately with inspection unchanged. Timeout errors now identify stalled origins/API families without logging query strings or credential-bearing paths.

## Validation

**Verdict: Phase 4 is implemented and reviewed, with no remaining items against its defined exit criteria.** Later-phase application debt and deployment-specific checks remain explicitly separate.

| Check | Result |
| --- | --- |
| Translation completeness and generated-file drift | Passed: 1,071 keys × 3 languages |
| Frontend type/lint/tooling gate | Passed; no new diagnostics or baseline exemptions |
| Full diagnostic inventory | **258 diagnostics / 174 unique entries**, down from 282 / 193; 19 baseline entries removed, zero added |
| Test-harness compiler | Passed |
| Unit regressions | **55 passed**, approximately 2 seconds; includes 18 Phase 4 cases |
| Required development fast suite | **55 unit tests + 11 integration steps passed**; integration runner 27.68 seconds, about 30 seconds for the wrapper |
| Complete workflow acceptance | **89/89 passed** against the isolated production artifact in 302.54 seconds; development disclosure rerun **7/7**, preview suite **9/9** |
| Fresh isolated production build | Passed, without overwriting development `.nuxt` |
| Anonymous public browser checks | **8/8** development and **8/8** fresh production artifact |
| German/English/Italian browser state | Passed in development and fresh production artifact; theme toggle/persistence and search open/close included |
| Editor persistence | **2/2 passed** against the production artifact: recovery/failure/publish/reload and nested legacy content/media/library interactions |
| Preview and migration security | **9/9** development preview checks; **22/22** fresh production migration checks, including public asset credential scanning |
| Staging read-only sanity check | **7/8**; deployed homepage reports a hydration mismatch; seven other pages pass. Staging has not received this branch's changes |
| Lockfile platform bindings | All 15 Rolldown platform packages remain optional |

The raw checker is intentionally not clean: the remaining baseline belongs to maintained components/pages/server/editor work outside Phase 4. Archived historical source accounts for 12 removed diagnostics; the other reductions are repaired shared/composable diagnostics. No broad compiler/lint suppression was added. Two existing rich-text `execCommand` uses retain narrowly explained deprecation suppressions because changing the editing/undo behavior requires separate acceptance.

Authenticated live StadtLandZahl is unavailable in this local environment. Its migrated plugin and data boundaries are exercised with deterministic responses through the actual implementation, plus existing data-availability workflows. This does not establish live upstream availability or arbitrary visualization compatibility. SMTP delivery, production deployment and non-Linux runtime execution are also outside this local verification.

## Repeating the checks

Use the patched Node version selected by `.nvmrc`, with the development stack running:

```bash
cd src/frontend
npm ci
npm run typecheck
npm run translations:check
cd ../../bin
./test_dev.sh
./test_dev.sh --full
cd test_suite
npm run typecheck
npm run test:blokkli
npm run test:security:preview -- http://localhost:8081 http://localhost:8080 ../../src/directus/.env
```

Run fixture-based acceptance suites sequentially: database hooks intentionally recalculate related fixtures. The default development runner stays short; `--full` explicitly requests all editorial workflows. Anonymous `npm run test:public -- <origin>` blocks write requests and does not require CMS credentials.

For concurrent development, use the isolated production-build procedure in `PHASE_0_3_REVIEW.md`, substituting `slk-phase4-production` for `slk-phase03-production`. Run the type/lint gate first. Point `TEST_FRONTEND_URL` at that artifact for editor tests and `TEST_FRONTEND_BUILD_DIR` at its copied `output/public` directory for migration-security asset scanning.

Apply the translation sources through the existing code-first importer (no schema/policy change is needed):

```bash
docker compose exec -T directus node /directus/cli/index.mjs import:translations /directus/translations --force
```

That import was run successfully on the local stack. `FEATURES.md` records exact targeted versus partial/manual coverage. The user's pre-existing staged Markdown and staged-but-deleted diagnostic/proxy files must be preserved; review/stage the intended working-tree diff before committing.
