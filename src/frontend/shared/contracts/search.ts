import { z } from "zod";

export const CatalogSchema = z.object({
  id: z.string(),
  name: z.string(),
  isCurrentFrontend: z.boolean().nullish(),
  isCurrentBackend: z.boolean().nullish(),
  date_created: z.string().nullish(),
});
export type Catalog = z.infer<typeof CatalogSchema>;
const numeric = z.union([z.number(), z.string()]).nullable();
export const PublicScoreSchema = z.object({
  catalog_version: z.union([CatalogSchema.pick({ id: true, name: true }), z.string()]).nullable(),
  published: z.boolean().nullish(),
  percentage_rated: numeric.optional(),
  score_total: numeric.optional(),
  rank: numeric.optional(),
});
export type PublicScore = z.infer<typeof PublicScoreSchema>;
export const PublicMunicipalitySchema = z.object({
  id: z.string(),
  name: z.string(),
  ars: z.string().nullish(),
  slug: z.string().nullish(),
  localteam_id: z.string().nullish(),
  status: z.string().nullish(),
  image: z.string().nullish(),
  image_credits: z.string().nullish(),
  scores: z.array(PublicScoreSchema).default([]),
});
export type PublicMunicipality = z.infer<typeof PublicMunicipalitySchema>;
export const AreaSchema = z
  .object({
    ars: z.string(),
    name: z.string(),
    prefix: z.string(),
    level: z.number().nullish(),
    population: z.number().nullable().optional(),
    slug: z.string().optional(),
    isReasonableForMunicipalRating: z.boolean().optional(),
    is_reasonable_for_municipal_rating: z.boolean().optional(),
    geoCenter: z.object({ lat: z.number(), lon: z.number() }).nullable().optional(),
    geo_center: z.object({ lat: z.number(), lon: z.number() }).nullable().optional(),
    geoArea: z
      .union([z.string(), z.record(z.string(), z.unknown())])
      .nullable()
      .optional(),
    geo_area: z
      .union([z.string(), z.record(z.string(), z.unknown())])
      .nullable()
      .optional(),
    state: z.string().nullish(),
    data_products: z
      .object({ population_data: z.object({ population: z.number() }).nullable().optional() })
      .loose()
      .optional(),
    stadtlandklima_data: z.array(z.object({ slug: z.string().nullable() }).loose()).optional(),
    contained_by: z
      .array(z.object({ ars: z.string(), name: z.string(), prefix: z.string(), level: z.number() }).loose())
      .optional(),
    stadtlandklimaDataAll: z
      .array(
        z.object({
          slug: z.string().nullable(),
          scoreTotal: numeric,
          percentageRated: numeric,
          measureCatalogName: z.string(),
        }),
      )
      .default([]),
  })
  .loose();
export type Area = z.infer<typeof AreaSchema>;
export type SearchMode = "normal" | "reasonable" | "all";
export const ContentHitSchema = z.object({
  id: z.union([z.string(), z.number()]),
  type: z.string(),
  title: z.string(),
  excerpt: z.string().default(""),
  url: z.string(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type ContentHit = z.infer<typeof ContentHitSchema>;
export const MunicipalitiesResponseSchema = z.object({ municipalities: z.array(PublicMunicipalitySchema) });
export const ContentResponseSchema = z.object({ hits: z.array(ContentHitSchema) });
export const AreaListSchema = z.array(AreaSchema);
export interface CatalogStatus {
  hasLocalteam: boolean;
  slug: string | null;
  published: boolean;
  percentageRated: string | number | null;
  scoreTotal: string | number | null;
  completeCatalogNames: string[];
  scores?: PublicScore[];
}
export type SearchArea = Area & { hasLocalteam?: boolean; directusCatalogStatus?: CatalogStatus | null };
export type UnifiedArea = Area & { hasLocalteam?: boolean; directusCatalogStatus?: PublicMunicipality | null };
export type AreaCta = "area" | "complete" | "outdated" | "none" | "in-progress" | "not-started";
export const scoreCatalogName = (score: PublicScore): string | undefined =>
  typeof score.catalog_version === "object" ? score.catalog_version?.name : undefined;
