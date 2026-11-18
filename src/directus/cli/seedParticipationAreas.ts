import { readFile } from "node:fs/promises";
import { createItems, readItems } from "@directus/sdk";
import { parse } from "yaml";
import { z } from "zod";
import createDirectusClient from "./tasks/shared/createDirectusClient.ts";
import clearDirectusCache from "./tasks/shared/clearDirectusCache.ts";

const Area = z.object({
  id: z.uuid(),
  team_key: z.string().min(1),
  label: z.string().min(1),
  sort: z.number().int(),
  color: z.string().regex(/^#[a-f0-9]{6}$/i),
});
type Area = z.infer<typeof Area>;
const client = createDirectusClient<{ organisation_teams: Area[] }>();
const existing = await client.request(readItems("organisation_teams", { fields: ["id"], limit: 1 }));
// A nonempty collection belongs to its editors. Do not restore deleted teams or overwrite authored labels.
if (!existing.length) {
  const defaults = Area.array().parse(
    parse(await readFile(new URL("../contents/organisation_teams.yaml", import.meta.url), "utf8")),
  );
  await client.request(createItems("organisation_teams", defaults));
  await clearDirectusCache();
  console.info("Organisation chart areas seeded for the participation funnel.");
}
