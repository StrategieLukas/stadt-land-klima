# Municipality ratings, publication and preview

Internal Directus 11.17.4 extension for score calculation, catalogue ranks and
publication state. Build with `npm ci` and `npm run build`, then restart Directus.
Import the matching schema/policy/flow YAML from the repository root.

Publication and preview changes require the acting account's `verified` flag.
Publication additionally checks actual approved assessments against every
published measure; submitted and cached completion percentages are not trusted.
A private preview uses the separate `preview_enabled` flag and the municipality
preview token. Tokens are generated using Node's cryptographic random bytes.
The deprecated creator-verification mirror and legacy token flow are inactive.

Successful state writes produce structured Directus logs with the event-context
actor, municipality, catalogue, completion percentage and both states. Logging
never includes tokens or research, and enrichment failures do not block status
and rank synchronization. Native Directus activity remains enabled.

See `PUBLISHING_PREVIEW_PLAN.md` and `FEATURES.md` for rollout and exact regression
coverage. Unit checks run in `bin/test_suite/src/municipalityPublishing.test.ts`;
real CMS/API/browser coverage is in `flows/municipalityPublishingFlow.ts` and
`flows/municipalityDisclosureFlow.ts`.
