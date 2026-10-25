import { defineOperationApi } from "@directus/extensions-sdk";
import { createError } from "@directus/errors";
import { resolveMissingMunicipalityData } from "../resolver.js";

const Forbidden = createError(
  "FORBIDDEN",
  "Only administrators can resolve climate regions for all municipalities.",
  403,
);

export default defineOperationApi({
  id: "operation-resolve-municipality-climate-regions",
  handler: async (_options, context) => {
    if (!context.accountability?.admin) throw new Forbidden();
    return resolveMissingMunicipalityData(context);
  },
});
