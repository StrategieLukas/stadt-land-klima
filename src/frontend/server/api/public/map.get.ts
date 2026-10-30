import { cmsRecord } from "~/server/utils/cmsValue";
import { municipalityType } from "~/shared/municipalityClassification";
import { MapResponseSchema } from "~/shared/contracts/map";
import { parseCms } from "~/server/utils/parseCms";
import { readPublicItems } from "~/server/utils/publicItems";
import { createDirectusServerClient } from "~/server/utils/directusServerClient";
import { catalogForRequest, readMunicipalityCatalogs } from "~/server/utils/municipalityPageData";
import { defineEventHandler, getQuery, setResponseHeader } from "h3";

export default defineEventHandler(async (event) => {
  const catalogs = await readMunicipalityCatalogs(createDirectusServerClient());
  const catalogVersion = catalogForRequest(catalogs, getQuery(event).v, false);
  const scores = await readPublicItems("municipality_scores", {
    filter: {
      catalog_version: { _eq: catalogVersion.id },
      // A municipality becomes draft when its last assessment is unpublished.
      // Its public identity/progress can still appear; archived records cannot.
      municipality: { status: { _in: ["published", "draft"] }, localteam_id: { _nnull: true } },
      percentage_rated: { _gt: 0 },
    },
    fields: [
      "published",
      "percentage_rated",
      "score_total",
      "municipality.name",
      "municipality.slug",
      "municipality.geolocation",
      "municipality.municipality_type",
      "municipality.population",
    ],
  });
  setResponseHeader(event, "Cache-Control", "public, max-age=60");
  return parseCms(MapResponseSchema, {
    catalogVersion,
    scores: scores.map((score) => {
      const complete = score.published === true && Number(score.percentage_rated) >= 100;
      const municipality = cmsRecord(score.municipality);
      return {
        published: complete,
        percentage_rated: score.percentage_rated,
        score_total: complete ? score.score_total : null,
        municipality: {
          name: municipality.name,
          slug: municipality.slug,
          geolocation: municipality.geolocation,
          municipality_type: municipalityType({
            population: typeof municipality.population === "number" ? municipality.population : null,
            municipality_type:
              typeof municipality.municipality_type === "string" ? municipality.municipality_type : null,
          }),
        },
      };
    }),
  });
});
