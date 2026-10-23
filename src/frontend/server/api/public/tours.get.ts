import { z } from "zod";
import { readItems } from "@directus/sdk";
import { defineEventHandler, getQuery, setResponseHeader } from "h3";
import { createDirectusServerClient } from "../../utils/directusServerClient";
import { parseCms } from "../../utils/parseCms";
import { queryLimit } from "../../utils/publicQuery";
import { TOUR_FIELDS } from "~/shared/successProjectTour";
import { TourSchema } from "~/shared/contracts/content";
export default defineEventHandler(async (event) => {
  const limit = queryLimit(getQuery(event).limit, 20, 100);
  const tours = await createDirectusServerClient().request(
    readItems("success_project_tours", {
      filter: { status: { _eq: "published" } },
      fields: [...TOUR_FIELDS],
      sort: ["title", "id"],
      limit,
    }),
  );
  setResponseHeader(event, "Cache-Control", "public, max-age=60");
  return { tours: parseCms(z.array(TourSchema), tours) };
});
