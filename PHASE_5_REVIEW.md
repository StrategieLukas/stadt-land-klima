# TypeScript migration — Phase 5 review

Reviewed: 2026-10-22. Branch: `0000-security-updates`. Base: `7a860dc3` (Phase 4). No commit is created by this change.

**Verdict: Phase 5 is implemented and reviewed. No items remain against its defined exit criteria.**

## Scope and implementation

All **131 maintained reusable SFCs** are included, including existing TypeScript components and one extracted map-marker component. **65 JavaScript scripts in 64 components** now declare `lang="ts"`. Existing component styles are byte-for-byte unchanged. There is no Options API rewrite or translation change.

| Phase 5 requirement | Implementation |
| --- | --- |
| Convert in dependency order | Shared navigation, content, municipality/rating, election and data contracts precede display controls, shell/navigation, forms, charts and maps |
| Precise props/defaults/emits | Runtime defaults retained except the documented zero-threshold repair; nullable inputs represented explicitly; filter models, navigation actions, election answers and histogram events have typed payloads |
| Empty refs and DOM/library events | DOM/template refs, timers, Chart.js/treemap, Leaflet and MapLibre instances use checked types; CAPTCHA custom events and errors narrow unknown input |
| Different rendering states | Data-product map requests use distinct idle/loading/ready/error variants; existing registration/newsletter state unions remain intact |
| Template checking | `tsconfig.components.json` enables strict component templates; the build gate runs both application and component configurations and rejects component exemptions, including during baseline refresh |
| Existing TS review | Removed component `any` declarations, unsafe JSON reads and editor-option casts; visualization payloads remain unknown until narrowed |
| Preserve styling and editor integration | No existing SFC style changes; CanonicalButton styling unchanged; Blökkli bundle names, explicit-return mock props, nesting and editable-field contracts retained |

The component template configuration permits standard `data-*` attributes and the legacy named accordion markers. Blökkli directives and the ALTCHA web component have declarations. Unknown-event checking is disabled for undeclared native/Leaflet listener fallthrough; declared emits and callback payloads are still checked. The shared repository-wide template strictness work remains Phase 8.

The component lint gate enforces unsafe-value, explicit-any, promise and other TypeScript checks. It preserves defensive nullable guards for unchecked JavaScript parents and existing markup formatting rather than rewriting templates/styles to satisfy formatting or redundant-guard rules. Existing advisory Vue warnings remain warnings.

## Behavior repairs and regressions

- Statistics read the actual prop and handle missing input.
- Progress layout validation returns a boolean; zero thresholds use finite defaults and avoid invalid layout percentages.
- Organisation logos accept both asset IDs and expanded asset objects. Image transforms and token-scoped report media remain intact.
- Search metadata matches the server's text/null response, and merged search results retain area/content discriminants.
- PDF requests use a binary response parser; registration newsletter names use the actual first/last-name fields.
- Histogram, geometry and marker payloads are checked before rendering. Unsupported map layers retain their legend metadata. Map request states cannot simultaneously show success and error.
- Native step widths, multiline titles and structured inline data retain Vega/Vega-Lite compatibility. Named Vega data is supplied through the specification's `datasets`, which Vega-Lite actually reads, while preserving other datasets.
- Both treemaps register their own scales; native grouped/leaf payloads retain their checked measure identities. Native chart callbacks use supported dataset/index access instead of private element context. The polar scale uses the standard implementation that its former empty subclass delegated to. Leaflet map-mask styling uses supported props.
- The projects-carousel editable label is a descendant DOM element with `v-text`, preserving the editor requirement.

The first full acceptance run caught a changed municipality accordion marker before the candidate portion of that flow could run. The legacy markers and lookup behavior were restored. The assertions were retained; the final run passed the entire flow, including the candidate steps.

## Verification

| Check | Result |
| --- | --- |
| Unit suite | **72 passed**, 2.10 seconds; includes **17 Phase 5 cases** |
| Required development runner | **11/11 integration steps passed**, **33.20 seconds** in the final run |
| Test harness TypeScript | Passed |
| Application/component type and migrated lint gate | Passed on the final implementation; component errors cannot enter the baseline |
| Raw application diagnostics | **258 → 193**, unique baseline entries **174 → 109**; only resolved entries removed; zero component exemptions |
| Fresh production build | Passed; isolated output avoids disturbing development `.nuxt` |
| Anonymous public smoke | **8/8 development**, **8/8 final production artifact** (1.58 seconds); all page navigation is read-only |
| Staging smoke | **7/8**; pre-existing deployed-homepage hydration mismatch, other pages pass |
| Complete workflow acceptance | **89/89 passed**, **304.33 seconds**, against the final production artifact |
| Editor persistence | **2/2 passed**, **18.27 seconds**; publishing/recovery, nested legacy content, formatting, media and reuse |
| Preview and migration security | **9/9 preview**, **22/22 migration**, including scanning copied final production assets |
| Existing component CSS | All original style blocks byte-identical |
| Dependency audit | Unchanged: 17 findings (14 high, 3 moderate, zero critical); no dependency upgrade in this phase |

The focused tests execute actual Vue component scripts/templates for statistics, filter events, progress controls, images, project logos and map request transitions. Native treemap tests independently load both components and exercise the real Chart.js/treemap controller; they check scale registration and grouped/leaf payloads. They also check actual search, histogram, geometry, CAPTCHA and Vega-data contracts, and parse every maintained SFC. An actual temporary strict-template compiler probe rejects an invalid prop type, a missing required prop and an invalid emit callback; the probe is removed afterwards. The gate's negative tests cover preparation/compiler failure, new diagnostics and attempted component-baseline additions. Coverage remains explicit in `FEATURES.md`; incidental page loads do not establish targeted chart coverage.

## Remaining migration scope

Phase 5 does not make the application fully migrated: pages, server feature-family diagnostics, deeper persisted Blökkli/external visualization validation and final global strictness remain Phases 6–8. Raw application checking is not clean. JavaScript parents still limit type guarantees until Phase 6.

Authenticated live StadtLandZahl is unavailable locally. Deterministic contract tests and data-availability workflows do not prove arbitrary upstream chart configurations or live upstream availability. SMTP/newsletter delivery, production deployment and other operating systems remain deployment checks. The unchanged dependency findings remain tracked separately in `TECHNICAL_DEBT.md`.

## Repeatable checks

```bash
cd src/frontend
npm run typecheck
cd ../../bin
./test_dev.sh
./test_dev.sh --full
cd test_suite
npm run typecheck
npm run test:components
npm run test:blokkli
npm run test:security:preview -- http://localhost:8081 http://localhost:8080 ../../src/directus/.env
npm run test:public -- http://localhost:8080
```

Run fixture-based suites sequentially. Use the isolated build/preview procedure from `PHASE_0_3_REVIEW.md` with `slk-phase5-production` paths, and run the gate before programmatic builds. Migration asset scanning must point at that artifact's copied `output/public` directory. Keep the short default runner separate from full editorial acceptance. Review/stage the working-tree diff manually; pre-existing staged Markdown and staged-but-deleted files are preserved.
