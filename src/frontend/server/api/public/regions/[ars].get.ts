import { AreaSchema } from "~/shared/contracts/search";
import { MunicipalityOverviewSchema } from "~/shared/contracts/municipalityOverview";
import { RegionMunicipalitiesResponseSchema } from "~/shared/contracts/regionMunicipalities";
import { checkedOverviewUrl, overviewEndpoint } from "~/utils/municipalityOverview";
import { loadRegionMunicipalities, regionMapBounds, regionSelection } from "~/utils/regionMunicipalities";
import { rateLimit } from "~/server/utils/rateLimit";
import { fetchStadtlandzahl } from "~/server/utils/stadtlandzahl";
import { queryChoice } from "~/server/utils/publicQuery";

export default defineEventHandler(async (event) => {
  if (!(await rateLimit(event, "region-municipalities")))
    throw createError({ statusCode: 429, statusMessage: "Too many requests" });
  setResponseHeader(event, "Cache-Control", "no-store");
  const ars = getRouterParam(event, "ars");
  if (!ars || !/^\d{2,12}$/.test(ars)) throw createError({ statusCode: 400, statusMessage: "Invalid ARS" });
  const query = getQuery(event);
  const lang = queryChoice(query.lang, ["de-DE", "en-US", "it-IT"], "de-DE");
  // Resolve the real level upstream rather than trusting a client-supplied prefix.
  const area = AreaSchema.parse(await fetchStadtlandzahl(`/api/areas/${ars}/`));
  if ((area.level ?? 0) > 4 || area.is_reasonable_for_municipal_rating)
    throw createError({ statusCode: 400, statusMessage: "Area is not an administrative region" });
  const selection = regionSelection(area.ars, area.level ?? 0);
  const expires = Date.now() + 25000;
  const fetchRegion = async (url: string, query: Record<string, string | number | undefined>) => {
    // All related links have already passed same-origin/collection/snapshot checks.
    if (!url.startsWith("/api/stadtlandzahl/api/collections/")) throw new Error("Invalid region endpoint");
    const remaining = expires - Date.now();
    if (remaining <= 0) throw createError({ statusCode: 504, statusMessage: "Region request timed out" });
    return fetchStadtlandzahl(url.slice("/api/stadtlandzahl".length), { query, timeout: Math.min(remaining, 10000) });
  };
  try {
    const context = MunicipalityOverviewSchema.parse(
      await fetchRegion(overviewEndpoint("stadtlandklima"), { scope: selection.scope, lang }),
    );
    if (context.collection !== "stadtlandklima" || context.scope.ars !== selection.scope)
      throw new Error("Mismatched region overview");
    checkedOverviewUrl(context.map.tile_url, context.collection, "tiles", context.snapshot_id);
    const [municipalities, bounds] = await Promise.all([
      loadRegionMunicipalities(context, selection.prefix, fetchRegion),
      regionMapBounds(context, selection.prefix, fetchRegion),
    ]);
    return RegionMunicipalitiesResponseSchema.parse({ context, municipalities, bounds });
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Region municipalities unavailable" });
  }
});
