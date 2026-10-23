import { cmsRecord, cmsRows } from "~/server/utils/cmsValue";
import { z } from "zod";
import { PublicElectionListSchema } from "~/shared/contracts/elections";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from "@directus/sdk";
import { defineEventHandler, setResponseHeader } from "h3";
import { createDirectusServerClient } from "../../../utils/directusServerClient";

type Row = Record<string, unknown>;

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map((field) => [field, row[field] ?? null]));
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "public, max-age=60");
  const client = createDirectusServerClient();

  // Load all public elections
  const elections = await client
    .request(
      readItems("elections", {
        filter: {
          is_public: { _eq: true },
        },
        fields: [
          "id",
          "descriptor",
          "custom_logo",
          "is_party_election",
          "localteam.id",
          "localteam.name",
          "localteam.slug",
          "localteam.municipality_name",
          "localteam.municipality_id.slug",
          "localteam.municipality_id.name",
          "date_created",
        ],
        sort: ["-date_created"],
      }),
    )
    .then(cmsRows);

  if (!elections || elections.length === 0) {
    return [];
  }

  // For each election, count candidates who have answered and published questions
  const results = [];
  for (const election of elections) {
    const candidates = await client
      .request(
        readItems("candidate", {
          filter: {
            election: { _eq: election.id },
            has_answered: { _eq: true },
          },
          fields: ["id"],
          limit: -1,
        }),
      )
      .then(cmsRows);

    const questions = await client
      .request(
        readItems("questions", {
          filter: {
            election: { _eq: election.id },
            status: { _eq: "published" },
          },
          fields: ["id"],
          limit: -1,
        }),
      )
      .then(cmsRows);

    // Only include elections that have at least one candidate who answered
    if ((candidates?.length || 0) > 0) {
      const localteam = cmsRecord(election.localteam || {});
      // municipality_id is a one-to-many alias, so it returns an array of municipalities.
      // Use the first municipality's slug, falling back to the localteam's own slug.
      const municipalities = Array.isArray(localteam.municipality_id)
        ? localteam.municipality_id
        : localteam.municipality_id
          ? [localteam.municipality_id]
          : [];
      const municipalitySlug = cmsRecord(municipalities[0] ?? {}).slug || localteam.slug || null;
      results.push({
        ...pick(election, ["id", "descriptor", "custom_logo", "is_party_election", "date_created"]),
        localteam: pick(localteam, ["id", "name", "slug", "municipality_name"]),
        municipalitySlug,
        candidateCount: candidates?.length || 0,
        questionCount: questions?.length || 0,
      });
    }
  }

  return parseCms(z.array(PublicElectionListSchema), results);
});
