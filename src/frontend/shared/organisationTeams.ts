import type { TranslationKey } from "./translationKeys";

/** Only these stable keys have a rendered destination in the organisation diagram. */
export const ORGANISATION_TEAM_LABELS = {
  lokalteams: ["organisation.team.lokalteams.line1", "organisation.team.lokalteams.line2"],
  technik: ["organisation.team.technik.line1"],
  steuerkreis: ["organisation.team.steuerkreis.line1"],
  massnahmen: ["organisation.team.massnahmen.line1"],
  kommunikation: [
    "organisation.team.kommunikation.line1",
    "organisation.team.kommunikation.line2",
    "organisation.team.kommunikation.line3",
  ],
  vorstand: ["organisation.team.vorstand.line1", "organisation.team.vorstand.line2"],
  kassenwart: ["organisation.team.kassenwart.line1"],
} as const satisfies Record<string, readonly TranslationKey[]>;

export function isOrganisationTeamKey(key: string): key is keyof typeof ORGANISATION_TEAM_LABELS {
  return Object.hasOwn(ORGANISATION_TEAM_LABELS, key);
}
