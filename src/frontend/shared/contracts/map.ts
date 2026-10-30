import { z } from "zod";
import { NumericSchema, PointSchema } from "./municipality";
import { CatalogSchema } from "./search";

/** Progress is public metadata; unpublished assessment results never enter this DTO. */
export const MapAssessmentSchema = z.object({
  published: z.boolean(),
  percentage_rated: NumericSchema,
  score_total: NumericSchema,
  municipality: z.object({
    name: z.string(),
    slug: z.string(),
    geolocation: PointSchema.nullable(),
    municipality_type: z.string().nullable(),
  }),
});
export const MapResponseSchema = z.object({
  catalogVersion: CatalogSchema,
  scores: z.array(MapAssessmentSchema),
});
export type MapAssessment = z.output<typeof MapAssessmentSchema>;
export type MapResponse = z.output<typeof MapResponseSchema>;
