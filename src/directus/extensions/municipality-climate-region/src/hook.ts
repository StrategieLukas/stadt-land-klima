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
        context.logger.warn("[municipality-climate-region] Municipality lookup failed");
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
      context.logger.error("[municipality-climate-region] Scheduled resolution failed");
    }
  });
});
