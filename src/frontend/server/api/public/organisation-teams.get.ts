import { z } from "zod";
import { OrganisationLeaderSchema, OrganisationTeamSchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from "@directus/sdk";
import { defineEventHandler, setResponseHeader } from "h3";
import { createDirectusServerClient } from "../../utils/directusServerClient";

// Relation permissions and this explicit opt-in both protect private user profiles.
const CmsLeaderSchema = OrganisationLeaderSchema.extend({ show_on_team_page: z.boolean().nullish() })
  .nullish()
  .transform((leader) => (leader?.show_on_team_page === true ? OrganisationLeaderSchema.parse(leader) : null));
const CmsTeamSchema = OrganisationTeamSchema.extend({ head: CmsLeaderSchema, deputy: CmsLeaderSchema });

export default defineEventHandler(async (event) => {
  const teams = await createDirectusServerClient().request(
    readItems("organisation_teams", {
      fields: [
        "team_key",
        "label",
        "email",
        "color",
        "tasks",
        "contacts",
        ...["head", "deputy"].flatMap((role) =>
          ["id", "first_name", "last_name", "avatar", "show_on_team_page"].map((field) => `${role}.${field}`),
        ),
      ],
      sort: ["sort"],
      limit: 100,
    }),
  );
  setResponseHeader(event, "Cache-Control", "public, max-age=60");
  return parseCms(z.array(CmsTeamSchema), teams);
});
