import path from "path";
import createDirectusClient from "../shared/createDirectusClient.ts";
import type { TaskOptions } from "../shared/models.ts";
import { RecordSchema } from "../shared/models.ts";
import readYamlFile from "../shared/readYamlFile.ts";
import { isDeepStrictEqual } from "node:util";

/** A lost PATCH response is ambiguous: verify every intended value, never blindly replay it. */
export async function applySettings(
  baseUrl: string,
  token: string,
  settings: Record<string, unknown>,
  fetcher: typeof globalThis.fetch = globalThis.fetch,
  wait: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 1000)),
): Promise<boolean> {
  const url = `${baseUrl.replace(/\/$/, "")}/settings`;
  const headers = { Authorization: `Bearer ${token}` };
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "PATCH",
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
  } catch {
    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt) await wait();
      try {
        const read = await fetcher(url, { headers, redirect: "error", signal: AbortSignal.timeout(5000) });
        if (read.status === 401 || read.status === 403) break;
        if (!read.ok) continue;
        const body = RecordSchema.parse(await read.json());
        const actual = RecordSchema.parse(body.data);
        if (
          Object.entries(settings).every(
            ([key, value]) => Object.hasOwn(actual, key) && isDeepStrictEqual(actual[key], value),
          )
        )
          return true;
      } catch {
        // Transient reads may recover; missing/masked/different settings never count as success.
      }
    }
    throw new Error(
      "Settings update response was lost and persisted values could not be verified; no write was retried.",
    );
  }
  if (!response.ok) throw new Error(`Settings import failed (HTTP ${response.status}).`);
  return false;
}

// Sensitive settings fields that should be populated from environment variables
// These are filtered out during export and merged during import
const SENSITIVE_SETTINGS_FIELDS: Record<string, string> = {
  mapbox_key: "string",
  ai_openai_api_key: "string",
  ai_anthropic_api_key: "string",
  ai_google_api_key: "string",
  ai_openai_compatible_api_key: "string",
  ai_openai_compatible_headers: "json",
  // Public branding assets that are managed separately
  project_logo: "json",
  public_foreground: "string",
  public_background: "string",
  public_favicon: "json",
};

// Wildcard pattern to catch any field containing "key" (case-insensitive)
const WILDCARD_PATTERN = /key/i;

/**
 * Parses a string value based on the expected field type
 * - 'string': returns value as-is
 * - 'json': attempts to parse as JSON, falls back to string
 */
function parseValue(value: string, type: string): unknown {
  if (type === "json") {
    try {
      return JSON.parse(value);
    } catch (e) {
      // If parsing fails, return as string
      return value;
    }
  }
  return value;
}

/**
 * Merges environment variables into settings for sensitive fields
 * Automatically detects all DIRECTUS_* environment variables and maps them
 * to setting fields by removing the DIRECTUS_ prefix and converting to lowercase.
 * Only merges fields that are in SENSITIVE_SETTINGS_FIELDS or match wildcard patterns.
 */
function mergeEnvSettings(settings: Record<string, unknown>, verbose = false) {
  const merged = { ...settings };
  let mergedCount = 0;

  for (const [envVar, envValue] of Object.entries(process.env)) {
    if (envVar.startsWith("DIRECTUS_") && envValue !== undefined && envValue !== null && envValue !== "") {
      // Remove DIRECTUS_ prefix and convert to lowercase
      const settingField = envVar.slice("DIRECTUS_".length).toLowerCase();

      // Check if this field should be merged
      // Either it's in our known list, or it matches a wildcard pattern
      const isKnownField = Object.hasOwn(SENSITIVE_SETTINGS_FIELDS, settingField);
      const matchesWildcard = WILDCARD_PATTERN.test(settingField);

      if (isKnownField || matchesWildcard) {
        const fieldType = isKnownField ? SENSITIVE_SETTINGS_FIELDS[settingField] : "string";
        merged[settingField] = parseValue(envValue, fieldType);
        mergedCount++;
        if (verbose) {
          console.info(`Merged ${settingField} (type: ${fieldType}) from ${envVar} environment variable`);
        }
      }
    }
  }

  return { merged, mergedCount };
}

async function importSettings(src: string, options: TaskOptions = {}) {
  createDirectusClient();

  try {
    const settings = readYamlFile(path.join(src, "settings.yaml"), RecordSchema);

    // Merge environment variables for sensitive fields
    const { merged: settingsWithEnv, mergedCount } = mergeEnvSettings(settings, options.verbose);

    // Use PATCH request to avoid the SDK's full update behavior
    // Directus 11.17.4 has a bug with updateSettings and parameter counting
    const directusUrl = process.env.FRONTEND_DIRECTUS_URL || "http://directus:8055";
    const token = process.env.CLI_DIRECTUS_STATIC_TOKEN;

    const recovered = await applySettings(directusUrl, token!, settingsWithEnv);

    if (options.verbose) {
      console.info("Settings imported");
      if (recovered) console.info("Persisted settings verified after a lost update response; no write was retried.");
      if (mergedCount > 0) {
        console.info(`Merged ${mergedCount} sensitive field(s) from environment variables`);
      }
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export default importSettings;
