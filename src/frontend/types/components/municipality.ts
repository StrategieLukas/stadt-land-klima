import type { NumericValue, Sector } from "~/shared/domain";
import type { Catalog } from "~/shared/contracts/search";
import type { Point } from "geojson";
export interface Municipality {
  id: string;
  name: string;
  slug: string;
  ars?: string | null | undefined;
  status?: string | null | undefined;
  state?: string | null | undefined;
  population?: NumericValue | undefined;
  municipality_type?: string | null | undefined;
  description?: string | null | undefined;
  image?: string | null | undefined;
  image_credits?: string | null | undefined;
  mayor?: string | null | undefined;
  party_mayor?: string | null | undefined;
  public_contact?: string | null | undefined;
  overall_status_comment?: string | null | undefined;
  date_created?: string | null | undefined;
  date_updated?: string | null | undefined;
  geolocation?: Point | null | undefined;
  localteam_id?: { id: string; date_created?: string | null | undefined } | null | undefined;
}
export type MunicipalityScore = {
  id: string;
  municipality: Municipality;
  catalog_version: Catalog;
  published?: boolean | null | undefined;
  percentage_rated?: NumericValue | undefined;
  score_total: NumericValue;
  score_max?: NumericValue | undefined;
  score_points?: NumericValue | undefined;
  rank: number | null;
  date_created?: string | null | undefined;
  date_updated?: string | null | undefined;
} & Partial<Record<`score_${Sector}`, NumericValue>>;
export type Measure = {
  date_updated?: string | null | undefined;
  id: string;
  measure_id: string;
  name: string;
  slug: string;
  sector: Sector;
  weight?: NumericValue | undefined;
  image?: string | null | undefined;
  image_credits?: string | null | undefined;
  impact?: NumericValue | undefined;
  feasibility_economical?: NumericValue | undefined;
  feasibility_political?: NumericValue | undefined;
  catalog_version?: Catalog | undefined;
} & Partial<
  Record<
    | "description"
    | `description_${"about" | "benefit" | "contribution" | "implementation" | "funding" | "legal" | "evaluation_criteria" | "verification" | "tutorial"}`,
    string | null
  >
>;
export interface MeasureRating {
  id: string;
  measure: Measure;
  measure_id?: string | undefined;
  rating: NumericValue;
  applicable?: boolean | null | undefined;
  why_not_applicable?: string | null | undefined;
  current_progress?: string | null | undefined;
  source?: string | null | undefined;
  date_updated?: string | null | undefined;
}
export type RatingsBySector = Partial<Record<Sector, MeasureRating[]>>;
export type SubScores = Partial<Record<`score_${Sector}`, NumericValue>>;
export interface ComparisonRating {
  rating: NumericValue;
  applicable?: boolean | null | undefined;
  localteam_id?: {
    id?: string | undefined;
    municipality_name?: string | null | undefined;
    municipality_id?: (Municipality & {
      scores?: { catalog_version: Catalog | string; published?: boolean | null | undefined; percentage_rated?: NumericValue | undefined }[] | undefined;
    })[] | undefined;
  } | null | undefined;
}
