import { ProjectMunicipalitySchema, createProjectLocationResolver } from "~/shared/projectMap";
import { pointLatLng } from "~/shared/tour";
import { cmsRows } from "~/server/utils/cmsValue";
import { z } from "zod";
import { ProjectListSchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
import { queryText, queryLimit, queryChoice } from "~/server/utils/publicQuery";
import { readItems } from "@directus/sdk";
import { defineEventHandler, getQuery, setResponseHeader } from "h3";
import { createDirectusServerClient } from "../../utils/directusServerClient";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "public, max-age=60");
  const client = createDirectusServerClient();

  const query = getQuery(event);
  const municipality = queryText(query.municipality, 200);
  const limit = queryLimit(query.limit, -1, 500, true);
  const sort = queryChoice(query.sort, ["-date_created", "date_created", "title", "-title"] as const, "-date_created");
  const articles = await client
    .request(
      readItems("articles", {
        filter: { status: { _eq: "published" }, ...(municipality ? { municipality_name: { _eq: municipality } } : {}) },
        fields: [
          "id",
          "slug",
          "title",
          "abstract",
          "author",
          "date_created",
          "municipality_name",
          "geolocation",
          "location_label",
          "state",
          "sectors",
          "can_do_autonomously",
          "is_profitable",
          "public_impact_effects",
          "ghg_savings_level",
          "profile_stage",
          "image_credits",
          { municipality: ["id", "name", "state", "geolocation"] },
          { image: ["id", "type"] },
          { organisation: ["id", "name", "logo"] },
          { measures: [{ measures_id: ["id", "measure_id", "name", "slug"] }] },
        ],
        sort: [sort ?? "-date_created"],
        limit,
      }),
    )
    .then(cmsRows);

  const projects = parseCms(z.array(ProjectListSchema), articles);
  // Only geographical facts from published municipality records enter automatic name matching.
  const needsFallback = projects.some(
    (project) => !pointLatLng(project.geolocation) && !project.municipality && project.municipality_name?.trim(),
  );
  const municipalities = needsFallback
    ? parseCms(
        z.array(ProjectMunicipalitySchema),
        cmsRows(
          await client.request(
            readItems("municipalities", {
              filter: { status: { _eq: "published" } },
              fields: ["id", "name", "state", "geolocation"],
              limit: -1,
            }),
          ),
        ),
      )
    : [];
  const resolveLocation = createProjectLocationResolver(municipalities);
  return { articles: projects.map((project) => ({ ...project, map_location: resolveLocation(project) })) };
});
