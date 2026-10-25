import type { NumericValue, RatingColor } from "./domain";

import linkifyStr from "linkify-string";
export function buildLocationString(municipality_name?: string | null, state?: string | null): string {
  if (municipality_name && state) {
    return `${municipality_name}, ${state}`;
  }
  if (municipality_name) {
    return municipality_name;
  }
  if (state) {
    return state;
  }
  return "";
}

/** @param {string | null | undefined} type
 * @returns {boolean}
 */
export function isRaster(type?: string | null): boolean {
  if (!type) return false;
  return type.startsWith("image/") && !type.includes("svg");
}

/**
 * @param {string} dateString
 * @returns {string} Properly formatted date and time
 */
export function formatLastUpdated(dateString: string, locale: string) {
  const lastUpdatedAt = new Date(dateString);
  return `${lastUpdatedAt.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "numeric",
  })}, ${lastUpdatedAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
}

export function getRatingDecimalColor(score: NumericValue | undefined): RatingColor {
  if (score === null) return "rating-na";
  return getScorePercentageColor(Number(score) * 100);
}

export function getScorePercentageColor(score: NumericValue | undefined): RatingColor {
  if (score === null) return "rating-na";
  const numericScore = Number(score);
  if (numericScore >= 80) {
    return "rating-4";
  } else if (numericScore >= 60) {
    return "rating-3";
  } else if (numericScore >= 40) {
    return "rating-2";
  } else if (numericScore >= 20) {
    return "rating-1";
  } else if (numericScore >= 0) {
    return "rating-0";
  }
  return "rating-na";
}

export function saneLinkifyStr(text: string | null | undefined, newTab = true) {
  return linkifyStr(text ?? "", {
    validate: {
      // don't linkify Stadt.Land.Klima substrings
      // we now require a protocol (http:// or https://) to create a link
      url: (value) => /^https?:\/\//.test(value),
    },
    target: newTab ? "_blank" : "_self",
    rel: "noopener noreferrer",
  });
}

const MUNICIPAL_ELECTION_YEARS: Record<string, number> = {
  Bayern: 2026,
  Hessen: 2026,
  Niedersachsen: 2026,
  Berlin: 2026,

  Bremen: 2027,

  "Schleswig-Holstein": 2028,

  "Baden-Württemberg": 2029,
  Brandenburg: 2029,
  "Mecklenburg-Vorpommern": 2029,
  "Rheinland-Pfalz": 2029,
  Saarland: 2029,
  Sachsen: 2029,
  "Sachsen-Anhalt": 2029,
  Thüringen: 2029,

  "Nordrhein-Westfalen": 2030,
  Hamburg: 2030,
};

export function getStateMunicipalElectionYear(state?: string | null) {
  if (state == null) return null;
  return MUNICIPAL_ELECTION_YEARS[state] ?? null;
}

// ARS prefix (first 2 digits) → German Bundesland name
export const ARS_STATE_MAP: Readonly<Record<string, string>> = {
  "01": "Schleswig-Holstein",
  "02": "Hamburg",
  "03": "Niedersachsen",
  "04": "Bremen",
  "05": "Nordrhein-Westfalen",
  "06": "Hessen",
  "07": "Rheinland-Pfalz",
  "08": "Baden-Württemberg",
  "09": "Bayern",
  "10": "Saarland",
  "11": "Berlin",
  "12": "Brandenburg",
  "13": "Mecklenburg-Vorpommern",
  "14": "Sachsen",
  "15": "Sachsen-Anhalt",
  "16": "Thüringen",
};

export function getStateFromArs(ars: string | number | null | undefined) {
  return ARS_STATE_MAP[String(ars).slice(0, 2)] ?? null;
}
