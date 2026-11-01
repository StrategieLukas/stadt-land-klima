import { z } from "zod";
import { GeoFeatureSchema } from "~/shared/contracts/geometry";
import { visualizationUrl } from "~/shared/visualizationSafety";

const ItemPageSchema = z
  .object({
    type: z.literal("FeatureCollection"),
    features: z.array(GeoFeatureSchema),
    links: z.array(z.object({ rel: z.string(), href: z.string() })).default([]),
    next: z.string().nullish(),
  })
  .loose();

export type CollectionItems = z.infer<typeof ItemPageSchema>;

export function isCollectionItemsUrl(input: string): boolean {
  return /\/api\/collections\/[^/]+\/items\/?$/.test(new URL(input, window.location.origin).pathname);
}

/** Read bounded pages through the supplied collection URL; never request no_page. */
export async function fetchCollectionItems(input: string, signal?: AbortSignal): Promise<CollectionItems> {
  const first = new URL(visualizationUrl(input, window.location.origin), window.location.origin);
  first.searchParams.delete("no_page");
  first.searchParams.set("limit", "1000");
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
      visited.has(url.href)
    ) {
      throw new Error("Invalid collection pagination link");
    }
    visited.add(url.href);
    const deadline = AbortSignal.timeout(10000);
    const response = await fetch(url, {
      signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
      credentials: "omit",
      redirect: "error",
    });
    if (!response.ok) throw new Error(`Collection page returned HTTP ${response.status}`);
    const page = ItemPageSchema.parse(await response.json());
    firstPage ??= page;
    features.push(...page.features);
    const next = page.links.find((link) => link.rel === "next")?.href ?? page.next;
    url = next ? new URL(next, url) : undefined;
  }
  if (!firstPage) throw new Error("Collection returned no page");
  return {
    ...firstPage,
    features,
    numberReturned: features.length,
    links: firstPage.links.filter((link) => link.rel !== "next"),
    next: null,
  };
}
