import { readItems } from "@directus/sdk";
import { createError, defineEventHandler, getQuery, setResponseHeader } from "h3";
import { z } from "zod";
import { MunicipalityUpdatesSchema } from "~/shared/contracts/municipalityUpdates";
import { NumericSchema } from "~/shared/contracts/municipality";
import { createDirectusServerClient } from "~/server/utils/directusServerClient";
import { cmsRows } from "~/server/utils/cmsValue";
import { parseCms } from "~/server/utils/parseCms";
import { queryLimit, queryText } from "~/server/utils/publicQuery";
import { rateLimit } from "~/server/utils/rateLimit";

const Row = z.object({
  id: z.uuid(),
  occurred_at: z.iso.datetime({ offset: true }),
  kind: z.enum(["initial", "published", "update"]),
  score_total: NumericSchema,
  previous_total: NumericSchema,
  score: z.object({
    published: z.boolean(),
    percentage_rated: NumericSchema,
    municipality: z.object({ name: z.string(), slug: z.string(), status: z.string() }),
    catalog_version: z.object({ name: z.string(), hidden: z.boolean() }),
  }),
});
const Cursor = z.object({ at: z.iso.datetime({ offset: true }), id: z.uuid() }).strict();

export default defineEventHandler(async (event) => {
  await rateLimit(event, "municipality-updates");
  setResponseHeader(event, "Cache-Control", "private, no-store");
  const query = getQuery(event);
  const limit = queryLimit(query.limit, 20, 50);
  const municipality = queryText(query.municipality);
  const catalog = queryText(query.v, 100);
  const encoded = queryText(query.cursor, 300);
  let cursor: z.output<typeof Cursor> | undefined;
  if (encoded) {
    try {
      cursor = Cursor.parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
    } catch {
      throw createError({ statusCode: 400, statusMessage: "Invalid cursor" });
    }
  }
  const filter = {
    score: {
      published: { _eq: true },
      percentage_rated: { _gte: 100 },
      municipality: { status: { _eq: "published" }, ...(municipality ? { slug: { _eq: municipality } } : {}) },
      catalog_version: { hidden: { _eq: false }, ...(catalog ? { name: { _eq: catalog } } : {}) },
    },
    ...(cursor
      ? { _or: [{ occurred_at: { _lt: cursor.at } }, { occurred_at: { _eq: cursor.at }, id: { _lt: cursor.id } }] }
      : {}),
  };
  const rows = parseCms(
    z.array(Row),
    cmsRows(
      await createDirectusServerClient().request(
        readItems("municipality_rating_updates", {
          filter,
          limit: limit + 1,
          sort: ["-occurred_at", "-id"],
          fields: [
            "id",
            "occurred_at",
            "kind",
            "score_total",
            "previous_total",
            "score.published",
            "score.percentage_rated",
            "score.municipality.name",
            "score.municipality.slug",
            "score.municipality.status",
            "score.catalog_version.name",
            "score.catalog_version.hidden",
          ],
        }),
      ),
    ),
  );
  // Recheck publication after parsing rather than trusting CMS filters alone.
  const visible = rows.filter(
    (row) =>
      row.score.published &&
      Number(row.score.percentage_rated) >= 100 &&
      row.score.municipality.status === "published" &&
      !row.score.catalog_version.hidden,
  );
  const page = visible.slice(0, limit);
  const last = page.at(-1);
  return parseCms(MunicipalityUpdatesSchema, {
    updates: page.map(({ score, ...row }) => ({
      ...row,
      municipality: { name: score.municipality.name, slug: score.municipality.slug },
      catalog: score.catalog_version.name,
    })),
    nextCursor:
      visible.length > limit && last
        ? Buffer.from(JSON.stringify({ at: last.occurred_at, id: last.id })).toString("base64url")
        : null,
  });
});
