import { cmsRows } from "~/server/utils/cmsValue";
import { z } from "zod";
import {
  ElectionCandidateSchema,
  ElectionSchema,
  ElectionQuestionSchema,
  ElectionAnswerSchema,
} from "~/shared/contracts/elections";
import { parseCms } from "./parseCms";
import { readItems } from "@directus/sdk";
import { createError } from "h3";
import { createDirectusServerClient } from "./directusServerClient";

const candidatePublicFields = [
  "id",
  "name",
  "party",
  "election",
  "has_answered",
  "time_first_submitted",
  "time_last_edited",
];

const questionPublicFields = ["id", "title", "thesis", "background_information", "status"];
const answerPublicFields = ["id", "response", "explanation", "candidate", "question"];

export async function verifyCandidateAccessToken(accessToken: string) {
  const client = createDirectusServerClient();
  const candidates = await client
    .request(
      readItems("candidate", {
        filter: { access_token: { _eq: accessToken } },
        fields: [
          ...candidatePublicFields,
          "election.id",
          "election.descriptor",
          "election.is_public",
          "election.is_party_election",
          "election.simple_answer_mode",
          "election.custom_logo",
          "election.response_cutoff_date",
          "election.localteam.id",
          "election.localteam.name",
          "election.localteam.slug",
          "election.localteam.municipality_id.id",
          "election.localteam.municipality_id.name",
          "election.localteam.municipality_id.slug",
          "election.localteam.municipality_id.state",
        ],
        limit: 1,
      }),
    )
    .then(cmsRows);

  if (!candidates || candidates.length === 0) {
    return null;
  }

  return { candidate: parseCms(ElectionCandidateSchema.extend({ election: ElectionSchema }), candidates[0]) };
}

export async function loadCandidateQuestions(electionId: string) {
  const client = createDirectusServerClient();
  const questions = await client
    .request(
      readItems("questions", {
        filter: {
          election: { _eq: electionId },
          status: { _eq: "published" },
        },
        fields: questionPublicFields,
        sort: ["date_created"],
        limit: 101,
      }),
    )
    .then(cmsRows);

  if (questions.length > 100) {
    throw createError({ statusCode: 502, statusMessage: "Questions limit exceeded" });
  }

  return parseCms(z.array(ElectionQuestionSchema), questions);
}

export async function loadCandidateAnswers(candidateId: string, questionIds: string[]) {
  const client = createDirectusServerClient();
  if (questionIds.length === 0) return [];

  const answers = await client
    .request(
      readItems("answers", {
        filter: {
          candidate: { _eq: candidateId },
          question: { _in: questionIds },
        },
        fields: [...answerPublicFields, "question.id"],
        limit: 101,
      }),
    )
    .then(cmsRows);

  if (answers.length > 100) {
    throw createError({ statusCode: 502, statusMessage: "Answers limit exceeded" });
  }

  return parseCms(
    z.array(
      ElectionAnswerSchema.extend({
        id: z.string(),
        question: z
          .union([z.string(), z.object({ id: z.string() })])
          .transform((value) => (typeof value === "string" ? value : value.id)),
      }),
    ),
    answers,
  );
}
