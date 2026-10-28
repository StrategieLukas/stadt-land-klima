import { cmsRows } from "~/server/utils/cmsValue";
import { z } from "zod";
import { CatalogSchema, type Catalog } from "~/shared/contracts/search";
import { CONTENT_LOCALE_QUERY } from "~/shared/contentTranslation";
import {
  MunicipalityIdentitySchema,
  MunicipalityDetailSchema,
  MunicipalityPageSchema,
  MeasureSchema,
  RatingSchema,
  ScoreSchema,
} from "~/shared/contracts/municipality";
import type { Sector } from "~/shared/domain";
import { parseCms } from "./parseCms";
import { queryText } from "./publicQuery";
import { readItems } from "@directus/sdk";
import { createError, getHeader, getQuery, getRouterParam, setResponseHeader, type H3Event } from "h3";
import { createDirectusServerClient } from "./directusServerClient";
import { verifyMunicipalityPreview } from "./municipalityPreview";

type Client = ReturnType<typeof createDirectusServerClient>;

const catalogFields = ["id", "name", "isCurrentFrontend", "isCurrentBackend", "date_created"];
const municipalityFields = [
  "id",
  "name",
  "slug",
  "ars",
  "status",
  "state",
  "population",
  "municipality_type",
  "climate_region_type",
  "description",
  "image",
  "image_credits",
  "mayor",
  "party_mayor",
  "public_contact",
  "overall_status_comment",
  "date_created",
  "date_updated",
];
const scoreFields = [
  "id",
  "published",
  "preview_enabled",
  "percentage_rated",
  "score_total",
  "score_max",
  "score_points",
  "rank",
  "score_agriculture",
  "score_buildings",
  "score_energy",
  "score_industry",
  "score_management",
  "score_transport",
  "date_created",
  "date_updated",
];
export const publicMeasureFields = [
  "id",
  "measure_id",
  "name",
  "slug",
  "sector",
  "weight",
  "image",
  "image_credits",
  "description",
  "description_about",
  "description_benefit",
  "description_contribution",
  "description_implementation",
  "description_funding",
  "description_legal",
  "description_evaluation_criteria",
  "description_verification",
  "description_tutorial",
  "impact",
  "feasibility_economical",
  "feasibility_political",
];
const ratingFields = [
  "id",
  "measure_id",
  "rating",
  "applicable",
  "why_not_applicable",
  "current_progress",
  "source",
  "date_updated",
];

export async function readMunicipalityCatalogs(client: Client): Promise<Catalog[]> {
  const rows = await client
    .request(
      readItems("measure_catalog", {
        fields: catalogFields,
        filter: { hidden: { _eq: false } },
        limit: 101,
      }),
    )
    .then(cmsRows);
  if (rows.length > 100) throw createError({ statusCode: 502, statusMessage: "Catalog limit exceeded" });
  return parseCms(z.array(CatalogSchema), rows);
}

export function catalogForRequest(catalogs: Catalog[], name: unknown, preview: boolean): Catalog {
  const requested = queryText(name, 100);
  const selected = requested
    ? catalogs.find((catalog) => catalog.name === requested)
    : catalogs.find((catalog) => (preview ? catalog.isCurrentBackend : catalog.isCurrentFrontend));
  if (!selected) throw createError({ statusCode: 404, statusMessage: "Catalog not found" });
  return selected;
}

export async function loadMunicipalityPageData(
  client: Client,
  slug: string,
  catalogName?: string,
  previewToken?: string,
) {
  const catalogs = await readMunicipalityCatalogs(client);
  const selectedCatalogVersion = catalogForRequest(catalogs, catalogName, !!previewToken);
  const rows = await client
    .request(
      readItems("municipalities", {
        filter: { _or: [{ slug: { _eq: slug } }, { ars: { _eq: slug } }] },
        fields: ["id", "name", "slug", "ars", "status", "localteam_id.id", "localteam_id.date_created"],
        limit: 1,
      }),
    )
    .then(cmsRows);
  const municipality = parseCms(z.array(MunicipalityIdentitySchema), rows)[0];
  const empty: z.output<typeof MunicipalityPageSchema> = {
    selectedCatalogVersion,
    municipality: null,
    directusData: {},
    previewAuthorized: false,
  };
  if (!municipality) {
    if (previewToken) throw createError({ statusCode: 404, statusMessage: "Preview not found" });
    return empty;
  }

  let previewAuthorized = false;
  if (previewToken) {
    // This verification record never becomes part of the response or Nuxt state.
    previewAuthorized = await verifyMunicipalityPreview(municipality.id, previewToken);
    if (!previewAuthorized) throw createError({ statusCode: 404, statusMessage: "Preview not found" });
  }

  const safeIdentity = municipality;
  const result = { ...empty, municipality: safeIdentity, previewAuthorized };
  const scores = await client
    .request(
      readItems("municipality_scores", {
        filter: {
          municipality: { _eq: municipality.id },
          catalog_version: { _eq: selectedCatalogVersion.id },
          ...(!previewAuthorized ? { published: { _eq: true } } : {}),
        },
        fields: scoreFields,
        limit: 1,
      }),
    )
    .then(cmsRows);
  const score = parseCms(z.array(ScoreSchema), scores)[0];
  if (previewAuthorized && score?.preview_enabled !== true) {
    throw createError({ statusCode: 404, statusMessage: "Preview not enabled" });
  }
  if (!score) return result;

  const [details, measures, ratings] = await Promise.all([
    client
      .request(
        readItems("municipalities", {
          filter: { id: { _eq: municipality.id } },
          fields: [...municipalityFields, "geolocation"],
          limit: 1,
        }),
      )
      .then(cmsRows),
    client
      .request(
        readItems("measures", {
          filter: { catalog_version: { _eq: selectedCatalogVersion.id }, status: { _eq: "published" } },
          fields: publicMeasureFields,
          limit: 501,
        }),
      )
      .then(cmsRows),
    municipality.localteam_id?.id
      ? client
          .request(
            readItems("ratings_measures", {
              filter: {
                localteam_id: { _eq: municipality.localteam_id.id },
                measure_id: { catalog_version: { _eq: selectedCatalogVersion.id }, status: { _eq: "published" } },
                ...(!previewAuthorized ? { status: { _eq: "published" }, approved: { _eq: true } } : {}),
              },
              fields: ratingFields,
              limit: 501,
            }),
          )
          .then(cmsRows)
      : Promise.resolve([]),
  ]);
  if (measures.length > 500 || ratings.length > 500) {
    throw createError({ statusCode: 502, statusMessage: "Municipality data limit exceeded" });
  }
  const safeMeasures = parseCms(z.array(MeasureSchema), measures);
  const measureById = new Map(safeMeasures.map((measure) => [measure.id, measure]));
  const ratingsBySector: Partial<
    Record<Sector, (z.output<typeof RatingSchema> & { measure: z.output<typeof MeasureSchema> })[]>
  > = {};
  const ratedIds = new Set<string>();
  for (const row of parseCms(z.array(RatingSchema), ratings)) {
    const measure = measureById.get(row.measure_id);
    if (!measure) continue;
    const rating = { ...row };
    if (rating.applicable === false) rating.rating = null;
    (ratingsBySector[measure.sector] ??= []).push({ ...rating, measure });
    ratedIds.add(measure.id);
  }
  if (previewAuthorized) {
    for (const measure of safeMeasures) {
      if (!ratedIds.has(measure.id)) {
        (ratingsBySector[measure.sector] ??= []).push({
          id: `unrated-${measure.id}`,
          measure_id: measure.id,
          measure,
          rating: null,
          applicable: null,
          why_not_applicable: null,
          current_progress: null,
          source: null,
          date_updated: null,
        });
      }
    }
  }
  for (const ratings of Object.values(ratingsBySector)) {
    ratings.sort(
      (a, b) =>
        (b.rating == null ? -1 : b.rating) - (a.rating == null ? -1 : a.rating) ||
        a.measure.measure_id.localeCompare(b.measure.measure_id, undefined, { numeric: true }),
    );
  }
  return parseCms(MunicipalityPageSchema, {
    ...result,
    directusData: {
      municipalityScore: {
        ...score,
        catalog_version: selectedCatalogVersion,
        municipality: {
          ...parseCms(MunicipalityDetailSchema, {
            ...(details[0] ?? municipality),
            localteam_id: safeIdentity.localteam_id,
          }),
        },
      },
      ratingsBySector,
    },
  });
}

export async function municipalityPageHandler(event: H3Event, preview: boolean) {
  // Both paths start uncached; no preview response may populate a public cache.
  setResponseHeader(event, "Cache-Control", "private, no-store");
  const slug = getRouterParam(event, "slug") ?? "";
  const query = getQuery(event);
  const contentLocale = query[CONTENT_LOCALE_QUERY];
  if (
    !/^[a-z0-9-]{1,160}$/.test(slug) ||
    Object.keys(query).some((key) => key !== "v" && (preview || key !== CONTENT_LOCALE_QUERY)) ||
    (contentLocale !== undefined && (typeof contentLocale !== "string" || contentLocale.length > 64)) ||
    (query.v !== undefined && (typeof query.v !== "string" || query.v.length > 100))
  ) {
    throw createError({ statusCode: 400, statusMessage: "Invalid municipality request" });
  }
  const token = preview ? getHeader(event, "x-preview-token") : undefined;
  if (preview && (!token || !/^[A-Za-z0-9_-]{16,256}$/.test(token))) {
    throw createError({ statusCode: 404, statusMessage: "Preview not found" });
  }
  try {
    return await loadMunicipalityPageData(createDirectusServerClient(), slug, query.v, token);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      (error.statusCode === 404 || error.statusCode === 503)
    )
      throw error;
    // SDK errors can contain private filter values and upstream response data.
    throw createError({ statusCode: 502, statusMessage: "Municipality data unavailable" });
  }
}
