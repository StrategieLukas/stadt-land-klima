import { z } from "zod";
import { AreaSchema } from "~/shared/contracts/search";
import { parseCms } from "~/server/utils/parseCms";
import { queryText, queryLimit, queryChoice } from "~/server/utils/publicQuery";

/** Direct administrative children, with bounded queries and an allowlisted external response. */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const level = queryChoice(query.level, ["1", "2", "3", "4", "5", "6"] as const);
  const prefix = queryText(query.arsPrefix, 12);
  if (prefix && !/^\d+$/.test(prefix)) throw createError({ statusCode: 400, statusMessage: "Invalid ARS prefix" });
  const withGeo = queryChoice(query.includeGeo, ["true", "false"] as const) === "true";
  const limit = queryLimit(query.first, 200, 500);
  if (!level) return [];
  try {
    const result = await fetchStadtlandzahl("/api/areas/", {
      params: {
        level,
        limit: String(limit),
        ordering: "name",
        ...(prefix ? { ars: prefix } : {}),
      },
    });
    const parsed = parseCms(z.union([z.array(AreaSchema), z.object({ results: z.array(AreaSchema) })]), result);
    const areas = Array.isArray(parsed) ? parsed : parsed.results;
    return areas
      .filter((area) => !prefix || area.ars.startsWith(prefix))
      .map((area) => ({
        ...area,
        geo_center: undefined,
        geo_area: undefined,
        geoCenter: area.geoCenter ?? area.geo_center,
        geoArea: withGeo ? (area.geoArea ?? area.geo_area) : undefined,
      }));
  } catch {
    return [];
  }
});
