# Ratings import and export

## Importing edited ratings

Use the shared **Ratings – Import/Export** bookmark in the `ratings_measures`
collection (German: **Bewertungen – Import/Export**). Open Import/Export, choose
JSON, and check the filter and export limit. The bookmark defaults to 50 rows;
set the limit to `-1` when all filtered ratings are needed.

The exported fields are `id`, `measure_id`, `localteam_id`, `status`,
`applicable`, `why_not_applicable`, `rating`, `current_progress`, `source`, and
`internal_note`. Relations are exported as UUID strings. Approval, derived
fields, interface-only fields, and audit metadata are excluded.

Keep the existing `id` unchanged. Edit the assessment fields and import the
JSON array into `ratings_measures`. The native importer updates an existing
row by its primary key. It can also create rows if the ID does not exist, so
use IDs from an export of the same backend. Imports require the existing
Directus create/update permissions; the bookmark does not grant permissions.
In particular, the local-team assessment policy only grants updates, so its
users cannot use the native bulk importer. An administrator performs this
workflow; no additional access to linked measures is needed with UUID relations.

For updating existing rows, both relation fields can be omitted altogether.
They are useful context in an export, but should not be edited. Never replace
them with objects containing measure codes, names, or catalog descriptions:
Directus treats objects as nested writes rather than lookups by these fields.

Minimal update example (replace the illustrative UUID with an exported ID):

```json
[
  {
    "id": "4c94bebf-6350-450d-af4d-0f6877b42282",
    "status": "draft",
    "applicable": true,
    "why_not_applicable": null,
    "rating": "0.25",
    "current_progress": null,
    "source": "https://example.org/evidence",
    "internal_note": "Preliminary assessment"
  }
]
```

`rating` accepts `"0"`, `"0.25"`, `"0.5"`, `"0.75"`, `"1"`, their numeric
equivalents, and JSON `null`. The database stores non-null ratings as strings.
The string `"null"` and other numeric values are invalid. `status` accepts
`draft` and `published`. Keep preliminary assessments in `draft`.
An omitted field retains its existing value; an explicit `null` clears a
nullable field. Additional form requirements still apply when editing in
Directus, such as providing a progress description for a rated measure.

## Shared export field selection

Directus 11.17.4 initializes the export field selection from the active layout
query's `fields`. It does not expose a separate export-only global preset.
The shared bookmark is a native global preset (`user: null`, `role: null`) and
therefore supplies the same export field selection to every user who opens it,
subject to their read permissions. The regular rating layout remains available.
Personal and role-specific default layouts take precedence over global defaults;
opening this bookmark explicitly selects the import/export layout.

Sources: [export dialog implementation](https://github.com/directus/directus/blob/v11.17.4/app/src/views/private/components/export-sidebar-detail.vue),
[nested relation handling](https://github.com/directus/directus/blob/v11.17.4/api/src/services/payload.ts),
[native importer](https://github.com/directus/directus/blob/v11.17.4/api/src/services/import-export.ts),
[preset priority](https://docs.directus.io/user-guide/settings/presets-bookmarks).

## Bernau diagnosis (2026-09-30)

All three supplied files contain 37 ratings. The successful Eberswalde file
uses scalar UUIDs for `measure_id` and `localteam_id`. Both Bernau files instead
contain relations shaped like this:

```json
{
  "measure_id": {
    "measure_id": "EN_01",
    "catalog_version": { "name": "v1.0" }
  },
  "localteam_id": { "municipality_name": "Bernau bei Berlin" }
}
```

None of these objects contains the related collection's primary key `id`.
Directus therefore attempts to create linked measures, catalogs, and localteams.
The reported required `description_about`, `description_evaluation_criteria`,
`description_verification`, and `name` fields belong to those collections, not
to a new rating import schema. Adding these fields would create unwanted
related records instead of fixing the import.

The filled Bernau file also uses numeric ratings. The previous `_in`
validation enumerated strings and null only; Directus validates membership
without converting numeric values to strings. The YAML now explicitly allows
both representations of the same five ratings. JSON null was already allowed.
Git history does not show a rating-validation change between the reported
Eberswalde import on 2026-09-08 and the Bernau export on 2026-09-29. The actual
configuration and version of that earlier importing backend cannot be
established from the supplied files alone.

The repaired Bernau file keeps the 37 existing rating IDs and assessment
fields, omits the nested relations and metadata, and canonicalizes numeric
ratings to strings. It can update the existing Bernau ratings without creating
linked content. Its assessments and sources have not been fact-checked.
