export type CatalogEntry = { id: string; title: string };

function getTitle(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const titles = value as Record<string, unknown>;
  return String(titles["de-DE"] || titles["en-US"] || "");
}

async function fetchCollections(url: string): Promise<CatalogEntry[]> {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok)
    throw new Error(`Catalog request returned ${response.status}`);
  const body = (await response.json()) as Record<string, unknown>;
  const entries = body.collections;
  if (!Array.isArray(entries))
    throw new Error("Catalog response has no collections");
  return entries
    .filter((entry): entry is Record<string, unknown> =>
      Boolean(entry && typeof entry === "object"),
    )
    .filter(
      (entry) =>
        typeof entry.id === "string" && entry.id !== "administrative-areas",
    )
    .map((entry) => ({
      id: entry.id as string,
      title: getTitle(entry.title) || (entry.id as string),
    }));
}

export async function getDataPageCatalog(
  baseUrl?: string,
): Promise<CatalogEntry[]> {
  const base = (baseUrl || "http://frontend:3000").replace(/\/+$/, "");
  let collections: CatalogEntry[] = [];
  try {
    collections = await fetchCollections(
      `${base}/api/stadtlandzahl/api/manifests/collections-index`,
    );
  } catch {
    // The complete API is used when the slim manifest is unavailable.
  }
  return collections.length
    ? collections
    : fetchCollections(`${base}/api/stadtlandzahl/api/collections/`);
}
