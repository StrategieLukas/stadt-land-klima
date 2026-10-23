import { z } from "zod";
import { TeamMemberSchema } from "~/shared/contracts/content";
import { parseCms } from "~/server/utils/parseCms";
export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const baseUrl: string = config.directusServerUrl || "http://directus:8055";
  const token: string = config.directusFrontendServerToken || "";

  const result = await $fetch<{ data: unknown[] }>(`${baseUrl}/users`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      "fields[]": ["id", "first_name", "last_name", "avatar", "bio", "slk_team"],
      "filter[show_on_team_page][_eq]": true,
      limit: -1,
    },
  });

  return parseCms(z.array(TeamMemberSchema), result.data ?? []);
});
