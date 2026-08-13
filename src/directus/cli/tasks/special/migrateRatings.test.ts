import assert from "node:assert/strict";
import test from "node:test";

import { buildNewRatingUpdate, SUPERSEDED_RATING_UPDATE } from "./migrateRatings.mjs";

const oldRating = {
  internal_note: "Internal note",
  status: "published",
  applicable: true,
  why_not_applicable: null,
  rating: 3,
  current_progress: "The bike lane has been completed.",
  source: "https://example.org/source",
};

test("preserves source and current progress when a measure must be rated again", () => {
  assert.deepEqual(buildNewRatingUpdate(oldRating, true), {
    internal_note: oldRating.internal_note,
    current_progress: oldRating.current_progress,
    source: oldRating.source,
  });
});

test("preserves the complete rating when no new rating is required", () => {
  assert.deepEqual(buildNewRatingUpdate(oldRating, false), {
    internal_note: oldRating.internal_note,
    current_progress: oldRating.current_progress,
    source: oldRating.source,
    status: oldRating.status,
    applicable: oldRating.applicable,
    why_not_applicable: oldRating.why_not_applicable,
    rating: oldRating.rating,
  });
});

test("marks superseded ratings as drafts", () => {
  assert.deepEqual(SUPERSEDED_RATING_UPDATE, { status: "draft" });
});
