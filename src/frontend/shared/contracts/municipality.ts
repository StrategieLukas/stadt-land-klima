import { z } from "zod";
import { sectors } from "../domain";
import { CatalogSchema } from "./search";
import { NullableTextSchema, AssetSchema } from "./content";

export const NumericSchema = z.union([z.number().finite(), z.string().regex(/^-?\d+(?:\.\d+)?$/)]).nullable().transform(value => value === null ? null : Number(value));
export const PointSchema = z.object({type: z.literal("Point"), coordinates: z.tuple([z.number().finite(), z.number().finite()])});
export const MunicipalitySchema = z.object({
  id: z.string(), name: z.string(), slug: z.string(), ars: NullableTextSchema,
  status: z.string(), state: NullableTextSchema, population: NumericSchema.nullish().transform(v => v ?? null),
  municipality_type: NullableTextSchema, description: NullableTextSchema,
  image: z.string().nullable().optional(), image_credits: NullableTextSchema,
  mayor: NullableTextSchema, party_mayor: NullableTextSchema, public_contact: NullableTextSchema,
  overall_status_comment: NullableTextSchema, date_created: NullableTextSchema, date_updated: NullableTextSchema,
  geolocation: PointSchema.nullish().transform(v => v ?? null),
  localteam_id: z.string().nullable().optional(),
});
export const MeasureSchema = z.object({
  id: z.string(), measure_id: z.string(), name: z.string(), slug: z.string(), sector: z.enum(sectors),
  weight: NumericSchema, image: AssetSchema.transform(value => typeof value === "object" ? value?.id ?? null : value), image_credits: NullableTextSchema,
  impact: NumericSchema, feasibility_economical: NumericSchema, feasibility_political: NumericSchema,
  description: NullableTextSchema, description_about: NullableTextSchema, description_benefit: NullableTextSchema,
  description_contribution: NullableTextSchema, description_implementation: NullableTextSchema,
  description_funding: NullableTextSchema, description_legal: NullableTextSchema,
  description_evaluation_criteria: NullableTextSchema, description_verification: NullableTextSchema, description_tutorial: NullableTextSchema,
});
export const ScoreSchema = z.object({
  id: z.string(), published: z.boolean().nullable(), percentage_rated: NumericSchema,
  score_total: NumericSchema, score_max: NumericSchema, score_points: NumericSchema,
  rank: z.number().nullable(),
  score_agriculture: NumericSchema, score_buildings: NumericSchema, score_energy: NumericSchema,
  score_industry: NumericSchema, score_management: NumericSchema, score_transport: NumericSchema,
  date_created: NullableTextSchema, date_updated: NullableTextSchema,
});
export const RatingSchema = z.object({
  id: z.string(), measure_id: z.string(), rating: NumericSchema, applicable: z.boolean().nullable(),
  why_not_applicable: NullableTextSchema, current_progress: NullableTextSchema, source: NullableTextSchema, date_updated: NullableTextSchema,
});
export const TeamIdentitySchema = z.object({id: z.string(), date_created: NullableTextSchema});
export const MunicipalityIdentitySchema = MunicipalitySchema.pick({id: true, name: true, slug: true, ars: true, status: true}).extend({localteam_id: TeamIdentitySchema.nullable()});
export const MunicipalityDetailSchema = MunicipalitySchema.omit({localteam_id: true}).extend({localteam_id: TeamIdentitySchema.nullable()});
export const MunicipalityPageSchema = z.object({
  selectedCatalogVersion: CatalogSchema,
  municipality: MunicipalityIdentitySchema.nullable(), previewAuthorized: z.boolean(),
  directusData: z.object({
    municipalityScore: ScoreSchema.extend({catalog_version: CatalogSchema, municipality: MunicipalityDetailSchema}).optional(),
    ratingsBySector: z.partialRecord(z.enum(sectors), z.array(RatingSchema.extend({measure: MeasureSchema}))).optional(),
  }),
});
const StatisticsMunicipalitySchema = MunicipalitySchema.transform(row => ({...row, localteam_id: row.localteam_id ? {id: row.localteam_id} : null}));
export const StatisticsSchema = z.object({
  catalogVersion: CatalogSchema,
  municipalities: z.array(StatisticsMunicipalitySchema),
  scores: z.array(ScoreSchema.omit({date_created: true, date_updated: true}).extend({catalog_version: CatalogSchema, municipality: StatisticsMunicipalitySchema})),
  measures: z.array(MeasureSchema),
  ratings: z.array(RatingSchema.pick({measure_id: true, rating: true, applicable: true}).extend({localteam_id: z.string()})),
});
export type Statistics = z.output<typeof StatisticsSchema>;

export const ComparisonRatingSchema = z.object({
  rating: NumericSchema, applicable: z.boolean().nullable(),
  localteam_id: z.object({id: z.string(), municipality_name: z.string().optional(), municipality_id: z.array(MunicipalitySchema.pick({id: true, name: true, slug: true, state: true, party_mayor: true, population: true, geolocation: true}).extend({scores: z.array(z.object({catalog_version: z.string(), published: z.boolean(), percentage_rated: NumericSchema}))}))}),
});
