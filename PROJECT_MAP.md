# Success project map (#481)

Open `/projects?view=map` or use the list/map controls next to the project database heading. The controls remain visible when phone filters are collapsed. Existing state, sector, organisation, tour and municipality filters apply to both views. Switching views retains the current query parameters and filters.

## Editing locations in Directus

Articles have an optional **Projektstandort auf der Karte** (`geolocation`, WGS84 Point) and **Bezeichnung des Projektstandorts** (`location_label`, trimmed text). Editors can choose a point using Directus's existing map interface and provide a public place name, such as a solar park or community centre. The existing municipality relation and municipality/state text remain available. No coordinate backfill or paid/external geocoding is required.

Location priority:

1. A valid project-level point.
2. The explicitly linked municipality's valid point.
3. A unique matching name/state in the published municipality directory, with normalized case, whitespace and Unicode.

Name-only matches must also be unique. Partial names, ambiguous towns, missing/invalid coordinates and state-only locations are not guessed. An invalid explicit municipality link is not silently replaced by a different town. Unlocated projects remain in the list, and the map reports how many filtered projects lack a usable location.

Project coordinates are optional and become public with the published project. The public article endpoint returns a checked `map_location` containing GeoJSON geometry, its source (`project` or `municipality`) and the municipality name. Municipality-derived pins are labelled as approximate. Projects sharing coordinates appear in one counted marker with links to every project. The map reuses Leaflet, the shared CARTO basemap proxy, theme handling and maintained pin asset; the overview control restores the filtered extent.

## Schema and permissions

Apply the YAML with the normal `import-all.sh` workflow. The private Frontend-Server policy gains only `geolocation` and `location_label`; the existing contributor field allowlists gain the same fields while preserving ownership/publication restrictions. Public-role permissions are unchanged. Anonymous website data continues through the checked `/api/public/articles` route, which filters published articles; automatic name matching uses only published municipality records and selects only geographical fields. The directory is indexed once per response, and is not fetched when all project locations can be resolved directly.

## Verification

- `npm run test:project-map` in `bin/test_suite`: precedence, normalized matching, ambiguous/missing/invalid geography, grouping and checked API projections/publication filters.
- `npm run test:project-map:live -- http://localhost:8082 http://localhost:8081 /absolute/path/to/directus/.env`: local-only fixtures with cleanup, a seeded published municipality with coordinates, installed map-field metadata, contributor edits with current agreement fixtures, public DTOs/draft exclusion, desktop grouping/popups/state filtering, list parity and phone controls. Tile requests use a local PNG fixture so these checks do not require third-party map availability.
- `bin/test_dev.sh`: the ordinary required regression suite.

Real tiles use the existing server-only `CARTO_BASEMAP_API_KEY` configuration, shared with rankings. Without that key, the basemap proxy returns 503; the map does not expose a key in the browser or bypass the shared proxy. Real basemap availability and visual appearance across browsers/themes remain manual checks. Map points and location names are geographic facts/place names and are not sent to automatic content translation; interface copy is supplied in German, English and Italian.
