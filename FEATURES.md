# Stadt-Land-Klima feature inventory

This is the canonical inventory of implemented application functionality. It covers the Nuxt frontend, server routes, Directus schema and permissions, Directus extensions and flows, integrations, and the end-to-end test suite. The inventory was reviewed on 2026-09-08.

The test column names the most specific automated flow and step where coverage exists. A status of “Not covered by a dedicated automated test” means that a page may be exercised incidentally while browsing another flow, but there is no targeted regression assertion for the functionality. Manual email checks are called out separately and are not treated as automated coverage.

## Test references

| Reference | Test suite |
| --- | --- |
| RAT | [ratingWahlcheckFlow.ts](bin/test_suite/src/flows/ratingWahlcheckFlow.ts) |
| REG | [registerLocalteamFlow.ts](bin/test_suite/src/flows/registerLocalteamFlow.ts) |
| USR | [addUserFlow.ts](bin/test_suite/src/flows/addUserFlow.ts) |
| EPI | [erfolgsprojekteArticlesFlow.ts](bin/test_suite/src/flows/erfolgsprojekteArticlesFlow.ts) |
| EPA | [erfolgsprojekteInviteDashboardFlow.ts](bin/test_suite/src/flows/erfolgsprojekteInviteDashboardFlow.ts) |
| MAN | Manual-only check described in the relevant [test description](bin/test_suite) |

## Important authorization and configuration findings

- Publishing is currently authorized by the authenticated Directus user’s directus_users.verified value in the score-publishing hook. A verified local-team member can publish even when the municipality’s creator_verified value is false.
- municipalities.creator_verified is still used for the unpublished municipality preview bypass. The users.update hook propagates the local-team administrator’s verified state to attached municipalities, while the legacy syncCreatorVerified flow is inactive. This field is therefore not the publication authority, but it is still relevant to preview behavior and should be removed only as part of an explicit preview-policy change.
- Directus preview links are built from FRONTEND_BASE_URL. The registration flow checks both the configured link metadata and that the resulting link uses the configured host.
- Registration repairs or retries the exact local-team member role and user-localteam junction, then verifies the result. This prevents an account from being created without a usable role.
- Automated coverage is concentrated around ratings, Wahlcheck, local-team registration, user invitations, and Erfolgsprojekte editorial permissions. Many public pages, visualizations, forms, newsletters, donations, jobs, and CMS interfaces still need dedicated regression coverage.

## Feature matrix

### Development workflow

| Area | Functionality | Main implementation | Test coverage |
| --- | --- | --- | --- |
| Development | Start the Docker development stack from any working directory with the current user and group IDs | bin/start_development.sh, docker-compose.dev.yaml | Manual-only: invoke the script from the repository root and bin directory when Docker is available; no dedicated automated test |

### Application shell, navigation, and shared behavior

| Area | Functionality | Main implementation | Test coverage |
| --- | --- | --- | --- |
| Shell | Global Nuxt layout, page metadata, responsive content container, locale-aware rendering | src/frontend/layouts/default.vue, src/frontend/app.vue, shared locale plugins | Not covered by a dedicated automated test |
| Shell | Desktop header with navigation, search, login, language, theme controls, and translucent backdrop blur | src/frontend/components/TheHeaderDesktop, src/frontend/assets/css/main.css | Manual-only: inspect the header while scrolling on localhost:8080; no dedicated automated test |
| Shell | Mobile header with drawer, compact navigation, and translucent backdrop blur | src/frontend/components/TheHeaderMobile, src/frontend/assets/css/main.css | Manual-only: inspect the header while scrolling on localhost:8080; no dedicated automated test |
| Shell | Desktop and mobile footer navigation and legal links | src/frontend/components/TheFooterDesktop, src/frontend/components/TheFooterMobile | Not covered by a dedicated automated test |
| Navigation | Directus-driven navigation configuration and translated labels | src/directus/schema/collections/navigation_config.yaml, src/frontend/components/TheNavigationMenuDesktop, src/frontend/shared/translatedNavigationLabel.js | Not covered by a dedicated automated test |
| Navigation | Desktop navigation strip and active route state | src/frontend/components/TheNavigationStripDesktop | Not covered by a dedicated automated test |
| Navigation | Mobile side drawer, menu sheet, and drawer state | src/frontend/components/TheDrawerSide, src/frontend/components/TheMenuSheet, src/frontend/composables/useDrawer.js | Not covered by a dedicated automated test |
| Navigation | Bottom dock navigation on supported mobile views | src/frontend/components/TheDock | Not covered by a dedicated automated test |
| Preferences | German, English, and Italian language selection and locale resolution | src/frontend/components/LanguageSelector, src/frontend/shared/resolveFullLocaleCode.js | Not covered by a dedicated automated test |
| Preferences | Light and dark theme switching and persisted theme state | src/frontend/components/ThemeToggle, src/frontend/composables/useTheme.ts, src/frontend/plugins/theme.client.ts | Not covered by a dedicated automated test |
| Account | Login button, authentication modal, current-user lookup, and logout/session behavior | src/frontend/components/LoginButton, src/frontend/components/AuthLoginModal, src/frontend/composables/useAuth.js, src/frontend/plugins/directus.client.js | Not covered by a dedicated automated test |
| Referrals | Referrer query state and referral persistence across navigation | src/frontend/composables/useReferrer.js, src/frontend/middleware/referrer.global.js | Not covered by a dedicated automated test |
| Search | Search command palette opens below the desktop header with header shadow, keyboard navigation, and result selection | src/frontend/components/TheSearchCommandPalette, src/frontend/components/TheHeaderDesktop, src/frontend/composables/useSearchPalette.js | Manual-only: inspect palette placement and header shadow on localhost:8080; no dedicated automated test |
| Search | Embedded-search bridge for host pages or integrations | src/frontend/composables/useEmbeddedSearchBridge.js | Not covered by a dedicated automated test |
| Navigation | Hash navigation to editable or content blocks after page load | src/frontend/composables/useBlockHashNavigation.js | Not covered by a dedicated automated test |
| Layout | Header-height and mobile-header visibility coordination | src/frontend/composables/useHeaderHeight.js, src/frontend/composables/useMobileHeaderHidden.js | Not covered by a dedicated automated test |
| Media | Responsive image loading, image transformations, and accessible image fallback | src/frontend/components/SmartImg | Not covered by a dedicated automated test |
| Accessibility | Shared labels, focusable controls, and responsive navigation semantics | src/frontend/components and src/frontend/layouts/default.vue | Not covered by a dedicated automated test |

### Public pages and content

| Area | Functionality | Main implementation | Test coverage |
| --- | --- | --- | --- |
| Home | Landing page with hero, featured content, calls to action, and block content | src/frontend/pages/index.vue, src/frontend/components/Blokkli | Not covered by a dedicated automated test |
| Pages | Generic Directus-managed page rendering by slug | src/frontend/pages/[slug].vue, src/frontend/components/ArticlePage | Not covered by a dedicated automated test |
| News | Published news listing, pagination or filters, and cards | src/frontend/pages/news/index.vue | Not covered by a dedicated automated test |
| News | Published news detail page with rich content and related links | src/frontend/pages/news/[slug].vue, src/frontend/components/ArticlePage | Not covered by a dedicated automated test |
| Events | Event listing and event cards | src/frontend/pages/events/index.vue, src/frontend/components/EventCard | Not covered by a dedicated automated test |
| Events | Event detail page with date, location, content, and registration links | src/frontend/pages/events/[slug].vue | Not covered by a dedicated automated test |
| Events | Downloadable iCalendar event endpoint | src/frontend/server/api/events/[slug].ics.get.ts, src/frontend/shared/eventDateTime.ts | Not covered by a dedicated automated test |
| Contact | Contact page and contact form entry point | src/frontend/pages/contact/index.vue | Not covered by a dedicated automated test |
| Organisation | Organisation information and team or contact content | src/frontend/pages/organisation/index.vue | Not covered by a dedicated automated test |
| Jobs | Job-offer listing and status presentation | src/frontend/pages/jobs/index.vue, src/frontend/components/JobOfferCard, src/frontend/components/JobOfferStatusPill | Not covered by a dedicated automated test |
| Jobs | Job-offer detail page, sections, and application links | src/frontend/pages/jobs/[slug].vue, src/frontend/components/JobDetailSection | Not covered by a dedicated automated test |
| Jobs | Automatic stable slug generation for job offers and other slugged records | src/directus/extensions/hook-job-offer-slug/src/index.ts | Not covered by a dedicated automated test |
| Measures | Climate-measure catalogue listing | src/frontend/pages/measures/index.vue, src/frontend/components/MeasureCard | Not covered by a dedicated automated test |
| Measures | Measure detail page with section navigation, descriptions, rating chart, history, image credits, and translated feedback link | src/frontend/pages/measures/[slug].vue, src/frontend/components/MeasureDescriptions, src/frontend/components/MeasureRatingChart, src/frontend/components/MeasureRatingSankey | Manual-only: inspect a measure in each available catalog on localhost:8080; no dedicated automated test |
| Measures | Sector index, sector detail, sector imagery, and sector navigation | src/frontend/pages/measures/sectors/index.vue, src/frontend/pages/measures/sectors/[sector].vue, src/frontend/shared/sectorImages.js | Not covered by a dedicated automated test |
| Municipalities | Municipality directory, catalog and view filters, and onboarding entry points | src/frontend/pages/municipalities/index.vue, src/frontend/components/TheRanking, src/frontend/components/TheMap | Partial: REG — “Register localteam: municipality search excludes higher-level regions”; filters and onboarding entry points have manual-only coverage |
| Municipalities | Public municipality detail page with score, measures, projects, and quick information | src/frontend/pages/municipalities/[slug].vue, src/frontend/components/DetailMunicipality, src/frontend/components/DetailMunicipalityQuickInfoDesktop | RAT — “Ratings: municipality detail page sector cards and PDF work on desktop and mobile” |
| Municipalities | Nearby municipality carousel and municipality comparisons | src/frontend/components/NearbyMunicipalitiesCarousel, src/frontend/shared/compareMunicipalities.js | Not covered by a dedicated automated test |
| Regions | Administrative-region detail page by ARS code | src/frontend/pages/regions/[ars].vue, src/frontend/components/AdministrativeAreaMap | Not covered by a dedicated automated test |
| Statistics | Measures meta-statistics dashboard at /stats | src/frontend/pages/stats/index.vue | Manual-only: inspect dashboard and filter behavior on localhost:8080; no dedicated automated test |
| Data | Administrative-area data pages replace the retired area statistics detail page | src/frontend/pages/data/[slug]/index.vue, src/frontend/pages/data/[slug]/[collection].vue | Manual-only: check a canonical data slug and an ARS link on localhost:8080; no dedicated automated test |
| Compatibility | Legacy /stats/[ars] links redirect to the matching /data area page | src/frontend/pages/stats/[ars].vue, src/frontend/server/api/area-by-slug.get.ts | Manual-only: check the redirect with curl on localhost:8080; no dedicated automated test |
| Map | Interactive municipality and region map | src/frontend/pages/map/index.vue, src/frontend/components/TheMap | Not covered by a dedicated automated test |
| Tools | Climate-tool directory and tool detail links | src/frontend/pages/tools/index.vue, src/directus/schema/collections/climate_tools.yaml | Not covered by a dedicated automated test |
| Feedback | Public feedback page and feedback submission entry point | src/frontend/pages/feedback/index.vue, src/frontend/server/api/submit-feedback.post.ts | Not covered by a dedicated automated test |
| Donations | Donation landing page and Betterplace donation widget | src/frontend/pages/spenden.vue, src/frontend/components/BetterplaceDonationWidget, src/frontend/shared/donation.ts | Not covered by a dedicated automated test |
| Donations | Donation-instead-of-gifts page | src/frontend/pages/spenden-statt-schenken.vue | Not covered by a dedicated automated test |
| Projects | Published Erfolgsprojekte listing | src/frontend/pages/projects/index.vue, src/frontend/components/ProjectCard | EPI — “Erfolgsprojekte: projects overview shows published articles and excludes drafts” |
| Projects | Project detail page with article content and savings information | src/frontend/pages/projects/[slug].vue | EPI — “Erfolgsprojekte: article detail page renders the full published article on desktop and mobile” |
| Projects | Project listing filter and savings sort | src/frontend/pages/projects/index.vue, src/frontend/shared/articleSubmission.ts | EPI — “Erfolgsprojekte: projects overview filters and savings sort work” |
| Projects | Public project/article submission form | src/frontend/pages/projects/submit.vue, src/frontend/server/api/submit-article.post.ts | Not covered by a dedicated automated test |

### Search, data, ratings, and visualizations

| Area | Functionality | Main implementation | Test coverage |
| --- | --- | --- | --- |
| Search | Full-text content search against the site index | src/frontend/composables/useContentSearch.js, src/frontend/server/api/content-search.get.ts | Not covered by a dedicated automated test |
| Search | Meilisearch index synchronization on content changes and committed blocks | src/directus/extensions/hook-search-index/src/index.ts | Not covered by a dedicated automated test |
| Search | Municipality and administrative-area lookup | src/frontend/composables/useAreaSearch.js, src/frontend/composables/useAdministrativeAreaSearch.js, src/frontend/server/api/area-search.get.ts | REG — “Register localteam: municipality search excludes higher-level regions” |
| Search | Municipality search result presentation, current-catalog status, and older-rating update action | src/frontend/components/AreaSearchResult, src/frontend/composables/useAreaSearch.js | Partial: REG — “Register localteam: municipality search excludes higher-level regions”; status chips have manual-only coverage |
| Maps | Administrative-area map and selection | src/frontend/components/AdministrativeAreaMap | Not covered by a dedicated automated test |
| Maps | Germany map indicator and aggregate status display | src/frontend/components/GermanyMapIndicator | Not covered by a dedicated automated test |
| Rankings | Municipality ranking and ranked item lists | src/frontend/components/TheRanking, src/frontend/components/ItemRanking | Not covered by a dedicated automated test |
| Rankings | Municipality tree map and area-level comparisons | src/frontend/components/MunicipalityTreeMap | Not covered by a dedicated automated test |
| Charts | Data histogram and legacy histogram rendering | src/frontend/components/DataHistogram, src/frontend/components/DataHistogramLegacy | Not covered by a dedicated automated test |
| Charts | Data-product map and data-product wrapper | src/frontend/components/DataProductMap, src/frontend/components/DataProductViewWrapper | Not covered by a dedicated automated test |
| Charts | Measures treemap | src/frontend/components/MeasuresTreemap | Not covered by a dedicated automated test |
| Charts | Municipality polar chart | src/frontend/components/MunicipalityPolarChart | Not covered by a dedicated automated test |
| Charts | Measure-rating Sankey diagram | src/frontend/components/MeasureRatingSankey | Not covered by a dedicated automated test |
| Charts | Feasibility bar chart and client-only rendering | src/frontend/components/FeasibilityBarChart.client | Not covered by a dedicated automated test |
| Progress | Threshold progress bar and implementation traffic light | src/frontend/components/ThresholdProgressBar, src/frontend/components/ImplementationTrafficLight | RAT — “Ratings: municipality detail page sector cards and PDF work on desktop and mobile” |
| Scores | Shared municipality score, rank, rating, and current-catalog fetches | src/frontend/shared/directus-calls/municipality-scores.js, src/frontend/shared/directus-calls/ratings-measures.js, src/frontend/shared/directus-calls/measures.js | RAT — rating fixtures and publication flow |
| Scores | Catalog-version lookup and all available catalog versions | src/frontend/composables/getCatalogVersion.js, src/frontend/composables/getAllCatalogVersions.js | RAT — “Ratings: fill current catalog ratings including not-applicable measures” |
| Scores | Rating icons, answer options, and score labels | src/frontend/shared/ratingIcons.js, src/frontend/shared/wahlcheckAnswerOptions.js | RAT — “Ratings: fill current catalog ratings including not-applicable measures” |
| Compare | Municipality comparison data and derived display values | src/frontend/shared/compareMunicipalities.js | Not covered by a dedicated automated test |
| Data | Climate regions and municipality score aggregation | src/directus/extensions/hook-calc-score-and-ranks/src/index.ts, src/directus/extensions/hook-calc-score-and-ranks/src/calculateScores.ts | RAT — “Ratings: municipality detail page sector cards and PDF work on desktop and mobile” |

### Local-team registration, accounts, and permissions

| Area | Functionality | Main implementation | Test coverage |
| --- | --- | --- | --- |
| Registration | Local-team registration page and municipality selection | src/frontend/pages/register_localteam.vue | REG — “Register localteam: frontend page creates a new localteam request” |
| Registration | Exclude higher-level regions from municipality choices | src/frontend/server/api/area-search.get.ts, src/frontend/pages/register_localteam.vue | REG — “Register localteam: municipality search excludes higher-level regions” |
| Registration | Create local-team request and initial municipality | src/frontend/server/api/register-municipality.post.ts, src/directus/flows/createMunicipality.yaml | REG — “Register localteam: frontend page creates a new localteam request” |
| Registration | Existing local-team contact path instead of duplicate registration | src/frontend/pages/register_localteam.vue | REG — “Register localteam: frontend page offers contact flow for an existing localteam” |
| Registration | New account receives the local-team member role | src/frontend/server/api/register-municipality.post.ts, src/frontend/server/utils/directusRoles.ts | REG — registration verifies the exact assigned role |
| Registration | New account is linked to the created local team | src/frontend/server/api/register-municipality.post.ts, src/directus/schema/collections/junction_directus_users_localteams.yaml | REG — registration verifies the user-localteam junction |
| Registration | Role and junction repair after partial Directus failure | src/frontend/server/api/register-municipality.post.ts | REG — exact role assignment and registration completion assertions |
| Registration | Registration cleanup after unrecoverable failure | src/frontend/server/api/register-municipality.post.ts | Not covered by a dedicated automated test |
| Registration | Welcome mail for a newly created local team | src/directus/flows/sendWelcomeNewLocalteam.yaml, src/directus/templates/email-template-welcome-new-localteam.liquid | MAN — welcome email is described as a manual check |
| Registration | Notify administrators about a new local-team request | src/directus/flows/notifyAdminNewLocalteam.yaml | Not covered by a dedicated automated test |
| Registration | Configured frontend URL in Directus municipality preview link | src/directus/schema/collections/municipalities.yaml, src/directus/schema/fields/municipalities/links-g1sxxi.yaml | REG — “Register localteam: Directus preview uses the configured frontend URL” |
| Registration | Preview token generation for unverified municipalities | src/directus/flows/setMunicipalityPreviewToken.yaml | RAT — “Ratings: preview is token-protected and not part of the public ranking” |
| Registration | Stale registration slug cannot impersonate another local team | src/frontend/pages/register_localteam.vue | REG — “Register localteam: stale slug cannot impersonate an existing team” |
| Account | Directus login and current-user data for frontend users | src/frontend/plugins/directus.client.js, src/frontend/composables/useAuth.js | Not covered by a dedicated automated test |
| Account | Consent status, acceptance, newsletter opt-in, opt-out, and other consent actions | src/directus/extensions/consent-management/src | Not covered by a dedicated automated test |
| Account | Consent hook enforcement for user operations | src/directus/extensions/consent-management/src | Not covered by a dedicated automated test |
| Teams | Local-team member list and organization-member API | src/frontend/server/api/org-members.get.ts, src/directus/schema/collections/junction_directus_users_localteams.yaml | USR — “Add user: backend app shows only the permitted localteam” |
| Teams | Local-team admin/member role separation | src/directus/roles/LokalteamAdmin.yaml, src/directus/roles/LokalteamMitglied.yaml, src/directus/policies/Lokalteam-Mitglied.yaml | USR — “Add user: member cannot invite users to another localteam” |
| Teams | Editor creation and local-team assignment | src/directus/flows/createEditorUser.yaml, src/directus/extensions/editor-manager/src | USR — “Add user: creating an editor triggers invited user creation and localteam assignment” |
| Teams | Editor record visibility in Directus | src/directus/schema/collections/editors.yaml, src/directus/extensions/editor-manager/src | USR — “Add user: editor record is visible in the Directus app” |
| Teams | Delete editor and associated invited user | src/directus/flows/deleteEditorUser.yaml, src/directus/extensions/editor-manager/src | Not covered by a dedicated automated test |
| Teams | Local-team user invitation email | src/directus/templates/email-template-invite.liquid, src/directus/policies/Lokalteam-Einladung-Mitglieder.yaml | MAN — invite email is described as a manual check |
| Authorization | Minimum app-access role and authenticated frontend policy | src/directus/roles/MinimalUser.yaml, src/directus/policies/App-Zugriff-Minimum.yaml, src/directus/policies/Frontend.yaml | Not covered by a dedicated automated test |
| Authorization | Automatic assignment of a usable role to newly registered accounts | src/frontend/server/api/register-municipality.post.ts, src/frontend/server/utils/directusRoles.ts | REG — registration role exact-match assertion |

### Municipality ratings and publishing

| Area | Functionality | Main implementation | Test coverage |
| --- | --- | --- | --- |
| Ratings | Current measure catalog and rating-question retrieval | src/frontend/shared/directus-calls/ratings-measures.js, src/directus/schema/collections/measure_catalog.yaml, src/directus/schema/collections/measure_questions_template.yaml | RAT — “Ratings: fill current catalog ratings including not-applicable measures” |
| Ratings | Enter answers for applicable and not-applicable measures | src/directus/schema/collections/rating.yaml, src/directus/schema/collections/ratings_measures.yaml | RAT — “Ratings: fill current catalog ratings including not-applicable measures” |
| Ratings | Started rating is displayed as in progress | src/frontend/pages/municipalities/[slug].vue | REG — “Register localteam: started current rating is shown as in progress” |
| Ratings | Published rating is displayed as complete independently of percentage | src/frontend/pages/municipalities/[slug].vue | REG — “Register localteam: published current rating is complete regardless of percentage” |
| Ratings | Automatic score calculation from ratings and measures | src/directus/extensions/hook-calc-score-and-ranks/src/calculateScores.ts | RAT — rating fixture and score assertions |
| Ratings | Municipality score creation, update, and rank recalculation | src/directus/extensions/hook-calc-score-and-ranks/src/index.ts | RAT — “Ratings: fill current catalog ratings including not-applicable measures” |
| Ratings | Public municipality remains hidden before score publication | src/frontend/pages/municipalities/[slug].vue, src/directus/schema/collections/municipality_scores.yaml | RAT — “Ratings: municipality is hidden before scores are published” |
| Ratings | Unpublished municipality preview by valid preview token | src/frontend/pages/municipalities/[slug].vue, src/directus/flows/setMunicipalityPreviewToken.yaml | RAT — “Ratings: preview is token-protected and not part of the public ranking” |
| Ratings | Invalid or absent preview token is rejected | src/frontend/pages/municipalities/[slug].vue | RAT — “Ratings: preview is token-protected and not part of the public ranking” |
| Ratings | Unpublished preview is excluded from public ranking | src/frontend/pages/municipalities/[slug].vue, src/frontend/components/TheRanking | RAT — “Ratings: preview is token-protected and not part of the public ranking” |
| Ratings | creator_verified local-team preview bypass | src/frontend/pages/municipalities/[slug].vue, src/directus/extensions/hook-calc-score-and-ranks/src/index.ts | RAT — “Ratings: municipality preview follows the localteam admin verification” |
| Ratings | Propagate administrator verification to attached municipalities | src/directus/extensions/hook-calc-score-and-ranks/src/index.ts users.update hook | RAT — “Ratings: municipality preview follows the localteam admin verification” |
| Ratings | Legacy creator verification flow is inactive | src/directus/flows/syncCreatorVerified.yaml | RAT — hook-driven verification propagation assertions |
| Publishing | Directus score publish checkbox and unpublish action | src/directus/extensions/hook-calc-score-and-ranks/src/index.ts, src/directus/extensions/custom-slk-interfaces/src/municipality-scores-publisher | RAT — “Ratings: verified localteam member can publish and unpublish via Directus checkbox” |
| Publishing | Block unverified local-team member from publishing | src/directus/extensions/hook-calc-score-and-ranks/src/index.ts | RAT — “Ratings: unverified localteam member cannot publish via Directus checkbox” |
| Publishing | Allow verified member to publish even when municipality creator_verified is false | src/directus/extensions/hook-calc-score-and-ranks/src/index.ts | RAT — “Ratings: verified localteam member can publish and unpublish via Directus checkbox” |
| Publishing | Admin or permitted system actor publishing path | src/directus/extensions/hook-calc-score-and-ranks/src/index.ts, src/directus/policies/Lokalteam-Bewertung.yaml | Not covered by a dedicated automated test |
| Ratings | Municipality sector cards, rating summary, and score indicators | src/frontend/components/DetailMunicipalitySectorCards, src/frontend/components/MunicipalityStats | RAT — “Ratings: municipality detail page sector cards and PDF work on desktop and mobile” |
| Ratings | Municipality rating PDF generation and download | src/frontend/pages/municipalities/[slug].vue, src/directus/extensions/endpoint-pdf-service | RAT — “Ratings: municipality detail page sector cards and PDF work on desktop and mobile” |
| Ratings | Municipality rating publication data exposed to the frontend | src/frontend/shared/directus-calls/municipality-scores.js | RAT — publication and detail-page assertions |
| Ratings | Weekly measure-rating report generation | src/directus/extensions/hook-measure-rating-reports/src | Not covered by a dedicated automated test |

### Wahlcheck and elections

| Area | Functionality | Main implementation | Test coverage |
| --- | --- | --- | --- |
| Wahlcheck | Measure-question template collection and expected template records | src/directus/schema/collections/measure_questions_template.yaml | RAT — “Wahlcheck: template collection is visible and has the expected amount of entries” |
| Wahlcheck | Create an election and connect municipality or election metadata | src/directus/schema/collections/election.yaml, src/directus/schema/collections/elections.yaml | RAT — “Wahlcheck: create election and generate ten theses from Directus action UI” |
| Wahlcheck | Generate theses from the approved question template | src/directus/extensions/election-check/src/generate-questions | RAT — “Wahlcheck: create election and generate ten theses from Directus action UI” |
| Wahlcheck | Add a custom thesis to an election | src/directus/schema/collections/questions.yaml | RAT — “Wahlcheck: add an extra thesis and verify question visibility” |
| Wahlcheck | Public and candidate question visibility rules | src/frontend/pages/elections/[slug].vue, src/frontend/pages/elections/wahlcheck/[municipalitySlug].vue | RAT — “Wahlcheck: add an extra thesis and verify question visibility” |
| Wahlcheck | Create candidates with a required salutation and associated party data; retain unset salutations on existing candidates during schema import | src/directus/schema/fields/candidate/salutation.yaml, src/directus/schema/collections/candidate.yaml, src/frontend/shared/candidateParties.js | Partial automated coverage — RAT “Wahlcheck: create candidates and verify the empty answers collection” checks new candidate validation; existing-row schema import is manual-only |
| Wahlcheck | Candidate answer collection starts empty | src/directus/schema/collections/answers.yaml | RAT — “Wahlcheck: create candidates and verify the empty answers collection” |
| Wahlcheck | Local-team members can read and filter candidate answer values for exports | src/directus/policies/Lokalteam-Wahlcheck.yaml | RAT — “Wahlcheck: localteam member can filter candidate answers” |
| Wahlcheck | Request thesis review from the election workflow | src/directus/extensions/election-check/src | RAT — “Wahlcheck: request thesis review and approve with WahlcheckAdmin” |
| Wahlcheck | Approve reviewed theses with WahlcheckAdmin | src/directus/roles/WahlcheckAdmin.yaml, src/directus/policies/WahlcheckAdmin.yaml | RAT — “Wahlcheck: request thesis review and approve with WahlcheckAdmin” |
| Wahlcheck | Send candidate invitation emails from Directus action UI | src/directus/extensions/election-check/src/send-candidate-mails | RAT — “Wahlcheck: send candidate emails from Directus action UI and generate stable tokens” |
| Wahlcheck | Generate stable candidate answer tokens | src/directus/extensions/election-check/src | RAT — “Wahlcheck: send candidate emails from Directus action UI and generate stable tokens” |
| Wahlcheck | Candidate access-token thesis page | src/frontend/pages/elections/thesen/[access_token].vue, src/frontend/components/Elections/WahlCheckQuestions.vue | RAT — “Wahlcheck: candidates answer all theses through their public links” |
| Wahlcheck | Candidate submits answers before reminder | src/frontend/server/api/submit-form-response.post.ts, src/frontend/pages/elections/thesen/[access_token].vue | RAT — “Wahlcheck: one candidate submits answers before reminders” |
| Wahlcheck | Candidate answer validation and completion state | src/frontend/pages/elections/thesen/[access_token].vue, src/directus/schema/collections/answers.yaml | RAT — “Wahlcheck: candidates answer all theses through their public links” |
| Wahlcheck | One-time candidate reminders after invitation only | src/directus/extensions/election-check/src | RAT — “Wahlcheck: send one-time reminders only after candidate invitations” |
| Wahlcheck | Thank-you email after a completed candidate questionnaire | src/directus/extensions/election-check/src | RAT — “Wahlcheck: send one-time thank-you emails to candidates who answered” |
| Wahlcheck | Public election discovery and public wizard | src/frontend/pages/elections/wahlcheck/index.vue, src/frontend/pages/elections/wahlcheck/[municipalitySlug].vue | RAT — “Wahlcheck: public election appears and public wizard produces ranked results” |
| Wahlcheck | Public question answering and candidate ranking | src/frontend/components/Elections/WahlCheckQuestions.vue, src/frontend/components/Elections/WahlCheckResults.vue | RAT — “Wahlcheck: public election appears and public wizard produces ranked results” |
| Wahlcheck | Summary and result explanation | src/frontend/components/Elections/WahlCheckSummary.vue | RAT — “Wahlcheck: public election appears and public wizard produces ranked results” |
| Wahlcheck | Shareable Wahlcheck results | src/frontend/components/Elections/WahlCheckShare.vue | Not covered by a dedicated automated test |
| Wahlcheck | Election information and question background content | src/frontend/components/ElectionInfo, src/frontend/components/Elections/QuestionBackgroundInfo | Not covered by a dedicated automated test |
| Wahlcheck | One browser session can count two distinct completions | src/frontend/pages/elections/wahlcheck/[municipalitySlug].vue | RAT — “Wahlcheck: count two distinct completions in one browser session” |
| Wahlcheck | Completion and thank-you tracking state | src/directus/extensions/election-check/src | RAT — “Wahlcheck: count two distinct completions in one browser session” |
| Wahlcheck | Election action routes for generation, review, sending, reminder, thank-you, test mail, and completion | src/directus/extensions/election-check/src/endpoint | RAT — action UI, invitation, reminder, thank-you, and completion steps |
| Wahlcheck | Candidate and election PDF or guide generation where configured | src/directus/extensions/endpoint-pdf-service/src, src/directus/extensions/endpoint-pdf-service/typst | Not covered by a dedicated automated test |
| Wahlcheck | Candidate-facing email delivery and content | src/directus/extensions/election-check/src, Directus email templates | MAN — email delivery is described as a manual check |
| Wahlcheck | Election admin roles and collection permissions | src/directus/roles/WahlcheckAdmin.yaml, src/directus/policies/WahlcheckAdmin.yaml, src/directus/policies/Lokalteam-Wahlcheck.yaml | RAT — admin action UI and restricted workflow assertions |

### Erfolgsprojekte editorial workflow

| Area | Functionality | Main implementation | Test coverage |
| --- | --- | --- | --- |
| Erfolgsprojekte | Published project/article overview | src/frontend/pages/projects/index.vue | EPI — “Erfolgsprojekte: projects overview shows published articles and excludes drafts” |
| Erfolgsprojekte | Published article detail rendering on desktop and mobile | src/frontend/pages/projects/[slug].vue, src/frontend/components/ArticlePage | EPI — “Erfolgsprojekte: article detail page renders the full published article on desktop and mobile” |
| Erfolgsprojekte | Draft exclusion from the public overview | src/frontend/pages/projects/index.vue, src/directus/schema/collections/articles.yaml | EPI — “Erfolgsprojekte: projects overview shows published articles and excludes drafts” |
| Erfolgsprojekte | Filter by project attributes | src/frontend/pages/projects/index.vue | EPI — “Erfolgsprojekte: projects overview filters and savings sort work” |
| Erfolgsprojekte | Sort by savings or impact value | src/frontend/pages/projects/index.vue | EPI — “Erfolgsprojekte: projects overview filters and savings sort work” |
| Erfolgsprojekte | Contributor article creation and editing | src/directus/roles/ErfolgsprojekteRedaktion.yaml, src/directus/policies/Erfolgsprojekte-Contributor.yaml | EPI — “Erfolgsprojekte: editorial role edits and publishes contributor content” |
| Erfolgsprojekte | Editorial article create, edit, delete, and publish | src/directus/roles/ErfolgsprojekteRedaktion.yaml, src/directus/policies/Erfolgsprojekte-Redaktion.yaml | EPI — “Erfolgsprojekte: editorial role creates, edits, deletes, and publishes articles” |
| Erfolgsprojekte | Restricted editorial collection visibility | src/directus/schema/collections/articles.yaml, src/directus/policies/Erfolgsprojekte-Redaktion.yaml | EPI — “Erfolgsprojekte: editorial collection is visible in the Directus app” |
| Erfolgsprojekte | Editorial user creation and shared fixtures | bin/test_suite/src/flows/erfolgsprojekteArticlesFlow.ts | EPI — “Erfolgsprojekte: create editorial user and shared article fixtures” |
| Erfolgsprojekte | Editorial invitation dashboard visibility for planning team | src/directus/dashboards/Erfolgsprojekte-Redaktion.yaml, src/directus/extensions/erfolgsprojekte-user-manager | EPA — “Erfolgsprojekte dashboard: only planning team sees the invitation dashboard” |
| Erfolgsprojekte | Reject unauthorized invitation-dashboard access | src/directus/extensions/erfolgsprojekte-user-manager, src/directus/policies/Erfolgsprojekte-Redaktion.yaml | EPA — “Erfolgsprojekte dashboard: unauthorized users cannot invite editors” |
| Erfolgsprojekte | Invite an Erfolgsprojekte editorial user | src/directus/extensions/erfolgsprojekte-user-manager, src/directus/policies/Erfolgsprojekte-Redaktion.yaml | EPA — “Erfolgsprojekte dashboard: planning team invites an editorial user” |
| Erfolgsprojekte | Editorial invitation email | src/directus/templates/email-template-erfolgsprojekte-invite.liquid | MAN — invite email is described as a manual check |

### Blokkli editing and block content

| Area | Functionality | Main implementation | Test coverage |
| --- | --- | --- | --- |
| Blocks | Directus-managed block tree and editable page content | src/frontend/components/Blokkli, src/frontend/app/blokkli.editAdapter.ts | Not covered by a dedicated automated test |
| Blocks | Button block | src/frontend/components/Blokkli/Button | Not covered by a dedicated automated test |
| Blocks | Carousel and projects carousel blocks | src/frontend/components/Blokkli/Carousel, src/frontend/components/Blokkli/ProjectsCarousel | Not covered by a dedicated automated test |
| Blocks | Citation block | src/frontend/components/Blokkli/Citation | Not covered by a dedicated automated test |
| Blocks | Container and page navigation blocks | src/frontend/components/Blokkli/Container, src/frontend/components/Blokkli/PageNav | Not covered by a dedicated automated test |
| Blocks | Directus page block | src/frontend/components/Blokkli/DirectusPage | Not covered by a dedicated automated test |
| Blocks | Donation widget block | src/frontend/components/Blokkli/DonationWidget | Not covered by a dedicated automated test |
| Blocks | Form, field, and label blocks | src/frontend/components/Blokkli/Form, src/frontend/components/Blokkli/FormField, src/frontend/components/Blokkli/FormLabel | Not covered by a dedicated automated test |
| Blocks | Heading, text, rich-text, and image blocks; heading markup renders during SSR and hydration | src/frontend/components/Blokkli/Heading, src/frontend/components/Blokkli/Text, src/frontend/components/Blokkli/RichText, src/frontend/components/Blokkli/Image | Partial targeted automated coverage: bin/test_suite/src/blokkliPersistence.test.ts — heading SSR and published-page reload; other blocks have no dedicated automated test |
| Blocks | Hero, municipality-search-hero, and honeycomb blocks | src/frontend/components/Blokkli/Hero, src/frontend/components/Blokkli/MunicipalitySearchHero, src/frontend/components/Blokkli/HexHoneyweb, src/frontend/components/Blokkli/HexItem | Not covered by a dedicated automated test |
| Blocks | Icon, progress bar, stat, timeline, video, and chart blocks | src/frontend/components/Blokkli/Icon, src/frontend/components/Blokkli/ProgressBar, src/frontend/components/Blokkli/Stat, src/frontend/components/Blokkli/Timeline, src/frontend/components/Blokkli/Video, src/frontend/components/Blokkli/VegaChart | Not covered by a dedicated automated test |
| Blocks | Blokkli edit adapter state mapping, nested fields, and block creation | src/frontend/app/blokkli.editAdapter.ts | Partial targeted automated coverage: bin/test_suite/src/blokkliPersistence.test.ts — heading edits; nested fields and block creation have no dedicated automated test |
| Blocks | Authenticated browser preview restores drafts and polls changes from other tabs while normal pages retain SSR | src/frontend/components/BlokkliPageProvider.vue, src/frontend/app/blokkli.editAdapter.ts, src/frontend/pages/index.vue, src/frontend/pages/[slug].vue, src/frontend/pages/news/[slug].vue | Partial targeted automated coverage: bin/test_suite/src/blokkliPersistence.test.ts — page preview loading and updates; home/news integration has no dedicated automated test |
| Blocks | Persist edit state and publish blocks atomically with conflict handling; report failed draft saves and retain drafts after failed publication | src/frontend/app/blokkli.editAdapter.ts, src/frontend/shared/blokkliPersistence.ts, src/directus/extensions/blokkli-persistence/src/index.ts, src/directus/translations/*/blokkli.editor.autosave_error.*.yaml | Partial targeted automated coverage: bin/test_suite/src/blokkliPersistence.test.ts — preview, autosave failure feedback, failed publish, server draft recovery, publish and reload; transaction rollback and concurrent revision conflicts have no dedicated automated test |
| Blocks | Rich-text toolbar and paste behavior | src/frontend/plugins/blokkli-rich-text-toolbar.client.ts, src/frontend/plugins/blokkli-paste-fix.client.js | Not covered by a dedicated automated test |
| Blocks | Block colors, links, and shared editor utilities | src/frontend/utils/blokkliColors.ts, src/frontend/utils/blokkliLinks.ts | Not covered by a dedicated automated test |

### Directus collections and content model

| Collection or model | Functionality represented | Source of truth | Test coverage |
| --- | --- | --- | --- |
| pages | Generic published pages and block content | src/directus/schema/collections/pages.yaml | Not covered by a dedicated automated test |
| articles | Articles and Erfolgsprojekte editorial records | src/directus/schema/collections/articles.yaml | EPI — editorial CRUD and public article assertions |
| articles_articles | Article-to-article relations | src/directus/schema/collections/articles_articles.yaml | Not covered by a dedicated automated test |
| articles_external_projects | Article-to-external-project relations | src/directus/schema/collections/articles_external_projects.yaml | Not covered by a dedicated automated test |
| articles_measures | Article-to-measure relations | src/directus/schema/collections/articles_measures.yaml | Not covered by a dedicated automated test |
| news_items | News content and publication state | src/directus/schema/collections/news_items.yaml | Not covered by a dedicated automated test |
| events | Event content and event metadata | src/directus/schema/collections/events.yaml | Not covered by a dedicated automated test |
| job_offers | Job content, status, and slug | src/directus/schema/collections/job_offers.yaml | Not covered by a dedicated automated test |
| external_projects | External project references | src/directus/schema/collections/external_projects.yaml | Not covered by a dedicated automated test |
| success_projects | Erfolgsprojekte records and related editorial data | src/directus/schema/collections/success_projects.yaml | EPI — public and editorial Erfolgsprojekte flows |
| library_items | Reusable media or library content | src/directus/schema/collections/library_items.yaml | Not covered by a dedicated automated test |
| blocks and blokkli | Block persistence and edit-state records | src/directus/schema/collections/blocks.yaml, src/directus/schema/collections/blokkli.yaml, src/directus/schema/collections/edit_states.yaml | Not covered by a dedicated automated test |
| navigation_config | Header, footer, and navigation configuration | src/directus/schema/collections/navigation_config.yaml | Not covered by a dedicated automated test |
| Legal | Legal and policy content | src/directus/schema/collections/Legal.yaml | Not covered by a dedicated automated test |
| organisations and organisation_teams | Organisation and team content | src/directus/schema/collections/organisations.yaml, src/directus/schema/collections/organisation_teams.yaml | Not covered by a dedicated automated test |
| climate_tools | Climate tool directory data | src/directus/schema/collections/climate_tools.yaml | Not covered by a dedicated automated test |
| municipalities | Municipality identity, publication, preview, and local-team linkage | src/directus/schema/collections/municipalities.yaml | RAT and REG — preview, publication, registration, and municipality assertions |
| municipality_scores | Computed scores, ranks, publication state, and score metadata | src/directus/schema/collections/municipality_scores.yaml | RAT — score calculation and publish flow |
| measure_catalog | Versioned measure catalogue | src/directus/schema/collections/measure_catalog.yaml | RAT — current catalog rating flow |
| measures | Climate measures and measure metadata | src/directus/schema/collections/measures.yaml | RAT — measure fixtures and municipality detail |
| measure_questions_template | Wahlcheck question templates | src/directus/schema/collections/measure_questions_template.yaml | RAT — template visibility and count |
| ratings and ratings_measures | Municipality rating answers and measure junctions | src/directus/schema/collections/rating.yaml, src/directus/schema/collections/ratings_measures.yaml | RAT — answer creation and score flow |
| feedback | Public feedback records | src/directus/schema/collections/feedback.yaml | Not covered by a dedicated automated test |
| form_responses | Public and candidate form submissions | src/directus/schema/collections/form_responses.yaml | Not covered by a dedicated automated test |
| elections and election | Elections, election metadata, and state | src/directus/schema/collections/elections.yaml, src/directus/schema/collections/election.yaml | RAT — election creation and public workflow |
| questions | Election theses and review state | src/directus/schema/collections/questions.yaml | RAT — generation, custom thesis, review, and public visibility |
| candidate | Wahlcheck candidates, parties, tokens, and invitation state | src/directus/schema/collections/candidate.yaml | RAT — candidate and invitation workflow |
| answers | Candidate answers and completion state | src/directus/schema/collections/answers.yaml | RAT — empty collection, submission, and completion |
| localteams | Local-team identity, admin, municipality, and status | src/directus/schema/collections/localteams.yaml | REG and USR — registration and member-management flows |
| editors | Local-team editor assignments | src/directus/schema/collections/editors.yaml | USR — editor creation and visibility |
| team and junction_directus_users_localteams | User-team membership and role scope | src/directus/schema/collections/team.yaml, src/directus/schema/collections/junction_directus_users_localteams.yaml | REG and USR — role and team-junction assertions |
| admin_tools | Admin-only configuration or operational records | src/directus/schema/collections/admin_tools.yaml | Not covered by a dedicated automated test |
| agreement_versions and user_consent | Consent text versions and user consent state | src/directus/schema/collections/agreement_versions.yaml, src/directus/schema/collections/user_consent.yaml | Not covered by a dedicated automated test |

### Directus interfaces, dashboards, roles, and permissions

| Area | Functionality | Main implementation | Test coverage |
| --- | --- | --- | --- |
| CMS | Frontend role read access for client-side Directus requests | src/directus/roles/Frontend.yaml | RAT, REG, EPI — exercised through frontend and test API requests |
| CMS | Public role read access for server-side or unauthenticated requests | src/directus/roles/public.yaml, src/directus/policies/Public.yaml | Not covered by a dedicated automated test |
| CMS | Minimum authenticated app access | src/directus/roles/MinimalUser.yaml, src/directus/policies/App-Zugriff-Minimum.yaml | Not covered by a dedicated automated test |
| CMS | Blokkli editor role and policy | src/directus/roles/BlokkliEditor.yaml, src/directus/policies/Blokkli-Editor.yaml | Not covered by a dedicated automated test |
| CMS | Local-team admin role and policy | src/directus/roles/LokalteamAdmin.yaml | REG and USR — registration and team permissions |
| CMS | Local-team member role and policy | src/directus/roles/LokalteamMitglied.yaml, src/directus/policies/Lokalteam-Mitglied.yaml | USR — permitted local-team and invitation boundary |
| CMS | Local-team rating permissions | src/directus/policies/Lokalteam-Bewertung.yaml | RAT — rating and publication flow |
| CMS | Local-team Wahlcheck permissions | src/directus/policies/Lokalteam-Wahlcheck.yaml | RAT — Wahlcheck admin workflow |
| CMS | Measures-team role and policy | src/directus/roles/Massnahmenteam.yaml, src/directus/policies/Massnahmen-Team.yaml | Not covered by a dedicated automated test |
| CMS | Planning-team role and policy | src/directus/roles/Planungsteam.yaml | EPA — planning-team dashboard visibility and invitation |
| CMS | Recruiter role and policy | src/directus/roles/Recruiter.yaml, src/directus/policies/Recruiter.yaml | Not covered by a dedicated automated test |
| CMS | WahlcheckAdmin role and policy | src/directus/roles/WahlcheckAdmin.yaml, src/directus/policies/WahlcheckAdmin.yaml | RAT — review and action UI |
| CMS | Erfolgsprojekte editorial and contributor policies | src/directus/roles/ErfolgsprojekteRedaktion.yaml, src/directus/policies/Erfolgsprojekte-Redaktion.yaml, src/directus/policies/Erfolgsprojekte-Contributor.yaml | EPI and EPA — editorial CRUD and dashboard permissions |
| CMS | Feedback manager permission | src/directus/policies/Feedback-Manager.yaml | Not covered by a dedicated automated test |
| CMS | Read-everything operational policy | src/directus/policies/Read-Everything.yaml | Not covered by a dedicated automated test |
| CMS | API-Erfolgsprojekte restricted API access | src/directus/policies/API-Erfolgsprojekte.yaml, src/directus/roles/LocalZeroAPI.yaml | Not covered by a dedicated automated test |
| CMS | Stadt-Land-Zahl API access | src/directus/policies/API-StadtLandZahl.yaml, src/directus/roles/StadtLandZahlAPI.yaml | Not covered by a dedicated automated test |
| CMS | Dashboard for general content administration | src/directus/dashboards/Allgemein.yaml | Not covered by a dedicated automated test |
| CMS | Erfolgsprojekte editorial dashboard | src/directus/dashboards/Erfolgsprojekte-Redaktion.yaml | EPI and EPA — collection and invitation-dashboard assertions |
| CMS | Local-team support dashboard and community activity panel | src/directus/dashboards/Lokalteam-Betreuung.yaml, src/directus/extensions/community-activity | Not covered by a dedicated automated test |
| CMS | Measures administration dashboard | src/directus/dashboards/Massnahmen.yaml | Not covered by a dedicated automated test |
| Interface | Automatic slug interface | src/directus/extensions/custom-slk-interfaces/src/auto-slug | Not covered by a dedicated automated test |
| Interface | Footer navigation editor | src/directus/extensions/custom-slk-interfaces/src/footer-nav-editor | Not covered by a dedicated automated test |
| Interface | Icon radio selector | src/directus/extensions/custom-slk-interfaces/src/images-as-radio-buttons | Not covered by a dedicated automated test |
| Interface | Measure preview interface | src/directus/extensions/custom-slk-interfaces/src/measure-infos | Not covered by a dedicated automated test |
| Interface | Municipality score publisher interface | src/directus/extensions/custom-slk-interfaces/src/municipality-scores-publisher | RAT — publish and unpublish checkbox flow |
| Interface | Navigation editor | src/directus/extensions/custom-slk-interfaces/src/navigation-editor | Not covered by a dedicated automated test |
| Interface | Unsplash image selector with upload validation and credits saved on the file and parent item | src/directus/extensions/custom-slk-interfaces/src/unsplash-image | Manual-only: import an image into an existing and a new item and inspect both credit fields; no dedicated automated test |
| Interface | Public-assets hook or interface support | src/directus/extensions/custom-slk-interfaces/src/public-assets | Not covered by a dedicated automated test |
| CMS | Directus schema, roles, policies, presets, settings, translations, flows, dashboards, and collection items are imported code-first | src/directus/cli/import-all.sh, src/directus/cli/export-all.sh | Not covered by a dedicated automated test; deployment/import smoke checks are operational |

### Directus flows and background automation

| Area | Functionality | Main implementation | Test coverage |
| --- | --- | --- | --- |
| Accounts | Create an editor user when an editors item is created | src/directus/flows/createEditorUser.yaml, src/directus/extensions/editor-manager | USR — “creating an editor triggers invited user creation and localteam assignment” |
| Accounts | Delete the associated user when an editor is deleted | src/directus/flows/deleteEditorUser.yaml, src/directus/extensions/editor-manager | Not covered by a dedicated automated test |
| Registration | Create a municipality when a localteam is created | src/directus/flows/createMunicipality.yaml | REG — “frontend page creates a new localteam request” |
| Registration | Set a random preview token when an unverified municipality lacks one | src/directus/flows/setMunicipalityPreviewToken.yaml | RAT — token-protected preview |
| Registration | Send the new-localteam welcome mail | src/directus/flows/sendWelcomeNewLocalteam.yaml | MAN — welcome email manual check |
| Registration | Notify administrators about new local-team requests | src/directus/flows/notifyAdminNewLocalteam.yaml | Not covered by a dedicated automated test |
| Feedback | Notify internal recipients about new feedback and optionally copy sender | src/directus/flows/notifyNewFeedback.yaml | Not covered by a dedicated automated test |
| Forms | Notify internal recipients about new form responses and optionally copy sender | src/directus/flows/notifyNewFormResponse.yaml | Not covered by a dedicated automated test |
| Verification | Legacy creator-verification sync flow retained as inactive documentation | src/directus/flows/syncCreatorVerified.yaml | RAT — active users.update hook behavior is tested |
| Scores | Calculate scores and ranks after rating changes | src/directus/extensions/hook-calc-score-and-ranks | RAT — current catalog ratings and publication flow |
| Scores | Enforce verified publisher on score publication | src/directus/extensions/hook-calc-score-and-ranks/src/index.ts | RAT — unverified and verified publisher steps |
| Scores | Synchronize local-team admin verification to municipality preview state | src/directus/extensions/hook-calc-score-and-ranks/src/index.ts | RAT — true and false propagation steps |
| Search | Keep site content index in sync on create, update, delete, and committed blocks | src/directus/extensions/hook-search-index/src/index.ts | Not covered by a dedicated automated test |
| Slugs | Generate or maintain slugs for pages, municipalities, measures, and job offers | src/directus/extensions/hook-job-offer-slug/src/index.ts | Not covered by a dedicated automated test |
| Reports | Generate scheduled weekly measure-rating CSV report | src/directus/extensions/hook-measure-rating-reports/src | Not covered by a dedicated automated test |
| Elections | Generate, review, send, remind, thank, test-mail, and complete Wahlcheck actions | src/directus/extensions/election-check/src | RAT — action UI and candidate workflow steps |
| Integrations | Send email through configured Directus mail transport and templates | src/directus/templates, src/directus/flows, src/directus/extensions/election-check | MAN — email delivery checks remain manual |

### Server routes and external integrations

| Area | Functionality | Main implementation | Test coverage |
| --- | --- | --- | --- |
| Security | ALTCHA challenge endpoint for bot protection | src/frontend/server/api/altcha.get.ts, src/frontend/plugins/altcha.client.ts | Not covered by a dedicated automated test |
| Search | Administrative-area search endpoint | src/frontend/server/api/area-search.get.ts | REG — municipality search path |
| Search | Content search endpoint | src/frontend/server/api/content-search.get.ts | Not covered by a dedicated automated test |
| Events | ICS endpoint for event calendar integration | src/frontend/server/api/events/[slug].ics.get.ts, src/frontend/plugins/embed-calender.client.js | Not covered by a dedicated automated test |
| Newsletter | Fetch available newsletter lists | src/frontend/server/api/newsletter-lists.get.ts | Not covered by a dedicated automated test |
| Newsletter | Subscribe to a newsletter list | src/frontend/server/api/newsletter-subscribe.post.ts, src/frontend/components/Blokkli/NewsletterSignup | Not covered by a dedicated automated test |
| Teams | Fetch organization members for permitted users | src/frontend/server/api/org-members.get.ts | USR — permitted local-team visibility |
| Registration | Register municipality or local team with role and membership repair | src/frontend/server/api/register-municipality.post.ts, src/frontend/server/utils/directusRoles.ts | REG — registration, role, junction, retry, and configured-preview assertions |
| Projects | Submit an article or Erfolgsprojekt from the public frontend | src/frontend/server/api/submit-article.post.ts | Not covered by a dedicated automated test |
| Feedback | Submit public feedback | src/frontend/server/api/submit-feedback.post.ts | Not covered by a dedicated automated test |
| Forms | Submit generic form responses | src/frontend/server/api/submit-form-response.post.ts | Not covered by a dedicated automated test |
| Directus client | Browser requests with frontend bearer token | src/frontend/plugins/directus.client.js | RAT, REG, EPI — exercised indirectly by browser workflows |
| Directus server | Server-side requests with public role or server credentials | src/frontend/plugins/directus.server.js | Not covered by a dedicated automated test |
| Stadt-Land-Zahl | API plugin integration for configured data service | src/frontend/plugins/stadt-land-zahl-api.js, src/directus/roles/StadtLandZahlAPI.yaml | Not covered by a dedicated automated test |
| Calendar | Browser calendar embedding integration | src/frontend/plugins/embed-calender.client.js | Not covered by a dedicated automated test |
| Donations | Betterplace widget integration | src/frontend/components/BetterplaceDonationWidget | Not covered by a dedicated automated test |
| Images | Unsplash search and download-trigger endpoint | src/directus/extensions/endpoint-unsplash | Not covered by a dedicated automated test |
| PDF | Authenticated municipality PDF endpoint | src/directus/extensions/endpoint-pdf-service | RAT — municipality PDF download |
| PDF | Election or local-election checklist PDF endpoint | src/directus/extensions/endpoint-pdf-service | Not covered by a dedicated automated test |
| Users | Generate password-reset link through Directus endpoint | src/directus/extensions/endpoint-generate-reset-link | Not covered by a dedicated automated test |
| Editorial users | Invite Erfolgsprojekte editorial users through endpoint and panel | src/directus/extensions/erfolgsprojekte-user-manager | EPA — dashboard invite flow |
| Community | Community activity summary endpoint and Directus panel | src/directus/extensions/community-activity | Not covered by a dedicated automated test |
| Consent | Consent-management API and Directus module | src/directus/extensions/consent-management | Not covered by a dedicated automated test |
| Persistence | Blokkli state and publish endpoint with atomic conflict-safe writes | src/directus/extensions/blokkli-persistence | Partial targeted automated coverage: bin/test_suite/src/blokkliPersistence.test.ts — state loading and publication; transaction rollback and concurrent revision conflicts have no dedicated automated test |
| Search | Meilisearch-backed search index integration | src/directus/extensions/hook-search-index | Not covered by a dedicated automated test |
| PDF templates | Typst municipality summary and election checklist templates | src/directus/extensions/endpoint-pdf-service/typst | RAT for municipality summary; election checklist not covered by a dedicated automated test |

## Existing regression-flow coverage

The current Playwright/API suite is organized around these flows:

| Flow | What it proves |
| --- | --- |
| [Add-user flow](bin/test_suite/src/flows/addUserFlow.ts) | Local-team scope, visible Directus fields, invitation boundaries, editor creation, user assignment, and editor visibility |
| [Register-localteam flow](bin/test_suite/src/flows/registerLocalteamFlow.ts) | Municipality lookup, registration, exact role assignment, user-team membership, preview URL configuration, duplicate-team contact flow, rating progress, and stale-slug protection |
| [Rating and Wahlcheck flow](bin/test_suite/src/flows/ratingWahlcheckFlow.ts) | Score calculation, publication gating, token preview, verification propagation, municipality detail/PDF, election setup, thesis review, candidate mail actions, answer tokens, reminders, thank-you behavior, and public results |
| [Erfolgsprojekte article flow](bin/test_suite/src/flows/erfolgsprojekteArticlesFlow.ts) | Editorial fixtures, contributor and editorial CRUD, publication, public rendering, draft exclusion, filtering, sorting, and collection visibility |
| [Erfolgsprojekte invitation-dashboard flow](bin/test_suite/src/flows/erfolgsprojekteInviteDashboardFlow.ts) | Planning-team-only dashboard visibility, unauthorized access rejection, and editorial invitation |

## Coverage gaps to address next

The inventory intentionally exposes missing regression tests rather than marking every route as covered by a broad smoke test. The highest-value additions are:

- A public-page smoke matrix for the home page, generic pages, news, events, jobs, measures, regions, map, statistics, tools, contact, donations, and project submission.
- API tests for ALTCHA, content search, newsletter list and subscription, ICS generation, feedback, generic form responses, and public article submission.
- Component or browser assertions for the search palette, language and theme preferences, responsive navigation, maps, ranking views, charts, block rendering, and share links.
- Directus permission tests for each role and policy boundary, including consent management, recruiter, measures team, public access, APIs, and deletion behavior.
- Integration tests for email delivery, Meilisearch indexing, Unsplash, Betterplace, Stadt-Land-Zahl, community activity, reset links, and the election PDF.
- Failure-path tests for registration cleanup and partial Directus failures, plus explicit tests for the preview policy if creator_verified is later removed from that decision.

When a feature is changed, update the relevant row, implementation path, and test reference in this file in the same change. When a new feature is added, add a row and a targeted test or explicitly record that it is not covered yet.
