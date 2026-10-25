import { z } from "zod";
import { sectors } from "../domain";
import { NullableTextSchema } from "./content";
import { AnswerValueSchema } from "./candidateAnswers";
export const ElectionMunicipalitySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  slug: z.string(),
  state: NullableTextSchema,
});
export const ElectionTeamSchema = z.object({
  id: z.string(),
  name: NullableTextSchema,
  slug: NullableTextSchema,
  municipality_name: NullableTextSchema,
  municipality_id: z
    .union([ElectionMunicipalitySchema, z.array(ElectionMunicipalitySchema)])
    .nullish()
    .transform((value) => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null))),
});
export const ElectionSchema = z.object({
  id: z.string(),
  descriptor: NullableTextSchema,
  is_public: z.boolean().optional(),
  is_party_election: z.boolean(),
  simple_answer_mode: z.boolean().nullable().optional(),
  custom_logo: NullableTextSchema,
  response_cutoff_date: NullableTextSchema,
  localteam: ElectionTeamSchema.nullish().transform((value) => value ?? null),
});
export const ElectionQuestionSchema = z.object({
  id: z.string(),
  title: NullableTextSchema,
  thesis: NullableTextSchema,
  background_information: NullableTextSchema,
  sector: z.enum(sectors).nullable().optional(),
  status: z.string().optional(),
});
export const ElectionCandidateSchema = z.object({
  id: z.string(),
  name: NullableTextSchema,
  party: NullableTextSchema,
  has_answered: z.boolean().nullable(),
  time_first_submitted: NullableTextSchema,
  time_last_edited: NullableTextSchema,
});
export const ElectionAnswerSchema = z.object({
  response: AnswerValueSchema.nullable(),
  explanation: NullableTextSchema,
  candidate: z.string(),
  question: z.string(),
});
export const CandidateReadSchema = z.object({
  candidate: ElectionCandidateSchema.extend({ election: ElectionSchema }),
  questions: z.array(ElectionQuestionSchema),
  existingAnswers: z.array(ElectionAnswerSchema.extend({ id: z.string() })),
});
export const WahlcheckSchema = z.object({
  municipality: z.object({ slug: z.string(), name: z.string() }),
  election: ElectionSchema,
  questions: z.array(ElectionQuestionSchema),
  candidates: z.array(
    ElectionCandidateSchema.extend({ answers: z.array(ElectionAnswerSchema.omit({ candidate: true })) }),
  ),
});
export const PublicElectionListSchema = ElectionSchema.omit({ response_cutoff_date: true }).extend({
  date_created: z.string(),
  municipalitySlug: NullableTextSchema,
  candidateCount: z.number().int().nonnegative(),
  questionCount: z.number().int().nonnegative(),
});
export const SharedWahlcheckSchema = z.strictObject({
  electionId: z.string(),
  answers: z.record(z.uuid(), AnswerValueSchema.nullable()).refine((value) => Object.keys(value).length <= 100),
  doubleWeighted: z.array(z.uuid()).max(100),
});
/** Shared/session results are meaningful only for this election's published questions. */
export function checkedWahlcheckState(input: unknown, electionId: string, questionIds: readonly string[]) {
  const parsed = SharedWahlcheckSchema.safeParse(input);
  if (!parsed.success || parsed.data.electionId !== electionId) return null;
  const ids = new Set(questionIds);
  if (
    Object.keys(parsed.data.answers).some((id) => !ids.has(id)) ||
    parsed.data.doubleWeighted.some((id) => !ids.has(id))
  )
    return null;
  return parsed.data;
}
