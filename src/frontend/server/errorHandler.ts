import { requestFailure } from "./utils/securityLogging";
import { defineNitroErrorHandler, useNitroApp } from "nitropack/runtime";
import { getHeader, send, setResponseHeader, setResponseStatus } from "h3";

/** Nitro's default diagnostic prints raw URLs/stacks; completion logging owns safe diagnostics. */
export default defineNitroErrorHandler(async (error, event) => {
  const status = error.statusCode || 500;
  requestFailure(event, "nuxt.request.failed", error);
  event.context.securityLogCompleted = true;
  const hidden = status >= 500 || error.unhandled || error.fatal;
  const message = hidden ? "Request failed" : error.statusMessage || error.message || "Request rejected";
  setResponseStatus(event, status);
  setResponseHeader(event, "Content-Type", "application/json");
  setResponseHeader(event, "Cache-Control", "private, no-store");
  setResponseHeader(event, "X-Content-Type-Options", "nosniff");
  setResponseHeader(event, "Referrer-Policy", "no-referrer");
  setResponseHeader(event, "X-Frame-Options", "DENY");
  setResponseHeader(event, "Content-Security-Policy", "script-src 'none'; frame-ancestors 'none';");
  // Keep the existing Nuxt error.vue page for HTML navigation. Only safe error
  // fields reach the internal renderer, and the guard prevents recursive errors.
  if (
    !event.path.startsWith("/api/") &&
    getHeader(event, "accept")?.includes("text/html") &&
    !event.context.securityLogRenderingError
  ) {
    const query = new URLSearchParams({
      status: String(status),
      statusCode: String(status),
      message,
      statusMessage: message,
    });
    const rendered = await useNitroApp()
      .localFetch(`/__nuxt_error?${query}`, {
        headers: event.headers,
        context: { securityLogRenderingError: true, nuxt: { "~rendering-error": true } },
      })
      .catch(() => null);
    if (rendered?.headers.get("content-type")?.includes("text/html")) {
      for (const [key, value] of rendered.headers) {
        if (["content-type", "content-security-policy", "x-frame-options"].includes(key))
          setResponseHeader(event, key, value);
      }
      return send(event, await rendered.text());
    }
  }
  return send(
    event,
    JSON.stringify({ statusCode: status, statusMessage: message, message, ...(hidden ? {} : { data: error.data }) }),
  );
});
