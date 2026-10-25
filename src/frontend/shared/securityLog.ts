/** Portable allowlisted log records. Never pass request/error/domain objects to a log sink. */
export type LogLevel = "info" | "warn" | "error";
export type ActorType = "user" | "candidate" | "anonymous" | "system" | "unknown";
export type LogDetails = {
  userId?: unknown;
  failureKind?: "application" | "validation" | "network" | "timeout" | "unknown";
  actorType?: ActorType;
  requestId?: unknown;
  route?: unknown;
  method?: unknown;
  status?: unknown;
  durationMs?: unknown;
  resource?: unknown;
  resourceId?: unknown;
  count?: unknown;
  changedFields?: unknown;
  published?: unknown;
  previewEnabled?: unknown;
  percentageRated?: unknown;
  municipalityId?: unknown;
  catalogId?: unknown;
  outcome?: "success" | "rejected" | "failed" | "attempt";
  userAgent?: unknown;
};
const identifier = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
export function logId(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  return typeof value === "string" && (identifier.test(value) || /^\d{1,16}$/.test(value)) ? value : null;
}
const label = (value: unknown): string | undefined =>
  typeof value === "string" && /^[a-z][a-z\d_.-]{0,95}$/i.test(value) ? value : undefined;

/** Structured UA facts only: attacker text, addresses, URLs and credentials never enter the record. */
export function userAgentInfo(input: unknown) {
  const ua = typeof input === "string" ? input.slice(0, 2048) : "";
  const bot = /googlebot/i.test(ua)
    ? "google"
    : /bingbot/i.test(ua)
      ? "bing"
      : /duckduckbot/i.test(ua)
        ? "duckduckgo"
        : /applebot/i.test(ua)
          ? "apple"
          : /bot|crawl|spider|headless|playwright|puppeteer|selenium|curl|wget|python-requests/i.test(ua)
            ? "other"
            : null;
  const match = /(?:Edg|Firefox|Chrome|Version|curl|wget)\/(\d{1,4})\b/i.exec(ua);
  return {
    family: /Edg\//i.test(ua)
      ? "edge"
      : /Firefox\//i.test(ua)
        ? "firefox"
        : /Chrome\//i.test(ua)
          ? "chrome"
          : /Safari\//i.test(ua)
            ? "safari"
            : /curl\//i.test(ua)
              ? "curl"
              : /wget\//i.test(ua)
                ? "wget"
                : "other",
    major: match ? Number(match[1]) : null,
    os: /Android/i.test(ua)
      ? "android"
      : /iPhone|iPad/i.test(ua)
        ? "ios"
        : /Windows/i.test(ua)
          ? "windows"
          : /Macintosh|Mac OS/i.test(ua)
            ? "macos"
            : /Linux/i.test(ua)
              ? "linux"
              : "other",
    bot,
    suspicious:
      Array.from(ua).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
      (typeof input === "string" && input.length > 2048),
  };
}
export function statusLevel(status: number): LogLevel {
  return status >= 500 ? "error" : [401, 403, 409, 429].includes(status) ? "warn" : "info";
}
export function securityRecord(event: string, details: LogDetails = {}) {
  const record: Record<string, unknown> = {
    event: label(event) ?? "logging.invalid_event",
    userId: logId(details.userId),
    actorType: details.actorType ?? (logId(details.userId) === null ? "system" : "user"),
  };
  const requestId = logId(details.requestId);
  if (requestId !== null) record.requestId = requestId;
  // Routes must be static templates, never raw URLs or identifiers from the request.
  if (typeof details.route === "string" && /^\/[a-z_/:.*-]*$/i.test(details.route)) record.route = details.route;
  for (const key of ["method", "resource"] as const) {
    const value = label(details[key]);
    if (value) record[key] = value;
  }
  for (const key of ["status", "durationMs", "count"] as const) {
    const value = details[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) record[key] = Math.floor(value);
  }
  const resourceId = logId(details.resourceId);
  if (resourceId !== null) record.resourceId = resourceId;
  if (details.changedFields && Array.isArray(details.changedFields)) {
    record.changedFields = details.changedFields.slice(0, 40).filter((field): field is string => !!label(field));
  }
  for (const key of ["published", "previewEnabled"] as const)
    if (typeof details[key] === "boolean") record[key] = details[key];
  if (typeof details.percentageRated === "number" && Number.isFinite(details.percentageRated))
    record.percentageRated = details.percentageRated;
  for (const key of ["municipalityId", "catalogId"] as const) {
    const id = logId(details[key]);
    if (id !== null) record[key] = id;
  }
  if (details.failureKind) record.failureKind = details.failureKind;
  if (details.outcome) record.outcome = details.outcome;
  if (details.userAgent !== undefined) record.userAgent = userAgentInfo(details.userAgent);
  return record;
}

let serverReporter: ((event: string, level: LogLevel) => void) | undefined;
export function configureServerDiagnostics(report: (event: string, level: LogLevel) => void): void {
  serverReporter = report;
}
let clientReporter: ((event: string) => void) | undefined;
export function configureClientDiagnostics(report: (event: string) => void): void {
  clientReporter = report;
}

/** Client console diagnostics contain fixed codes only, never error payloads or application data. */
export function clientDiagnostic(event: string, level: LogLevel = "warn"): void {
  // Universal Vue/composable code also runs during SSR; use the active server request there.
  if (!("window" in globalThis) && serverReporter) {
    serverReporter(event, level);
    return;
  }
  const record = securityRecord(event, {
    actorType: "unknown",
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
  });
  record.severity = level;
  clientReporter?.(String(record.event));
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.info(record);
}

export function errorStatus(error: unknown): number {
  try {
    if (error && typeof error === "object") {
      for (const key of ["statusCode", "status", "status_code"]) {
        const value = Reflect.get(error, key) as unknown;
        if (typeof value === "number" && value >= 400 && value <= 599) return value;
      }
      if ("response" in error && error.response && typeof error.response === "object" && "status" in error.response) {
        const value = error.response.status;
        if (typeof value === "number" && value >= 400 && value <= 599) return value;
      }
    }
  } catch {
    /* Error objects are untrusted diagnostics, including their getters. */
  }
  return 500;
}
export function clientFailure(event: string, error: unknown): void {
  clientDiagnostic(event, statusLevel(errorStatus(error)));
}

export function failureKind(error: unknown): NonNullable<LogDetails["failureKind"]> {
  try {
    const name: unknown = error && typeof error === "object" ? Reflect.get(error, "name") : undefined;
    if (["ReferenceError", "TypeError", "RangeError", "SyntaxError"].includes(String(name))) return "application";
    if (["ZodError", "ValidationError"].includes(String(name))) return "validation";
    if (["FetchError", "NetworkError"].includes(String(name))) return "network";
    if (["TimeoutError", "AbortError"].includes(String(name))) return "timeout";
  } catch {
    /* Never inspect arbitrary exception text or getters. */
  }
  return "unknown";
}
