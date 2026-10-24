import { queryText } from "~/server/utils/publicQuery";
import { z } from "zod";
import { AreaSchema } from "~/shared/contracts/search";
import { parseCms } from "~/server/utils/parseCms";
/**
 * GET /api/area-ancestors?ars=<ars>
 *
 * Proxies to GET /api/areas/{ars}/ancestors/ on the stadtlandzahl backend.
 * Returns { ancestors: AncestorArea[] } ordered Bundesland → Kreis.
 * Routing through a server route ensures SSR uses the Docker-internal URL.
 */

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const ars = queryText(query.ars, 12);
  if (ars && !/^\d+$/.test(ars)) throw createError({ statusCode: 400, statusMessage: "Invalid ARS" });
  if (!ars) return { ancestors: [] };

  try {
    return parseCms(
      z.object({ ancestors: z.array(AreaSchema) }),
      await fetchStadtlandzahl(`/api/areas/${encodeURIComponent(ars)}/ancestors/`),
    );
  } catch {
    return { ancestors: [] };
  }
});
