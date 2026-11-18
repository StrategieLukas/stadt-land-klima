import { createError, defineEventHandler, getQuery, setResponseHeader } from "h3";
import { z } from "zod";
import { ParticipationSlotsSchema } from "~/shared/participation";
import { participationRequest } from "../../utils/participation";
import { rateLimit } from "../../utils/rateLimit";

export default defineEventHandler(async (event) => {
  if (!(await rateLimit(event, "participation-slots"))) throw createError({ statusCode: 429 });
  setResponseHeader(event, "Cache-Control", "no-store");
  const query = z
    .object({
      start: z.iso.datetime({ offset: true }),
      end: z.iso.datetime({ offset: true }),
      timeZone: z.string().max(100),
    })
    .safeParse(getQuery(event));
  if (!query.success) throw createError({ statusCode: 400 });
  return ParticipationSlotsSchema.parse(await participationRequest("slots", query.data));
});
