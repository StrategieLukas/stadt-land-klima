import type { ApiExtensionContext } from "@directus/types";
import { z } from "zod";

const ARS_PATTERN = /^\d{12}$/;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const PAGE_SIZE = 100;
const idSchema = z.union([z.string().min(1).max(100), z.number().int().positive().safe()]);
const municipalitySchema = z.object({
  id: idSchema,
  name: z.string().max(255).nullable(),
  state: z.string().max(255).nullable(),
  ars: z.string().nullable(),
  climate_region_type: z.string().max(255).nullable(),
});
const areaSearchSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string().max(255).optional(),
        ars: z.string().max(32).optional(),
        is_reasonable_for_municipal_rating: z.boolean().optional(),
      }),
    )
    .max(100),
});
const osmTypeSchema = z.enum(["node", "way", "relation"]);
const osmIdSchema = z.number().int().positive().safe();
const nominatimSchema = z
  .array(
    z.object({
      name: z.string().max(255).optional(),
      osm_type: osmTypeSchema.optional(),
      osm_id: osmIdSchema.optional(),
      address: z.object({ state: z.string().max(255).optional() }).optional(),
    }),
  )
  .max(8);
const overpassSchema = z.object({
  elements: z
    .array(
      z.object({
        type: osmTypeSchema,
        id: osmIdSchema,
        tags: z.record(z.string(), z.string()).optional(),
      }),
    )
    .max(8),
});
const climateRegionSchema = z.object({
  type: z.literal("FeatureCollection"),
  numberMatched: z.number().int().nonnegative(),
  numberReturned: z.number().int().nonnegative(),
  features: z
    .array(
      z.object({
        type: z.literal("Feature"),
        properties: z.object({
          area_ars: z.string().regex(ARS_PATTERN),
          klimaraumtyp_name: z.string().trim().max(255).nullable(),
        }),
      }),
    )
    .max(2),
});

type Municipality = z.infer<typeof municipalitySchema>;
export type ResolverLogger = Pick<ApiExtensionContext["logger"], "info" | "warn" | "error">;
export type ResolverContext = {
  database: ApiExtensionContext["database"];
  env: Record<string, unknown>;
  logger: ResolverLogger;
};
export interface ResolutionSummary {
  processed: number;
  arsResolved: number;
  climateRegionResolved: number;
  unresolved: number;
  failed: number;
}
type Outcome = { arsResolved: boolean; climateRegionResolved: boolean; unresolved: boolean };
type ResolverConfig = {
  apiBaseUrl: string;
  nominatimUrl: string;
  overpassUrl: string;
  authorization: string | undefined;
  origins: Set<string>;
};
const batches = new WeakMap<ResolverContext["database"], Promise<ResolutionSummary>>();
const pendingRows = new WeakMap<ResolverContext["database"], Map<string, Promise<Outcome>>>();

function envString(env: Record<string, unknown>, key: string): string {
  const value = env[key];
  return typeof value === "string" ? value.trim() : "";
}

function configuredUrl(env: Record<string, unknown>, key: string): string {
  const value = envString(env, key);
  if (!value) return "";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid climate-region service URL");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Invalid climate-region service URL");
  }
  return url.href.replace(/\/+$/, "");
}

function resolverConfig(env: Record<string, unknown>): ResolverConfig {
  const user = envString(env, "SLZ_BASIC_AUTH_USER");
  const password = envString(env, "SLZ_BASIC_AUTH_PASSWORD");
  if (!!user !== !!password) throw new Error("Incomplete climate-region service credentials");
  const apiBaseUrl = configuredUrl(env, "SLZ_API_BASE_URL");
  const nominatimUrl = configuredUrl(env, "SLZ_NOMINATIM_URL");
  const overpassUrl = configuredUrl(env, "SLZ_OVERPASS_URL");
  return {
    apiBaseUrl,
    nominatimUrl,
    overpassUrl,
    authorization: user ? `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}` : undefined,
    // All three URLs are operator-owned service configuration, never response URLs or CMS input.
    origins: new Set([apiBaseUrl, nominatimUrl, overpassUrl].filter(Boolean).map((url) => new URL(url).origin)),
  };
}

function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function validArs(value: unknown): value is string {
  return typeof value === "string" && ARS_PATTERN.test(value);
}

async function requestJson<T extends z.ZodType>(
  url: string,
  config: ResolverConfig,
  schema: T,
  init: RequestInit = {},
): Promise<z.output<T>> {
  if (!config.origins.has(new URL(url).origin)) throw new Error("Unconfigured upstream origin");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("User-Agent", "Stadt-Land-Klima-Directus/1.0");
  if (config.authorization) headers.set("Authorization", config.authorization);
  try {
    const response = await fetch(url, { ...init, headers, redirect: "error", signal: controller.signal });
    if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}`);
    const contentLength = Number(response.headers.get("content-length"));
    if (contentLength > MAX_RESPONSE_BYTES) throw new Error("Upstream response too large");
    if (!response.body) throw new Error("Empty upstream response");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_RESPONSE_BYTES) {
          controller.abort();
          throw new Error("Upstream response too large");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return schema.parse(body);
  } finally {
    clearTimeout(timeout);
  }
}

function uniqueArs(values: unknown[]): string | null {
  const ars = [...new Set(values.filter(validArs))];
  return ars.length === 1 ? ars[0]! : null;
}

async function resolveArs(
  municipality: Municipality,
  config: ResolverConfig,
  logger: ResolverLogger,
): Promise<string | null> {
  if (!municipality.name?.trim()) return null;
  const name = normalizeName(municipality.name);
  if (config.apiBaseUrl) {
    try {
      const params = new URLSearchParams({ q: municipality.name, is_reasonable_for_municipal_rating: "true" });
      const response = await requestJson(`${config.apiBaseUrl}/api/search/areas/?${params}`, config, areaSearchSchema);
      const ars = uniqueArs(
        response.results
          .filter(
            (area) =>
              area.is_reasonable_for_municipal_rating === true && area.name && normalizeName(area.name) === name,
          )
          .map((area) => area.ars),
      );
      if (ars) return ars;
    } catch {
      logger.warn(`[municipality-climate-region] Area search failed for municipality ${municipality.id}`);
    }
  }
  if (!config.nominatimUrl || !config.overpassUrl) return null;
  try {
    const params = new URLSearchParams({
      q: [municipality.name, municipality.state, "Deutschland"].filter(Boolean).join(", "),
      format: "jsonv2",
      countrycodes: "de",
      addressdetails: "1",
      "accept-language": "de",
      limit: "8",
    });
    const response = await requestJson(`${config.nominatimUrl}/search?${params}`, config, nominatimSchema);
    const candidates = response.filter(
      (candidate) =>
        candidate.name &&
        normalizeName(candidate.name) === name &&
        candidate.osm_type &&
        candidate.osm_id &&
        (!municipality.state ||
          !candidate.address?.state ||
          normalizeName(candidate.address.state) === normalizeName(municipality.state)),
    );
    if (!candidates.length) return null;
    const queries = candidates.map((candidate) => `${candidate.osm_type}(${candidate.osm_id});`).join("");
    const overpass = await requestJson(config.overpassUrl, config, overpassSchema, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ data: `[out:json][timeout:6];(${queries});out tags;` }),
    });
    return uniqueArs(
      overpass.elements
        .filter((element) =>
          candidates.some((candidate) => candidate.osm_type === element.type && candidate.osm_id === element.id),
        )
        .map((element) => element.tags?.["de:regionalschluessel"]),
    );
  } catch {
    logger.warn(`[municipality-climate-region] Nominatim/Overpass lookup failed for municipality ${municipality.id}`);
    return null;
  }
}

async function resolveClimateRegionType(ars: string, config: ResolverConfig): Promise<string | null> {
  if (!config.apiBaseUrl) return null;
  const url = new URL(`${config.apiBaseUrl}/api/collections/climate-region-type/items/`);
  url.searchParams.set("area", ars);
  url.searchParams.set("limit", "2");
  const response = await requestJson(url.href, config, climateRegionSchema);
  // Never assign a different municipality, an ambiguous edition, or a truncated result.
  if (response.numberMatched !== 1 || response.numberReturned !== 1 || response.features.length !== 1) return null;
  const feature = response.features[0]!;
  return feature.properties.area_ars === ars ? feature.properties.klimaraumtyp_name || null : null;
}

function needsResolution(municipality: Municipality): boolean {
  return !validArs(municipality.ars) || !municipality.climate_region_type?.trim();
}

async function resolveMunicipality(
  municipality: Municipality,
  context: ResolverContext,
  config: ResolverConfig,
): Promise<Outcome> {
  const update: Partial<Pick<Municipality, "ars" | "climate_region_type">> = {};
  let ars = validArs(municipality.ars) ? municipality.ars : null;
  if (!ars) {
    ars = await resolveArs(municipality, config, context.logger);
    if (ars) update.ars = ars;
  }
  if (ars && !municipality.climate_region_type?.trim()) {
    try {
      const climateRegion = await resolveClimateRegionType(ars, config);
      if (climateRegion) update.climate_region_type = climateRegion;
    } catch {
      context.logger.warn(
        `[municipality-climate-region] Climate region lookup failed for municipality ${municipality.id}`,
      );
    }
  }
  if (Object.keys(update).length) {
    // Keep operator changes, including changes made while an upstream request was pending.
    const affected = await context
      .database("municipalities")
      .where({
        id: municipality.id,
        name: municipality.name,
        state: municipality.state,
        ars: municipality.ars,
        climate_region_type: municipality.climate_region_type,
      })
      .update(update);
    if (!affected) return { arsResolved: false, climateRegionResolved: false, unresolved: true };
  }
  return {
    arsResolved: !!update.ars,
    climateRegionResolved: !!update.climate_region_type,
    unresolved: !ars || (!municipality.climate_region_type?.trim() && !update.climate_region_type),
  };
}

function resolveRow(municipality: Municipality, context: ResolverContext, config: ResolverConfig): Promise<Outcome> {
  let rows = pendingRows.get(context.database);
  if (!rows) {
    rows = new Map();
    pendingRows.set(context.database, rows);
  }
  const key = String(municipality.id);
  const existing = rows.get(key);
  if (existing) return existing;
  const pending = resolveMunicipality(municipality, context, config).finally(() => rows.delete(key));
  rows.set(key, pending);
  return pending;
}

export async function resolveMunicipalityById(
  municipalityId: string | number,
  context: ResolverContext,
): Promise<void> {
  const id = idSchema.parse(municipalityId);
  const row: unknown = await context
    .database("municipalities")
    .select("id", "name", "state", "ars", "climate_region_type")
    .where({ id })
    .first();
  if (!row) return;
  const municipality = municipalitySchema.parse(row);
  if (!needsResolution(municipality)) return;
  await resolveRow(municipality, context, resolverConfig(context.env));
}

async function runBatch(context: ResolverContext): Promise<ResolutionSummary> {
  const summary: ResolutionSummary = {
    processed: 0,
    arsResolved: 0,
    climateRegionResolved: 0,
    unresolved: 0,
    failed: 0,
  };
  const config = resolverConfig(context.env);
  let cursor: Municipality["id"] | undefined;
  while (true) {
    const query = context
      .database("municipalities")
      .select("id", "name", "state", "ars", "climate_region_type")
      .orderBy("id")
      .limit(PAGE_SIZE);
    if (cursor !== undefined) query.where("id", ">", cursor);
    const rows = z
      .array(municipalitySchema)
      .max(PAGE_SIZE)
      .parse(await query);
    if (!rows.length) break;
    for (const municipality of rows) {
      if (!needsResolution(municipality)) continue;
      summary.processed++;
      try {
        const result = await resolveRow(municipality, context, config);
        if (result.arsResolved) summary.arsResolved++;
        if (result.climateRegionResolved) summary.climateRegionResolved++;
        if (result.unresolved) summary.unresolved++;
      } catch {
        summary.failed++;
        context.logger.error(`[municipality-climate-region] Resolution failed for municipality ${municipality.id}`);
      }
    }
    cursor = rows.at(-1)!.id;
    if (rows.length < PAGE_SIZE) break;
  }
  context.logger.info(`[municipality-climate-region] Resolution finished: ${JSON.stringify(summary)}`);
  return summary;
}

/** Share one bounded, sequential batch between the daily schedule and manual operation. */
export function resolveMissingMunicipalityData(context: ResolverContext): Promise<ResolutionSummary> {
  const existing = batches.get(context.database);
  if (existing) return existing;
  const pending = runBatch(context).finally(() => batches.delete(context.database));
  batches.set(context.database, pending);
  return pending;
}
