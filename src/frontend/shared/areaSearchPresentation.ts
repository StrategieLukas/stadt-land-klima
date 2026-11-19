import type { AreaCta, UnifiedArea } from "./contracts/search";
import { scoreCatalogName } from "./contracts/search";
import { isMunicipalityScoreComplete } from "./municipality-score-publishing";
import { getScorePercentageColor } from "./utils";

export type SearchAreaKind = "region" | "municipality" | "administrative-area";

export function areaSearchPresentation(area: UnifiedArea, catalogName: string | null) {
  // Eligibility is explicit: a lower administrative level alone does not make
  // an area rateable. City-states can be rateable despite their higher level.
  const areaKind: SearchAreaKind = area.isReasonableForMunicipalRating
    ? "municipality"
    : area.level != null && area.level <= 3
      ? "region"
      : "administrative-area";
  let ctaType: AreaCta = "area";
  let scoreTotal: string | number | null = null;
  let slug: string | null = null;
  let oldCatalogName: string | null = null;

  if (areaKind === "municipality") {
    const municipality = area.directusCatalogStatus;
    const completeScores = (municipality?.scores ?? []).filter(isMunicipalityScoreComplete);
    const currentScore = catalogName
      ? completeScores.find((score) => scoreCatalogName(score) === catalogName)
      : undefined;
    const oldScore = catalogName
      ? completeScores.find((score) => scoreCatalogName(score) && scoreCatalogName(score) !== catalogName)
      : undefined;
    const displayedScore = currentScore ?? oldScore;
    const externalRating = area.stadtlandklimaDataAll.find((rating) =>
      displayedScore ? rating.measureCatalogName === scoreCatalogName(displayedScore) : rating.slug,
    );
    slug = municipality?.slug ?? externalRating?.slug ?? null;

    if (displayedScore) {
      ctaType = currentScore ? "complete" : "outdated";
      scoreTotal = displayedScore.score_total ?? externalRating?.scoreTotal ?? null;
      oldCatalogName = oldScore && !currentScore ? (scoreCatalogName(oldScore) ?? null) : null;
    } else if (area.hasLocalteam || municipality?.localteam_id || externalRating?.slug) {
      ctaType = "in-progress";
    } else {
      ctaType = "none";
    }
  }

  return {
    areaKind,
    isMunicipality: areaKind === "municipality",
    ctaType,
    scoreDisplay: scoreTotal != null ? `${Math.round(Number(scoreTotal))}%` : null,
    scoreTotalColorClass: scoreTotal != null ? getScorePercentageColor(scoreTotal) : null,
    _slug: slug,
    _oldCatalogName: oldCatalogName,
  };
}
