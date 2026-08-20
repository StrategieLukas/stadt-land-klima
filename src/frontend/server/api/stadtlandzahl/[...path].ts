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

function getIncomingHeaders(event: any): Headers {
  const headers = new Headers();
  const incoming = event.node?.req?.headers ?? event.req?.headers;

  if (incoming instanceof Headers) return new Headers(incoming);
  for (const [name, value] of Object.entries(incoming ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, String(value));
    }
  }
  return headers;
}

async function readIncomingBody(event: any): Promise<Uint8Array | undefined> {
  if (typeof event.request?.arrayBuffer === "function") {
    return new Uint8Array(await event.request.arrayBuffer());
  }
  if (typeof event.req?.arrayBuffer === "function") {
    return new Uint8Array(await event.req.arrayBuffer());
  }

  const request = event.node?.req ?? event.req;
  if (!request?.on) return undefined;

  return await new Promise<Uint8Array>((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

export default defineEventHandler(async (event) => {
  const proxyPrefix = "/api/stadtlandzahl";
  // event.req.url is relative in this project's Nitro/H3 runtime, while
  // event.path consistently contains the path and query string.
  const requestPath = event.path ?? "/";
  const requestUrl = new URL(requestPath, "http://stadtlandzahl-proxy.local");
  const upstreamPath = requestUrl.pathname.startsWith(proxyPrefix)
    ? requestUrl.pathname.slice(proxyPrefix.length) || "/"
    : "/";
  const requestHeaders = getIncomingHeaders(event);
  for (const header of REQUEST_HEADERS_TO_REMOVE) requestHeaders.delete(header);

  // Browsers can advertise zstd, which Node's fetch does not reliably decode.
  // Request gzip explicitly: undici decodes it before we inspect or forward the
  // response body, while still keeping the upstream transfer compact.
  requestHeaders.set("accept-encoding", "gzip");

  const authorization = getStadtlandzahlAuthorization();
  if (authorization) requestHeaders.set("authorization", authorization);

  const method = event.method ?? event.node?.req?.method ?? "GET";
  const hasBody = !["GET", "HEAD"].includes(method.toUpperCase());
  const body = hasBody ? await readIncomingBody(event) : undefined;

  let upstreamResponse: Response | undefined;
  for (const baseUrl of getStadtlandzahlBaseUrls()) {
    const target = resolveStadtlandzahlUrl(`${upstreamPath}${requestUrl.search}`, undefined, baseUrl);
    try {
      upstreamResponse = await fetch(target, {
        method,
        headers: requestHeaders,
        body,
        redirect: "manual",
      });
      break;
    } catch {
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
  return response;
});
