import type { Collection, CollectionSummary, SourceAttribution } from "../types/slz-api";

interface DataAttributionContext {
  summary?: CollectionSummary | null | undefined;
  collection?: Pick<Collection, "source_attributions" | "sourceAttributions"> | null | undefined;
  fallbackAttribution?: string | null | undefined;
}

export interface DataAttributionItem {
  source: string;
  sourceUrl: string | null;
  attribution: string;
  licenseName: string;
  licenseUrl: string | null;
}

const normalize = (value: string) => value.replace(/\s+/gu, " ").trim();

/** Source and license links are external web pages, never executable destinations. */
function attributionUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/** Prefer published summary sources, then registry metadata, then legacy aggregate credits. */
export function resolveDataAttribution(
  context: DataAttributionContext,
  localize: (labels: Record<string, string> | null | undefined) => string,
): DataAttributionItem[] {
  const resolve = (sources: readonly SourceAttribution[]) => {
    const seen = new Set<string>();
    return sources.flatMap((entry) => {
      const sourceUrl = attributionUrl(entry.source_url) ?? attributionUrl(entry.sourceUrl);
      const licenseUrl = attributionUrl(entry.license_url) ?? attributionUrl(entry.licenseUrl);
      const attribution = normalize(entry.attribution ?? "");
      const source = normalize(typeof entry.source === "string" ? entry.source : localize(entry.source));
      const label = source || attribution || sourceUrl || "";
      const item: DataAttributionItem = {
        source: label,
        sourceUrl,
        attribution: attribution === label ? "" : attribution,
        licenseName: normalize(entry.license_name ?? "") || normalize(entry.licenseName ?? "") || licenseUrl || "",
        licenseUrl,
      };
      const key = JSON.stringify(item);
      if ((!item.source && !item.licenseName) || seen.has(key)) return [];
      seen.add(key);
      return [item];
    });
  };
  for (const sources of [
    [...(context.summary?.source_attributions ?? []), ...(context.summary?.sourceAttributions ?? [])],
    [...(context.collection?.source_attributions ?? []), ...(context.collection?.sourceAttributions ?? [])],
  ]) {
    const items = resolve(sources);
    if (items.length) return items;
  }
  const metadata = context.summary?.aggregate.metadata;
  const aggregateItems = resolve([
    {
      attribution: metadata?.attribution,
      source_url: metadata?.attribution_url,
      license_name: metadata?.license_name,
      license_url: metadata?.license_url,
    },
  ]);
  if (aggregateItems.length) return aggregateItems;
  const fallback = normalize(context.fallbackAttribution ?? "");
  return fallback ? [{ source: fallback, sourceUrl: null, attribution: "", licenseName: "", licenseUrl: null }] : [];
}

export function formatDataAttribution(items: readonly DataAttributionItem[]): string {
  return items
    .map((item) => [...new Set([item.source, item.attribution, item.licenseName].filter(Boolean))].join(" | "))
    .join("; ");
}
