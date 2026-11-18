import { resolvePublicWahlcheckRoute, type PublicWahlcheckElection } from "../../../utils/wahlcheckRoute";
import { cmsString, cmsRows } from "~/server/utils/cmsValue";

import { WahlcheckSchema } from "~/shared/contracts/elections";
import { parseCms } from "~/server/utils/parseCms";
import { readItems } from "@directus/sdk";
import { defineEventHandler, getRouterParam, createError, setResponseHeader } from "h3";
import { createDirectusServerClient } from "../../../utils/directusServerClient";

type Row = Record<string, unknown>;

function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.map((field) => [field, row[field] ?? null]));
}

const candidatePublicFields = ["id", "name", "party", "has_answered", "time_first_submitted", "time_last_edited"];
const questionPublicFields = ["id", "title", "thesis", "background_information", "sector"];
const answerPublicFields = ["response", "explanation"];

async function buildWahlcheckResponse(
  client: ReturnType<typeof createDirectusServerClient>,
  municipality: { slug: string; name: string },
  election: PublicWahlcheckElection,
) {
  // Load questions
  const questions = await client
    .request(
      readItems("questions", {
        filter: {
          election: { _eq: election.id },
          status: { _eq: "published" },
        },
        fields: questionPublicFields,
        sort: ["date_created"],
        limit: 100,
      }),
    )
    .then(cmsRows);

  // Load candidates
  const candidates = await client
    .request(
      readItems("candidate", {
        filter: { election: { _eq: election.id } },
        fields: candidatePublicFields,
        sort: ["name"],
        limit: 200,
      }),
    )
    .then(cmsRows);

  // Load answers for all candidates
  const candidateIds = candidates.map((c) => c.id);
  const answers: Row[] = [];
  if (candidateIds.length > 0) {
    const loadedAnswers = await client
      .request(
        readItems("answers", {
          filter: {
            candidate: { _in: candidateIds },
            question: {
              id: { _in: questions.map((q) => q.id) },
              election: { _eq: election.id },
              status: { _eq: "published" },
            },
          },
          fields: ["candidate", "question", "response", "explanation"],
          limit: 10000,
        }),
      )
      .then(cmsRows);
    answers.push(...loadedAnswers);
  }

  // Build answer map: candidateId -> questionId -> answer
  const answerMap = new Map<string, Map<string, Row>>();
  for (const ans of answers) {
    const cId = cmsString(ans.candidate);
    const qId = cmsString(ans.question);
    if (!answerMap.has(cId)) answerMap.set(cId, new Map());
    answerMap.get(cId)!.set(qId, pick(ans, answerPublicFields));
  }

  // Build response
  const responseCandidates = candidates.map((c) => ({
    ...pick(c, candidatePublicFields),
    answers: Array.from(answerMap.get(cmsString(c.id)) || new Map<string, Row>()).map(([qId, ans]) => ({
      question: qId,
      ...ans,
    })),
  }));

  return parseCms(WahlcheckSchema, {
    municipality: { slug: municipality.slug, name: municipality.name },
    election: pick(election, [
      "id",
      "is_party_election",
      "simple_answer_mode",
      "descriptor",
      "custom_logo",
      "response_cutoff_date",
    ]),
    questions: questions.map((q) => pick(q, questionPublicFields)),
    candidates: responseCandidates,
  });
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "public, max-age=60");
  const client = createDirectusServerClient();
  const municipalitySlug = getRouterParam(event, "municipalitySlug");

  if (!municipalitySlug || !/^[a-z0-9-]{1,160}$/.test(municipalitySlug)) {
    throw createError({ statusCode: 404, statusMessage: "Not found" });
  }

  const { municipality, election } = await resolvePublicWahlcheckRoute(client, municipalitySlug);
  return await buildWahlcheckResponse(client, municipality, election);
});
