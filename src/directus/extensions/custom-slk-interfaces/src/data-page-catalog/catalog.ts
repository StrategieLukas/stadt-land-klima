export type CatalogEntry = { id: string; title: string };
const FRESH_MS = 30_000;
const STALE_MS = 5 * 60_000;
const catalogs = new Map<string, { entries?: CatalogEntry[]; loadedAt?: number; pending?: Promise<CatalogEntry[]> }>();
class CatalogUnavailableError extends Error {
  constructor(readonly transient: boolean) {
    super("Collection catalog unavailable");
  }
}

function getTitle(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const titles = value as Record<string, unknown>;
  return String(titles["de-DE"] || titles["en-US"] || "");
}

async function fetchCollections(url: string): Promise<CatalogEntry[]> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new CatalogUnavailableError(true);
  }
  if (!response.ok) throw new CatalogUnavailableError(response.status === 429 || response.status >= 500);
  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch (error) {
    throw new CatalogUnavailableError(
      error instanceof Error && ["AbortError", "TimeoutError", "TypeError"].includes(error.name),
    );
  }
  const entries = body.collections;
  if (!Array.isArray(entries)) throw new Error("Catalog response has no collections");
  return entries
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .filter((entry) => typeof entry.id === "string" && entry.id !== "administrative-areas")
    .map((entry) => ({
      id: entry.id as string,
      title: getTitle(entry.title) || (entry.id as string),
    }));
}

async function loadCatalog(base: string): Promise<CatalogEntry[]> {
  let collections: CatalogEntry[] = [];
  try {
    collections = await fetchCollections(`${base}/api/stadtlandzahl/api/manifests/collections-index`);
  } catch {
    // The complete API is used when the slim manifest is unavailable.
  }
  return collections.length ? collections : fetchCollections(`${base}/api/stadtlandzahl/api/collections/`);
}

/** The editor may retain a recent successful list through a brief upstream
 * outage. Save validation never accepts a stale-on-error fallback. Both callers
 * share concurrent metadata reads and the short fresh cache.
 */
export async function getDataPageCatalog(baseUrl?: string, allowStale = false): Promise<CatalogEntry[]> {
  const base = (baseUrl || "http://frontend:3000").replace(/\/+$/, "");
  let cache = catalogs.get(base);
  if (!cache) {
    // URLs are operator configuration, but keep hot-reload/config changes bounded.
    if (catalogs.size >= 4) catalogs.delete(catalogs.keys().next().value!);
    cache = {};
    catalogs.set(base, cache);
  }
  if (cache.entries && Date.now() - cache.loadedAt! < FRESH_MS) return structuredClone(cache.entries);
  const entry = cache;
  entry.pending ??= loadCatalog(base)
    .then((entries) => {
      entry.entries = entries;
      entry.loadedAt = Date.now();
      return entries;
    })
    .finally(() => {
      delete entry.pending;
    });
  try {
    return structuredClone(await entry.pending);
  } catch (error) {
    if (
      allowStale &&
      error instanceof CatalogUnavailableError &&
      error.transient &&
      entry.entries &&
      Date.now() - entry.loadedAt! < STALE_MS
    )
      return structuredClone(entry.entries);
    throw error;
  }
}
