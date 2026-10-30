import { cmsRecord, cmsRows } from "~/server/utils/cmsValue";
import { z } from "zod";
import { ComparisonRatingSchema } from "~/shared/contracts/municipality";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from "@directus/sdk";
import { createError, defineEventHandler, getQuery, setResponseHeader } from "h3";
import { createDirectusServerClient } from "../../utils/directusServerClient";

/** Public comparisons only include complete, published municipal assessments. */
export default defineEventHandler(async (event) => {
  const { measureId } = getQuery(event);
  if (typeof measureId !== "string" || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(measureId)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid measure" });
  }
  const client = createDirectusServerClient();
  // The service policy also excludes draft measures and hidden catalogs.
  const measures = await client
    .request(
      readItems("measures", {
        filter: { id: { _eq: measureId }, status: { _eq: "published" }, catalog_version: { hidden: { _eq: false } } },
        fields: ["id", "catalog_version"],
        limit: 1,
      }),
    )
    .then(cmsRows);
  const measure = measures[0];
  if (!measure) throw createError({ statusCode: 404, statusMessage: "Measure not found" });
  const municipalityFields = [
    "id",
    "name",
    "slug",
    "status",
    "state",
    "party_mayor",
    "population",
    "geolocation",
    "localteam_id",
  ];
  const scores = await client
    .request(
      readItems("municipality_scores", {
        filter: {
          catalog_version: { _eq: measure.catalog_version },
          published: { _eq: true },
          percentage_rated: { _gte: 100 },
          municipality: { status: { _eq: "published" } },
        },
        fields: [
          "catalog_version",
          "published",
          "percentage_rated",
          ...municipalityFields.map((field) => `municipality.${field}`),
        ],
        limit: 10001,
      }),
    )
    .then(cmsRows);
  if (scores.length > 10000) throw createError({ statusCode: 502, statusMessage: "Comparison limit exceeded" });
  const municipalities = new Map(
    scores
      .filter((score) => cmsRecord(score.municipality ?? {}).localteam_id)
      .map((score) => [
        cmsRecord(score.municipality).localteam_id,
        {
          ...cmsRecord(score.municipality),
          scores: [
            {
              catalog_version: score.catalog_version,
              published: score.published,
              percentage_rated: score.percentage_rated,
            },
          ],
        },
      ]),
  );
  const ratings = municipalities.size
    ? await client
        .request(
          readItems("ratings_measures", {
            filter: {
              measure_id: { _eq: measureId },
              localteam_id: { _in: [...municipalities.keys()] },
              status: { _eq: "published" },
              approved: { _eq: true },
            },
            fields: ["rating", "applicable", "localteam_id"],
            limit: 10001,
          }),
        )
        .then(cmsRows)
    : [];
  if (ratings.length > 10000) throw createError({ statusCode: 502, statusMessage: "Comparison limit exceeded" });
  setResponseHeader(event, "Cache-Control", "public, max-age=60");
  return {
    ratings: parseCms(
      z.array(ComparisonRatingSchema),
      ratings.map((row) => {
        const municipality = municipalities.get(row.localteam_id);
        return {
          rating: row.rating,
          applicable: row.applicable,
          localteam_id: {
            id: row.localteam_id,
            municipality_name: municipality ? cmsRecord(municipality).name : null,
            municipality_id: [municipality],
          },
        };
      }),
    ),
  };
});
