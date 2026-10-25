import type { HookConfig } from "@directus/types";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { extensionLog, withLogContext, setExtensionLogActor } from "../../../shared/securityLogger.ts";
import { statusLevel } from "../../../../../frontend/shared/securityLog.ts";

function routeTemplate(path: string): string {
  const first = path.split(/[/?]/)[1];
  if (first === "items") return "/items/:collection/:id";
  if (first === "auth") return "/auth/:operation";
  const known = new Set([
    "users",
    "files",
    "folders",
    "roles",
    "policies",
    "permissions",
    "settings",
    "flows",
    "operations",
    "assets",
    "activity",
    "revisions",
    "collections",
    "fields",
    "relations",
    "server",
    "extensions",
    "utils",
    "shares",
    "presets",
    "notifications",
    "blokkli-persistence",
    "election-actions",
    "consent",
    "community-activity",
    "erfolgsprojekte-users",
    "generate-reset-link",
    "pdf",
    "pdf-service",
    "unsplash",
    "data-page-catalog",
  ]);
  if (first && known.has(first)) return `/${first}/:id`;
  return "/extension/:operation";
}
function authOperation(path: string): string | undefined {
  const route = path.split("?")[0];
  const events: Record<string, string> = {
    "/auth/refresh": "directus.auth.refresh",
    "/auth/password/request": "directus.auth.password_reset_requested",
    "/auth/password/reset": "directus.auth.password_reset",
    "/users/invite/accept": "directus.auth.invitation_accepted",
    "/users/me/tfa/generate": "directus.auth.tfa_generated",
    "/users/me/tfa/enable": "directus.auth.tfa_enabled",
    "/users/me/tfa/disable": "directus.auth.tfa_disabled",
  };
  return route ? events[route] : undefined;
}
const securityAudit: HookConfig = ({ action, init, filter }, { logger }) => {
  init("middlewares.before", ({ app }) => {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const request = req as Request & { accountability?: { user?: string | null }; slkLogRequestId?: string };
      const start = performance.now();
      const requestId = randomUUID();
      request.slkLogRequestId = requestId;
      res.setHeader("X-Request-ID", requestId);
      const auditContext = {
        user: () => request.accountability?.user,
        requestId,
        userAgent: req.headers["user-agent"],
      };
      withLogContext(auditContext, () => {
        res.once("finish", () =>
          withLogContext(auditContext, () =>
            extensionLog(
              logger,
              statusLevel(res.statusCode),
              authOperation(req.originalUrl) ?? "directus.request.completed",
              {
                userId: request.accountability?.user,
                route: routeTemplate(req.originalUrl),
                method: req.method,
                status: res.statusCode,
                durationMs: performance.now() - start,
                requestId,
                userAgent: req.headers["user-agent"],
              },
            ),
          ),
        );
        next();
      });
    });
  });
  // Native JWT metadata supplies a verified account for refresh requests without reading tokens.
  filter("auth.jwt", (payload, meta) => {
    setExtensionLogActor(meta.user);
    return payload;
  });
  filter("activity.create", (payload) => {
    if (
      payload &&
      typeof payload === "object" &&
      "action" in payload &&
      payload.action === "logout" &&
      "user" in payload
    )
      setExtensionLogActor(payload.user);
    return payload;
  });
  action("activity.create", (meta) => {
    if (meta.payload?.action === "logout")
      extensionLog(logger, "info", "directus.auth.logout", { userId: meta.payload.user, outcome: "success" });
  });
  // Pinned Directus emits both outcomes, including an ID when a known account failed login.
  action("auth.login", (meta) => {
    extensionLog(logger, meta.status === "success" ? "info" : "warn", "directus.auth.login", {
      userId: meta.status === "success" ? meta.user : undefined,
      resourceId: meta.user,
      outcome: meta.status === "success" ? "success" : "rejected",
    });
  });
  const scopes = [
    "items",
    "users",
    "files",
    "folders",
    "roles",
    "policies",
    "permissions",
    "access",
    "settings",
    "flows",
    "operations",
    "shares",
    "webhooks",
    "collections",
    "fields",
    "relations",
    "translations",
    "presets",
    "dashboards",
    "panels",
    "notifications",
    "extensions",
    "versions",
    "comments",
  ];
  const mutationEvents = [
    ...scopes.flatMap((scope) => ["create", "update", "delete"].map((verb) => `${scope}.${verb}`)),
    "files.upload",
  ];
  for (const event of mutationEvents) {
    action(event, (meta, context) => {
      // Logging and activity tables must not recursively audit their own audit rows.
      if (["directus_activity", "directus_revisions", "directus_sessions"].includes(meta.collection)) return;
      const keys = Array.isArray(meta.keys) ? meta.keys : meta.key === undefined ? [] : [meta.key];
      extensionLog(logger, "info", `directus.${event}`, {
        userId: context.accountability?.user,
        resource: meta.collection,
        resourceId: keys.length === 1 ? keys[0] : undefined,
        count: keys.length,
        changedFields: meta.payload && typeof meta.payload === "object" ? Object.keys(meta.payload) : [],
        outcome: "success",
      });
    });
  }
};
export default securityAudit;
