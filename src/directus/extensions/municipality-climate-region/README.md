# Municipality climate regions

Internal Directus bundle for filling missing municipality ARS identifiers and
climate-region types. It supports Directus 11.17.4; installing this extension does
not require upgrading Directus.

- Municipality creation and changes to name, state, ARS or climate region trigger a lookup.
- The daily job runs at 03:00 in the Directus scheduler's timezone.
- The collection-level flow runs the same backfill, with confirmation, for administrators only.
- Existing valid ARS and nonempty climate-region values are preserved, including concurrent edits.

## Configuration

Set the server-only variables documented in `src/directus/.env.example`:

- `SLZ_API_BASE_URL`: Stadt-Land-Zahl origin for area search and the OGC Collections API.
- `SLZ_NOMINATIM_URL`: optional self-hosted Nominatim base URL.
- `SLZ_OVERPASS_URL`: optional self-hosted Overpass interpreter endpoint.
- `SLZ_BASIC_AUTH_USER` and `SLZ_BASIC_AUTH_PASSWORD`: optional credentials for the
  explicitly configured SLZ services. Set both or neither. Do not configure
  third-party endpoints with shared private credentials.

An absent API URL skips area search and climate-region lookup. Nominatim/Overpass
fallback requires both URLs. With no service URLs, the resolver makes no network
requests. URLs must use HTTP(S), without embedded credentials, queries or fragments.
Credentials never enter frontend configuration. Redirects are rejected.

Nominatim uses the canonical [`/search` endpoint](https://nominatim.org/release-docs/latest/api/Search/)
with German result names, avoiding the deprecated `search.php` endpoint.

Area search requires one exact, reasonable municipality match. The fallback
search includes the municipality's state and Germany, then checks matching OSM
objects in one Overpass request. Ambiguous or malformed identifiers stay unresolved.
The OGC `climate-region-type` collection is queried at
`/api/collections/climate-region-type/items/?area=<ARS>&limit=2`. Its GeoJSON
`properties.area_ars` must match the exact ARS; `properties.klimaraumtyp_name`
must contain a name of at most 255 characters. Empty, ambiguous, malformed or
truncated feature collections stay unresolved. No GraphQL endpoint is used. Requests time out after eight seconds and responses are
limited to 1 MiB. Batches read 100 rows at a time; overlapping jobs and lookups are
coalesced within the Directus process. Errors are logged without upstream bodies
or credentials.

Build with `npm install` and `npm run build`, restart Directus, then apply the
checked field, private read policies, translations and manual flow from the
repository root:

```bash
docker compose -f docker-compose.yaml exec directus /directus/cli/import-all.sh
```

The frontend displays the checked climate-region field in the municipality
information card on desktop and mobile. No anonymous Directus permission or
browser CMS credential is needed.

## Verification

`npm run typecheck`, `npm run build` and `npm run validate` check this package.
`bin/test_suite/src/municipalityClimateRegion.test.ts` exercises the production
resolver with replaced transport, including matching, bounds, pagination,
concurrent edits and operation authorization. `publicNavigationFlow.ts` verifies
the real private-service API projection and responsive display. Actual external
service availability and credentials remain deployment configuration checks.
