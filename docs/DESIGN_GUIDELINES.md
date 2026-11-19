# Design guidelines

Persistent project design memory. Read before changing frontend appearance or interaction.

The current appearance is deliberate. The decisions below include small fixes
reviewed from commits `8ee4e4aa` and `4a62c3e3` (2026-11-18/19), including details
previously lost during other agent sessions. Preserve these decisions during
refactors, component reuse and unrelated fixes. A general cleanup or consistency
pass is not a reason to replace them. When a user requests a design change,
update the affected rule and `FEATURES.md` with the implementation. These rules
describe the intended result; implementation paths identify the current reference.

## Theme surfaces, translucent overlays and badges

- The site must remain recognizable behind search/modal tints in dark mode.
  Search uses `bg-black/50` in light mode; the shared dark `.slk-modal-backdrop`
  uses `color-mix(in srgb, var(--slk-backdrop) 50%, transparent)` with
  `--slk-backdrop: #050b11`. Keep the background color alpha at 0.5 and the
  displayed backdrop element at full opacity. An opaque token fill obscures the
  page and reverses this fix. This rule applies to the shared backdrop class;
  media viewers and fullscreen visualizations retain their own treatments.
- Retain separate dark page, surface, subdued and muted levels (`#101820`,
  `#17212b`, `#1f2b36`, `#2a3947`) and visible border levels (`#344454`,
  `#526575`). Use the existing `--slk-*` tokens. Green, blue and orange notices
  keep their semantic tints and readable theme text instead of becoming identical
  dark panels or bright light-theme boxes.
- Status/category chips use `.slk-badge` and its warning, success, info and news
  variants, with paired foreground/background tokens. This includes search,
  nearby municipalities, event/news states, measure labels, project previews,
  tool categories and Wahlcheck double weighting. Compact chip actions retain
  themed hover fills and visible keyboard focus. Rating chips use their score
  scale; identity colors and share artwork retain their fixed palettes.
- Dark ranking cards and rating-colored measure sections use subdued score
  tints, including neutral N/A, with strong/muted light labels. `*-very-light`
  rating backgrounds mix the score tint 50% with `--slk-surface`; do not map
  every score to the same neutral surface. Preserve the saturated semantic
  progress fills and their own label contrast. Dark sector icons use transparent
  SVG masks colored by the heading token, without an opaque image background.
- Keep the municipality filter panel neutral and raised, reserving brand lime
  for selected controls with dark selected text. Unselected controls retain
  readable text/borders and a distinct hover surface.

References: [theme tokens and rules](../src/frontend/assets/css/main.css),
[area result chips](../src/frontend/components/AreaSearchResult.vue),
[sector cards](../src/frontend/components/DetailMunicipalitySectorCards.vue).

## Header, navigation and search handoff

- Logo, search field and action controls share a vertical center in both expanded
  and compact headers. Shrinking the header must not change the search field's
  dimensions or horizontal position.
- Reveal/collapse the navigation smoothly from accumulated scroll intent,
  including small trackpad deltas, while resisting reversal noise. Keep the
  reveal wrapper clipped throughout the transition, hidden navigation inert,
  and close its dropdown on collapse. Preserve measured heights and fractional
  geometry rather than introducing jumps or scrollbar feedback.
- Desktop dropdowns remain compact, themed and viewport-bounded. Switch between
  preview/cards/list layouts through one shell whose position and size animate;
  crossfade its contents. Hovering a plain link closes the dropdown. Previews
  respond to keyboard focus as well as hover; mobile children retain CMS order,
  thumbnails and descriptions.
- While search is open, a navigation dropdown temporarily hides and inerts the
  result panel, preserving its query, results and translucent backdrop. Keep the
  dropdown interactive above the backdrop, and restore the result panel when
  navigation closes or input resumes. Preserve coordinated fade/scale/position
  transitions, Escape priority and reduced-motion behavior.
- Embedded search tint begins below the measured header. Administrative-area
  suggestions sit above page content but below the fixed header/navigation
  (`z-40` below `z-50`); do not restore the former `z-99999`. Keep result links
  and chip actions separately usable, including touch scrolling. Area-kind
  badges stay muted and distinguish regions, rateable municipalities and other
  administrative areas without competing with rating/status chips.

References: [header](../src/frontend/components/TheHeaderDesktop.vue),
[navigation strip](../src/frontend/components/TheNavigationStripDesktop.vue),
[search palette](../src/frontend/components/TheSearchCommandPalette.vue),
[area search](../src/frontend/components/AdministrativeAreaSearchBar.vue).

## News and event timelines

The sticky timeline background spans the usable viewport with a subtle bottom
shadow. Its inner horizontally scrollable month strip starts, ends and clips at
the page content edges. Keep compact pills (12px text, 18px line height,
4px vertical/10px horizontal padding), 6px gaps and 6px strip vertical padding.
Do not confine the background to the reading column, enlarge the timeline back
into a tall navigation row, or introduce horizontal document overflow. Use the
measured `--slk-timeline-width` to account for the reserved scrollbar strip.

References: `.slk-timeline-navigation`, `.slk-timeline-links` and
`.slk-timeline-pill` in the shared CSS, plus
[timeline measurements](../src/frontend/composables/useTimelineNavigation.ts).

## Page gutters and content widths

The default layout owns one outer gutter through `--slk-page-gutter`: 16px below
640px, 24px from 640–767px, and 32px from 768px upward. Standard content is fluid
up to a usable width of 1280px, centered inside that gutter. Measure against the
usable document width, excluding the reserved scrollbar strip. At 960px, ordinary
page headings and content start 32px from each usable edge.

Do not add horizontal padding or breakpoint-stepped Tailwind `container` widths
to page wrappers. Cards, panels, forms and authored blocks retain their internal
padding. Preserve explicit narrower detail/reading widths and centered forms.
`.cms-page-shell` supplies vertical spacing only; authored Blökkli padding,
including `none`, and full-width backgrounds remain independent.

`contentWidth: "full"` removes the 1280px cap, while retaining the shared gutter.
The data overview uses this for its visual panels; its introduction and supporting
information retain their standard width caps. Dashboard panels do not add a
second outer margin. Header/footer spacing, standalone Wahlcheck embeds and
wizard-specific internal padding follow their existing layouts.

### Route inventory

Source inventory covers all maintained page routes. The pre-change browser audit
at 960px measured jobs/list and detail at 8px, ranking/data/donations at 24px,
home/CMS/tools/measures at 32px, organisation at 40px, and container-based listings
at about 105px. The shared layout replaces those separate outer-spacing rules.

Browser verification on 2026-11-18: the shared geometry matrix passed in both
themes at all listed widths. Manual 960px checks passed for job, event, measure,
project and tour details and the map. The sampled municipality returned a
restricted/empty state; the sampled regional detail timed out during hydration,
so its completed layout still needs browser acceptance. Native and deployed
verification require their own environments. Before/after screenshots are local
artifacts under `.reports/layout-gutters/`.

| Route family                                 | Routes                                                                                                                                              | Width treatment and regression coverage                                                                                                                                                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standard overview/listing                    | `/jobs`, `/organisation`, `/municipalities`, `/news`, `/events`, `/projects`, `/tools`, `/measures`, `/stats`, `/contact`, `/elections/wahlcheck`   | Shared 1280px grid; targeted browser geometry at 960px in both themes. Jobs/news also cover 390, 639, 640, 767, 768, 1024 and 1440px. Contact keeps its inner form cap.                                                                                 |
| Event-series listing                         | `/events/series/:slug`                                                                                                                              | Shared grid; targeted 960px geometry with the Public Navigation fixture.                                                                                                                                                                                |
| CMS and homepage                             | `/`, `/:slug`                                                                                                                                       | Shared outer gutter; authored block widths/padding and legacy prose widths remain. Homepage and the Public Navigation CMS fixture have targeted browser geometry; arbitrary authored combinations and editor geometry remain manual-only.               |
| Narrow reading/details                       | `/news/:slug`, `/events/:slug`, `/projects/tours/:tourSlug/:stopSlug`, `/measures/:slug`, `/jobs/:slug`, `/municipalities/updates`, `/regions/:ars` | Preserve explicit caps: 768px for news/events/station reports, 1024px for measures, 1152px for jobs, 896px for updates/regions. News/event/measure fixture details and updates have targeted gutter geometry; the other detail caps remain manual-only. |
| Forms and donations                          | `/register_localteam`, `/projects/submit`, `/spenden`, `/elections/thesen/:access_token?`                                                           | Preserve form/donation layout caps and internal padding. Registration/project forms have targeted 960px geometry; donation and candidate-page geometry remain manual-only.                                                                              |
| Data                                         | `/data`, `/data/:slug`, `/data/:slug/:collection`                                                                                                   | Overview visual panels are uncapped with one gutter; area and collection details use the standard shell. Overview has targeted geometry at every listed width in both themes; detail gutter geometry remains manual-only.                               |
| Composed municipality/project/tour/map pages | `/municipalities/:slug`, `/projects/:slug`, `/projects/tours/:tourSlug`, `/map`                                                                     | Shared outer gutter; preserve internal cards, charts, map canvases, tour spacing and viewport-wide backgrounds. Existing municipality/tour/map interaction regressions are partial coverage, without dedicated gutter assertions.                       |
| Election guide/wizard/embed                  | `/elections/:slug`, `/elections/wahlcheck/:municipalitySlug`, `/embed/wahlcheck/:municipalitySlug`                                                  | Guide/wizard inherit the outer gutter and retain internal spacing. Embed uses its own layout. Existing election/embed regressions are partial coverage; no dedicated gutter assertion.                                                                  |
| Redirects and empty legacy route             | `/backend`, `/feedback`, `/stats/:ars`, `/spenden-statt-schenken`, `/measures/sectors/:sector`, `/measures/sectors`                                 | Retain redirects and the empty legacy sector index; no content gutter of their own. No dedicated gutter test.                                                                                                                                           |

The shared assertions live in `bin/test_suite/src/lib/pageLayout.ts`, called by
`cssMigration.ts` and Public Navigation's “Public layout: shared gutters, narrow
content and full-width dashboards” step in both development profiles. They check
actual element bounds, width caps, symmetric gutters, heading alignment, CMS
wrapper padding and dashboard panel alignment. Existing component regressions
cover explicit authored zero padding; mixed full-width backgrounds and live
editor geometry also require visual review.

## Standard page heroes

- Do not pair a large heading with a decorative small all-caps eyebrow/overline above it. Start with the heading; put useful context in the introduction instead.
- Use `font-heading text-4xl font-black sm:text-6xl` for the hero `h1`, with `mb-4`. This is the shared scale in news, events, jobs, tools, projects, and measures. Do not enlarge a standard hero to `text-5xl sm:text-7xl` or add a one-off line height or tracking treatment.
- Use the page's established heading color: for example `text-gray` for organisation/measures, `text-stats-dark` for news/events/tools, `text-orange` for jobs, and `text-light-blue` for projects.
- Keep introductory copy at `max-w-3xl text-lg leading-relaxed text-gray`. Do not add a desktop `text-xl` size or extra font weight to a standard introduction.
- Use the existing `mb-8` or `mb-10` header spacing to suit the page. Optional hero actions use `CanonicalButton`, a relevant icon, and the heading's color, preserving the component's shared styling.
- Keep section headings subordinate to the hero, normally `font-heading text-3xl font-bold`. Use smaller headings inside detail panels and member cards instead of increasing every heading level together.

Reference implementations: [news](../src/frontend/pages/news/index.vue), [events](../src/frontend/pages/events/index.vue), [tools](../src/frontend/pages/tools/index.vue), [organisation](../src/frontend/pages/organisation/index.vue).

## Loading stability

- Avoid page layout jitter or motion while content loads. Reserve space for asynchronous images, maps, and other content using known dimensions, aspect ratios, or stable containers.
- Reveal natural-size decorative images only after they have loaded and decoded. Keep their frames and captions hidden and unfocusable until the final layout is ready; reveal adjacent postcards together so one loading image cannot move another.
- Keep already displayed content visible while replacement content loads. On tour station changes, retain the previous decoded postcard set and its position until the active station's replacement previews have settled and at least one is ready, then swap the set atomically. Never clear the old set temporarily, animate the swap, or let a late download from an earlier station replace the active station. If all replacements fail, retain the previous set; a station with no media intentionally clears it.
- Do not animate loading content into position or visibly resize it when loading completes. Keep gallery frames stable when switching between image formats or videos, and preserve the page's scroll position when opening and closing overlays.
- Tour map postcards retain their natural, uncropped image proportions, readable
  themed frames/captions and individual rotations. Pairs stay separated inside
  the scene: the desktop pair container uses `min(40rem, 48vw)` with a 3rem
  column gap and matching position calculations. Preserve the responsive
  placement and hover stacking rather than squeezing two images into the old
  single-photo width. Failed previews remain hidden and inert.

## Election pages

- Follow the jobs cards: square corners, a 1px `--slk-border` edge, `--slk-surface` background and consistent padding. Use underlined headings and visible keyboard focus for linked cards instead of raised shadows or hover scaling.
- Keep introductions outside panels. Center the Wahlcheck overview, including its introduction, election cards and three illustrated instruction steps; use one/two/three election columns on mobile/tablet/desktop. Municipal guide and candidate introductions stay left aligned. These pages use the standard hero scale in `text-stats-dark`; the wizard and embeds keep compact, centered headings, logos and instructions.
- The overview uses the shared site header and its SLK logo. Do not add a second page-level SLK masthead; keep the distinct Wahlcheck campaign artwork in the introduction.
- Separate supporting information with spacing, labelled sections and dividers instead of nested tinted boxes. Keep best/lowest sector summaries in flat green/blue tinted boxes with shared padding and readable theme text. Retain semantic answer, weighting, warning and result colours, plus recognisable radio controls, progress markers and tabs. Answer outlines appear for keyboard focus, while clicks retain the answer sparkle without a focus ring.
- Keep Wahlcheck statement text in a fixed-height, keyboard-scrollable area (20rem on mobile, 14rem from 640px) with a compact 0.75rem gap above the agreement controls, so answer choices and skip controls retain their vertical position. Advance question cards out to the left and in from the right using viewport-width travel; reverse when going back. Clip only at the viewport, not the question panel or page gutters. Outgoing cards are inert; reduced-motion preferences disable the slide and answer sparkle.
- Personal results story graphics retain their earlier gradient backgrounds, soft glows, rounded ranking cards and callout. This artwork is an exception to the flat page-panel styling; retain the reserved story safe area and all five results at narrow preview widths. Preserve supplied official artwork and LocalZero's palette, Fabrikat fonts and logos. The fallback wizard wordmark uses white lettering in normal dark mode, retaining the green mark; LocalZero keeps dark lettering.
- Retain answer sparkles, completion confetti and functional question/step transitions. Render completion confetti through a body-level portal so transformed wizard steps and panel spacing cannot constrain the fixed viewport overlay; embedded Wahlchecks use their own document body. Remove the overlay when leaving results. Do not add decorative entrance sequences, glowing page backgrounds or pulsing share badges.
- The active question marker stays solid green with white content even when
  already answered; keep its checkmark and `aria-current`. Active, completed and
  unanswered treatments are mutually exclusive. Forward/weighting/show-results
  navigation labels retain explicit white text in normal and LocalZero themes.
- Platform share actions use outline CanonicalButtons with monochrome platform
  icons in the icon compartment and translated labels: one column on mobile,
  two from 640px. Preserve busy/disabled states during story generation and the
  existing download/copy feedback. Do not replace them with platform-colored pills.

## Jobs, municipality panels and organisation identity

- Job cards use square corners, a single themed border, surface background and
  24px padding. Keep complete wrapping role titles, an organisation name/logo,
  and plain metadata below a divider; hover/focus underlines the title. Do not
  restore raised hover motion, rounded shadow cards or decorative type badges.
- Job details retain an unboxed heading and one bordered content panel with
  divided sections, beside a 20rem sticky facts sidebar from `lg`; on mobile the
  facts/actions precede the content. Do not turn each prose section into a
  separate card or add decorative heading dots. The detail title deliberately
  uses `text-3xl sm:text-4xl lg:text-5xl font-bold`, rather than the overview hero
  scale. Keep the orange canonical contact/application action below the facts.
- Rated and unrated municipalities share the brand-lime municipality-name hero
  and facts card. Do not restore a state label above the name or a placeholder
  score bar on unrated pages. Preserve the general introduction, labelled
  catalogue version, rank marker, full-width rating progress and compact native
  PDF control on rated pages. Desktop keeps two-thirds content/one-third sticky
  sidebar; mobile stacks the same information.
- Municipality notices and lower actions remain compact bordered orange/green
  tinted boxes with small semantic icons and canonical actions. Reuse
  `MunicipalityActionBox`; keep older-catalogue notices pale blue with text links
  and their separate orange update callout. Sidebar statistics/elections/history
  actions share one neutral box with full-width outline canonical buttons and
  large icons. Nearby cards retain themed surfaces and a blue-tinted image area.
- Reuse `OrganisationLogo` in job cards/details, project cards and article corner
  triangles. Prefer the CMS `logo_dark` artwork in dark mode, with the existing
  LocalZero fallback. When no dark artwork exists, retain the light logo on a
  white backing so it stays legible. Preserve aspect ratio with `contain`; do not
  crop or blanket-invert official artwork. Article/project corner triangles use
  the theme surface instead of an unconditional white triangle.
- Organisation team details retain a clear team title, icon-labelled contact
  links, readable task lists and separate adjacent leadership/member rows.
  Leadership is not repeated among regular avatars. Preserve the diagram's
  layout stability while switching teams, and the matching `RobotoCondensed`
  diagram font. Member-card names use the heading face at 20px/24px; the compact
  avatar labels follow the rules below.

References: [job card](../src/frontend/components/JobOfferCard.vue),
[job detail](../src/frontend/pages/jobs/[slug].vue),
[municipality hero](../src/frontend/components/MunicipalityDetailHero.vue),
[action box](../src/frontend/components/MunicipalityActionBox.vue),
[organisation logo](../src/frontend/components/OrganisationLogo.vue),
[organisation page](../src/frontend/pages/organisation/index.vue).

## Data explorer and visualization details

- Keep `/data` visual panels full width within the shared gutter. From 1024px,
  use equal unboxed columns: chooser/histogram on the left, compact filters/search
  and map/legend on the right, with aligned edges. The complete information row
  sits below both columns at the standard centered width. Narrow layouts order
  chooser, controls, map, information, histogram; the chooser is collapsible on
  mobile. Panels share themed borders, 8px corners and consistent inner padding.
- Product matrices respond to their container width (two/three/four columns),
  with the coming-soon tile filling remaining cells. Show all chooser cards
  without an internal scrollbar or automatic card scrolling. Preserve the
  selected card's 4px theme-aware ring, surface offset and separate keyboard
  focus indicator, including padding that keeps these rings unclipped.
- Preserve the map footprint through SSR, asynchronous mounting and first load:
  `data-overview-map-size` is shared by placeholder/live map and reserved outside
  `ClientOnly`. Desktop uses the portrait 4:5 ratio with 420–760px height bounds;
  smaller screens use `clamp(320px, 60svh, 520px)`. Keep the gray initial loading
  pulse and reduced-motion support. Missing published overview capability has a
  static translated pending screen; errors retain a distinct recovery state.
- Chart SSR previews exist in both palettes and swap atomically to the live
  chart inside its reserved frame. Theme changes update the existing chart
  without blanking, refetching, recompiling or losing zoom/selection. Histogram
  loading reserves the chart height without an extra visible loading row.
  Split chart/KPI/image-text layouts stack on narrow screens; do not force two
  squeezed columns or restore oversized empty product-section heights.
- Keep category-axis labels without duplicate generated bar-text overlays when
  that axis is visible. Quantitative ticks/labels remain visible, including after
  resize/fullscreen; charts with hidden category labels retain adaptive labels.
  Municipality reference rules use the chart foreground color while preserving
  their dashed stroke and position. Dark overview-map boundaries stay `#344454`
  on creation and theme changes, with selection emphasis intact.
- Collection charts, interactive histograms and detail maps retain a persistent
  transparent ghost fullscreen control: subdued 16px icon, at least 44px touch
  target. A viewport-filling native dialog resizes the same live visualization;
  Escape/close restores its placement, page scroll and focus. Keep mobile safe
  areas, map gesture help and attribution available. Tour media dialogs remain
  centered against the visible viewport, including the reserved scrollbar gutter.
- Show complete product/narrative/metric explanations and source/license/date
  credits, removing only whitespace-normalized exact duplicates. Omit redundant
  single-metric selectors and repeated scope/unit captions. Preserve source
  fallback/deduplication and consistent credits in charts/exports; map credits
  remain available when WebGL fails. Municipality product fragments keep their
  sticky-header offset and navigate without remounting the page.

References: [data overview](../src/frontend/pages/data/index.vue),
[product matrix](../src/frontend/components/DataProductMatrix.vue),
[Vega chart](../src/frontend/components/VegaChart.vue),
[fullscreen wrapper](../src/frontend/components/VisualizationFullscreen.vue),
[architecture and SSR constraints](../PROJECT_DECISIONS.md#data-dashboard-ssr-and-publication-aware-reuse).

## Compact organisation avatars

- Use wrapping, left-aligned flex rows with small gaps; do not distribute avatars across equal-width columns.
- Keep member buttons a consistent compact width (`w-16`) with 40px avatars and small name labels. Allow longer names to wrap within that width, retaining the full name in the button title.
- Leadership buttons may use `w-28` to fit their role labels, but remain adjacent in their own wrapping row.

## Buttons and action audit

Use `CanonicalButton` with a relevant icon for prominent application actions. Customize its supported props and surrounding layout; keep its shared corners, borders, shadows and interaction styling intact.

Use `variant="outline"` for neutral-surface canonical buttons with themed borders and text; the default remains filled. Use `icon-size="lg"` for a 28px icon in a 48px-wide area when icons need more room. Municipality sidebar actions share a neutral-surface box and use these outline and large-icon props.

Canonical actions fit their container and wrap long labels on narrow screens. Keep labels complete rather than truncating translated calls to action.

The label-only action audit covers maintained frontend pages and components, including button-styled links. Commented-out markup and CMS administration controls are excluded.

| Actions                                                                                | Decision                                                                                                    |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Onboarding appointment booking                                                         | Canonical calendar action in `dark-green`; retain the booking overlay handler.                              |
| Municipality localteam card, statistics card and assessment callout                    | Canonical group/chart actions in `bright-green`, `dark` and `dark-green`, respectively.                     |
| Measure feedback                                                                       | Canonical message action in `blue`; resolve the existing route object to preserve encoded query parameters. |
| Both measure catalogue downloads                                                       | Single canonical anchors in `gray`, with download icons; never nest buttons inside links.                   |
| External tool links                                                                    | Canonical actions in `dark`, with open-window icons and external-link protections.                          |
| Statistics analysis actions                                                            | Retain canonical actions in `orange`; add scatter-plot/chart icons.                                         |
| Filters, tabs, pagination, search-result chips, map/chart controls and disclosures     | Retain compact controls whose shapes communicate their local interaction.                                   |
| Wahlcheck navigation, recovery, image download and link copy                           | Canonical actions with relevant icons; use supported yellow props for LocalZero.                            |
| Form submissions and compact partner-themed controls                                   | Retain their existing form and control designs.                                                             |
| Ordinary text links, clickable cards, footer utility links and compact editor controls | Retain their existing navigation or utility presentation.                                                   |
| Blökkli authored buttons                                                               | Retain outline, icon-position and hover options, editable labels and persisted authoring contracts.         |

In dark mode, canonical fills mix 65% accent with the theme surface. Their 1px inset edge mixes 80% rendered fill with 20% accent; hover outlines match the rendered fill. Keyboard focus uses 60% rendered fill with 40% white for a distinct visible outline. Filled-button icon/text dividers use soft off-white `--slk-text-inverse` in light mode and soft gray-white `--slk-text-muted` (`#b8c4cc`) in dark mode. At rest, outline-button dividers match the outline border through `--btn-edge` in both themes. Hover fills outline buttons with `--btn-ink`, with contrasting theme-surface text/icons and divider; only keyboard focus adds a focus ring. Outline hover fill, text/icons and divider transition in and out over 150ms with easing, matching the focus-ring timing. Reduced-motion preferences disable button and divider transitions. Resting divider colors remain independent of explicit button text-color overrides. Disabled buttons receive no hover emphasis.

## Verification references and limits

For appearance changes, inspect both themes at narrow and desktop widths and
exercise the affected hover, keyboard-focus, overlay and reduced-motion states.
Compare with the rules above before replacing existing styles. Passing a page
load or typecheck does not establish visual equivalence. These are existing
coverage references, not a claim that they have passed in the current session:

| Design area                                                               | Existing regression reference                                                                                                                 | Coverage limit                                                                                                                                   |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Header/search tint, handoff, geometry, scroll reveal and compact timeline | `bin/test_suite/src/headerNavigation.browser.ts`; `municipalityDashboard.browser.ts`                                                          | Targeted browser assertions; real assets, devices and frame pacing still need visual review.                                                     |
| Gutters and width caps                                                    | `bin/test_suite/src/lib/pageLayout.ts`, invoked by `cssMigration.ts` and `flows/publicNavigationFlow.ts`                                      | Targeted geometry matrix; route-specific gaps are listed in the gutter inventory above.                                                          |
| Canonical buttons                                                         | `bin/test_suite/src/lib/canonicalButtons.ts`, invoked by `cssMigration.ts` and `flows/tourSeriesFlow.ts`; divider assertions in the tour flow | Partial automated coverage of filled styles, wrapping and theme dividers; outline transitions still require visual review.                       |
| Tour postcard replacement                                                 | `bin/test_suite/src/flows/tourSeriesFlow.ts`                                                                                                  | Targeted delayed-decode/station-switch regressions; artwork and dialog centering still need visual review.                                       |
| Data explorer and regional navigation                                     | `bin/test_suite/src/municipalityDashboard.browser.ts`; `regionNavigation.browser.ts`                                                          | Partial targeted coverage; newer chart SSR, theme continuity, axes and fullscreen details have manual-only acceptance recorded in `FEATURES.md`. |
| Election styling, logos, badges and organisation details                  | `bin/test_suite/src/wahlcheckTheme.ts`; `flows/jobsFlow.ts`; `uiFixes.test.ts`                                                                | Partial coverage; many exact visual choices remain manual-only. Consult the individual feature rows rather than assuming complete coverage.      |

`FEATURES.md` remains the canonical feature/coverage inventory; keep its exact
flow references and manual-only gaps current when these designs change.
