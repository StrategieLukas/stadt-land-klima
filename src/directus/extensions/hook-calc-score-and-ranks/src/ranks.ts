export type RankedMunicipalityScore = {
  id: number | string;
  score_total: number | string | null;
  published: boolean | null;
  percentage_rated?: number | string | null;
  municipality?: number | string | { status: string; name: string };
  rank: number | string | null;
};

export function municipalityRanks(scores: RankedMunicipalityScore[]): Map<string, number> {
  const sortedScores = scores
    .filter(
      (score) =>
        score.published === true &&
        Number(score.percentage_rated) >= 100 &&
        typeof score.municipality === "object" &&
        score.municipality.status === "published",
    )
    .sort(
      (a, b) =>
        Number(b.score_total) - Number(a.score_total) ||
        (typeof a.municipality === "object" ? a.municipality.name : "").localeCompare(
          typeof b.municipality === "object" ? b.municipality.name : "",
          "de",
        ) ||
        String(a.id).localeCompare(String(b.id)),
    );

  const ranked: Array<{ id: number | string; rank: number }> = [];
  for (let index = 0; index < sortedScores.length; index++) {
    const score = sortedScores[index];
    const previousScore = sortedScores[index - 1];
    const previousRank = ranked[index - 1]?.rank;
    ranked.push({
      id: score.id,
      rank:
        index === 0 || Number(score.score_total) !== Number(previousScore.score_total)
          ? index + 1
          : (previousRank ?? index + 1),
    });
  }

  return new Map(ranked.map((entry) => [String(entry.id), entry.rank]));
}
