# Directus extension compiler enforcement

Date: 2026-10-23. Branch: `0000-security-updates`. **Status: extension enforcement complete.**

This completes the extension portion of section 6 of TYPESCRIPT_MIGRATION_PLAN.md. Nuxt phases 0–8 remain complete. The privileged Directus CLI JavaScript migration and its compiler gate are a separate, still-open task; this is not a claim of repository-wide TypeScript completion.

## Implementation

All 14 maintained extensions now expose `npm run typecheck` and enforce it in `prebuild`. The nine packages without Vue use `tsc --noEmit`; the five packages with Vue use `vue-tsc --noEmit`, which checks their 13 SFCs as well as TypeScript. Configurations enable strict TypeScript and disallow unchecked application JavaScript. The regression suite inventories all 64 maintained TS/Vue sources and rejects omitted files and JavaScript SFC scripts. No diagnostic baseline or error suppression was introduced.

The extension packages retain their existing TypeScript 5.9.3 compiler and Directus SDK 18.0.6; the added Vue checker is 3.3.13. The frontend remains on TypeScript 6.0.3. Directus remains **11.17.4**. Standalone extensions are checked against their own dependencies, independently of Nuxt's generated configuration.

Invalid historical imports (`Database`, `Schema`, `ItemsService`, `Services`, `Logger`, `GetSchema`, SDK `Router`) were replaced with actual `@directus/types` exports and context-derived types; Express supplies the router/request declarations. Services carry the existing row types through their supported generics. The consent registrar uses `RegisterFunctions['filter']`. System score calculations now supply the complete SDK accountability shape while retaining their existing administrative authority. No role, policy, schema or public permission YAML changed.

These types follow the installed SDK declarations and the [Directus service-context API](https://docs.directus.io/extensions/services/introduction). The native service types still contain SDK-provided dynamic values, and existing extension `any` use is not claimed to be eliminated. Vue checks cover scripts, known components and template expressions; Data Studio's dynamically registered global components do not gain fabricated prop declarations.

## Repairs caught by checking

- The icon-radio template referenced an undeclared `block` value despite already having the static `block` class. The redundant dynamic reference is removed; selected/disabled states and CSS remain intact.
- The footer editor's nullable external URL now maps to an omitted native title attribute. The activity panel's nullable member key has a string fallback.
- Custom interface configuration accepts Vue's `Component` type rather than requiring a prop-less `DefineComponent`. An unsupported interface configuration property was removed. Data Studio's existing translation injection is explicitly declared.
- Consent endpoints type their authenticated requests, reuse the request schema when present and otherwise obtain it through the SDK context, after rejecting anonymous callers. Consent enforcement and service-role exemptions remain in place.
- Unsplash authentication accepts query-bearing requests and validates the injected user identity as a nonempty string. Unauthenticated/malformed identities are rejected before upstream requests.
- Weekly reports pass the extension database as the supported `knex` option instead of the ignored `database` option.

All packages were rebuilt; changed tracked `dist` bundles accompany their source changes. Type-only changes leave the other bundles byte-identical.

## Verification

`bin/test_suite/src/directusExtensions.test.ts` is included in `test:unit` and also available as `npm run test:extensions`. Six isolated tests cover package/config/source inclusion, real consent endpoint and hook execution, weekly-report connection wiring, Unsplash authentication and actual radio-component rendering. They require no services or real mail/upstream access.

| Check | Result |
| --- | --- |
| `./bin/check_extensions.sh --build` | All 14 strict checks and builds passed |
| Isolated negative build probes | All 14 packages rejected TS2322 before bundling; all five Vue packages also rejected an invalid string template method, for 19 rejected builds total |
| Harness compiler and unit suite | Passed; 124 tests, about 3.24 seconds |
| Required `cd bin && ./test_dev.sh` | Passed; 12 workflow checks, 28.40 seconds |
| Full application workflows after rebuilding/restarting Directus | **90/90 passed**, 341.62 seconds; disposable fixture cleanup passed |
| Editor persistence / nested content | 2/2 passed, 22.04 seconds |
| Weekly CSV tests | 2/2 passed |
| CLI tour migration database regression | 1/1 passed inside the Directus container; the host attempt could not resolve Docker hostname `db` |
| Local HTTP checks | Homepage, navigation API and Directus health returned 200 |
| Dependency audits | All 14 extension packages reported zero known vulnerabilities |

The negative probes used temporary directories with the package's real compiler/configuration and dependency tree. Each invoked the actual `npm run build` lifecycle with a deliberate invalid source and asserted that the bundler was never reached. No invalid source was placed in the running application.

No frontend production bundle was rebuilt in this batch: frontend source and release configuration did not change. The Phase 8 production build/security results remain recorded in PHASE_8_REVIEW.md. Live authenticated StadtLandZahl and Unsplash, production email/newsletter delivery and exploratory CMS interface presentation still require their configured environments; this local test run does not establish those integrations.

## Deployment and remaining work

Install each extension's locked dependencies with `npm ci`, then run `./bin/check_extensions.sh --build` from the repository root. Restart Directus to load the rebuilt bundles. The normal local Directus container was restarted and remains available. No YAML import, database migration or cache clearing is required for this batch. Nothing was committed or pushed.

The next operational task is migrating the CLI `.mjs` implementation without changing its executable path, ESM behavior or import/export semantics, and adding a dedicated compiler gate. Include regression tests for the item-import `limite` typo and asynchronous update sequencing recorded in TECHNICAL_DEBT.md. Existing frontend dependency findings remain separate from the clean extension audits. Registry checks also found newer compatible Sass (1.106.1 versus 1.105.2) and html-validate (11.17.0 versus 11.16.4) releases; these have no reported advisories and were left for ordinary dependency maintenance. Express 5 typings, Node 26 typings, Vue changes against the SDK pin and TypeScript 7 were not forced into the Directus 11 packages.

The existing Git index and HEAD were preserved. New files remain unstaged for review.
