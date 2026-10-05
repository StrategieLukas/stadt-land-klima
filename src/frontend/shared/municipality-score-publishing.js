export function isMunicipalityScorePublished(score) {
  return score?.published === true;
}

export function isMunicipalityScoreComplete(score) {
  return isMunicipalityScorePublished(score) && Number(score.percentage_rated) >= 100;
}
