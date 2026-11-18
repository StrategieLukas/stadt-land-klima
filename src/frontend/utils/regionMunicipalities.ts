import {
  OverviewMunicipalitiesSchema,
  OverviewRegionsSchema,
  type MunicipalityOverview,
  type OverviewMunicipality,
} from "../shared/contracts/municipalityOverview";
import { checkedOverviewUrl } from "./municipalityOverview";

/** ARS padding is significant: never strip trailing zeroes from a region code. */
export function regionSelection(ars: string, level: number) {
  const length = ({ 1: 0, 2: 2, 3: 3, 4: 5 } as Record<number, number>)[level];
  if (!/^\d{2,12}$/.test(ars) || length === undefined || ars.length < length)
    throw new Error("Invalid administrative region");
  return {
    prefix: ars.slice(0, length),
    // The frozen overview catalogue contains states and districts, not Regierungsbezirke.
    scope: level === 1 ? "DE" : ars.slice(0, level === 4 ? 5 : 2).padEnd(12, "0"),
  };
}

type RegionFetch = (url: string, query: Record<string, string | number | undefined>) => Promise<unknown>;

export async function loadRegionMunicipalities(context: MunicipalityOverview, prefix: string, fetcher: RegionFetch) {
  const url = checkedOverviewUrl(
    context.links.municipalities,
    context.collection,
    "municipalities",
    context.snapshot_id,
  );
  const rows: OverviewMunicipality[] = [];
  const seenArs = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  let count: number | undefined;
  let received = 0;
  for (let index = 0; index < 150; index++) {
    const page = OverviewMunicipalitiesSchema.parse(await fetcher(url, { limit: 100, cursor }));
    if (page.snapshot_id !== context.snapshot_id || (count !== undefined && count !== page.count))
      throw new Error("Changed municipality snapshot");
    count = page.count;
    for (const row of page.results) {
      if (seenArs.has(row.ars)) throw new Error("Duplicate municipality");
      seenArs.add(row.ars);
      if (row.ars.startsWith(prefix)) rows.push(row);
    }
    received += page.results.length;
    if (received > count) throw new Error("Invalid municipality count");
    if (!page.next_cursor) {
      if (received !== count) throw new Error("Incomplete municipality list");
      return rows;
    }
    if (!page.results.length || seenCursors.has(page.next_cursor)) throw new Error("Invalid municipality cursor");
    seenCursors.add(page.next_cursor);
    cursor = page.next_cursor;
  }
  throw new Error("Municipality page limit exceeded");
}

export async function regionMapBounds(context: MunicipalityOverview, prefix: string, fetcher: RegionFetch) {
  if (prefix.length !== 3) return context.map.bounds;
  const url = checkedOverviewUrl(context.links.regions, context.collection, "regions", context.snapshot_id);
  const page = OverviewRegionsSchema.parse(
    await fetcher(url, { level: "district", parent_ars: context.scope.state_ars ?? undefined }),
  );
  if (page.snapshot_id !== context.snapshot_id) throw new Error("Changed region snapshot");
  const districts = page.results.filter((district) => district.ars.startsWith(prefix));
  if (!districts.length) throw new Error("Missing region bounds");
  return [
    Math.min(...districts.map((district) => district.bounds[0])),
    Math.min(...districts.map((district) => district.bounds[1])),
    Math.max(...districts.map((district) => district.bounds[2])),
    Math.max(...districts.map((district) => district.bounds[3])),
  ] as MunicipalityOverview["map"]["bounds"];
}
