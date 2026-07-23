# Score and rank recalculation triggers

This extension stores one `municipality_scores` row per municipality and measure
catalog version. A score recalculation can therefore target either one
municipality/catalog pair or every municipality in one catalog version. Ranks
are relative, so every score change is followed by a rank update for all
`municipality_scores` rows in the affected catalog version.

## Active triggers

| Event | Status | Score recalculation scope | Rank scope | Notes |
|---|---|---|---|---|
| Directus extension startup | Existing | All municipalities, for every catalog version | Every catalog version | Also creates the initial score rows if the table is empty. |
| Create a published `measure` | Existing, refined | All municipalities for the new measure's catalog version | That catalog version | Creates only missing `ratings_measures` rows. Creating a draft measure does not recalculate. |
| Publish an existing `measure` | Existing, refined | All municipalities for the measure's catalog version | That catalog version | Re-enables existing rating rows and creates missing ones without duplicating them. |
| Change any field of a currently or previously published `measure` | Added | All municipalities for every affected catalog version | Every affected catalog version | This includes weight and sector changes. If the same update moves a published measure between catalog versions, both the catalog version captured before the update and the newly assigned version are recalculated. Changes to a measure which was and remains a draft do not recalculate. |
| Unpublish a published `measure` | Added | All municipalities for the catalog version ID captured before the update | That catalog version | The ID normally remains unchanged. Capturing it before the update also covers an update that moves and unpublishes the measure at the same time. Both `draft` and `archived` transitions are covered. |
| Delete a published `measure` | Added | All municipalities for the catalog version ID captured before deletion | That catalog version | The version itself does not change during deletion; it must be captured because the measure row is unavailable afterward. |
| Create a `ratings_measures` row | Existing, refined | The affected municipality/catalog pair; every distinct pair in a bulk create is handled | Each affected catalog version | Normally used by setup/import paths. Measure publication creates rows silently and performs one catalog-wide recalculation instead. |
| Change `rating`, `applicable`, or `approved` on `ratings_measures` | Existing, refined | The affected municipality/catalog pair; every distinct pair in a bulk update is handled | Each affected catalog version | Rank updates remain catalog-wide because one municipality's new score can change every published municipality's rank. |
| Change `published` on `municipality_scores` | Existing | No score recalculation | The affected catalog version | Also synchronizes the parent municipality's published/draft status. |

Catalog-wide recalculation also resets totals and every known sector score to
zero when no published measures remain, or when the final published measure of
a sector is removed.

## Removed or intentionally non-triggering paths

| Event/path | Current treatment | Reason |
|---|---|---|
| `unpublishedMeasure` Directus flow | Removed | It copied `measure_published: false` to every rating row. The measure hook now owns the single catalog-wide recalculation, so the flow was redundant and caused unnecessary bulk writes. |
| `ratings_measures.measure_published` | Compatibility field, potentially obsolete | Score queries also verify the related measure's live `status`. Existing false values are restored when a measure is republished, but changing the flag alone does not trigger scoring. |
| Non-scoring `ratings_measures` fields such as progress text, source, notes, choices, or status | No recalculation | The score formula does not read these fields. Before this change every rating-row update recalculated a score unnecessarily. |
| Delete a `ratings_measures` row | No recalculation trigger | Normal measure deletion removes these rows by cascade and is covered by the measure delete trigger. Individual rating deletion is not part of the supported editing workflow. |
| Create, change, or delete a measure which was and remains unpublished | No recalculation | Unpublished measures are excluded from every score formula. |

## Root cause of the missed recalculations

Commit `81ce533a` introduced the TypeScript version of the measure handler with
an optimization that returned unless the action payload explicitly contained
`status: published`. Directus update payloads only contain changed fields.
Consequently, changing a published measure's weight had no `status` field, and
unpublishing contained `status: draft`; both paths returned without
recalculating. No measure delete action was registered either.

The current handler captures the old measure status and catalog version before
updates/deletes, reads the persisted state after updates, and recalculates each
affected catalog version once.

The original rating handler also treated
`localteam_id.municipality_id` as a single ID, although Directus returns this
one-to-many alias as an array, and it inspected only the first row of a bulk
rating update. The rating handler now normalizes that ID array and groups every
changed row by municipality and catalog version.
