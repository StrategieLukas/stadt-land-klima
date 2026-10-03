import type { Knex } from 'knex';

const ARS_PATTERN = /^\d{12}$/;
const REQUEST_TIMEOUT_MS = 8_000;

export interface ResolverLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

export interface ResolverContext {
  database: Knex;
  env: Record<string, unknown>;
  logger: ResolverLogger;
}

interface MunicipalityRow {
  id: string | number;
  name: string | null;
  state: string | null;
  ars: string | null;
  climate_region_type: string | null;
}

interface AreaSearchResult {
  name?: string;
  ars?: string;
  is_reasonable_for_municipal_rating?: boolean;
}

interface NominatimResult {
  name?: string;
  osm_type?: 'node' | 'way' | 'relation';
  osm_id?: number;
}

interface OverpassElement {
  tags?: Record<string, string>;
}

interface ClimateRegionNode {
  ars?: string;
  climateRegionTypeData?: {
    klimaraumtypName?: string | null;
  } | null;
}

export interface ResolutionSummary {
  processed: number;
  arsResolved: number;
  climateRegionResolved: number;
  unresolved: number;
  failed: number;
}

interface ResolverConfig {
  apiBaseUrl: string;
  nominatimUrl: string;
  overpassUrl: string;
  authorization?: string;
}

function envString(env: Record<string, unknown>, key: string): string {
  return typeof env[key] === 'string' ? env[key].trim() : '';
}

function resolverConfig(env: Record<string, unknown>): ResolverConfig {
  const user = envString(env, 'SLZ_BASIC_AUTH_USER');
  const password = envString(env, 'SLZ_BASIC_AUTH_PASSWORD');

  return {
    apiBaseUrl: envString(env, 'SLZ_API_BASE_URL').replace(/\/$/, ''),
    nominatimUrl: envString(env, 'SLZ_NOMINATIM_URL').replace(/\/$/, ''),
    overpassUrl: envString(env, 'SLZ_OVERPASS_URL'),
    ...(user || password
      ? { authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}` }
      : {}),
  };
}

function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('de-DE')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function validArs(value: unknown): value is string {
  return typeof value === 'string' && ARS_PATTERN.test(value);
}

async function requestJson<T>(
  url: string,
  config: ResolverConfig,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('User-Agent', 'Stadt-Land-Klima-Directus/1.0');
  if (config.authorization) headers.set('Authorization', config.authorization);

  try {
    const response = await fetch(url, { ...init, headers, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${new URL(url).host}`);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

function pickUniqueArea(results: AreaSearchResult[], municipalityName: string): string | null {
  const normalizedName = normalizeName(municipalityName);
  const exactMatches = results.filter((result) =>
    result.is_reasonable_for_municipal_rating === true
    && typeof result.name === 'string'
    && normalizeName(result.name) === normalizedName
    && validArs(result.ars),
  );

  const uniqueArs = [...new Set(exactMatches.map((result) => result.ars as string))];
  return uniqueArs.length === 1 ? uniqueArs[0] : null;
}

async function resolveArsFromAreaSearch(
  municipalityName: string,
  config: ResolverConfig,
): Promise<string | null> {
  if (!config.apiBaseUrl) return null;

  const params = new URLSearchParams({
    q: municipalityName,
    is_reasonable_for_municipal_rating: 'true',
  });
  const response = await requestJson<{ results?: AreaSearchResult[] }>(
    `${config.apiBaseUrl}/api/search/areas/?${params}`,
    config,
  );
  return pickUniqueArea(response.results ?? [], municipalityName);
}

async function resolveArsFromNominatim(
  municipalityName: string,
  state: string | null,
  config: ResolverConfig,
): Promise<string | null> {
  if (!config.nominatimUrl || !config.overpassUrl) return null;

  const query = [municipalityName, state, 'Deutschland'].filter(Boolean).join(', ');
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    countrycodes: 'de',
    limit: '8',
  });
  const candidates = await requestJson<NominatimResult[]>(
    `${config.nominatimUrl}/search.php?${params}`,
    config,
  );
  const normalizedName = normalizeName(municipalityName);
  const exactCandidates = candidates.filter((candidate) =>
    candidate.name
    && normalizeName(candidate.name) === normalizedName
    && candidate.osm_type
    && Number.isInteger(candidate.osm_id),
  );

  for (const candidate of exactCandidates) {
    const osmType = candidate.osm_type as 'node' | 'way' | 'relation';
    const osmId = candidate.osm_id as number;
    const body = new URLSearchParams({
      data: `[out:json][timeout:10];${osmType}(${osmId});out tags;`,
    });
    const overpass = await requestJson<{ elements?: OverpassElement[] }>(
      config.overpassUrl,
      config,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
      },
    );
    const ars = overpass.elements?.[0]?.tags?.['de:regionalschluessel'];
    if (validArs(ars)) return ars;
  }

  return null;
}

async function resolveArs(
  municipality: MunicipalityRow,
  config: ResolverConfig,
  logger: ResolverLogger,
): Promise<string | null> {
  if (!municipality.name) return null;

  try {
    const ars = await resolveArsFromAreaSearch(municipality.name, config);
    if (ars) return ars;
  } catch (error) {
    logger.warn(`[municipality-climate-region] SLZ area search failed for municipality ${municipality.id}: ${String(error)}`);
  }

  try {
    return await resolveArsFromNominatim(municipality.name, municipality.state, config);
  } catch (error) {
    logger.warn(`[municipality-climate-region] Nominatim/Overpass lookup failed for municipality ${municipality.id}: ${String(error)}`);
    return null;
  }
}

async function resolveClimateRegionType(
  ars: string,
  config: ResolverConfig,
): Promise<string | null> {
  if (!config.apiBaseUrl) return null;

  const response = await requestJson<{
    data?: {
      allAdministrativeAreas?: {
        edges?: Array<{ node?: ClimateRegionNode }>;
      };
    };
    errors?: Array<{ message?: string }>;
  }>(
    `${config.apiBaseUrl}/graphql/`,
    config,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query MunicipalityClimateRegion($ars: String!) {
          allAdministrativeAreas(ars: $ars, first: 5) {
            edges {
              node {
                ars
                climateRegionTypeData {
                  klimaraumtypName
                }
              }
            }
          }
        }`,
        variables: { ars },
      }),
    },
  );

  if (response.errors?.length) {
    throw new Error(response.errors.map((error) => error.message).filter(Boolean).join('; ') || 'GraphQL request failed');
  }

  const matchingNode = response.data?.allAdministrativeAreas?.edges
    ?.map((edge) => edge.node)
    .find((node) => node?.ars === ars);
  const climateRegionType = matchingNode?.climateRegionTypeData?.klimaraumtypName?.trim();
  return climateRegionType || null;
}

async function readMunicipality(
  database: Knex,
  municipalityId: string | number,
): Promise<MunicipalityRow | null> {
  return await database('municipalities')
    .select('id', 'name', 'state', 'ars', 'climate_region_type')
    .where({ id: municipalityId })
    .first() as MunicipalityRow | null;
}

async function resolveMunicipality(
  municipality: MunicipalityRow,
  context: ResolverContext,
  config: ResolverConfig,
): Promise<{ arsResolved: boolean; climateRegionResolved: boolean; unresolved: boolean }> {
  const update: Partial<Pick<MunicipalityRow, 'ars' | 'climate_region_type'>> = {};
  let ars = validArs(municipality.ars) ? municipality.ars : null;

  if (!ars) {
    ars = await resolveArs(municipality, config, context.logger);
    if (ars) update.ars = ars;
  }

  if (ars && !municipality.climate_region_type?.trim()) {
    try {
      const climateRegionType = await resolveClimateRegionType(ars, config);
      if (climateRegionType) update.climate_region_type = climateRegionType;
    } catch (error) {
      context.logger.warn(`[municipality-climate-region] Climate region lookup failed for municipality ${municipality.id}: ${String(error)}`);
    }
  }

  if (Object.keys(update).length > 0) {
    await context.database('municipalities').where({ id: municipality.id }).update(update);
  }

  return {
    arsResolved: Boolean(update.ars),
    climateRegionResolved: Boolean(update.climate_region_type),
    unresolved: !ars || (!municipality.climate_region_type?.trim() && !update.climate_region_type),
  };
}

export async function resolveMunicipalityById(
  municipalityId: string | number,
  context: ResolverContext,
): Promise<void> {
  const municipality = await readMunicipality(context.database, municipalityId);
  if (!municipality) return;
  if (validArs(municipality.ars) && municipality.climate_region_type?.trim()) return;

  await resolveMunicipality(municipality, context, resolverConfig(context.env));
}

export async function resolveMissingMunicipalityData(
  context: ResolverContext,
): Promise<ResolutionSummary> {
  const rows = await context.database('municipalities')
    .select('id', 'name', 'state', 'ars', 'climate_region_type') as MunicipalityRow[];
  const municipalities = rows.filter((municipality) =>
    !validArs(municipality.ars) || !municipality.climate_region_type?.trim(),
  );
  const summary: ResolutionSummary = {
    processed: municipalities.length,
    arsResolved: 0,
    climateRegionResolved: 0,
    unresolved: 0,
    failed: 0,
  };
  const config = resolverConfig(context.env);

  for (const municipality of municipalities) {
    try {
      const result = await resolveMunicipality(municipality, context, config);
      if (result.arsResolved) summary.arsResolved += 1;
      if (result.climateRegionResolved) summary.climateRegionResolved += 1;
      if (result.unresolved) summary.unresolved += 1;
    } catch (error) {
      summary.failed += 1;
      context.logger.error(`[municipality-climate-region] Failed to resolve municipality ${municipality.id}: ${String(error)}`);
    }
  }

  context.logger.info(`[municipality-climate-region] Resolution finished: ${JSON.stringify(summary)}`);
  return summary;
}
