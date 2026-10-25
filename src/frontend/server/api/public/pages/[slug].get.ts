import { cmsRows } from "~/server/utils/cmsValue";
import { ContentPageSchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from "@directus/sdk";
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from "h3";
import { createDirectusServerClient } from "../../../utils/directusServerClient";

const pageFields = ["id", "slug", "name", "contents", "status"];

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "public, max-age=60");
  const client = createDirectusServerClient();
  const slug = getRouterParam(event, "slug");

  if (!slug || !/^[a-z0-9-]{1,160}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: "Page not found" });
  }

  const pages = await client
    .request(
      readItems("pages", {
        filter: { slug: { _eq: slug }, status: { _eq: "published" } },
        fields: pageFields,
        limit: 1,
      }),
    )
    .then(cmsRows);

  if (!pages[0]) {
    throw createError({ statusCode: 404, statusMessage: "Page not found" });
  }

  return { page: parseCms(ContentPageSchema, pages[0]) };
});
