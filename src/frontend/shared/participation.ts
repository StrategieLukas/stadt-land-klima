import { z } from "zod";

export const PARTICIPATION_TOOLS = ["ranking", "wahlcheck", "project"] as const;
export const AgreementTypeSchema = z.enum(["terms_of_service", "data_protection"]);
export const ParticipationAgreementSchema = z.object({
  id: z.uuid(),
  type: AgreementTypeSchema,
  version: z.string().min(1),
  legalText: z.string().min(1),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});
export const ParticipationOptionsSchema = z.object({
  areas: z.array(z.object({ id: z.uuid(), key: z.string(), label: z.string() })),
  projects: z.array(
    z.object({ id: z.uuid(), title: z.string(), description: z.string().nullable(), area: z.uuid().nullable() }),
  ),
  agreements: z
    .array(ParticipationAgreementSchema)
    .max(2)
    .refine((versions) => versions.length === 0 || versions.length === 2),
  personalOnboardingAvailable: z.boolean(),
});
export type ParticipationOptions = z.infer<typeof ParticipationOptionsSchema>;
export type ParticipationAgreement = z.infer<typeof ParticipationAgreementSchema>;

const unique = (values: string[]) => new Set(values).size === values.length;
const interestIds = z.array(z.uuid()).max(50).refine(unique);
const common = {
  requestId: z.uuid(),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  language: z.enum(["de-DE", "en-GB", "it-IT"]),
  timeZone: z
    .string()
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
  agreements: z
    .array(z.strictObject({ id: z.uuid(), digest: z.string().regex(/^[a-f0-9]{64}$/), accepted: z.literal(true) }))
    .length(2)
    .refine((values) => unique(values.map((value) => value.id))),
};
const intent = z.discriminatedUnion("path", [
  z.strictObject({
    path: z.literal("local"),
    tools: z.array(z.enum(PARTICIPATION_TOOLS)).min(1).max(3).refine(unique),
    municipality: z.string().trim().min(1).max(200),
  }),
  z
    .strictObject({ path: z.literal("build"), areas: interestIds, projects: interestIds, undecided: z.boolean() })
    .refine((value) =>
      value.undecided ? !value.areas.length && !value.projects.length : !!(value.areas.length + value.projects.length),
    ),
]);
export const ParticipationInputSchema = z.discriminatedUnion("mode", [
  z.strictObject({ ...common, intent, mode: z.literal("account") }),
  z.strictObject({ ...common, intent, mode: z.literal("personal"), start: z.iso.datetime({ offset: true }) }),
]);
export type ParticipationInput = z.infer<typeof ParticipationInputSchema>;
export type ParticipationContactDraft = {
  firstName: string;
  lastName: string;
  email: string;
  mode: "personal" | "account";
  timeZone: string;
  accepted: Record<string, boolean>;
};
export const ParticipationRequestSchema = z.strictObject({
  registration: ParticipationInputSchema,
  altcha: z.string().min(1).max(20000),
});
export const ParticipationBookingSchema = z.object({
  uid: z.string().min(1).max(200),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  status: z.literal("accepted"),
});
export type ParticipationBooking = z.infer<typeof ParticipationBookingSchema>;
export const ParticipationResultSchema = z.object({
  success: z.literal(true),
  accountCreated: z.literal(true),
  accountConfirmationSent: z.literal(true),
  booking: ParticipationBookingSchema.nullable(),
});
export type ParticipationResult = z.infer<typeof ParticipationResultSchema>;
export const ParticipationSlotsSchema = z.object({ slots: z.array(z.iso.datetime({ offset: true })).max(2000) });
export const PARTICIPATION_ERROR_KEYS = [
  "duplicate_email",
  "agreements_changed",
  "interests_changed",
  "calendar_unavailable",
  "slot_unavailable",
  "delivery_pending",
  "processing",
  "review_required",
  "invalid_request",
  "unavailable",
  "captcha",
] as const;
export type ParticipationErrorCode = (typeof PARTICIPATION_ERROR_KEYS)[number];
export class ParticipationError extends Error {
  constructor(
    readonly code: ParticipationErrorCode,
    readonly status: number,
  ) {
    super(code);
  }
}
