import { DeepLSettingsSchema, deepLNamespace } from "../../../src/frontend/server/utils/deepLTranslation.js";

// Reads only non-secret settings. No provider, source read or API key is required.
console.log(
  deepLNamespace(
    DeepLSettingsSchema.parse({
      endpoint: process.env.DEEPL_API_ENDPOINT ?? "auto",
      model: process.env.DEEPL_MODEL ?? "prefer_quality_optimized",
      glossaryEn: process.env.DEEPL_GLOSSARY_EN ?? "",
      glossaryIt: process.env.DEEPL_GLOSSARY_IT ?? "",
      policyRevision: process.env.DEEPL_POLICY_REVISION ?? "v1",
    }),
  ),
);
