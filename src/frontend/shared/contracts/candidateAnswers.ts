import { z } from "zod";

// Null deliberately clears an answer; omission and fractional values are invalid.
export const AnswerValueSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
export const CandidateAnswersRequestSchema = z
  .strictObject({
    answers: z
      .array(
        z.strictObject({
          question: z.uuid(),
          response: AnswerValueSchema.nullable(),
          explanation: z.string().max(500).optional(),
        }),
      )
      .min(1)
      .max(100),
  })
  .refine(({ answers }) => new Set(answers.map((answer) => answer.question)).size === answers.length, {
    message: "Duplicate questions are not allowed",
  });

export type CandidateAnswersRequest = z.infer<typeof CandidateAnswersRequestSchema>;
export const CandidateAnswersResponseSchema = z.strictObject({ success: z.literal(true) });
