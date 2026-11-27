# Job sharing and sharepic implementation plan

Date: 24 November 2026

Status: implemented locally on 27 November 2026; physical-app and deployed
acceptance remain pending. The original plan below records the intended behavior.

The implementation provides the three PNG formats, adaptive content including
hours/pay, a sharing dialog, platform links/native sharing, copy/download
fallbacks and job-specific SSR metadata. Rendering reuses the checked existing
job endpoint and its prepared translations through an internal Nuxt request;
no duplicate CMS loader was necessary. Dialog state/actions live together in the
lazy component. Bundled YAML-derived labels support crawlers before a CMS import.
`bin/test_suite/src/jobSharing.test.ts` covers content, formats, safe-area bounds,
escaping and cache/concurrency; `flows/jobsFlow.ts` — “Jobs: generated share images,
safe format switching and sharing fallbacks” exercises the actual API and dialog.

## 1. Recommended scope

Add sharing to every published job detail page, combining immediate link sharing
with automatically generated graphics. WhatsApp and LinkedIn work well with job
links; Instagram needs an image plus a native share or download handoff. Providing
only link buttons would leave the Instagram use case incomplete.

Deliver in two increments:

1. **Link sharing:** WhatsApp, LinkedIn, native link sharing, copy link and copy
   caption on `/jobs/[slug]`.
2. **Complete sharepic support:** adaptive Story and feed graphics, preview,
   downloads, native file sharing and a generated Open Graph image for link
   previews. This completes the requested feature.

Use existing dependencies and published job data. No new CMS fields, public-role
permissions, social account connections or automatic posting are required.
Custom editorial graphics, arbitrary text editing, scheduled publishing, QR codes,
Reels/video and additional platforms are follow-up work.

## 2. Existing implementation to reuse

| Area                          | Current implementation                                                                                      | Consequence for this feature                                                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wahlcheck sharing             | `src/frontend/components/Elections/WahlCheckShare.vue`                                                      | Reuse action behavior, translated feedback, outline CanonicalButtons and fallback patterns. It already supports Instagram/native file handoff, WhatsApp, LinkedIn and PNG download.         |
| Wahlcheck image export        | Same component uses `html-to-image` and exports its preview at 1080 × 1920                                  | Preserve this implementation and its regressions. Avoid copying its large election-specific component into jobs.                                                                            |
| Server-rendered social images | `src/frontend/server/api/public/municipalities/[slug]/social-image.get.ts`, `server/utils/sectorPreview.ts` | Reuse the installed `@resvg/resvg-js`, bundled fonts, fixed-size SVG-to-PNG approach and rate-limit conventions.                                                                            |
| Public job contracts          | `src/frontend/shared/contracts/jobs.ts`                                                                     | All five types and the required share content already exist in checked DTOs.                                                                                                                |
| Published job reads           | `src/frontend/server/api/public/jobs.get.ts`, `jobs/[slug].get.ts`                                          | Keep private Frontend-Server requests, explicit fields, published-only filters and checked responses. Existing responses have a 60-second public cache lifetime.                            |
| Job detail UI                 | `src/frontend/pages/jobs/[slug].vue`                                                                        | Add the share entry below the existing orange contact/application action; retain the sticky facts sidebar and mobile ordering.                                                              |
| Job cards                     | `src/frontend/components/JobOfferCard.vue`                                                                  | Cards currently have one enclosing NuxtLink. Start with sharing on details; any later card share control must be a sibling of the link.                                                     |
| SEO                           | `src/frontend/composables/usePageSeo.ts`, `shared/seo.ts`                                                   | Job details currently set the title and inherit generic jobs description/artwork. The custom social-image allowlist currently accepts only municipality paths. Extend it narrowly for jobs. |
| Logos and styling             | `OrganisationLogo.vue`, `CanonicalButton.vue`, `tailwind.config.js`, `docs/DESIGN_GUIDELINES.md`            | Reuse supported components/props and official artwork; use brand lime `#AFCA0B`, rather than `ff-green`, where brand green is intended.                                                     |
| Regression coverage           | `bin/test_suite/src/flows/jobsFlow.ts`, `flows/ratingWahlcheckFlow.ts`, `wahlcheckTheme.ts`                 | Extend the jobs flow and preserve Wahlcheck's existing Story/download/theme coverage. Those tests do not currently establish job sharing behavior.                                          |

## 3. Sharing experience and platform behavior

The detail page exposes one neutral outline share action with a share icon.
It opens a compact share dialog with link actions available immediately and a
graphic preview loaded on demand. Use the existing shared modal conventions:
50% translucent backdrop in both themes, dialog label, focus containment, Escape,
scroll handling and focus restoration. On narrow screens allow the dialog to
scroll while retaining complete action labels.

| Action               | Payload and behavior                                                                                                                                               | Fallback / limitation                                                                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WhatsApp             | Open the existing `https://api.whatsapp.com/send?text=…` pattern with a localized caption and canonical job URL, encoded with URLSearchParams.                     | This shares text/link; it does not attach a generated PNG. Offer image download/native file sharing separately.                                                                                                         |
| LinkedIn             | Use the existing `https://www.linkedin.com/sharing/share-offsite/?url=…` pattern with the canonical job URL.                                                       | The platform composes its own preview from server-rendered metadata. It does not accept an image attachment or guaranteed prefilled commentary through this link. Copy caption and download support manual image posts. |
| Instagram Story      | Select Story, prepare the PNG, then offer native file sharing when `navigator.canShare({ files })` succeeds. Explain that the user chooses Instagram if available. | Otherwise download the image and show translated instructions to add it in Instagram and add a link sticker containing the copied job URL. Do not promise automatic posting or app selection.                           |
| Instagram feed       | Select the 4:5 graphic, then share the file or download it and copy the caption.                                                                                   | A URL printed into an image or caption is not a clickable Story link sticker. Keep copy link available.                                                                                                                 |
| Native link sharing  | Call `navigator.share({ title, text, url })` directly from its click handler.                                                                                      | Capability-detect; keep copy link available on unsupported browsers.                                                                                                                                                    |
| Native image sharing | Share the already prepared File from a fresh click; use a file-only payload for Instagram handoff.                                                                 | Share targets may discard accompanying text/URLs. Provide caption/link copy as separate actions.                                                                                                                        |
| Download / copy      | Download the selected PNG; copy canonical URL or caption with explicit success/error feedback.                                                                     | Clipboard refusal exposes selectable text for manual copying. A canceled native share is neutral and must not trigger a download or success message.                                                                    |

Native sharing requires a secure context and transient user activation; its targets
are controlled by the browser/OS. Preload the selected image while the dialog is
open, then enable a separate ready-to-share action. Do not fetch/render an image
inside the share click handler and assume activation survives the wait. See the
[Web Share specification](https://www.w3.org/TR/web-share/).

External share destinations open only after interaction, with
`noopener noreferrer`. Use no tracking SDKs or new social embeds. LinkedIn's
[share-plugin documentation](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/plugins/share-plugin)
describes URL sharing; retain the repository's existing script-free URL approach
and verify it manually during acceptance.

## 4. Content model and layout selection

Create one pure TypeScript resolver from a checked `PublicJobDetail`, resolved
locale and translated labels into a compact `JobShareContent` model. Both captions
and image rendering use this model. Keep raw CMS data out of layout code.

Every graphic includes the job type, role title, organisation name when available,
SLK identity, a short translated invitation and the canonical job address. The
invitation points to job details; it must not imply that clicking an image applies
for the role. Sharing always links to `/jobs/{slug}`, rather than an external
application URL or contact form containing prefilled content.

### Type-specific compositions

Use three composition families with five explicit type configurations. These
change information priority and geometry, rather than merely changing a badge.

| Job type          | Composition                                                            | Priority after title/organisation               | Optional supporting content                                    |
| ----------------- | ---------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| `full_time`       | Employment: large role heading above a structured facts band           | Salary, weekly hours, start/period              | One short task excerpt if space remains                        |
| `part_time`       | Employment: emphasize time commitment in the facts band                | Weekly hours, salary, start/period              | One short task excerpt                                         |
| `internship`      | Early career: role heading plus a prominent period block               | Start/end period, weekly hours, salary when set | One task or benefit excerpt                                    |
| `working_student` | Early career: role heading plus a prominent hours/pay block            | Weekly hours, hourly wage, start/period         | One task or benefit excerpt                                    |
| `volunteer`       | Volunteering: impact/task-led central area and compact time commitment | Short task excerpt, weekly hours, start/period  | One benefit excerpt if appropriate; no employment salary panel |

Only the most useful two or three facts appear in a graphic. Captions may contain
additional concise facts, but should not copy the complete job description.

When compensation is set for a paid role, include it alongside weekly hours in
the sharepic facts band, using the same field priority as the job overview cards.
Reflow the pair together in narrow compositions; omit a missing value without an
empty placeholder or dangling separator. Keep compensation ahead of optional
excerpts when reducing content to fit the Instagram safe rectangle. If weekly
hours are absent, display compensation on its own. Preserve authored units and
currency rather than guessing a monthly or hourly basis.

### Missing fields and inconsistent data

- Trim text, collapse whitespace and treat empty strings as missing. Render text
  as escaped text, never raw HTML. Convert Markdown excerpts to plain text through
  an established parser/sanitizer path so links, list markers and markup do not leak
  into the artwork. Omit `contact_notes` and `qualifications` from the artwork in
  the initial version; they are often long or contain personal contact details.
- `role_title` is primary content. Wrap at word boundaries and support long
  unbroken words. Do not replace a missing organisation with an invented employer.
  With neither organisation nor logo, use a compact SLK-only identity row.
- For full/part-time employment and internships, use `salary` if set. For working
  students, prefer `hourly_wage`. Keep a meaningful type-appropriate alternative
  only when the preferred field is absent. If both exist, show only the preferred
  field in the image. Never relabel an hourly wage as salary or infer a pay period.
- Salary/hourly wage/hours are free-text strings. Preserve ranges, units and
  qualifiers; do not parse them as simple numbers or append guessed currencies.
  A missing compensation field never implies unpaid work. Ignore stale employment
  compensation on volunteer records; do not invent an expense allowance.
- Date fields describe the job period, not an application deadline. Format valid
  calendar dates with the selected locale without timezone day shifts. Start-only
  means “from”; an equal start/end means one date; a valid range shows both ends.
  Missing start uses translated flexible-start copy. An invalid/reversed range or
  orphaned end date omits the unreliable date fact. Do not auto-close jobs based
  on `end_date`; publication remains the source of availability.
- Collapse absent facts and excerpts; do not reserve empty salary/logo/content
  boxes. A sparse role becomes a title-led layout with the same safe areas.
- Resolve overflow in this order: remove optional excerpts, reduce fact count,
  compact spacing, reduce title size within a defined readable range. If an
  exceptional title still cannot fit, truncate at a grapheme/word boundary with an
  ellipsis; keep the full title in caption and accessible preview text. Never
  solve overflow by entering a reserved area or silently clipping text.
- Do not invent location, remote status, deadlines, requirements or benefits:
  these are not structured public job fields. Do not add AI-generated summaries.

### Locales

Add `jobs.share.*` translations in `src/directus/translations/{de-DE,en-GB,it-IT}/`
for actions, captions, facts, instructions, accessibility and error states. Reuse
existing `jobs.type.*` labels where appropriate. Use informal German `du`, proper
umlauts and colon gendering where needed.

Resolve prepared job-content translations through the established content-fetch
and translation services; reuse their German fallback and never trigger generation
from an image/crawler request. Inspect `server/utils/contentTranslationSources.ts`
when implementing this integration. The server renderer must obtain the same
resolved content as the page, rather than rendering German source into a translated
preview. Image locale is explicit (`lang`), independent of cookies. Captions and
graphics must not silently present untranslated job prose as a new translation.

## 5. Image formats and Instagram safe areas

| Format key | PNG size           | Intended use                                | Layout treatment                                                              |
| ---------- | ------------------ | ------------------------------------------- | ----------------------------------------------------------------------------- |
| `story`    | 1080 × 1920 (9:16) | Instagram Stories and manual status sharing | Vertical composition inside the safe content rectangle                        |
| `feed`     | 1080 × 1350 (4:5)  | Instagram feed and manual image posts       | Reflowed title/facts; at least 72px internal inset on every edge              |
| `link`     | 1200 × 630         | WhatsApp/LinkedIn Open Graph previews       | Compact landscape composition; title/organisation/type plus at most two facts |

These are project export presets, not a claim that every platform mandates these
dimensions. Each format gets its own composition; do not crop a Story into a link
preview or stretch one aspect ratio into another.

For the initial Story design, reserve **288px at the top, 672px at the bottom and
72px on each side**. Essential content fits within `x = 72…1008` and
`y = 288…1248`, leaving a 936 × 960 content rectangle. The bottom zone stays free
for app controls and a manually placed link sticker; the top stays free for profile
and app UI. Background color or nonessential decoration may extend to the edges.
Logos, role title, facts, address and invitation must all remain inside the content
rectangle. Do not put branding at the very top or a CTA at the canvas bottom.

These conservative margins are an explicit project design proposal, not verified
universal Instagram specifications. Meta's official
[Story image guide](https://www.facebook.com/business/ads-guide/update/image/instagram-story)
and [safe-zone help](https://www.facebook.com/business/help/980593475366490) were
login/temporarily-blocked gated during this review. Recheck them and test organic
Stories on real devices before finalizing constants. Ad, Reel and organic Story
interfaces may differ; no Reels or paid-ad acceptance is implied by this plan.

Centralize dimensions and safe-area constants in a typed configuration. Provide
an optional preview-only guide overlay for the top/bottom/side exclusions; it is
never burned into downloads. Test the exported pixels/layout bounds as well as
the scaled preview. This protects free space even when optional fields, longer
translations or unusually long titles change the composition.

Use the project's fonts and brand palette. Keep page controls theme-aware, while
the exported artwork uses one deliberate, fixed, readable brand palette independent
of the visitor's page theme. Use official light-surface logos without inversion,
preserve aspect ratios and fall back to organisation text when an asset fails.
Do not introduce a theme choice in the initial version.

## 6. Technical implementation

### Shared content and rendering

Prefer the existing server SVG-to-PNG renderer approach for all three job formats.
The preview displays the returned PNG and download/native sharing use those exact
bytes. This gives preview/export parity without duplicating layout in HTML and
SVG, and avoids browser canvas/CORS/font-export differences. No new screenshot
service, headless browser or image dependency is needed.

Build a deterministic layout pass using explicit text measurement/wrapping with
the bundled font's metrics. Verify whether the installed renderer exposes suitable
measurement; do not assume SVG text auto-wraps. Reuse existing layout utilities
where suitable and isolate any required wrapping helper. Keep geometry testable
and cap text length before layout. If reliable measurement requires a dependency,
evaluate its maintenance/security cost before adding it.

### Implementation files and integration points

| Path                                                             | Planned responsibility                                                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/frontend/shared/jobSharing.ts`                              | Typed format configuration, type-aware content selection, captions and safe-area constants                         |
| `src/frontend/server/api/public/jobs/[slug].get.ts`              | Existing published-only checked loader reused internally, including prepared translations; no duplicate CMS loader |
| `src/frontend/server/utils/jobShareImage.ts`                     | Deterministic format-specific SVG layout and PNG rendering, bounded font/logo loading, escaped text                |
| `src/frontend/server/api/public/jobs/[slug]/social-image.get.ts` | Validated image endpoint using the shared public loader and renderer                                               |
| `src/frontend/shared/jobCompensation.ts`                         | Shared compensation priority used by overview cards and share content; dialog actions live in the component        |
| `src/frontend/components/Jobs/JobShareDialog.vue`                | Accessible preview, format controls, platform actions and feedback                                                 |
| `src/frontend/pages/jobs/[slug].vue`                             | Share entry, lazy dialog integration and job-specific SEO metadata                                                 |
| `src/frontend/composables/usePageSeo.ts`                         | Narrowly permit the checked job image path alongside existing municipality images                                  |
| `src/frontend/server/utils/rateLimitConfig.ts`                   | `job-social-image`: `max: 10`, `windowSeconds: 60`                                                                 |
| `src/directus/translations/*/jobs.share.*.yaml`                  | German, English and Italian interface/caption copy                                                                 |
| `bin/test_suite/src/jobSharing.test.ts`, `flows/jobsFlow.ts`     | Content/layout unit cases and API/browser regressions, registered in the existing runner                           |

Keep election-specific layouts and behavior in Wahlcheck. Extract common share
utilities only where there is a real shared operation; any Wahlcheck migration
must retain current translations, official artwork, theme behavior and tests.

### Image endpoint, resource limits and caching

Proposed contract:

`GET /api/public/jobs/{slug}/social-image?format=story|feed|link&lang=de-DE|en-GB|it-IT`

- Default to `format=link` and `lang=de-DE` for crawlers. Validate slug against the
  existing job-route pattern. Reject unknown/duplicate parameters and non-enum
  formats/locales. Accept no arbitrary text, image URLs, dimensions or CSS.
- Call `rateLimit(event, 'job-social-image')` at the handler start. Return 404 for
  missing or unpublished jobs, and respect the same publication filters as detail
  reads. Revalidate publication before serving a renderer cache hit.
- Return `image/png`, `X-Content-Type-Options: nosniff`, bounded filenames and
  explicit cache headers. Start with at most 60 seconds public freshness to match
  job DTOs, without stale-on-error serving. Errors/404s use no-store. Document that
  third-party platform caches cannot be recalled after a job is unpublished.
- Use a bounded process cache with a proposed 64 entries / 32 MiB limit, 60-second
  expiry, single-flight rendering and at most two concurrent render tasks per
  process; reject excess work with a retryable response instead of an unbounded
  queue. Do not assume per-IP limits alone bound memory/CPU. Verify these budgets
  under the actual container limits before release.
- Key cached images/ETags on normalized resolved content, locale, format,
  template revision and logo identity. Logo cache lifetime must also be bounded
  because an existing asset can be replaced. Never cache solely by slug or trust
  a caller-supplied version as content identity. No new `date_updated` permission
  is necessary to hash the already authorized fields.
- Fetch logo assets only by IDs from the authorized organisation DTO and a fixed
  configured CMS origin. Restrict redirects, time, bytes and decoded dimensions;
  use an approved raster representation. Do not embed raw CMS SVG with external
  references or accept caller-supplied URLs. Asset failure yields readable text
  identity, not a failed graphic. No credentials enter the returned image URL.
- Bundle the needed font weights and official SLK artwork into Nitro server
  assets using the existing build convention. Disable system-font discovery and
  ensure production output includes every required asset.

### Browser state and performance

Load the sharing UI/selected image on demand. Link buttons must work while the
image is loading or after a rendering error. Preload only one selected format,
not all formats for every listed job.

Key requests by job identity, locale and format; abort obsolete requests and ignore
late responses. Retain the current decoded preview in its reserved frame while a
replacement loads, then swap atomically. During replacement, image actions remain
disabled so an old format/job cannot be shared accidentally. Revoke replaced Blob
URLs, cancel work on close/unmount and clear stale File state on navigation.

### Server-rendered link metadata

Pass a job-specific plain-text description and absolute `link` image URL through
`usePageSeo`; extend only its explicit image-path allowlist. Preserve private-route
and preview protections. Keep OG dimensions at 1200 × 630, meaningful image alt
text, canonical job URLs and crawler-readable SSR HTML without browser JavaScript.
Use an explicit metadata locale rather than making an image URL cookie-dependent.
Document the existing default-locale behavior for crawlers that receive no locale
cookie/header; do not promise the sharer's selected language survives a platform's
independent crawl of the canonical URL.

## 7. Implementation order

1. Add representative fixtures and the pure content resolver for every job type,
   sparse data and overflow. Add translations and implement the link-sharing
   dialog/actions. Validate this first increment independently.
2. Implement the three-format layout configuration, server renderer and image
   endpoint with publication checks, bounded work, rate limiting and font assets.
   Add endpoint and layout tests before wiring the preview.
3. Add lazy preview, format selection, safe-area guides, PNG download and prepared
   native file sharing. Verify cancellation and failure fallbacks.
4. Add job-specific SSR descriptions/OG images through the narrowly extended SEO
   helper. Exercise real WhatsApp/LinkedIn crawlers in authorized deployed acceptance.
5. Update `FEATURES.md` with exact implementation/test references and explicitly
   distinguish automated, partial and manual-only coverage. Record the agreed job
   artwork/safe-area decisions in `docs/DESIGN_GUIDELINES.md` in the same change.
   Update `PROJECT_DECISIONS.md` only if an architectural boundary actually changes.

No schema/policy expansion is expected. Apply new translations through the
code-first importer from the repository root:

```bash
./bin/slk stack compose --env development -- exec directus /directus/cli/import-all.sh
```

Keep Directus pinned at 11.17.4 and leave public-role permissions untouched.

## 8. Verification and acceptance

| Coverage                | Required cases                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content unit tests      | Every type; all optional fields absent/present; whitespace-only values; salary/hourly precedence and units; no inferred unpaid/remote/deadline claims; missing organisation/logo; Markdown conversion; German characters and long EN/IT copy; valid/invalid/open date ranges without timezone shifts                                                 |
| Layout/render tests     | Every format has exact PNG dimensions; important text/logo bounds stay inside safe rectangles; long-title fallback; sparse/dense cases; no guide overlay in exports; consistent fonts and brand identity; preview/download byte parity                                                                                                               |
| Endpoint/security tests | Published job succeeds; draft/missing job is 404; malformed/duplicate/unknown input is refused; no private DTO fields/credentials; markup cannot inject SVG; no arbitrary fetch/redirect; asset timeout/oversize fallback; 429 rate limit; bounded concurrent rendering; content changes regenerate; unpublished job cannot reuse a render cache hit |
| Browser integration     | Share entry, focus/Escape/restore, format selection, delayed image decode with atomic replacement, fast job/locale switches, encoded WhatsApp/LinkedIn URLs, clean canonical links, copy success/refusal, PNG download, canShare true/false, native share cancellation/rejection, retry and no-JavaScript SSR metadata                               |
| Regression protection   | Existing jobs list/detail/application-link tests; Wahlcheck Story dimensions, all-five-results safe area and theme actions; municipality OG images and private SEO allowlisting                                                                                                                                                                      |
| Manual visual checks    | Light/dark dialog at narrow/desktop sizes; keyboard focus and reduced motion; all five types × sparse/dense data in each format; readable artwork and official logos; long translated titles; real iOS/Android Instagram Story controls and a manually added link sticker                                                                            |
| Manual platform checks  | HTTPS native file handoff and download on physical iOS/Android; desktop fallback; WhatsApp and LinkedIn preview crawl/cache behavior; image/caption behavior in actual installed target apps                                                                                                                                                         |

During implementation use selected checks discovered with
`./bin/slk check ready --list`. After the complete implementation run
`./bin/slk check ready` and wait for completion; review final diff/security and
dependency findings without weakening gates or raising the Directus cap. Curl
`http://localhost:8080/jobs/{published-slug}`, its public DTO and all three image
formats; confirm draft rejection and metadata without executing JavaScript.

Native macOS/Windows and deployed acceptance need their actual environments.
Run `./bin/slk check native` there and `./bin/slk check release --target staging`
against an existing authorized target. Report unavailable checks and physical-app
verification as pending. This plan authorizes no push or deployment.

Completion means every published job has working link actions, downloadable
type-aware graphics, safe-area-compliant Story artwork and a job-specific crawler
preview, with tested fallbacks when native sharing is unavailable. A button labeled
Instagram alone does not satisfy that acceptance criterion.
