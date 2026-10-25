import { randomUUID } from "node:crypto";
import { getHeader, type H3Event } from "h3";
import {
  securityRecord,
  failureKind,
  errorStatus,
  statusLevel,
  type ActorType,
  type LogDetails,
  type LogLevel,
} from "../../shared/securityLog";
import { SECURITY_LOG_ROUTES } from "../../shared/securityLogRoutes";

export function safeRequestRoute(path: string): string {
  const pathname = (typeof path === "string" ? path : "").split(/[?#]/)[0] ?? "";
  for (const route of SECURITY_LOG_ROUTES) {
    const pattern = route
      .split("/")
      .map((segment) =>
        segment.endsWith("*")
          ? ".*"
          : segment.startsWith(":")
            ? "[^/]+"
            : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      )
      .join("/");
    if (new RegExp(`^${pattern}/?$`).test(pathname)) return route;
  }
  return pathname.startsWith("/api/") ? "/api/unmatched" : "/page";
}
export function setLogActor(event: H3Event, userId: string, actorType: ActorType = "user"): void {
  event.context ??= {};
  event.context.securityLogActor = { userId, actorType };
}
export function requestLog(event: H3Event, level: LogLevel, action: string, details: LogDetails = {}): void {
  try {
    const actor = event.context.securityLogActor as { userId?: string; actorType?: ActorType } | undefined;
    event.context.securityLogRequestId ??= randomUUID();
    const record = securityRecord(action, {
      ...details,
      userId: actor?.userId,
      actorType: actor?.actorType ?? "anonymous",
      requestId: event.context.securityLogRequestId,
      route: safeRequestRoute(event.path),
      method: event.method,
      userAgent: getHeader(event, "user-agent") ?? "",
    });
    record.severity = level;
    console[level](JSON.stringify(record));
  } catch {
    /* Logging never breaks requests, even during partial initialization. */
  }
}
export function systemLog(level: LogLevel, action: string, details: LogDetails = {}): void {
  try {
    console[level](JSON.stringify({ ...securityRecord(action, { ...details, actorType: "system" }), severity: level }));
  } catch {
    /* Logging never breaks background jobs. */
  }
}

export function requestFailure(event: H3Event, action: string, error: unknown): void {
  const status = errorStatus(error);
  requestLog(event, statusLevel(status), action, { status, failureKind: failureKind(error) });
}
