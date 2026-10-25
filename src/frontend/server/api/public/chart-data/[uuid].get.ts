import { cmsRecord, cmsString, cmsRows } from "~/server/utils/cmsValue";
import { readItems } from "@directus/sdk";
import { createError, defineEventHandler, getRouterParam, getQuery, setResponseHeader } from "h3";
import { z } from "zod";
import { defaultVegaQuery } from "../../../../shared/vegaQuery";
import { createDirectusServerClient } from "../../../utils/directusServerClient";
import { readPublicBlocks } from "../../../utils/publicBlocks";
import { readPublicItems } from "../../../utils/publicItems";
import { publicMeasureFields } from "../../../utils/municipalityPageData";

const querySchema = z
  .object({
    collection: z.enum(["ratings_measures", "municipality_scores", "municipalities", "measures", "measure_catalog"]),
    query: z
      .object({
        fields: z.array(z.string()).min(1).max(100),
        filter: z.record(z.string(), z.unknown()).optional(),
        sort: z.array(z.string()).optional(),
        limit: z.number().int().min(-1).max(10000).optional(),
      })
      .strict(),
    dataPath: z.string().optional(),
  })
  .strict();
const municipalityFields = [
  "id",
  "name",
  "slug",
  "ars",
  "state",
  "population",
  "municipality_type",
  "geolocation",
  "localteam_id",
];
const scoreFields = [
  "id",
  "published",
  "percentage_rated",
  "score_total",
  "score_points",
  "score_max",
  "rank",
  "catalog_version",
  "score_energy",
  "score_buildings",
  "score_transport",
  "score_industry",
  "score_agriculture",
  "score_management",
];
const fieldsByCollection = {
  ratings_measures: [
    "id",
    "rating",
    "applicable",
    "measure_id",
    "localteam_id",
    ...publicMeasureFields.map((field) => `measure_id.${field}`),
  ],
  municipality_scores: [...scoreFields, ...municipalityFields.map((field) => `municipality.${field}`)],
  municipalities: municipalityFields,
  measures: [...publicMeasureFields, "catalog_version", "catalog_version.name"],
  measure_catalog: ["id", "name", "isCurrentFrontend", "isCurrentBackend", "date_created"],
};

export default defineEventHandler(async (event) => {
  const uuid = getRouterParam(event, "uuid");
  if (!uuid || !/^[\w-]{1,100}$/.test(uuid)) throw createError({ statusCode: 404 });
  const client = createDirectusServerClient();
  const scope = getQuery(event);
  let blocks: Record<string, unknown>[];
  if (typeof scope.entityType === "string" && typeof scope.entityUuid === "string") {
    blocks = await readPublicBlocks(scope.entityType, scope.entityUuid);
  } else {
    const [root] = await client
      .request(
        readItems("blocks", {
          filter: { uuid: { _eq: uuid }, bundle: { _eq: "vega_chart" }, status: { _eq: "published" } },
          fields: ["entity_type", "entity_uuid", "field_name"],
          limit: 1,
        }),
      )
      .then(cmsRows);
    if (!root) throw createError({ statusCode: 404 });
    blocks = await readPublicBlocks(
      cmsString(root.entity_type),
      cmsString(root.entity_uuid),
      cmsString(root.field_name),
    );
  }
  function findChart(value: unknown, depth = 0): Record<string, unknown> | undefined {
    if (depth > 30 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const child of value) {
        const match = findChart(child, depth + 1);
        if (match) return match;
      }
    } else {
      const block = value as Record<string, unknown>;
      if (block.uuid === uuid && block.bundle === "vega_chart") return block;
      if (block.props && typeof block.props === "object") {
        for (const child of Object.values(block.props)) {
          if (Array.isArray(child)) {
            const match = findChart(child, depth + 1);
            if (match) return match;
          }
        }
      }
    }
    return undefined;
  }
  const block = findChart(blocks);
  if (!block) throw createError({ statusCode: 404 });
  // Only a published author's stored configuration is accepted. Request parameters
  // can never supply a collection, filter or field projection.
  const props = cmsRecord(block.props ?? {});
  let stored: unknown;
  try {
    stored =
      typeof props.query === "string" && props.query
        ? JSON.parse(props.query)
        : props.query || JSON.parse(defaultVegaQuery);
  } catch {
    /* Invalid configuration fails closed below. */
  }
  const parsed = querySchema.safeParse(stored);
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: "Invalid published chart query" });
  const { collection, query } = parsed.data;
  if (query.fields.some((field) => !fieldsByCollection[collection].includes(field))) {
    throw createError({ statusCode: 400, statusMessage: "Unsupported public chart field" });
  }
  const catalog = { hidden: { _eq: false } };
  const publicFilters = {
    ratings_measures: {
      status: { _eq: "published" },
      approved: { _eq: true },
      measure_id: { status: { _eq: "published" }, catalog_version: catalog },
      localteam_id: {
        municipality_id: {
          _some: {
            status: { _eq: "published" },
            scores: { _some: { published: { _eq: true }, percentage_rated: { _gte: 100 }, catalog_version: catalog } },
          },
        },
      },
    },
    municipality_scores: {
      published: { _eq: true },
      municipality: { status: { _eq: "published" } },
      catalog_version: catalog,
    },
    municipalities: { status: { _eq: "published" } },
    measures: { status: { _eq: "published" }, catalog_version: catalog },
    measure_catalog: catalog,
  };
  if (collection === "ratings_measures") {
    const scores = await readPublicItems("municipality_scores", {
      fields: ["catalog_version", "municipality.localteam_id"],
      filter: {
        published: { _eq: true },
        percentage_rated: { _gte: 100 },
        catalog_version: catalog,
        municipality: { status: { _eq: "published" } },
      },
    });
    const coverage = new Map<string, string[]>();
    for (const score of scores) {
      const rawTeam = cmsRecord(score.municipality ?? {}).localteam_id;
      const team = rawTeam == null ? null : cmsString(rawTeam);
      if (!team) continue;
      const teams = coverage.get(cmsString(score.catalog_version)) ?? [];
      teams.push(team);
      coverage.set(cmsString(score.catalog_version), teams);
    }
    publicFilters.ratings_measures = {
      ...publicFilters.ratings_measures,
      ...{
        _or: [...coverage].map(([version, teams]) => ({
          measure_id: { catalog_version: { _eq: version } },
          localteam_id: { _in: teams },
        })),
      },
    };
    if (!coverage.size) return [];
  }
  const filter = { _and: [query.filter ?? {}, publicFilters[collection]] };
  const rows =
    query.limit && query.limit > 0
      ? await client.request(readItems(collection, { ...query, filter })).then(cmsRows)
      : await readPublicItems(collection, { ...query, filter });
  setResponseHeader(event, "Cache-Control", "public, max-age=60");
  return rows;
});
