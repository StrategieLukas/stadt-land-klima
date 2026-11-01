import { z } from "zod";
import { GeoFeatureSchema } from "~/shared/contracts/geometry";
import { visualizationUrl } from "~/shared/visualizationSafety";
import { assertEditorJson } from "~/shared/editorBlocks";

const ItemPageSchema = z
  .object({
    type: z.literal("FeatureCollection"),
    features: z.array(GeoFeatureSchema),
    links: z.array(z.object({ rel: z.string(), href: z.string() })).default([]),
    next: z.string().nullish(),
  })
  .loose();

export type CollectionItems = z.infer<typeof ItemPageSchema>;
const recentItems = new Map<string, { expires: number; data: CollectionItems }>();
const MAX_CACHED_FEATURES = 50000;

export function isCollectionItemsUrl(input: string): boolean {
  return /\/api\/collections\/[^/]+\/items\/?$/.test(new URL(input, window.location.origin).pathname);
}

/** Read bounded pages through the supplied collection URL; never request no_page. */
export async function fetchCollectionItems(input: string, signal?: AbortSignal): Promise<CollectionItems> {
  const first = new URL(visualizationUrl(input, window.location.origin), window.location.origin);
  first.searchParams.delete("no_page");
  first.searchParams.set("limit", "1000");
  signal?.throwIfAborted();
  for (const [key, entry] of recentItems) if (entry.expires <= Date.now()) recentItems.delete(key);
  const cached = recentItems.get(first.href);
  if (cached) return cached.data;
  const visited = new Set<string>();
  const features: CollectionItems["features"] = [];
  let firstPage: CollectionItems | undefined;
  let url: URL | undefined = first;
  while (url) {
    visualizationUrl(url.toString(), window.location.origin);
    if (
      url.origin !== first.origin ||
      url.pathname !== first.pathname ||
      url.searchParams.get("area") !== first.searchParams.get("area") ||
      url.searchParams.get("geojson_type") !== first.searchParams.get("geojson_type") ||
      visited.has(url.href)
    ) {
      throw new Error("Invalid collection pagination link");
    }
    visited.add(url.href);
    // Derived networks can contain tens of thousands of segments in one reply.
    const deadline = AbortSignal.timeout(url.searchParams.has("geojson_type") ? 30000 : 10000);
    const response = await fetch(url, {
      signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
      credentials: "omit",
      redirect: "error",
    });
    if (!response.ok) throw new Error(`Collection page returned HTTP ${response.status}`);
    const page = ItemPageSchema.parse(await response.json());
    assertEditorJson(page);
    firstPage ??= page;
    features.push(...page.features);
    const next = page.links.find((link) => link.rel === "next")?.href ?? page.next;
    url = next ? new URL(next, url) : undefined;
  }
  if (!firstPage) throw new Error("Collection returned no page");
  const result = {
    ...firstPage,
    features,
    numberReturned: features.length,
    links: firstPage.links.filter((link) => link.rel !== "next"),
    next: null,
  };
  // Reuse checked data for theme changes/exports without retaining unbounded networks.
  if (features.length <= MAX_CACHED_FEATURES && !signal?.aborted) {
    recentItems.set(first.href, { expires: Date.now() + 30000, data: result });
    let retainedFeatures = [...recentItems.values()].reduce((total, entry) => total + entry.data.features.length, 0);
    for (const [key, entry] of recentItems) {
      if (recentItems.size <= 3 && retainedFeatures <= MAX_CACHED_FEATURES) break;
      recentItems.delete(key);
      retainedFeatures -= entry.data.features.length;
    }
  }
  return result;
}
