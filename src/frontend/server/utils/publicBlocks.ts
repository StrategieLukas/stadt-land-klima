import { cmsRows } from "~/server/utils/cmsValue";
import { readItems } from "@directus/sdk";
import { createError } from "h3";
import { createDirectusServerClient } from "./directusServerClient";

export const publicBlockFields = [
  "id",
  "uuid",
  "bundle",
  "props",
  "options",
  "sort_order",
  "entity_type",
  "entity_uuid",
  "field_name",
  "status",
];
const parentCollections = new Set([
  "pages",
  "articles",
  "news_items",
  "event_reports",
  "success_project_tours",
  "success_project_tour_stops",
]);

/** A block is public only through a published parent, never through its UUID alone. */
export async function readPublicBlocks(entityType: string, entityUuid: string, fieldName = "content") {
  if (!parentCollections.has(entityType) || !/^[\w-]{1,100}$/.test(entityUuid) || !/^[a-z_]{1,100}$/.test(fieldName)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid block scope" });
  }
  const client = createDirectusServerClient();
  const parentFilter =
    entityType === "success_project_tour_stops"
      ? {
          id: { _eq: entityUuid },
          status: { _eq: "published" },
          report_status: { _eq: "published" },
          tour: { status: { _eq: "published" } },
        }
      : { id: { _eq: entityUuid }, status: { _eq: "published" } };
  const parents = await client
    .request(readItems(entityType, { filter: parentFilter, fields: ["id"], limit: 1 }))
    .then(cmsRows);
  if (!parents.length) throw createError({ statusCode: 404, statusMessage: "Content not found" });
  const blocks = await client
    .request(
      readItems("blocks", {
        filter: {
          entity_type: { _eq: entityType },
          entity_uuid: { _eq: entityUuid },
          field_name: { _eq: fieldName },
          status: { _eq: "published" },
        },
        fields: publicBlockFields,
        sort: ["sort_order"],
        limit: 1001,
      }),
    )
    .then(cmsRows);
  if (blocks.length > 1000) throw createError({ statusCode: 502, statusMessage: "Block limit exceeded" });
  return blocks;
}
