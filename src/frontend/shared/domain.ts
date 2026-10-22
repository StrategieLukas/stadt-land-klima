export const sectors = ["energy", "buildings", "industry", "management", "agriculture", "transport"] as const;
export type Sector = (typeof sectors)[number];
export type NumericValue = number | string | null;
export type AnswerValue = 0 | 1 | 2 | 3 | 4;
export type RatingColor = "rating-na" | "rating-0" | "rating-1" | "rating-2" | "rating-3" | "rating-4";
export interface ScorePublication {
  published?: boolean | null;
  percentage_rated?: NumericValue;
}
