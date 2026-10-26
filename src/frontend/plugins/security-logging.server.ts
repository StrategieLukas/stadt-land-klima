import { defineNuxtPlugin, useRequestEvent } from "#app";
import { configureServerDiagnostics } from "~/shared/securityLog";
import { requestLog, requestFailure, systemLog } from "../server/utils/securityLogging";

export default defineNuxtPlugin({
  name: "security-logging",
  enforce: "pre",
  setup(app) {
    // Resolve Nuxt context at call time; never capture one user's request in a global reporter.
    configureServerDiagnostics((code, level) => {
      let event;
      try {
        event = useRequestEvent();
      } catch {
        /* Background work has no Nuxt request. */
      }
      if (event) requestLog(event, level, code);
      else systemLog(level, code);
    });
    const event = useRequestEvent();
    if (!event) return;
    app.hook("app:error", (error) => {
      requestFailure(event, "nuxt.app.failed", error);
    });
    app.hook("vue:error", (error) => {
      requestFailure(event, "nuxt.vue.failed", error);
    });
  },
});
