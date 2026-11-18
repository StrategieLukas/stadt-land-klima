# Design guidelines

Persistent project design memory. Follow the existing page patterns when changing typography.

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

## Election pages

- Follow the jobs cards: square corners, a 1px `--slk-border` edge, `--slk-surface` background and consistent padding. Use underlined headings and visible keyboard focus for linked cards instead of raised shadows or hover scaling.
- Keep introductions outside panels. Center the Wahlcheck overview, including its introduction, election cards and three illustrated instruction steps; use one/two/three election columns on mobile/tablet/desktop. Municipal guide and candidate introductions stay left aligned. These pages use the standard hero scale in `text-stats-dark`; the wizard and embeds keep compact, centered headings, logos and instructions.
- The overview uses the shared site header and its SLK logo. Do not add a second page-level SLK masthead; keep the distinct Wahlcheck campaign artwork in the introduction.
- Separate supporting information with spacing, labelled sections and dividers instead of nested tinted boxes. Keep best/lowest sector summaries in flat green/blue tinted boxes with shared padding and readable theme text. Retain semantic answer, weighting, warning and result colours, plus recognisable radio controls, progress markers and tabs. Answer outlines appear for keyboard focus, while clicks retain the answer sparkle without a focus ring.
- Personal results story graphics retain their earlier gradient backgrounds, soft glows, rounded ranking cards and callout. This artwork is an exception to the flat page-panel styling; retain the reserved story safe area and all five results at narrow preview widths. Preserve supplied official artwork and LocalZero's palette, Fabrikat fonts and logos. The fallback wizard wordmark uses white lettering in normal dark mode, retaining the green mark; LocalZero keeps dark lettering.
- Retain answer sparkles, completion confetti and functional question/step transitions. Render completion confetti through a body-level portal so transformed wizard steps and panel spacing cannot constrain the fixed viewport overlay; embedded Wahlchecks use their own document body. Remove the overlay when leaving results. Do not add decorative entrance sequences, glowing page backgrounds or pulsing share badges.

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

In dark mode, canonical fills mix 55% accent with the theme surface. Their 1px inset edge mixes 80% rendered fill with 20% accent; hover outlines match the rendered fill. Keyboard focus uses 60% rendered fill with 40% white for a distinct visible outline. Light-mode styling and theme-specific icon dividers remain shared; disabled buttons receive no hover emphasis.
