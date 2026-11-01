# Future compared with the current frontend

Comparison date: 1 November 2026. Baseline: https://future.stadt-land-klima.de, application release `3bf7b200`, deployment checkout `881e3f1b`. Comparison implementation: `641e0744` plus the filter-mask and homepage-news fixes in this change.

## Scope and evidence

The browser comparison covers 22 representative public routes, at 1440 × 1000 and 390 × 1000, in light and dark mode, with German selected. Screenshots and DOM measurements cover both environments. The four viewport/theme combinations are also checked by the existing DE/EN/IT UI acceptance flow.

Routes cover the homepage, municipality directory/detail/history, map, measure directory/detail/sectors, statistics, projects, project tour/detail, news feed/detail, events, data landing, tools, organisation, jobs, contact, donations and participation. Private editor, candidate-token and account screens are outside this read-only public comparison. Closed menus, every possible filter combination, and every CMS-authored page are not claimed as exhaustive visual coverage.

Raw screenshots and measurements are saved under `.reports/design-comparison/`. The corrected tour-stop URL uses its complete stored slug, `erfolgsprojekte-tour-ost-2026-erfurt`.

## Design differences

| Area | Future baseline | Current implementation | Assessment |
| --- | --- | --- | --- |
| Municipality type filter icons | The city SVGs have an opaque square background. Used as CSS masks, they paint the whole icon box instead of a building silhouette. Both original masks have 100% alpha coverage. | Separate transparent masks preserve the existing building drawings. Rasterized coverage is about 46% for the smaller municipality and 50% for the larger city; the remaining pixels are transparent. Icons inherit selected/unselected text colours in either theme. | Rendering defect fixed. Existing coloured SVGs used elsewhere are preserved. |
| Homepage news teasers | News consists of title links with a green top border. There is no news image element, although the public news DTO includes image IDs. | News uses image cards alongside the existing project-card design: a 16:9 image, neutral border, small corners, padded heading and blue hover border. Three columns on desktop become one on phones. An item without an image retains its title link. | Missing homepage images fixed. No CMS permission or credential change is required. |
| Municipality assessment summary | A narrow progress bar and prominent PDF button sit in the hero. Rank and score captions are separate text above the bar. | The original tinted rating card is restored above the chart: rank marker, municipality/state, progress bar and compact rectangular PDF control. The large page heading and teaser remain. | Previously requested restoration is present in the repository but absent from Future's older release. |
| Municipality history action | History is a standalone retro button and differs from the statistics and election cards. | History matches their full-width card geometry, heading typography, padding, shadow, icon alignment and arrow. The same action group is used on phones and in the desktop sidebar. | Previously requested harmonisation is preserved. |
| Dark rating cards | The older ranking component lacks the score-specific theme classes; generic translucent background utilities can override the intended rating surface. | The established score-specific dark theme tint and contrasting foreground apply together. Browser acceptance checks heading contrast as well as layout. | Readability correction; the dark cards can look lighter and more clearly coloured than the old release. |
| Phone ranking cards | Left padding remains 40px, and long municipality names can constrain the progress-bar area. | Left padding is 16px on phones and 40px from the small breakpoint upward. The content can shrink and long names wrap; marker and PDF controls retain their width. | Responsive adjustment to the shared ranking/rating card. |
| Data charts and maps | Future predates the data-page delivery changes merged from `main`. | The updated chart adapter places labels inside bars when they fit and outside short segments, reserves label space and permits horizontal scrolling in narrow chart cards. Point maps follow checked pagination instead of stopping at the unpaged limit. | Incoming implementation differences, rather than a general page redesign. Map point counts also depend on upstream data. Detailed chart visual parity needs the same upstream collection/render payload; the local backend does not currently provide all of Future's data. |

## Areas with no additional design change observed

For comparable content, the common header, footer styling, hero typography, page gutters, view toggles, sector filters, sort controls, map controls, project list/tour styling, news-feed card layout, timeline, contact form and donation layout use the same design rules. The inspected hydrated pages showed no horizontal document overflow or browser page errors.

The `/news` feed itself is not missing image markup. Actual ordinary-news, event and tour-report image requests returned HTTP 200 and decoded successfully after loading. The confirmed missing images are on the homepage. The feed layout is preserved.

## Content and environment differences

These affect screenshots but should not be mistaken for CSS regressions:

- Future's current catalogue is `v1.0` and its ranking heading says 2026; the development database uses `beta` and says 2025.
- Navigation and footer menu entries are CMS content. Future has its complete published menus; the development database has different assignments.
- Ranking positions, score values, progress markers, municipality names, project/news counts, images and dates differ between the restored Future dataset and local fixtures.
- Cologne's selected assessment is available on Future but not in the local current catalogue. The local municipality-template check uses published Paderborn instead; this is not a claim of identical city content.
- Future has published tour reports; local stops retain draft report states. Report paragraphs, teaser images and publication badges therefore differ even on the same tour.
- Some local CMS detail pages have no corresponding published body, and the local Stadt.Land.Zahl backend does not resolve all the areas/collections available on Future. Empty local content is recorded as data availability, not as a design deletion.

## Verification

`uiFixes.test.ts` rasterizes the actual mask assets and rejects both fully opaque squares and empty icons. `uiFeedbackSmoke.ts` checks selected/unselected icon colours and actual homepage news image loading across German, English and Italian, both screen sizes and both themes. The normal development suite, strict frontend compiler/lint gates and test-suite typecheck cover the repository change. `FEATURES.md` records the exact coverage and remaining manual-only cases.
