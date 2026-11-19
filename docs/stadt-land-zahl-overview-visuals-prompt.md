# Stadt.Land.Zahl interactive municipality overview — backend handoff

This replaces the earlier request for **static overview images**. The website now
implements a product picker, metric selector, regional filters, municipality search,
vector choropleth, and interactive histograms against the version 1 contract below.
Existing `overview_visuals` fields remain backward compatible. This document is a
handoff: the backend endpoints and publication derivatives are **not implemented in
this frontend repository**. The separately authorized threshold-first API reader
fix is recorded in `docs/patches/threshold-first-overview-colors.patch`; no
publication pointer or pipeline/controller state was changed.

The source repository is `jakobkrieger/stadt-land-zahl` on `ssh slk-data2`, inspected
at `8eb2cce`. Rebase the implementation on its current revision. The relevant source
is `src/apps/api/data_product_registry.py`, `types.py`, `collections_views.py`, the
publication readers, and native Dagster manifest/derivative assets. The repository's
SandDance application is not the website frontend.

## Executable wire contract

[municipality-overview.v1.json](contracts/municipality-overview.v1.json) contains JSON
Schemas for the overview, histogram, municipality-list and region replies, plus a
complete overview/histogram example. It is generated from the website's checked
Zod contracts. `bin/test_suite/src/municipalityOverview.test.ts` checks that the
handoff and frontend schemas still agree.

Regenerate after a coordinated contract change, from the repository root:

```sh
node --import ./bin/test_suite/node_modules/tsx/dist/loader.mjs bin/test_suite/src/overviewContract.ts --write
```

The example includes two metrics to demonstrate that neither API nor UI is limited
to one. Its numbers and municipalities are test fixtures, not scientific results.

All paths below are **upstream paths**. The website prefixes these with
`/api/stadtlandzahl`; credentials remain private in Nuxt. Return absolute URLs on
the configured upstream origin: the existing proxy rewrites these to website URLs.
Already-proxied example URLs in the JSON contract illustrate the browser's view.
Never return a different host, another collection, arbitrary navigation URLs, or
links without the correct `snapshot` query parameter.

## Product configuration

Add typed dataclasses for a collection's optional `municipality_overview`:

```ts
{
  default_metric_id: string;
  metrics: Array<{
    id: string;
    value_plot_id: string;
    histogram_plot_id: string;
    default_color_mode: "score" | "continuous";
    color_modes: Array<"score" | "continuous">;
  }>;
}
```

Add an optional object to `HistogramElement`:

```ts
interactions: {
  reveal_municipalities: {
    metric_id: string;
    selection: "whole_bin";
  }
}
```

Validate references during registry loading: the plots must describe the same
municipal value, unit, percentage representation, population normalization and
cohort. IDs are stable machine identifiers, not localized labels. Metric metadata
comes from the referenced plots; do not establish duplicate editorial descriptions.

Serialize `interactions` and the injected `data_url` in collection detail, full
render and lazy element-render replies. Without the object a histogram stays
non-interactive. The website routes all maintained histogram render paths through
the same wrapper.

Advertise capabilities only once a usable verified projection exists. Collection
index/manifest and metadata-only detail replies add only:

```json
{ "municipality_overview": { "contract_version": 1, "default_metric_id": "power" } }
```

Keep municipality rows, geometry, runtime chart data and expanded metric metadata
out of the slim manifest.

### Initial registry entries

Use each product's existing verified comparison cohort, field definitions and
normalization. There is one distinct configured metric per listed product today;
the schema supports additional metrics without frontend changes.

| Collection                 | Suggested stable metric ID | Existing KPI / histogram              |
| -------------------------- | -------------------------- | ------------------------------------- |
| `wind-turbines`            | `power`                    | `kpi-power` / `histogram-power`       |
| `solar-plants`             | `power`                    | `kpi-power` / `histogram-power`       |
| `rooftop-solar-plants`     | `power`                    | `kpi-power` / `histogram-power`       |
| `balkonkraftwerk`          | `power`                    | `kpi-power` / `histogram-power`       |
| `batteriespeicher`         | `capacity`                 | `kpi-capacity` / `histogram-capacity` |
| `ev-charging-stations`     | `power`                    | `kpi-power` / `histogram-power`       |
| `public-transport-scores`  | `velocity`                 | `kpi-velocity` / `histogram-velocity` |
| `cycleway-infrastructure`  | `ratio`                    | `kpi-ratio` / `histogram-ratio`       |
| `stadtlandklima`           | `score`                    | `kpi-score` / `histogram-score`       |
| `traffic-calmed-downtown`  | `calming`                  | `kpi-calming` / `histogram-calming`   |
| `town-greenness`           | `ndvi`                     | `kpi-ndvi` / `histogram-ndvi`         |
| `bike-and-ride-capacities` | `bnr`                      | `kpi-bnr-score` / `histogram-bnr`     |

Do not expose unlisted prerequisites or invent scalar comparisons for raster,
categorical or other unsuitable products. Do not expand eligibility or combine
overlapping municipal and municipal-association administrative levels.

## Endpoints

### `GET /api/collections/{slug}/overview/`

Parameters: optional `metric`, `scope`, `lang`. Defaults are the registry's metric,
`DE` (Germany), and the existing API language default. Other scopes are canonical
string ARS values for states/districts. Preserve leading zeroes. The website sends
`en-US` for its `en-GB` locale; support `de-DE`, `en-US` and `it-IT` for new labels.

Return the exact overview shape in the JSON contract:

- `contract_version: 1`, collection ID, `status: available|no_data`, opaque
  `snapshot_id`, selected `metric_id`, and all configured runtime metric descriptors.
- Scope ARS/name and `state_ars` (null for Germany, the state's own ARS for a state,
  and its containing state for a district).
- Cohort `eligible_count`, `included_count`, `missing_count`, `excluded_count`, and
  a nullable `stats.median` in the same display-value units as map/list/histogram.
- Map tile URL template, WGS84 `[west,south,east,north]` bounds, zoom range and
  explicit no-data color. Tiles use the fixed source layer `municipalities`.
- An ordinary histogram render element with `data_url`, `vegalite_spec` and the
  opt-in interaction object. Its feed URL must pin this same snapshot.
- Snapshot-pinned `links.municipalities` and `links.regions`.
- Localized plain-text attribution, nullable update date, verification status and
  a localized `quality_label` explaining partial or qualified coverage.

Runtime metric descriptors explicitly specify precision,
`percentage_representation: none|fraction|percent` and
`normalization: {basis: none|population, per: number|null}`. Do not normalize twice.
Percentage fractions and percentage points are different representations; threshold
magnitudes must not be used to guess between them.

Available color modes require their scale definitions. Project-defined score
thresholds take precedence; relative quintiles are only the fallback when no
thresholds are configured. Score mode supplies ordered `{id,label,color}` classes.
Tiles expose the persisted fixed `score_class`, falling back to the persisted
`quintile_color` only when that score is absent. Continuous mode supplies strictly
increasing numeric `{value,color}` stops, with palette orientation already
reflecting the product's meaning. Use valid six-digit hex colors. Both map modes
operate on the same numeric metric, not different measures.

Histogram feeds preserve their original relative `segments`. Where configured
thresholds exist, they additionally return `score_segments` with `score_color`,
`bin_index`, `segment_count` and the existing display bounds. Counts are grouped
from exact persisted snapshot memberships and score labels, never from bin
midpoints or interpolated membership. Each bin's score counts must conserve its
original count and every score label must belong to the declared palette. The
render element explicitly selects `score_segments` and `score_color`; without
thresholds it keeps the original quintile segments. Existing consumers can keep
reading `segments`. Detail-context fallback retains its own existing peer
quintiles; overview fallback keeps its national quintile boundaries.

For the overview, freeze national numeric bin boundaries, configured score/quintile boundaries and
continuous color domains for the snapshot. Regional filters restrict cohort rows
and recount bins; they do not rebin or rescale. Map pan/zoom has no effect on scope,
bins or counts. `no_data` scopes still return usable geography, metadata and empty
histogram data so search and no-data explanations remain available.

### `GET /api/collections/{slug}/overview/tiles/{z}/{x}/{y}.pbf`

Required parameter: `snapshot`. Return bounded, zoom-simplified MVT from the pinned
projection and territorial catalogue. Preserve one stable string `ars` feature ID
across clipped tile fragments; the website uses `promoteId: ars`.

Properties include `ars`, `name`, `prefix`, `slug`, `state_name`, optional
`district_name`, `data_status`, numeric `value` when present, `score_class` when
scored, and `bin_index` for values included in the distribution. `data_status` is
`available`, `no_data` or `excluded`. MVT's absent null properties are fine; never
substitute zero. Draw the same non-overlapping territorial representation used by
the verified cohort, with missing/excluded coverage shown distinctly.

The client highlights by `bin_index`, so all matching polygons are highlighted
even when only the first municipality-list page is loaded. No client-side
membership calculation or full-country geometry download is needed.

Use PostGIS and the published projection, bounded tile coordinates/zoom, and
zoom-dependent simplification. Cache internal results by immutable edition,
metric-definition/geometry/bin identities, scope and tile coordinates. Do not
truncate features to satisfy a byte budget. Preserve legitimate tiny areas at
useful zoom levels and allow overzooming; test boundary fragments and enclaves.

### `GET /api/collections/{slug}/overview/municipalities/`

Required `snapshot`; optional `bin_index`, `q`, `cursor`, `limit`. This is the
shared histogram-member and municipality-search endpoint.

- Default limit 50, maximum 100; reject invalid parameters. Bound search text to
  200 characters. Stable ordering is municipality name followed by ARS.
- A bin selects its **entire column**, including all colored segments.
- `q` narrows the selected scope/bin, using the existing indexed name-search
  infrastructure where possible. Without a bin, search includes no-data areas.
- Bind opaque cursors to snapshot, scope, metric, bin and query. Reject tampering,
  cross-context reuse and invalid/repeated pagination. Use stored exact membership.
- Return `{snapshot_id,count,results,next_cursor}`; count is the full filtered
  result count, not the page size. Each result has the row shape in the JSON
  contract. `value` uses the same normalization and precision basis as the chart.
- `slug` must resolve through the existing area-detail resolver. Disambiguate
  duplicate names with a stable ARS suffix and extend resolution accordingly.
  The frontend constructs `/data/{slug}#{collection}` locally, opening the municipality data page at that product section. Standalone product routes remain available for existing links.

The website provides direct links on desktop map clicks, a tap preview with an
explicit link on touch devices, and links in search/results. Missing data must not
make a legitimate municipality's detail route inaccessible.

### `GET /api/collections/{slug}/overview/regions/`

Required `snapshot`, `level=state|district`; optional `parent_ars` for districts.
Return `{snapshot_id,results}` with all available filter options at that level
(maximum 1,000), each containing ARS, name, level, parent ARS and WGS84 bounds.
Use the snapshot's frozen containment catalogue, never today's mutable geography.
All Germany's states and a state's districts fit this bounded response.

### Existing `GET /api/collections/{slug}/histogram/`

Add `metric`, `scope` and `snapshot` support without removing `field`, `parent_area`,
`area` or existing response fields. New overview callers pin metric and snapshot;
new detail render feeds must also identify their configured metric explicitly.
Every interactive `data_url`, including detail-page feeds, must contain exactly
one `snapshot` parameter matching the response interaction context. The frontend
rejects missing or different snapshot identities. Legacy non-interactive clients
can continue omitting it.
Retain detail charts' existing national/state cohort and municipality marker.

For interactive replies add the selected runtime `metric` descriptor and:

```ts
interaction_context: {
  snapshot_id: string;
  metric_id: string;
  members_url: string; // same-collection overview/municipalities/?snapshot=...
}
```

Keep exact `bins` and `segments`. Each bin retains `bin_index`, nullable `lower` and
`upper`, localized `display_label`, `count`, and existing richer fields. Every
colored segment carries the original `bin_index`. Name the Vega-Lite **bar chart
layer** `municipality-histogram-bars`; compiled Vega marks are then named
`municipality_histogram_bars_marks`. Do not give this name to text, axes, markers
or backgrounds. The client only accepts clicks from these bar marks.

The wrapper fetches and validates this feed once, then replaces exact matching
`data.url` references with inline `bins` or `segments` according to
`data.format.property`. Keep that property explicit. It preserves the original
specification, marker, labels and exports; it never reconstructs bins from labels.

The snapshot identity includes the actual bin definition and scope. Thus an
existing state comparison and the new nationally binned overview cannot be mixed.
Preserve special zero, underflow, overflow, inclusive final-edge, missing and
excluded categories. Do not silently fall back to an unrelated live table or
recalculate normalization from today's population.

## Publication, errors and rollout

A snapshot binds source publication IDs, verification identity, geography catalogue,
metric-definition version, normalization, eligibility, scope and exact binning and
membership. Build its municipal projection through the existing native derivative
workflow and publish only checked products. HTTP reads must not start ingestion,
scientific recomputation or publication jobs.

Recheck product visibility/publication eligibility on **every** context, tile,
region and membership request, including cached artifacts. Preserve existing
publication-aware HTTP `no-store` restrictions. Internal cache keys must include
all immutable identities and may not bypass withdrawal. Never make immutable
public HTTP cache promises that defeat revocation.

Use JSON errors with a stable `code`:

| HTTP | Meaning                                                   |
| ---- | --------------------------------------------------------- |
| 400  | Invalid or unknown metric/scope/parameters/bin/cursor     |
| 404  | Unknown or hidden collection                              |
| 409  | `snapshot_unavailable`: expired/unservable pinned context |
| 503  | Required verified publication/projection unavailable      |
| 200  | A valid empty scope, explicitly marked `no_data`          |

The website refreshes an unservable context once, clears its bin selection and
announces the update. It must never display old map data beside a new histogram.

Extend OpenAPI with complete JSON reply schemas, query parameters, errors and the
binary MVT content type. Preserve old render, item, histogram-ID and collection
clients. Do not upgrade Directus or edit website public-role permissions.

After **any registry configuration change**, rebuild
`collections_index_slim_manifest` through the shared native Dagster queue, verify
`manifest_integrity`, and confirm the resulting edition is published and served
by `/api/manifests/collections-index`. This includes render-only interaction edits.
Follow the remote AGENTS.md publication, scientific identity and storage guards.
No deployment or push is included. Build the required derivatives and refresh the
manifest through the native publication workflow described above.

## Backend acceptance required before enabling capability

1. Compare map value/bin IDs, histogram counts and all paginated members for every
   initial product, nationally and for representative states/districts. Sum all
   list pages and compare against the selected column, not a rounded range query.
2. Test percentages as fractions and points, per-capita normalization, negative and
   zero values, missing population, exact bin edges, underflow/overflow, partial
   coverage and empty scopes. Retain the battery complete-case policy.
3. Exercise a two-metric product fixture, reversed score direction, absent
   interactions, invalid plot references and unchanged legacy render responses.
4. Change publication/visibility between context, tile and member requests; verify
   pinned consistency, fail-closed withdrawal, snapshot expiry and cursor binding.
5. Test native tile output, tiny municipalities, tile-edge duplicates, all-member
   highlight with a paginated list, and bounded cold/warm national responses.
6. Exercise duplicate municipality names and verify the supplied slug opens the
   correct area/product through the website resolver.
7. Confirm new API links pass through the website's proxy without duplicated
   prefixes, upstream credentials in browser state, unexpected hosts or redirects.
8. Record backend commands, passing/failed cases, native publication editions,
   manifest-integrity/publication evidence and real HTTP samples. Mock frontend
   tests establish UI/contract behavior, not scientific parity or live delivery.

## SSR and conditional delivery follow-up

The website now server-renders overview controls, coverage, legends and histogram
bin controls, and hydrates their checked data without repeating those reads.
Municipality pages deliver the product catalogue and anchors in their initial
HTML, preload the first product, and prioritize a client-side product fragment.
Fragments are not sent in HTTP requests; no special backend fragment endpoint is
required. Existing standalone product pages preload metadata/render/summary in
parallel. Maps and Vega canvases remain client-only with reserved dimensions.

For publication-backed public JSON reads (collection catalogue/metadata,
render/summary, overview, histogram and regions), support ETag or Last-Modified
conditional GET where the publication policy allows it. Include metric, scope,
locale, publication, geometry, membership and definition identities in validators
as applicable. Check collection visibility, verification and snapshot availability
**before** returning 304. Withdrawal must return 404; invalidated snapshots must
return 409, never 304. Return no-store whenever required, including incomplete
freshness verification; it takes precedence over an otherwise immutable snapshot.

The website's optional server cache only accepts explicitly public, validated
JSON responses with a positive cache lifetime and a validator. It retains at most
128 entries / 8 MiB (1 MiB per entry), for at most 60 seconds, keys by upstream,
query, representation and private service identity, and revalidates before every
reuse. It does not cache municipality searches/member lists, errors, private
responses, Set-Cookie responses, or unrecognized Vary representations. It never
serves stale data on error. Existing binary tile delivery is unchanged. The live
overview currently returns no-store, so shared overview body reuse remains
inactive until publication policy explicitly permits it. The separately authorized API reader fix was applied on slk-data2 with a
graceful API-worker refresh; no container build or pipeline deployment was used.

## Balcony-solar KPI threshold review

The inspected registry defines the same fixed thresholds for its KPI and
histogram: orange 1, yellow 50, light green 200 and dark green 500 kW per 1,000
residents. These are targets, not national quintiles. The checked overview snapshot
`eb938147b252ba8381908b2b4de4bd39d3e9271cbe85621d115dac5a9f8e25d4`
has 3,298 included municipalities, median 16.4747 and maximum 33.7859 in those
same units. Thus orange coverage is expected under the existing targets; the old
green histogram colors described relative ranks instead.

The source is MaStR `Nettonennleistung`, aggregated in kW and normalized once by
population. It must not be confused with module peak power or device count.
For context, the [Bundesnetzagentur's plug-in solar guidance](https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/ErneuerbareEnergien/Solaranlagen/start.html)
distinguishes the simplified-registration limits of 800 VA inverter power and
2,000 W module power; these are installation limits, not municipal score targets.

A proposed **editorial target scale**, pending owner approval, is 1 / 10 / 20 / 40
kW per 1,000 residents. It keeps fixed, rounded milestones, makes green reachable
for current higher-adoption municipalities and reserves dark green as a stretch
target beyond the current overview maximum. It is neither an official climate
benchmark nor an automatically recalculated distribution score. Expressed only as
an illustration using 0.8 kW per device, the green thresholds correspond to 25 and
50 devices per 1,000 residents; actual device ratings vary. No threshold values
were changed. A registry change must update the KPI and histogram together,
refresh and verify the collection manifest through the native queue, and rebuild
any affected frozen overview projections before reporting activation complete.
