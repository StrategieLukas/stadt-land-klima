import { z } from "zod";
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const email = requiredText(255).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
const captcha = z.string().min(1).max(20000);
export const FeedbackTypeSchema = z.enum(["legal", "bug", "inaccuracy", "suggestion", "cooperation", "other"]);
export const FeedbackRequestSchema = z.strictObject({
  title: requiredText(200), type: FeedbackTypeSchema, content: requiredText(5000),
  name: requiredText(200), contact: email, sendCopy: z.boolean().default(false), altcha: captcha,
});
export type FeedbackRequest = z.input<typeof FeedbackRequestSchema>;
export const RegistrationRequestSchema = z.strictObject({
  firstName: requiredText(200), lastName: requiredText(200), email,
  organisation: z.string().trim().max(200).optional(), ars: z.string().regex(/^\d{2,12}$/),
  municipalityName: requiredText(200), population: z.number().int().nonnegative().nullable().optional(),
  state: z.string().trim().max(100).nullable().optional(),
  geolocation: z.object({type: z.literal("Point"), coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])}).nullable().optional(),
  altcha: captcha,
});
export type RegistrationRequest = z.input<typeof RegistrationRequestSchema>;
export const NewsletterRequestSchema = z.strictObject({
  email, name: z.string().trim().max(255).optional(),
  listIds: z.array(z.number().int().positive()).min(1).max(50).optional(),
});
export type NewsletterRequest = z.input<typeof NewsletterRequestSchema>;
export const GenericFormRequestSchema = z.strictObject({
  formKey: z.string().max(120).optional(), formTitle: z.string().max(180).optional(),
  pagePath: z.string().max(500).optional(), notificationEmail: z.string().max(255).optional(),
  sendCopy: z.boolean().optional(), altcha: captcha,
  fields: z.array(z.strictObject({name: z.string().max(80), label: z.string().max(180), type: z.enum(["text", "email", "textarea", "select", "checkbox"]), required: z.boolean().optional()})).min(1).max(50),
  values: z.record(z.string(), z.union([z.string().max(5000), z.boolean(), z.array(z.string().max(5000)).max(50)])),
});
export type GenericFormRequest = z.input<typeof GenericFormRequestSchema>;
export const WahlcheckCompletionRequestSchema = z.strictObject({electionId: z.uuid()});
