import { z } from "zod";
import { setLogActor, requestLog } from "./securityLogging";
import type { H3Event } from "h3";
import { createItem, readItems, updateItem } from "@directus/sdk";
import { createError } from "h3";
import { getBerlinEndOfDay } from "../../shared/eventDateTime";
import { CandidateAnswersResponseSchema, type CandidateAnswersRequest } from "../../shared/contracts/candidateAnswers";
import { createTypedDirectusServerClient } from "./directusServerClient";

interface Election {
  id: string;
  response_cutoff_date: string | null;
}
interface Candidate {
  id: string;
  access_token: string;
  election: string | Election | null;
  has_answered: boolean;
  time_first_submitted: string | null;
  time_last_edited: string | null;
}
interface Question {
  id: string;
  election: string | Election;
  status: string;
}
interface Answer {
  id: string;
  candidate: string | Candidate;
  question: string | Question;
  response: number | null;
  explanation: string | null;
}
interface CandidateAnswerSchema {
  candidate: Candidate[];
  elections: Election[];
  questions: Question[];
  answers: Answer[];
}

export async function saveCandidateAnswers(accessToken: string, request: CandidateAnswersRequest, event?: H3Event) {
  if (!z.uuid().safeParse(accessToken).success) throw createError({ statusCode: 404, statusMessage: "Not found" });
  const client = createTypedDirectusServerClient<CandidateAnswerSchema>();
  const [candidate] = await client.request(
    readItems("candidate", {
      filter: { access_token: { _eq: accessToken } },
      fields: ["id", "time_first_submitted", { election: ["id", "response_cutoff_date"] }],
      limit: 1,
    }),
  );
  if (!candidate?.election) throw createError({ statusCode: 404, statusMessage: "Not found" });
  if (event) setLogActor(event, candidate.id, "candidate");

  const cutoffDate = candidate.election.response_cutoff_date;
  const cutoff = getBerlinEndOfDay(cutoffDate);
  if ((cutoffDate && !cutoff) || (cutoff && Date.now() > cutoff.getTime())) {
    throw createError({ statusCode: 403, statusMessage: "Election response deadline has passed" });
  }

  // Authorize the whole batch before performing any write. A real question ID
  // alone does not prove membership of this candidate's election.
  const questionIds = request.answers.map((answer) => answer.question);
  const questions = await client.request(
    readItems("questions", {
      filter: { id: { _in: questionIds }, election: { _eq: candidate.election.id }, status: { _eq: "published" } },
      fields: ["id"],
      limit: 100,
    }),
  );
  const allowed = new Set(questions.map((question) => question.id));
  if (questionIds.some((id) => !allowed.has(id))) {
    throw createError({ statusCode: 403, statusMessage: "Question is not available for this election" });
  }

  const existing = await client.request(
    readItems("answers", {
      filter: { candidate: { _eq: candidate.id }, question: { _in: questionIds } },
      fields: ["id", { question: ["id"] }],
      limit: 101,
    }),
  );
  const byQuestion = new Map(existing.map((answer) => [answer.question.id, answer.id]));
  if (existing.length > 100 || byQuestion.size !== existing.length) {
    throw createError({ statusCode: 409, statusMessage: "Conflicting candidate answers" });
  }
  for (const answer of request.answers) {
    const payload = {
      candidate: candidate.id,
      question: answer.question,
      response: answer.response,
      explanation: answer.explanation || null,
    };
    const id = byQuestion.get(answer.question);
    if (id) await client.request(updateItem("answers", id, payload));
    else await client.request(createItem("answers", payload));
  }
  const now = new Date().toISOString();
  await client.request(
    updateItem("candidate", candidate.id, {
      has_answered: true,
      time_last_edited: now,
      ...(!candidate.time_first_submitted ? { time_first_submitted: now } : {}),
    }),
  );
  if (event)
    requestLog(event, "info", "nuxt.candidate.answers_saved", {
      resource: "candidate",
      resourceId: candidate.id,
      count: request.answers.length,
      outcome: "success",
    });
  return CandidateAnswersResponseSchema.parse({ success: true });
}
