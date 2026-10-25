# Municipality publishing and preview repair

## Findings

1. The custom publisher permits publication at 95%, while public rankings require 100%. The server checks the acting user's verification but has no completion guard, so API requests bypass the UI threshold.
2. Verification belongs to `directus_users.verified` for the person making the change. There is no `localteams.admin_verified` schema field. The UI label “Admin verifiziert” refers to `municipalities.creator_verified`, a legacy mirror of the designated local-team administrator's verification.
3. That mirror is written by the score hook and registration/create-municipality paths, referenced by the inactive legacy sync flow and token field/generation conditions, exposed in private read policies and expected by older tests. Public preview authorization already uses a separate server-only token verifier, not this mirror.
4. A published but incomplete score is selected before preview authorization in the page-state composable, producing a locked page even with a valid preview link. Sharing one boolean between preview and publication would also silently publish a completed preview.

## Step-by-step implementation

1. Keep `published` for an explicit full publication. Add code-first `municipality_scores.preview_enabled`, initially false, with narrowly scoped owner read/update access. Keep existing local-team ownership and hidden-catalogue filters. Do not change public-role or legacy Frontend permissions.
2. Enforce changes in Directus filters for create and update. Require the acting user's current `verified` value for either control, regardless of the designated team administrator. Reject publication below 100% using server-side assessment data, never submitted percentages. Internal system score recalculation remains supported. Return stable, descriptive error codes.
3. Show two independent, clickable controls in the custom table. Keep controls enabled for verification/completion failures so clicks explain what is required; only read-only and in-flight controls are disabled. Explain anti-spam verification and contact `info@stadt-land-klima.de` in German, English and Italian. Refresh verification on each action; handle server errors and undo failed optimistic updates.
4. Add a preview link to each enabled table row using Directus’ configured preview URL and an explicit catalogue parameter; the general CMS preview button otherwise defaults to the backend catalogue and can open the wrong version. Gate private preview links by `preview_enabled` for the selected catalogue. Enabling preview requires verification, but no rating percentage. Keep unpublished/draft research behind the server-only token check, no-store responses and explicit checked DTO. Prioritize authorized preview presentation; preview never enters ranking/comparison results or automatically publishes at 100%.
5. Retire the active creator-verification synchronization. Keep its YAML tombstone inactive so import reconciles older deployments. Hide/deprecate the old field without dropping historical data. Remove active writes, token-generation dependencies and unnecessary private read grants. Keep token generation cryptographically random in the TypeScript hook; disable the old Math.random-based flow through its YAML definition.
6. Log successful publication/preview writes to structured Directus logs using event-context accountability: actor ID/email, municipality ID/name, catalogue, percentage, requested changes and final state. Do not log preview tokens, credentials or research. Logging enrichment must not prevent status/rank synchronization. Native Directus activity continues to supply the transaction audit.
7. Add targeted API and component regressions for direct-request bypass, 99/100 boundaries, unverified designated admin versus verified member, revoked verification, incomplete preview, independent states, token/catalogue isolation and log actor metadata. Update the existing rating/disclosure tests and FEATURES.md.
8. Build both extensions, typecheck/lint, import YAML into local Directus, restart Directus, curl localhost:8080 and run bin/test_dev.sh plus targeted editorial workflows. Review dependency audits and the full diff. Production rollout requires deploying the same compiled extensions, frontend and YAML together, running import-all.sh from the repository root, then checking logs and access with disposable accounts.

## Rollout / compatibility

Existing publication flags are retained; an explicit publish request is subject to the new completion check. Existing incomplete flags are excluded from full public results by the existing completeness gates. Before production rollout, inventory these legacy records and withdraw their publication through a reviewed administrative API migration if they should require a fresh explicit release after completion. Preview is opt-in after verified enablement; old tokens remain secret and are not rotated. The deprecated field remains in the database for compatibility, but no longer grants access or controls token visibility. A preview becoming 100% complete still needs an explicit publish action.

## Implemented and validated

- Implemented the independent flags, fresh server-side completion guard, per-action verification, descriptive multilingual dialogs, selected-catalogue preview links, legacy retirement and structured Directus logging.
- Rebuilt both modified extensions and applied the YAML through `import-all.sh` on the local development stack. Directus remains pinned to 11.17.4. Production was not changed.
- `bin/test_dev.sh`: 24 integration steps passed, plus the maintained unit/CLI suites.
- Targeted real publishing and disclosure run: 13 steps passed after the catalogue-specific preview-link change, including real CMS browser controls, SSR/hydration/client navigation, token rotation and no-store/disclosure checks.
- Frontend, test-suite and all 15 extension type gates passed; frontend and extension lint passed. The score-hook SDK validation passed; its dependency audit reports zero vulnerabilities after the compatible serialize-javascript development-dependency patch.
- localhost:8080 municipality page and checked public API both returned HTTP 200. Actual local structured publication logs include non-system actor identity and all requested metadata without credential/research keys.
- Changes are isolated on `fix/municipality-publishing-preview`; the original working tree's unrelated rebase is preserved. Production rollout and verification are the remaining operational steps, not part of this local change.
