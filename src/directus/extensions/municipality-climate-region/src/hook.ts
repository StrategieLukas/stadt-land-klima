import { extensionLog } from "../../shared/securityLogger.ts";
import { defineHook } from "@directus/extensions-sdk";
import { resolveMissingMunicipalityData, resolveMunicipalityById } from "./resolver.js";

type ActionMeta = {
  collection?: string;
  key?: string | number;
  keys?: Array<string | number>;
  payload?: Record<string, unknown>;
};

export default defineHook(({ action, schedule }, context) => {
  const resolve = async (meta: ActionMeta) => {
    if (meta.collection !== "municipalities") return;
    for (const id of meta.key !== undefined ? [meta.key] : (meta.keys ?? [])) {
      try {
        await resolveMunicipalityById(id, context);
      } catch {
        extensionLog(context.logger, "warn", "app.municipality-climate-region.hook.degraded");
      }
    }
  };
  action("items.create", resolve);
  action("items.update", async (meta: ActionMeta) => {
    if (meta.payload && !["ars", "name", "state", "climate_region_type"].some((key) => key in meta.payload!)) return;
    await resolve(meta);
  });
  schedule("0 3 * * *", async () => {
    try {
      await resolveMissingMunicipalityData(context);
    } catch {
      extensionLog(context.logger, "error", "app.municipality-climate-region.hook.failed");
    }
  });
});
