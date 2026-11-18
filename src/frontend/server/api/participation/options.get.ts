import { createError, defineEventHandler, setResponseHeader } from "h3";
import { ParticipationOptionsSchema } from "~/shared/participation";
import { participationRequest } from "../../utils/participation";
import { rateLimit } from "../../utils/rateLimit";

export default defineEventHandler(async (event) => {
  if (!(await rateLimit(event, "participation-options"))) throw createError({ statusCode: 429 });
  setResponseHeader(event, "Cache-Control", "no-store");
  return ParticipationOptionsSchema.parse(await participationRequest("options"));
});
