import { createHash } from "node:crypto";
import {
  CollectionSchema,
  CollectionsResponseSchema,
  RenderResponseSchema,
  SummarySchema,
} from "~/shared/contracts/slz";
import {
  HistogramResponseSchema,
  MunicipalityOverviewSchema,
  OverviewRegionsSchema,
} from "~/shared/contracts/municipalityOverview";

type CachedResponse = { body: string; headers: [string, string][]; expiresAt: number };
const entries = new Map<string, CachedResponse>();
const MAX_ENTRIES = 128;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ENTRY_BYTES = 1024 * 1024;
let bytes = 0;

function schemaFor(path: string) {
  if (/^\/api\/(?:manifests\/collections-index|collections\/)\/?$/.test(path)) return CollectionsResponseSchema;
  if (/^\/api\/collections\/[a-zA-Z0-9_-]+\/overview\/$/.test(path)) return MunicipalityOverviewSchema;
  if (/^\/api\/collections\/[a-zA-Z0-9_-]+\/overview\/regions\/$/.test(path)) return OverviewRegionsSchema;
  if (/^\/api\/collections\/[a-zA-Z0-9_-]+\/histogram\/$/.test(path)) return HistogramResponseSchema;
  if (/^\/api\/collections\/[a-zA-Z0-9_-]+\/summary\/$/.test(path)) return SummarySchema;
  if (/^\/api\/collections\/[a-zA-Z0-9_-]+\/render\/$/.test(path)) return RenderResponseSchema;
  if (/^\/api\/collections\/[a-zA-Z0-9_-]+\/$/.test(path)) return CollectionSchema;
  return null;
}

/** Hash credentials and representation headers; neither is exposed in cache keys or logs. */
export function stadtlandzahlCacheKey(path: string, target: URL, headers: Headers): string | undefined {
  if (!schemaFor(path) || headers.has("if-none-match") || headers.has("if-modified-since")) return undefined;
  return createHash("sha256")
    .update(
      JSON.stringify([
        target.href,
        ["authorization", "accept", "accept-encoding", "accept-language", "origin"].map((name) => [
          name,
          headers.get(name),
        ]),
      ]),
    )
    .digest("hex");
}

export function forgetStadtlandzahlResponse(key: string | undefined) {
  if (!key) return;
  const entry = entries.get(key);
  if (entry) bytes -= Buffer.byteLength(entry.body);
  entries.delete(key);
}

export function readStadtlandzahlResponse(key: string | undefined): CachedResponse | undefined {
  if (!key) return;
  const entry = entries.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry;
  forgetStadtlandzahlResponse(key);
  return undefined;
}

/** A hit is never served without a new upstream visibility/publication check. */
export function revalidatedStadtlandzahlResponse(response: Response, cached: CachedResponse): Response {
  const headers = new Headers(cached.headers);
  for (const [name, value] of response.headers) headers.set(name, value);
  return new Response(cached.body, { status: 200, headers });
}

export function storeStadtlandzahlResponse(key: string | undefined, path: string, response: Response, body: string) {
  forgetStadtlandzahlResponse(key);
  if (!key || response.status !== 200 || response.headers.has("set-cookie")) return;
  const policy = response.headers.get("cache-control") ?? "";
  if (!/(?:^|,)\s*public(?:\s*,|\s*$)/i.test(policy) || /(?:no-store|private|stale-if-error)/i.test(policy)) return;
  const vary = (response.headers.get("vary") ?? "")
    .toLowerCase()
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (vary.some((name) => !["accept", "accept-encoding", "accept-language", "origin"].includes(name))) return;
  const maxAge = Number(
    /(?:^|,)\s*s-maxage=(\d+)/i.exec(policy)?.[1] ?? /(?:^|,)\s*max-age=(\d+)/i.exec(policy)?.[1] ?? 0,
  );
  const validator = response.headers.get("etag") || response.headers.get("last-modified");
  const size = Buffer.byteLength(body);
  if (!validator || maxAge <= 0 || size > MAX_ENTRY_BYTES) return;
  const schema = schemaFor(path);
  if (!schema) return;
  try {
    if (!schema.safeParse(JSON.parse(body)).success) return;
  } catch {
    return;
  }
  // Short-lived and bounded even for immutable publications. HTTP reads always revalidate.
  while (entries.size >= MAX_ENTRIES || bytes + size > MAX_BYTES) {
    const oldest = entries.keys().next().value;
    if (!oldest) break;
    forgetStadtlandzahlResponse(oldest);
  }
  entries.set(key, { body, headers: [...response.headers], expiresAt: Date.now() + Math.min(maxAge, 60) * 1000 });
  bytes += size;
}
