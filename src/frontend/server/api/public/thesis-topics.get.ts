import { readItems } from "@directus/sdk";
import { defineEventHandler, setResponseHeader } from "h3";
import { PublicThesisTopicSchema } from "~/shared/contracts/thesisTopics";
import { mergeThesisCategories } from "~/shared/thesisCategories";
import type { DirectusSchema } from "../../types/directus";
import { createTypedDirectusServerClient } from "../../utils/directusServerClient";
import { requestLog } from "../../utils/securityLogging";

export default defineEventHandler(async (event) => {
  const client = createTypedDirectusServerClient<DirectusSchema>();
  const rows = await client.request(
    readItems("thesis_topics", {
      fields: ["id", "title", "short_description", "description", "categories", "levels"],
      filter: { status: { _eq: "published" } },
      sort: ["title", "id"],
      limit: -1,
    }),
  );

  const topics = rows.flatMap(({ id, title, short_description, description, categories, levels }) => {
    const parsed = PublicThesisTopicSchema.safeParse({
      id,
      title,
      short_description,
      description,
      categories: Array.isArray(categories) ? mergeThesisCategories(categories) : categories,
      levels,
    });
    return parsed.success ? [parsed.data] : [];
  });
  if (topics.length !== rows.length) {
    requestLog(event, "warn", "app.server.api.public.thesis-topics.get.degraded");
  }
  setResponseHeader(event, "Cache-Control", "no-store");
  return { topics };
});
