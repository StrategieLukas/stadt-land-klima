import { readItems } from "@directus/sdk";
import { createError, defineEventHandler, setResponseHeader } from "h3";
import { createTypedDirectusServerClient } from "../../utils/directusServerClient";
import type { DirectusSchema } from "../../types/directus";
import { JobsListResponseSchema } from "~/shared/contracts/jobs";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "public, max-age=60");
  const client = createTypedDirectusServerClient<DirectusSchema>();

  const jobs = await client.request(
    readItems("job_offers", {
      filter: { status: { _eq: "published" } },
      fields: [
        "id",
        "slug",
        "role_title",
        "type",
        "start_date",
        "end_date",
        "weekly_hours",
        "salary",
        "hourly_wage",
        {
          organisation: ["id", "name", "link", { logo: ["id", "type"] }],
        },
      ],
      sort: ["-date_created"],
      limit: 50,
    }),
  );

  // Build allowlisted response — only approved fields reach the browser
  const response = {
    jobs: jobs.map((job) => ({
      id: job.id,
      slug: job.slug,
      role_title: job.role_title,
      type: job.type,
      start_date: job.start_date ?? null,
      end_date: job.end_date ?? null,
      weekly_hours: job.weekly_hours ?? null,
      salary: job.salary ?? null,
      hourly_wage: job.hourly_wage ?? null,
      organisation: job.organisation
        ? {
            id: job.organisation.id,
            name: job.organisation.name,
            link: job.organisation.link ?? null,
            logo: job.organisation.logo
              ? {
                  id: job.organisation.logo.id,
                  type: job.organisation.logo.type ?? null,
                }
              : null,
          }
        : null,
    })),
  };

  // Validate against public contract before returning
  const parsed = JobsListResponseSchema.safeParse(response);
  if (!parsed.success) throw createError({ statusCode: 502, statusMessage: "Invalid jobs response" });
  return parsed.data;
});
