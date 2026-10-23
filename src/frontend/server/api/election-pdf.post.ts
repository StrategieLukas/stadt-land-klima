import { ElectionPdfRequestSchema } from "~/shared/contracts/submissions";
import { createError, defineEventHandler, readBody, setResponseHeader } from "h3";
import { useRuntimeConfig } from "#imports";
import { rateLimit } from "../utils/rateLimit";

/**
 * Proxy for the Directus election PDF service. The browser cannot call Directus
 * directly, so this route uses the server token instead.
 */
export default defineEventHandler(async (event) => {
  // Rate limit: see server/utils/rateLimitConfig.ts
  if (!(await rateLimit(event, "election-pdf"))) {
    throw createError({ statusCode: 429, statusMessage: "Too many requests" });
  }
  const parsed = ElectionPdfRequestSchema.safeParse(await readBody<unknown>(event));
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: "Invalid PDF request" });
  const { catalogVersion, municipalitySlug, measures } = parsed.data;

  const config = useRuntimeConfig();
  const directusUrl = config.directusServerUrl || "http://directus:8055";
  const token = config.directusFrontendServerToken as string | undefined;

  if (!token) {
    throw createError({ statusCode: 500, statusMessage: "Server token not configured" });
  }

  const response = await fetch(`${directusUrl}/pdf-service/elections/${municipalitySlug}/${catalogVersion}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ measure_text: measures }),
  });

  if (!response.ok) {
    throw createError({ statusCode: response.status, statusMessage: "PDF generation failed" });
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  setResponseHeader(event, "Content-Type", "application/pdf");
  setResponseHeader(event, "Content-Disposition", 'inline; filename="election.pdf"');
  setResponseHeader(event, "Content-Length", buffer.length);

  return buffer;
});
