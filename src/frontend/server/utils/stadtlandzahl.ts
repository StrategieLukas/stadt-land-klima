const STADTLANDZAHL_PROXY_BASE = "/api/stadtlandzahl";

type StadtlandzahlRuntimeConfig = {
  stadtlandzahlBaseUrl?: string;
  stadtlandzahlServerBaseUrl?: string;
  stadtlandzahlBasicAuthUser?: string;
  stadtlandzahlBasicAuthPassword?: string;
};

function parseBaseUrl(value: string | undefined, name: string): URL | null {
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw createError({ statusCode: 500, statusMessage: `${name} is not a valid URL` });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw createError({ statusCode: 500, statusMessage: `${name} must use HTTP or HTTPS` });
  }

  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

function getConfig(): StadtlandzahlRuntimeConfig {
  return useRuntimeConfig() as StadtlandzahlRuntimeConfig;
}

export function getStadtlandzahlBaseUrls(): URL[] {
  const config = getConfig();
  const serverUrl = parseBaseUrl(config.stadtlandzahlServerBaseUrl, "STADTLANDZAHL_SERVER_BASE_URL");
  const publicUrl = parseBaseUrl(config.stadtlandzahlBaseUrl, "STADTLANDZAHL_BASE_URL");
  const urls = [serverUrl, publicUrl].filter((url): url is URL => Boolean(url));
  const uniqueUrls = urls.filter((url, index) => urls.findIndex((candidate) => candidate.href === url.href) === index);

  if (!uniqueUrls.length) {
    throw createError({
      statusCode: 500,
      statusMessage: "STADTLANDZAHL_BASE_URL is not configured",
    });
  }

  return uniqueUrls;
}

export function getStadtlandzahlBaseUrl(): URL {
  return getStadtlandzahlBaseUrls()[0];
}

export function getStadtlandzahlAuthorization(): string | undefined {
  const config = getConfig();
  const username = config.stadtlandzahlBasicAuthUser;
  const password = config.stadtlandzahlBasicAuthPassword;

  // Best-effort configuration: a complete pair enables Basic Auth. Missing or
  // partial credentials are deliberately treated as an unprotected upstream.
  if (!username || !password) return undefined;
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

export function resolveStadtlandzahlUrl(
  path: string,
  query?: Record<string, unknown>,
  configuredBaseUrl = getStadtlandzahlBaseUrl(),
): URL {
  const url = new URL(configuredBaseUrl);
  const parsedPath = new URL(path, "http://stadtlandzahl.local");
  const basePath = url.pathname.replace(/\/+$/, "");

  url.pathname = `${basePath}/${parsedPath.pathname.replace(/^\/+/, "")}`;
  url.search = parsedPath.search;

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, String(item));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

export function rewriteStadtlandzahlUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value;
  }

  const configuredBase = getStadtlandzahlBaseUrls().find((base) => base.origin === url.origin);
  if (!configuredBase) return value;

  const basePath = configuredBase.pathname.replace(/\/+$/, "");
  const upstreamPath =
    basePath && url.pathname.startsWith(`${basePath}/`) ? url.pathname.slice(basePath.length) : url.pathname;

  return `${STADTLANDZAHL_PROXY_BASE}${upstreamPath}${url.search}${url.hash}`;
}

export function rewriteStadtlandzahlPayload<T>(value: T): T {
  if (typeof value === "string") return rewriteStadtlandzahlUrl(value) as T;
  if (Array.isArray(value)) return value.map((item) => rewriteStadtlandzahlPayload(item)) as T;
  if (!value || typeof value !== "object") return value;

  const rewritten: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    rewritten[key] = rewriteStadtlandzahlPayload(item);
  }
  return rewritten as T;
}

export async function fetchStadtlandzahl<T>(path: string, options: Record<string, any> = {}): Promise<T> {
  const { params, query, headers: suppliedHeaders, ...fetchOptions } = options;
  const headers = new Headers(suppliedHeaders);
  const authorization = getStadtlandzahlAuthorization();

  headers.delete("authorization");
  if (authorization) headers.set("authorization", authorization);

  for (const baseUrl of getStadtlandzahlBaseUrls()) {
    const url = resolveStadtlandzahlUrl(path, params ?? query, baseUrl);
    try {
      const data = await $fetch<T>(url.toString(), {
        ...fetchOptions,
        headers,
      });
      return rewriteStadtlandzahlPayload(data);
    } catch (error) {
      const upstreamStatus = (error as { response?: { status?: number } })?.response?.status;
      if (upstreamStatus) {
        throw createError({
          statusCode: 502,
          statusMessage: `Stadtlandzahl upstream returned HTTP ${upstreamStatus}`,
        });
      }
    }
  }

  throw createError({ statusCode: 502, statusMessage: "Stadtlandzahl upstream request failed" });
}
