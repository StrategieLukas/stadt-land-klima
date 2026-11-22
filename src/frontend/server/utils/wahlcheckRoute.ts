import { readItems } from "@directus/sdk";
import { createError } from "h3";
import { z } from "zod";
import type { createDirectusServerClient } from "./directusServerClient";
import { parseCms } from "./parseCms";

type Client = ReturnType<typeof createDirectusServerClient>;
const nullableText = z.string().nullish();
const municipalitySchema = z.object({
  slug: z.string(),
  name: z.string(),
  localteam_id: z.object({ id: z.string(), name: nullableText }).nullish(),
});
const teamSchema = z.object({ id: z.string(), name: nullableText, municipality_name: nullableText });
const electionSchema = z.object({
  id: z.string(),
  date_created: nullableText,
  is_public: z.literal(true),
  is_party_election: z.boolean(),
  simple_answer_mode: z.boolean().nullish(),
  descriptor: nullableText,
  custom_logo: nullableText,
  response_cutoff_date: nullableText,
});
export type PublicWahlcheckElection = z.infer<typeof electionSchema>;

/** Resolve exactly the municipality/team and latest public election shown by the detail URL. */
export async function resolvePublicWahlcheckRoute(client: Client, slug: string) {
  if (!/^[a-z0-9-]{1,160}$/.test(slug)) throw createError({ statusCode: 404, statusMessage: "Not found" });
  const municipalities = parseCms(
    z.array(municipalitySchema),
    await client.request(
      readItems("municipalities", {
        filter: { slug: { _eq: slug } },
        fields: ["name", "slug", "localteam_id.id", "localteam_id.name"],
        limit: 1,
      }),
    ),
  );
  let municipality: { slug: string; name: string };
  let localteamId: string;
  let localteamName: string | null | undefined;
  const existing = municipalities[0];
  if (existing) {
    if (!existing.localteam_id) throw createError({ statusCode: 404, statusMessage: "No local team found" });
    municipality = { slug: existing.slug, name: existing.name };
    localteamId = existing.localteam_id.id;
    localteamName = existing.localteam_id.name;
  } else {
    const teams = parseCms(
      z.array(teamSchema),
      await client.request(
        readItems("localteams", {
          filter: { slug: { _eq: slug } },
          fields: ["id", "name", "municipality_name"],
          limit: 1,
        }),
      ),
    );
    const team = teams[0];
    if (!team) throw createError({ statusCode: 404, statusMessage: "Not found" });
    municipality = { slug, name: team.municipality_name || team.name || slug };
    localteamId = team.id;
    localteamName = team.name;
  }
  const elections = parseCms(
    z.array(electionSchema),
    await client.request(
      readItems("elections", {
        filter: { localteam: { _eq: localteamId }, is_public: { _eq: true } },
        fields: [
          "id",
          "date_created",
          "is_public",
          "is_party_election",
          "simple_answer_mode",
          "descriptor",
          "custom_logo",
          "response_cutoff_date",
        ],
        sort: ["-date_created", "-id"],
        limit: 1,
      }),
    ),
  );
  const election = elections[0];
  if (!election) throw createError({ statusCode: 404, statusMessage: "No public election found" });
  return { municipality, localteamId, localteamName, election };
}

/** Search never reads candidate identities, answers or access tokens. */
export async function resolveSearchElection(client: Client, slug: string) {
  let selection: Awaited<ReturnType<typeof resolvePublicWahlcheckRoute>>;
  try {
    selection = await resolvePublicWahlcheckRoute(client, slug);
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 404) return null;
    throw error;
  }
  const answered = parseCms(
    z.array(z.object({ id: z.string() })),
    await client.request(
      readItems("candidate", {
        filter: { election: { _eq: selection.election.id }, has_answered: { _eq: true } },
        fields: ["id"],
        limit: 1,
      }),
    ),
  );
  if (!answered.length) return null;
  return {
    id: selection.election.id,
    descriptor: selection.election.descriptor ?? null,
    municipalitySlug: selection.municipality.slug,
    municipalityName: selection.municipality.name,
    localteamName: selection.localteamName ?? null,
  };
}

export async function collectSearchElections(client: Client) {
  const municipality = z.object({ slug: nullableText });
  const rows = parseCms(
    z.array(
      z.object({
        localteam: z
          .object({
            slug: nullableText,
            municipality_id: z.union([z.array(municipality), municipality]).nullish(),
          })
          .nullable(),
      }),
    ),
    await client.request(
      readItems("elections", {
        filter: { is_public: { _eq: true } },
        fields: ["localteam.slug", "localteam.municipality_id.slug"],
        limit: -1,
      }),
    ),
  );
  const slugs = new Set<string>();
  for (const row of rows) {
    const municipalities = row.localteam?.municipality_id;
    const first = Array.isArray(municipalities) ? municipalities[0] : municipalities;
    const slug = first?.slug || row.localteam?.slug;
    if (slug && /^[a-z0-9-]{1,160}$/.test(slug)) slugs.add(slug);
  }
  const selections = new Map<string, NonNullable<Awaited<ReturnType<typeof resolveSearchElection>>>>();
  for (const slug of slugs) {
    const selection = await resolveSearchElection(client, slug);
    if (selection && !selections.has(selection.id)) selections.set(selection.id, selection);
  }
  return [...selections.values()];
}
