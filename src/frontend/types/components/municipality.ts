import type { NumericValue, Sector } from "~/shared/domain";
import type { Catalog } from "~/shared/contracts/search";
import type { Point } from "geojson";
export interface Municipality {
  id: string;
  name: string;
  slug: string;
  ars?: string | null;
  status?: string | null;
  state?: string | null;
  population?: NumericValue;
  municipality_type?: string | null;
  description?: string | null;
  image?: string | null;
  image_credits?: string | null;
  mayor?: string | null;
  party_mayor?: string | null;
  public_contact?: string | null;
  overall_status_comment?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
  geolocation?: Point | null;
  localteam_id?: { id: string; date_created?: string | null } | null;
}
export type MunicipalityScore = {
  id: string;
  municipality: Municipality;
  catalog_version: Catalog;
  published?: boolean | null;
  percentage_rated?: NumericValue;
  score_total: NumericValue;
  score_max?: NumericValue;
  score_points?: NumericValue;
  rank: number | null;
  date_created?: string | null;
  date_updated?: string | null;
} & Partial<Record<`score_${Sector}`, NumericValue>>;
export type Measure = {
  date_updated?: string | null;
  id: string;
  measure_id: string;
  name: string;
  slug: string;
  sector: Sector;
  weight?: NumericValue;
  image?: string | null;
  image_credits?: string | null;
  impact?: NumericValue;
  feasibility_economical?: NumericValue;
  feasibility_political?: NumericValue;
  catalog_version?: Catalog;
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
  measure_id?: string;
  rating: NumericValue;
  applicable?: boolean | null;
  why_not_applicable?: string | null;
  current_progress?: string | null;
  source?: string | null;
  date_updated?: string | null;
}
export type RatingsBySector = Partial<Record<Sector, MeasureRating[]>>;
export type SubScores = Partial<Record<`score_${Sector}`, NumericValue>>;
export interface ComparisonRating {
  rating: NumericValue;
  applicable?: boolean | null;
  localteam_id?: {
    id?: string;
    municipality_name?: string | null;
    municipality_id?: (Municipality & { scores?: {catalog_version: Catalog | string; published?: boolean | null; percentage_rated?: NumericValue}[] })[];
  } | null;
}
