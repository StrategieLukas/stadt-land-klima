import type { ScorePublication } from "./domain";
export function isMunicipalityScorePublished(score: ScorePublication | null | undefined) {
  return score?.published === true;
}

export function isMunicipalityScoreComplete(score: ScorePublication | null | undefined) {
  return isMunicipalityScorePublished(score) && Number(score?.percentage_rated) >= 100;
}
