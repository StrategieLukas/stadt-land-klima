import { defineNuxtPlugin, type Plugin } from "#app";
import { clientDiagnostic } from "~/shared/securityLog";

/** DevTools read storage during module evaluation, before Nuxt can hydrate. */
export function optionalDevtools(loader: () => Promise<{ default: unknown }>) {
  return defineNuxtPlugin(async (app) => {
    // Widgets do not need the developer overlay or its cross-window/storage access.
    if (window.self !== window.top) return;
    try {
      window.localStorage.getItem("nuxt-devtools-frame-state");
    } catch {
      return;
    }
    try {
      const plugin = (await loader()).default;
      if (typeof plugin === "function") await app.runWithContext(() => (plugin as Plugin)(app));
    } catch {
      clientDiagnostic("app.devtools.optional.degraded", "warn");
    }
  });
}
