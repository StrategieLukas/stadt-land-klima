import { z } from "zod";
import { OrganisationTeamSchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from "@directus/sdk";
import { defineEventHandler, setResponseHeader } from "h3";
import { createDirectusServerClient } from "../../utils/directusServerClient";

export default defineEventHandler(async (event) => {
  const teams = await createDirectusServerClient().request(
    readItems("organisation_teams", {
      fields: ["team_key", "label", "email", "color", "tasks"],
      sort: ["sort"],
      limit: 100,
    }),
  );
  setResponseHeader(event, "Cache-Control", "public, max-age=60");
  return parseCms(z.array(OrganisationTeamSchema), teams);
});
