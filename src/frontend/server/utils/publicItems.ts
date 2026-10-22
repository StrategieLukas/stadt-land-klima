import { readItems } from "@directus/sdk";
import { createError } from "h3";
import { createDirectusServerClient } from "./directusServerClient";

/** Read all matching public rows or fail explicitly; never silently truncate charts. */
export async function readPublicItems(
  collection: string,
  query: {
    fields?: (string | Record<string, unknown>)[];
    filter?: Record<string, unknown>;
    sort?: string[];
    limit?: number;
  },
  maximum = 100000,
) {
  const client = createDirectusServerClient();
  const rows: Record<string, any>[] = [];
  for (let offset = 0; offset <= maximum; offset += 1000) {
    const page = await client.request(
      readItems(collection, {
        ...query,
        sort: query.sort ?? ["id"],
        limit: Math.min(1000, maximum + 1 - offset),
        offset,
      }),
    );
    rows.push(...page);
    if (rows.length > maximum) throw createError({ statusCode: 502, statusMessage: "Public data limit exceeded" });
    if (page.length < 1000) return rows;
  }
  return rows;
}
