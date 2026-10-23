import { cmsRows } from "~/server/utils/cmsValue";
import { timingSafeEqual } from "node:crypto";
import { createDirectus, readItems, rest, staticToken } from "@directus/sdk";
import { createError } from "h3";

/** This narrowly permitted identity is separate from public content reads. */
export async function verifyMunicipalityPreview(id: string, supplied: string): Promise<boolean> {
  const config = useRuntimeConfig();
  if (!config.directusPreviewToken) {
    throw createError({ statusCode: 503, statusMessage: "Preview unavailable" });
  }
  const client = createDirectus(config.directusServerUrl).with(rest()).with(staticToken(config.directusPreviewToken));
  const rows = await client
    .request(
      readItems("municipalities", {
        filter: { id: { _eq: id } },
        fields: ["preview_token"],
        limit: 1,
      }),
    )
    .then(cmsRows);
  const actual = rows[0]?.preview_token;
  if (typeof actual !== "string" || !actual || !supplied) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}
