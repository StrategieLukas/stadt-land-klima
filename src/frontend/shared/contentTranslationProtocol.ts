import { z } from "zod";

export const TRANSLATION_WORKER_ROLE = "Content-Translation-Worker";
export const TRANSLATION_WORKER_EMAIL = "content-translation-worker@stadt-land-klima.de";
export const TRANSLATION_JOB_ID = "public-content";
export const TranslationKeySchema = z.string().regex(/^content-translation:v1:[a-f0-9]{64}$/);
export const TranslationNamespaceSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9:._-]+$/);
export const TranslationTargetSchema = z.enum(["en-GB", "it-IT"]);
export const TranslationFormatSchema = z.enum(["text", "html", "markdown"]);
export const TranslationStateSchema = z.enum(["pending", "inflight", "ready", "uncertain", "blocked"]);
export const TranslationMemorySchema = z.object({
  id: TranslationKeySchema,
  namespace: TranslationNamespaceSchema,
  kind: z.enum(["unit", "field"]),
  locale: TranslationTargetSchema,
  format: TranslationFormatSchema,
  state: TranslationStateSchema,
  translated_text: z.string().max(100_000).nullable(),
  retry_at: z.string().nullable(),
});
const ownership = { owner: z.uuid(), namespace: TranslationNamespaceSchema };
const field = z.object({
  key: TranslationKeySchema,
  locale: TranslationTargetSchema,
  format: TranslationFormatSchema,
  text: z.string().min(1).max(100_000),
});
export const TranslationOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("claim"), ...ownership }).strict(),
  z
    .object({
      op: z.literal("reserve"),
      ...ownership,
      revision: z.number().int().nonnegative(),
      batch: z.uuid(),
      units: z
        .array(
          z
            .object({
              key: TranslationKeySchema,
              locale: TranslationTargetSchema,
              characters: z.number().int().min(1).max(2000),
            })
            .strict(),
        )
        .min(1)
        .max(50),
    })
    .strict(),
  z
    .object({
      op: z.literal("commit"),
      ...ownership,
      batch: z.uuid().nullable(),
      units: z
        .array(
          z
            .object({
              key: TranslationKeySchema,
              text: z.string().min(1).max(10_000),
              billed: z.number().int().nonnegative().max(10_000),
            })
            .strict(),
        )
        .max(50),
      fields: z.array(field.strict()).max(100),
    })
    .strict(),
  z
    .object({
      op: z.literal("failed-batch"),
      ...ownership,
      batch: z.uuid(),
      code: z.enum(["rate", "quota", "invalid", "auth", "uncertain", "cancelled"]),
    })
    .strict(),
  z
    .object({
      op: z.literal("finish"),
      ...ownership,
      revision: z.number().int().nonnegative(),
      error: z.enum(["none", "source", "provider", "budget", "attention"]),
    })
    .strict(),
  z.object({ op: z.literal("enqueue"), namespace: TranslationNamespaceSchema.optional() }).strict(),
  z
    .object({
      op: z.literal("retry"),
      keys: z.array(TranslationKeySchema).min(1).max(50),
      allowRebill: z.literal(true),
    })
    .strict(),
]);
export type TranslationOperation = z.infer<typeof TranslationOperationSchema>;
export const TranslationLeaseSchema = z.object({ owner: z.uuid(), revision: z.number().int().nonnegative() });
