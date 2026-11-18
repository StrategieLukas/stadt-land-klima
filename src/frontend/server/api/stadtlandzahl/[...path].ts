import type { H3Event } from "h3";
import { rateLimit } from "../../utils/rateLimit";
import {
  stadtlandzahlCacheKey,
  readStadtlandzahlResponse,
  revalidatedStadtlandzahlResponse,
  storeStadtlandzahlResponse,
  forgetStadtlandzahlResponse,
} from "../../utils/stadtlandzahlResponseCache";
const REQUEST_HEADERS_TO_REMOVE = [
  "accept-encoding",
  "authorization",
  "connection",
  "content-length",
  "cookie",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

const RESPONSE_HEADERS_TO_REMOVE = new Set([
  "authorization",
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "set-cookie",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "www-authenticate",
]);

function isJson(contentType: string | null): boolean {
  return Boolean(contentType && (contentType.includes("application/json") || contentType.includes("+json")));
}

function getIncomingHeaders(event: H3Event): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(event.node.req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

async function readIncomingBody(event: H3Event): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of event.node.req as AsyncIterable<Buffer | string>) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 65536) throw createError({ statusCode: 413, statusMessage: "Render request too large" });
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// Only allow safe HTTP methods — reject write methods before reading body.
const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST"]);

// Route allowlist: only proxy to known upstream API paths.
const ALLOWED_UPSTREAM_PREFIXES = [
  "/api/areas",
  "/api/histograms",
  "/api/collections",
  "/api/manifests",
  "/api/renders",
  "/api/render",
  "/api/search",
  "/api/health",
];

function isUpstreamAllowed(path: string): boolean {
  return ALLOWED_UPSTREAM_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}

export default defineEventHandler(async (event) => {
  // Rate limit: see server/utils/rateLimitConfig.ts
  if (!(await rateLimit(event, "stadtlandzahl"))) {
    throw createError({ statusCode: 429, statusMessage: "Too many requests" });
  }
  const method = (event.method ?? event.node?.req?.method ?? "GET").toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    throw createError({ statusCode: 405, statusMessage: "Method not allowed" });
  }

  const proxyPrefix = "/api/stadtlandzahl";
  // event.req.url is relative in this project's Nitro/H3 runtime, while
  // event.path consistently contains the path and query string.
  const requestPath = event.path ?? "/";
  const requestUrl = new URL(requestPath, "http://stadtlandzahl-proxy.local");
  const upstreamPath = requestUrl.pathname.startsWith(proxyPrefix)
    ? requestUrl.pathname.slice(proxyPrefix.length) || "/"
    : "/";

  if (!isUpstreamAllowed(upstreamPath)) {
    throw createError({ statusCode: 403, statusMessage: "Upstream route not allowed" });
  }

  // Overview tiles are bounded cached reads; contexts and member queries are
  // independently limited so map movement cannot consume their allowance.
  let canonicalReadPath: string;
  try {
    canonicalReadPath = decodeURIComponent(upstreamPath).replace(/\/?$/, "/");
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid upstream path" });
  }
  if (/^\/api\/collections\/[^/]+\/overview\/(?:municipalities\/|regions\/)?$/.test(canonicalReadPath)) {
    const key = canonicalReadPath.endsWith("/municipalities/")
      ? requestUrl.searchParams.has("q")
        ? "municipality-overview-search"
        : "municipality-overview-members"
      : canonicalReadPath.endsWith("/regions/")
        ? "municipality-overview-regions"
        : "municipality-overview";
    if (!(await rateLimit(event, key))) throw createError({ statusCode: 429, statusMessage: "Too many requests" });
  }

  if (method === "POST" && !/^\/api\/(?:render\/?|collections\/[^/]+\/render\/?)$/.test(upstreamPath)) {
    throw createError({ statusCode: 405, statusMessage: "Only read-only render POST requests are allowed" });
  }
  const requestHeaders = getIncomingHeaders(event);
  for (const header of REQUEST_HEADERS_TO_REMOVE) requestHeaders.delete(header);

  // Browsers can advertise zstd, which Node's fetch does not reliably decode.
  // Request gzip explicitly: undici decodes it before we inspect or forward the
  // response body, while still keeping the upstream transfer compact.
  requestHeaders.set("accept-encoding", "gzip");

  const authorization = getStadtlandzahlAuthorization();
  if (authorization) requestHeaders.set("authorization", authorization);

  const hasBody = !["GET", "HEAD"].includes(method.toUpperCase());
  const body = hasBody ? await readIncomingBody(event) : undefined;

  let upstreamResponse: Response | undefined;
  let responseCacheKey: string | undefined;
  for (const baseUrl of getStadtlandzahlBaseUrls()) {
    const target = resolveStadtlandzahlUrl(`${upstreamPath}${requestUrl.search}`, undefined, baseUrl);
    responseCacheKey = method === "GET" ? stadtlandzahlCacheKey(upstreamPath, target, requestHeaders) : undefined;
    const cached = readStadtlandzahlResponse(responseCacheKey);
    const upstreamHeaders = new Headers(requestHeaders);
    if (cached) {
      const headers = new Headers(cached.headers);
      const etag = headers.get("etag");
      const modified = headers.get("last-modified");
      if (etag) upstreamHeaders.set("if-none-match", etag);
      else if (modified) upstreamHeaders.set("if-modified-since", modified);
    }
    try {
      upstreamResponse = await fetch(target, {
        method,
        headers: upstreamHeaders,
        ...(body ? { body: Uint8Array.from(body) } : {}),
        redirect: "manual",
      });
      if (cached && upstreamResponse.status === 304) {
        upstreamResponse = revalidatedStadtlandzahlResponse(upstreamResponse, cached);
      } else if (upstreamResponse.status !== 200) {
        forgetStadtlandzahlResponse(responseCacheKey);
      }
      break;
    } catch {
      forgetStadtlandzahlResponse(responseCacheKey);
      // Prefer the Docker-internal URL, but fall back to the public base URL
      // when the internal service is not reachable from this deployment.
    }
  }

  if (!upstreamResponse) {
    throw createError({ statusCode: 502, statusMessage: "Stadtlandzahl upstream request failed" });
  }

  const responseHeaders = new Headers();
  for (const [name, value] of upstreamResponse.headers) {
    if (!RESPONSE_HEADERS_TO_REMOVE.has(name.toLowerCase())) responseHeaders.append(name, value);
  }

  const location = upstreamResponse.headers.get("location");
  if (location) responseHeaders.set("location", rewriteStadtlandzahlUrl(location));

  let responseBody: BodyInit | null = upstreamResponse.body;
  if (method.toUpperCase() !== "HEAD" && isJson(upstreamResponse.headers.get("content-type"))) {
    const text = await upstreamResponse.text();
    if (text) {
      try {
        responseBody = JSON.stringify(rewriteStadtlandzahlPayload(JSON.parse(text)));
      } catch {
        responseBody = text;
      }
    } else {
      responseBody = null;
    }
  }

  const response = new Response(responseBody, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
  if (typeof responseBody === "string" && !upstreamResponse.headers.has("set-cookie")) {
    storeStadtlandzahlResponse(responseCacheKey, upstreamPath, response, responseBody);
  } else {
    forgetStadtlandzahlResponse(responseCacheKey);
  }
  return response;
});
