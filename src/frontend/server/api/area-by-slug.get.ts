import { AreaSchema } from "~/shared/contracts/search";
import { parseCms } from "~/server/utils/parseCms";
import { queryText, queryChoice } from "~/server/utils/publicQuery";
/**
 * Resolves a URL slug like "stadtkreis-karlsruhe" to a full area object
 * via the REST areas endpoint.
 *
 * geo_area (the boundary polygon) is stripped by default — it can be many MB
 * for Germany or states, and is only needed client-side. Pass includeGeo=true
 * to get it (e.g. for the sticky map panel on Kreis/Gemeinde pages).
 * Nearby map lookups also pass requireGeo=true so upstream and missing-geometry
 * failures are returned as errors instead of empty successful responses.
 *
 * The REST API accepts the same slugified prefix-name form directly, so a
 * single request replaces the old multi-step GraphQL search loop.
 */

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const slug = queryText(query.slug) ?? "";
  const requireGeo = queryChoice(query.requireGeo, ["true", "false"]) === "true";
  const geometryOnly = requireGeo || queryChoice(query.geometryOnly, ["true", "false"]) === "true";
  const includeGeo = geometryOnly || queryChoice(query.includeGeo, ["true", "false"]) === "true";
  if (!slug.trim()) {
    if (requireGeo) throw createError({ statusCode: 400, statusMessage: "Area identifier is required" });
    return null;
  }

  try {
    const data = parseCms(
      AreaSchema,
      await fetchStadtlandzahl(`/api/areas/${encodeURIComponent(slug)}/`, {
        params: geometryOnly ? { geometry_only: "true" } : undefined,
      }),
    );
    if (requireGeo && !data?.geo_area && !data?.geoArea) {
      throw createError({ statusCode: 502, statusMessage: `Geometry missing for area ${slug}` });
    }
    if (!includeGeo && data && typeof data === "object") {
      return { ...data, geo_area: undefined, geoArea: undefined };
    }
    return data;
  } catch (error) {
    if (requireGeo) throw error;
    return null;
  }
});
