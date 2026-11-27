import { z } from "zod";

export const ThesisCategorySchema = z.enum([
  "political_science",
  "public_administration",
  "computer_and_data_science",
  "climate_action_management",
  "climate_and_environmental_engineering",
]);
export const ThesisLevelSchema = z.enum(["bachelor", "master", "phd"]);

export type ThesisCategory = z.infer<typeof ThesisCategorySchema>;
export type ThesisLevel = z.infer<typeof ThesisLevelSchema>;

export const PublicThesisTopicSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(255),
  short_description: z.string().trim().max(255).nullable(),
  description: z.string().trim().min(1),
  categories: z.array(ThesisCategorySchema).min(1).max(ThesisCategorySchema.options.length),
  levels: z.array(ThesisLevelSchema).min(1).max(ThesisLevelSchema.options.length),
});

export const ThesisTopicsResponseSchema = z.object({
  topics: z.array(PublicThesisTopicSchema),
});
