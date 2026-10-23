import { cmsRecord, cmsString, cmsRows } from "~/server/utils/cmsValue";
import { z } from "zod";
import { NumericSchema } from "~/shared/contracts/municipality";
import { parseCms } from "~/server/utils/parseCms";
import { queryText } from "~/server/utils/publicQuery";
import { readItems } from "@directus/sdk";
import { defineEventHandler, getQuery, setResponseHeader } from "h3";
import { createDirectusServerClient } from "../../utils/directusServerClient";
import { readMunicipalityCatalogs, catalogForRequest } from "../../utils/municipalityPageData";
const MeasureReferenceSchema = z.object({ id: z.string(), name: z.string().nullable(), sector: z.string().nullable() });
const PublicRatingSchema = z.object({
  measure_id: MeasureReferenceSchema.nullable(),
  rating: NumericSchema,
  applicable: z.boolean().nullable(),
});

const ratingFields = ["measure_id", "rating", "applicable"];

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "public, max-age=60");
  const client = createDirectusServerClient();
  const query = getQuery(event);

  const municipalitySlug = queryText(query.municipalitySlug);
  const requestedTeam = queryText(query.localteamId, 100);
  const measureId = queryText(query.measureId, 100);
  const catalogs = await readMunicipalityCatalogs(client);
  const selectedCatalog = catalogForRequest(catalogs, query.v, false);

  // Require a published municipality/localteam to look up ratings
  if (!municipalitySlug && !requestedTeam) {
    return { ratings: [] };
  }

  let localteamId: string | undefined;

  if (municipalitySlug) {
    const municipalities = await client
      .request(
        readItems("municipalities", {
          filter: { slug: { _eq: municipalitySlug } },
          fields: ["localteam_id.id"],
          limit: 1,
        }),
      )
      .then(cmsRows);
    const teamId = cmsRecord(municipalities[0]?.localteam_id ?? {}).id;
    localteamId = teamId === undefined ? undefined : cmsString(teamId);
  } else {
    localteamId = requestedTeam;
  }

  if (!localteamId) {
    return { ratings: [] };
  }

  const publishedScores = await client
    .request(
      readItems("municipality_scores", {
        filter: {
          municipality: { localteam_id: { _eq: localteamId }, status: { _eq: "published" } },
          catalog_version: { _eq: selectedCatalog.id },
          published: { _eq: true },
        },
        fields: ["id"],
        limit: 1,
      }),
    )
    .then(cmsRows);
  if (!publishedScores.length) return { ratings: [] };

  const filter: Record<string, unknown> = {
    localteam_id: { _eq: localteamId },
    measure_id: { catalog_version: { _eq: selectedCatalog.id }, status: { _eq: "published" } },
    status: { _eq: "published" },
    approved: { _eq: true },
  };

  if (measureId) {
    filter.measure_id = {
      _and: [
        { catalog_version: { _eq: selectedCatalog.id } },
        { status: { _eq: "published" } },
        { id: { _eq: measureId } },
      ],
    };
  }

  const ratings = await client
    .request(
      readItems("ratings_measures", {
        filter,
        fields: [...ratingFields, "measure_id.id", "measure_id.name", "measure_id.sector"],
        limit: 500,
      }),
    )
    .then(cmsRows);

  const result = parseCms(z.array(PublicRatingSchema), ratings).map((row) => ({ ...row, measure: row.measure_id }));
  return { ratings: result };
});
