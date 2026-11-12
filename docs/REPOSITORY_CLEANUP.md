# Repository cleanup and remaining overlaps

Reviewed 2026-11-12. This report distinguishes removed unreachable code from
supported alternatives requiring an owner choice. Runtime behavior, endpoints,
scheduled jobs, permissions and registered database migrations are preserved.
Architecture/security policy is in [PROJECT_DECISIONS.md](../PROJECT_DECISIONS.md).

## Changes

- Removed fourteen unreachable Vue components: the old collection cards/modal,
  DataProductViewWrapper and its histogram/map children, DataMapPanel,
  JobOfferStatusPill, MunicipalitySearchBar, MunicipalityStats, StaticMeasureCard
  and ThresholdProgressBar. The maintained collection pages use
  DataProductScrollSection, DataProductPanel, VegaChart and MapLibreRenderElement.
  No CMS-registered Blökkli bundle was removed.
- Removed their exclusive histogram/map contracts and HistogramConfig type, the
  unused content-search composable and administrative-search shim. The late-search
  response regression now exercises the active `useUnifiedSearch` implementation.
  Removed tests solely for retired components/contracts; maintained boundary
  tests and browser workflows remain.
- Consolidated local SVG preparation in `utils/buttonIcons.ts`. The CanonicalButton
  and Blökkli button retain their different background-removal rules. Both variants
  were compared byte-for-byte across all 43 checked-in SVG icons (86 outputs).
- Removed the archived pre-map tour component, obsolete v10 role-policy conversion
  helper/public-permission SQL, stale Apollo editor configuration, commented-out
  development pgAdmin configuration, a tracked Finder metadata file and an obsolete
  example task that recommended public-role access.
- Removed unused direct `@iconify/json` and `vega-geo` dependencies; Vega retains
  its own transitive geo dependency. Locked versions of retained packages stay
  unchanged. `linkifyjs` remains the required peer of `linkify-string`; the explicit
  patched PostCSS dependency remains.
- Consolidated seventeen historical decision/review documents into the current
  project record, repaired references and trimmed stale setup/migration narratives.
  Current deployment, Podman, Caddy, translation, CLI and feature/test instructions
  remain available. Existing uncommitted TLS-cutover notes and environment edits
  were preserved.
- Corrected two strict optional-property request constructions by omitting absent
  options. Wire parameters remain identical. Updated the collection-render test's
  locale mock and MapLibre dependency mock to match the existing implementations.
  Chart label cleanup now explicitly returns void and models the existing optional
  Font Loading capability without dropping its runtime fallback.

## Recorded decisions

Owner decisions of 2026-11-12; work is on `repository-cleanup`. Only invitation
consolidation remains pending. Existing private volumes/backups are preserved.

| Area                  | Decision                                                                                                                 | Status      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------- |
| Score publication     | Retire `bin/migrations/publish-all-municipality-scores-over-95.sql`; retain verified-actor/100%-assessment CMS controls. | Resolved    |
| Container engine      | Podman only; remove Docker source definitions and convert operational scripts/tests.                                     | Resolved    |
| Gateway               | Caddy only; retire nginx configurations and its dedicated test profile.                                                  | Resolved    |
| Maintenance           | Podman-managed Caddy static server; shared maintenance HTML/logo/metadata retained.                                      | Resolved    |
| Runtime configuration | Read-only mounted dotenv files loaded at each startup/exec; runtime changes need a restart, not an image rebuild.        | Resolved    |
| Area/unified search   | Keep both contracts and orchestration; differences below.                                                                | Resolved    |
| Search indexing       | Keep event updates plus periodic/startup reconciliation and live publication checks.                                     | Resolved    |
| Climate resolution    | Keep immediate hooks, scheduled recovery and manual invocation of the same resolver.                                     | Resolved    |
| Navigation            | Keep responsive surfaces; future shared presentation helpers must preserve each interaction.                             | Resolved    |
| CMS invitations       | Keep both current workflows while deciding whether to share further invitation primitives.                               | **Pending** |
| Service provisioning  | Keep the shared provisioner and isolated translation-worker wrapper/identity.                                            | Resolved    |
| Translation pipeline  | Keep transactional outbox, leased worker/reconciliation and bounded operator controls.                                   | Resolved    |
| Rate limiting         | Keep shared presets with Redis, database and edge enforcement at their respective boundaries.                            | Resolved    |
| Rating exports        | Keep scheduled report delivery and native interactive export/import.                                                     | Resolved    |
| Backups               | Keep full, sanitized and migration-specific recovery workflows.                                                          | Resolved    |
| CI                    | Keep raw lockfile auditing, reviewed image/quality gates and target acceptance workflows.                                | Resolved    |

## Area search versus unified search

| Aspect                       | `useAreaSearch`                                                                                                                                  | `useUnifiedSearch`                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Main caller                  | `AdministrativeAreaSearchBar`, used by municipality/area selection surfaces.                                                                     | `TheSearchCommandPalette`, the global keyboard-search surface.                                                                                  |
| Providers                    | Administrative-area lookup through the StadtLandZahl client and checked server route; optional catalogue-status enrichment from public CMS DTOs. | Area lookup, published CMS municipalities and Meilisearch full-text content run in parallel.                                                    |
| Search scope                 | `reasonable`, `normal` or `all`, depending on the picker.                                                                                        | Normal area search plus CMS/content results, grouped and indexed for keyboard navigation.                                                       |
| Catalogue context            | Supports catalogue name and an exact Directus catalogue ID for status lookup.                                                                    | Uses catalogue-name context and complete published score rows from its municipality DTO.                                                        |
| Team/progress classification | Distinguishes missing team, zero/missing progress (`not-started`), work in progress, complete and older-catalogue results.                       | Its area path can use `in-progress` for an existing team without distinguishing zero progress; also prepends CMS-only municipalities.           |
| Concurrency                  | Debounce plus generation guards stop late results from replacing a newer or cleared query.                                                       | Debounce, generation guards and AbortController cancellation cover several parallel providers; each provider can publish results independently. |
| Return contract              | Picker-oriented enriched result list and loading/search/clear controls.                                                                          | `groupsWithIndex`, `flatResults`, loading/search/clear controls.                                                                                |

They overlap in enrichment/presentation but do not currently implement an identical
status contract. Replacing either with the other would change result inclusion,
zero-progress labels, catalogue selection or response timing. The owner has
resolved this overlap by retaining both; CMS invitation consolidation is unrelated
and remains pending.

## Pending CMS invitation overlap

| Surface                        | Authority and scope                                                             | Implementation                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Administrator role invitations | Administrators select an explicitly allowed human role.                         | `erfolgsprojekte-user-manager/src/admin-endpoint/index.ts` and `src/module/role-invitations.vue` |
| Article-editor invitations     | Planning-team members or administrators invite only `ErfolgsprojekteRedaktion`. | `erfolgsprojekte-user-manager/src/endpoint/index.ts` and `src/panel/panel.vue`                   |

Paths above are under `src/directus/extensions/`. Both already use
`src/shared/invitations.ts` and `src/shared/InvitationForm.vue` in that extension
for the common mechanics. The remaining decision is whether to consolidate their
surfaces/endpoints further. Preserve the different authorization boundaries and
resend/account-conflict protections in any follow-up. Neither was removed.

## Runtime environment acceptance

`podman/environment` is a dependency-free static launcher for the application and
data-service images. It rereads mounted dotenv files and replaces itself with
the service process. The existing dotenv grammar is preserved, including literal
`$` values, quoted/multiline strings and shared Meilisearch-file precedence. The
private host file is not copied into images or represented as provider secret
values. Frontend legacy keys become Nuxt runtime aliases; production artifacts
contain defaults and remain valid after runtime-key changes.

Targeted regression coverage includes actual launcher execution, changed-file
reloads, managed-control precedence, rejected malformed input without secret
logging, alias coverage/overrides and environment-independent output verification.
Provider fixtures cover fail-closed import, prepare-only, restart and exec behavior.
Native acceptance on 2026-11-12 also built production output with dotenv disabled,
confirmed an injected build credential was absent, and served two successive
mounted `PUBLIC_URL` values from the same artifact after process restarts. An
HTTP CMS asset origin updated the production CSP while retaining its nonce.
The maintenance Caddyfile passed validation with Caddy 2.11.7.

The required `cd bin && ./test_dev.sh` passed 294 repository tests, 40 CLI tests,
Go tests and all 26 live regression steps. Frontend and extension lint, CLI/test
harness strict checking and shell syntax checks passed. Fresh dependency audits
still report high findings in retained dependencies; see PROJECT_DECISIONS.md.

A real Podman image/build/restart acceptance remains required on a host with the
rootless runtime and UID-mapping helpers installed. This workstation currently
has no Podman executable; existing containers and native process checks do not
establish the new deployment's confinement, remount or restore behavior.
