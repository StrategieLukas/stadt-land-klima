/** Explicit human roles. Localteam membership and service/administrator identities use their own workflows. */
export const INVITABLE_ROLES = [
  {
    name: "ErfolgsprojekteRedaktion",
    label: "Erfolgsprojekte-Redaktion",
    description: "Du kannst Erfolgsprojekte redaktionell bearbeiten und kommunale Klimaschutzprojekte vorstellen.",
  },
  {
    name: "Maßnahmenteam",
    label: "Maßnahmenteam",
    description:
      "Du kannst am Maßnahmenkatalog und den Grundlagen für die Bewertung des kommunalen Klimaschutzes mitarbeiten.",
  },
  {
    name: "Planungsteam",
    label: "Planungsteam",
    description: "Du kannst die gemeinsame Planung und Organisation von Stadt.Land.Klima! unterstützen.",
  },
  {
    name: "Recruiter",
    label: "Recruiting",
    description: "Du kannst Stellenangebote und Bewerbungen bei Stadt.Land.Klima! betreuen.",
  },
  {
    name: "WahlcheckAdmin",
    label: "Wahlcheck-Administration",
    description:
      "Du kannst Klima-Wahlchecks vorbereiten und Wahlen, Thesen und die Kommunikation mit Kandidierenden betreuen.",
  },
  {
    name: "BlokkliEditor",
    label: "Website-Redaktion",
    description: "Du kannst die Inhalte und Bausteine der Website von Stadt.Land.Klima! bearbeiten.",
  },
] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number] & { id: string };
