import { AsyncLocalStorage } from "node:async_hooks";
import {
  securityRecord,
  errorStatus,
  statusLevel,
  type LogDetails,
  type LogLevel,
} from "../../../frontend/shared/securityLog.ts";

type RequestContext = { user: () => unknown; requestId: string; userAgent: unknown; authenticatedUser?: unknown };
const key = Symbol.for("stadt-land-klima.security-log-context.v1");
const registry = globalThis as typeof globalThis & { [key: symbol]: unknown };
// Extension bundles each inline this helper; one ALS instance preserves request actors across bundles.
const context = (registry[key] ??= new AsyncLocalStorage<RequestContext>()) as AsyncLocalStorage<RequestContext>;
export function withLogContext<T>(value: RequestContext, run: () => T): T {
  return context.run(value, run);
}
export function extensionLog(logger: unknown, level: LogLevel, event: string, details: LogDetails = {}): void {
  const request = context.getStore();
  const user = details.userId ?? request?.authenticatedUser ?? request?.user();
  const record = securityRecord(event, {
    ...details,
    userId: user,
    actorType: details.actorType ?? (user ? "user" : request ? "anonymous" : "system"),
    requestId: request?.requestId ?? details.requestId,
    userAgent: request?.userAgent ?? details.userAgent,
  });
  record.severity = level;
  try {
    if (logger && typeof logger === "object") {
      const write: unknown = Reflect.get(logger, level);
      if (typeof write === "function") write.call(logger, record, String(record.event));
    }
  } catch {
    /* Diagnostics must never break application work. */
  }
}

export function extensionDiagnostic(level: LogLevel, event: string, details: LogDetails = {}): void {
  const sink = {
    info: (value: Record<string, unknown>) => console.info(JSON.stringify(value)),
    warn: (value: Record<string, unknown>) => console.warn(JSON.stringify(value)),
    error: (value: Record<string, unknown>) => console.error(JSON.stringify(value)),
  };
  extensionLog(sink, level, event, details);
}

export function extensionError(logger: unknown, event: string, error: unknown): void {
  const status = errorStatus(error);
  extensionLog(logger, statusLevel(status), event, { status });
}

export function setExtensionLogActor(userId: unknown): void {
  const request = context.getStore();
  if (request) request.authenticatedUser = userId;
}
