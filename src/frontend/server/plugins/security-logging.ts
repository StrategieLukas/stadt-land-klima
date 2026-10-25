import { randomUUID } from "node:crypto";
import { getCookie, setResponseHeader, type H3Event } from "h3";
import { readEditorSession } from "../utils/editorSession";
import { requestLog } from "../utils/securityLogging";
import { statusLevel } from "../../shared/securityLog";

export function logRequestCompletion(event: H3Event, aborted = false): void {
  if (event.context.securityLogCompleted) return;
  event.context.securityLogCompleted = true;
  const status = aborted ? 499 : event.node.res.statusCode;
  requestLog(event, statusLevel(status), aborted ? "nuxt.request.aborted" : "nuxt.request.completed", {
    status,
    durationMs: performance.now() - Number(event.context.securityLogStarted ?? performance.now()),
    outcome: status >= 500 ? "failed" : status >= 400 ? "rejected" : "success",
  });
}
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook("request", async (event) => {
    event.context.securityLogStarted = performance.now();
    event.context.securityLogRequestId = randomUUID();
    setResponseHeader(event, "X-Request-ID", event.context.securityLogRequestId);
    // Native response events also cover middleware responses and interrupted streams.
    event.node.res.once("finish", () => {
      logRequestCompletion(event);
    });
    event.node.res.once("close", () => {
      if (!event.node.res.writableFinished) logRequestCompletion(event, true);
    });
    if (getCookie(event, "slk-editor")) {
      try {
        await readEditorSession(event, false);
      } catch {
        /* The route decides whether authentication is required. */
      }
    }
  });
  nitro.hooks.hook("afterResponse", (event) => {
    logRequestCompletion(event);
  });
});
