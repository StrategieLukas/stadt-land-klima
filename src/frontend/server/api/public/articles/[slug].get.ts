import { cmsRows } from "~/server/utils/cmsValue";
import { ProjectDetailSchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from "@directus/sdk";
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from "h3";
import { createDirectusServerClient } from "../../../utils/directusServerClient";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "public, max-age=60");
  const client = createDirectusServerClient();
  const slug = getRouterParam(event, "slug");

  if (!slug || !/^[a-z0-9-]{1,160}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: "Article not found" });
  }

  const articles = await client
    .request(
      readItems("articles", {
        filter: { slug: { _eq: slug }, status: { _eq: "published" } },
        fields: [
          "id",
          "slug",
          "title",
          "date_created",
          "subtitle",
          "abstract",
          "article_text",
          "image_credits",
          "author",
          "municipality_name",
          "state",
          "link",
          "instagram",
          "linkedin",
          "profile_stage",
          { image: ["id", "type"] },
          { organisation: ["id", "name", "link", { logo: ["id", "type"] }] },
          { measures: [{ measures_id: ["id", "measure_id", "name", "slug"] }] },
        ],
        limit: 1,
      }),
    )
    .then(cmsRows);

  if (!articles || articles.length === 0) {
    throw createError({ statusCode: 404, statusMessage: "Article not found" });
  }

  return { article: parseCms(ProjectDetailSchema, articles[0]) };
});
