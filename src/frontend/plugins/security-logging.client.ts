import { defineNuxtPlugin } from "#app";
import { clientDiagnostic, configureClientDiagnostics } from "../shared/securityLog";
import { SECURITY_CLIENT_EVENTS } from "../shared/securityClientEvents";

export default defineNuxtPlugin((app) => {
  const allowed = new Set<string>(SECURITY_CLIENT_EVENTS);
  const sent = new Map<string, number>();
  function report(value: unknown) {
    if (typeof value !== "string" || !allowed.has(value)) return;
    const now = Date.now();
    if (now - (sent.get(value) ?? 0) < 60_000) return;
    sent.set(value, now);
    void fetch("/api/security/client-event", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: value }),
    }).catch(() => undefined);
  }
  configureClientDiagnostics(report);
  app.hook("vue:error", () => {
    clientDiagnostic("client.vue_failed", "error");
  });
  app.hook("app:error", () => {
    clientDiagnostic("client.app_failed", "error");
  });
  // After hydration Vue normally falls back to printing raw exceptions. Keep its
  // diagnostic sink safe while Nuxt's existing fatal-error navigation stays intact.
  app.hook("app:mounted", () => {
    app.vueApp.config.errorHandler = () => {
      clientDiagnostic("client.vue_failed", "error");
    };
  });
  window.addEventListener("unhandledrejection", (event) => {
    event.preventDefault();
    clientDiagnostic("client.promise_unhandled", "error");
  });
  window.addEventListener("error", (event) => {
    event.preventDefault();
    clientDiagnostic("client.runtime_failed", "error");
  });
});
