export const candidateParties = {
  parteilos: { label: "parteilos", color: "#9ca3af", textColor: "#ffffff" },
  Union: { label: "CDU", color: "#000000", textColor: "#ffffff" },
  AfD: { label: "AfD", color: "#009ee0", textColor: "#ffffff" },
  SPD: { label: "SPD", color: "#e3000f", textColor: "#ffffff" },
  Gruene: { label: "Grüne", color: "#46962b", textColor: "#ffffff" },
  Linke: { label: "Die Linke", color: "#be3075", textColor: "#ffffff" },
  BSW: { label: "BSW", color: "#7b2e5a", textColor: "#ffffff" },
  FDP: { label: "FDP", color: "#ffed00", textColor: "#000000" },
  Volt: { label: "Volt", color: "#502379", textColor: "#ffffff" },
  PARTEI: { label: "Die PARTEI", color: "#b5152b", textColor: "#ffffff" },
  FW: { label: "Freie Wähler", color: "#f5a300", textColor: "#ffffff" },
  Oedp: { label: "ÖDP", color: "#f29400", textColor: "#ffffff" },
  Piraten: { label: "Piraten", color: "#ff8800", textColor: "#ffffff" },
  Klimaliste: { label: "Klimaliste", color: "#00a09a", textColor: "#ffffff" },
  Tierschutzpartei: { label: "Tierschutzpartei", color: "#00645c", textColor: "#ffffff" },
  ParteiDesFortschritts: { label: "Partei des Fortschritts", color: "#ffa600", textColor: "#000000" },
  Tierschutzallianz: { label: "Tierschutzallianz", color: "#01cdfe", textColor: "#000000" },
  Gartenpartei: { label: "Gartenpartei", color: "#004001", textColor: "#ffffff" },
  Humanisten: { label: "Humanisten", color: "#ee225a", textColor: "#ffffff" },
  Losdemokratie: { label: "Losdemokratie", color: "#266e7a", textColor: "#ffffff" },
  FBU: { label: "Freie Bürgerliche Union", color: "#10104f", textColor: "#ffffff" },
  BuendnisC: { label: "Bündnis C", color: "#00529c", textColor: "#ffffff" },
  Handwerkerpartei: { label: "Handwerkerpartei", color: "#f79707", textColor: "#000000" },
  LobbyistenFuerKinder: { label: "Lobbyisten für Kinder", color: "#d2175e", textColor: "#ffffff" },
  Sonstige: { label: "Sonstige", color: "#cccccc", textColor: "#ffffff" },
};

function normalizePartyValue(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("de-DE");
}

const candidatePartyAliases = new Map();

function addCandidatePartyAliases(key, aliases = []) {
  const config = candidateParties[key];

  [key, config?.label, ...aliases].filter(Boolean).forEach((alias) => {
    candidatePartyAliases.set(normalizePartyValue(alias), key);
  });
}

addCandidatePartyAliases("parteilos", ["parteilose", "parteiloser"]);
addCandidatePartyAliases("Union", ["CDU", "CSU", "CDU/CSU"]);
addCandidatePartyAliases("AfD", ["Alternative für Deutschland"]);
addCandidatePartyAliases("SPD", ["Sozialdemokratische Partei Deutschlands"]);
addCandidatePartyAliases("Gruene", ["Bündnis 90/Die Grünen", "Bündnis 90 / Die Grünen"]);
addCandidatePartyAliases("Linke", ["Die Linke"]);
addCandidatePartyAliases("BSW", ["Bündnis Sahra Wagenknecht"]);
addCandidatePartyAliases("FDP", ["Freie Demokratische Partei"]);
addCandidatePartyAliases("Volt", ["Volt Deutschland"]);
addCandidatePartyAliases("PARTEI", ["Die PARTEI"]);
addCandidatePartyAliases("FW", ["Freie Wähler"]);
addCandidatePartyAliases("Oedp", ["ÖDP", "Ökologisch-Demokratische Partei"]);
addCandidatePartyAliases("Piraten", ["Piratenpartei", "Piratenpartei Deutschland"]);
addCandidatePartyAliases("Klimaliste", ["Klimaliste Deutschland"]);
addCandidatePartyAliases("Tierschutzpartei", ["Partei Mensch Umwelt Tierschutz"]);
addCandidatePartyAliases("ParteiDesFortschritts", ["PdF"]);
addCandidatePartyAliases("Tierschutzallianz", ["Allianz für Menschenrechte, Tier- und Naturschutz"]);
addCandidatePartyAliases("Gartenpartei");
addCandidatePartyAliases("Humanisten", ["Partei der Humanisten", "Die Humanisten", "PdH"]);
addCandidatePartyAliases("Losdemokratie", ["LOS", "LOS Demokratie", "Losdemokratie - Für eine starke Bürgerschaft"]);
addCandidatePartyAliases("FBU", ["Freie Bürger Union"]);
addCandidatePartyAliases("BuendnisC", ["Bündnis C - Christen für Deutschland"]);
addCandidatePartyAliases("Handwerkerpartei", ["Handwerker Partei", "Handwerker Partei Deutschland", "HPD"]);
addCandidatePartyAliases("LobbyistenFuerKinder", ["LfK"]);
addCandidatePartyAliases("Sonstige");

export function getCandidatePartyKey(party) {
  return candidatePartyAliases.get(normalizePartyValue(party)) || "";
}

export function getCandidatePartyConfig(party) {
  const key = getCandidatePartyKey(party);
  return key ? candidateParties[key] : null;
}

export function getCandidatePartyLabel(party, state = "") {
  if (!party) return "";

  const normalizedParty = normalizePartyValue(party);
  const key = getCandidatePartyKey(party);

  if (key === "Union") {
    if (normalizedParty === normalizePartyValue("CSU")) return "CSU";
    return state === "Bayern" ? "CSU" : "CDU";
  }

  return (key && candidateParties[key]?.label) || String(party).trim();
}

function getCandidateName(candidate) {
  const explicitName = String(candidate?.name ?? "").trim();
  if (explicitName) return explicitName;

  return `${candidate?.first_name || ""} ${candidate?.last_name || ""}`.trim();
}

function normalizeCandidateLabel(value) {
  return normalizePartyValue(value);
}

export function candidateNameMatchesParty(candidate, state = "") {
  const name = normalizeCandidateLabel(getCandidateName(candidate));
  const rawParty = String(candidate?.party ?? "").trim();
  const party = normalizeCandidateLabel(getCandidatePartyLabel(rawParty, state));
  const partyKey = getCandidatePartyKey(rawParty);

  if (!name || !rawParty) return false;

  return (
    name === normalizeCandidateLabel(rawParty) ||
    name === party ||
    (partyKey && getCandidatePartyKey(name) === partyKey)
  );
}

export function getCandidateDisplayName(candidate, state = "") {
  const name = getCandidateName(candidate);
  const party = getCandidatePartyLabel(String(candidate?.party ?? "").trim(), state).trim();

  if (candidateNameMatchesParty(candidate, state)) {
    return party || name;
  }

  return name || party;
}

export function formatCandidateNameAndParty(candidate, state = "") {
  const name = getCandidateName(candidate);
  const rawParty = String(candidate?.party ?? "").trim();
  const party = getCandidatePartyLabel(rawParty, state).trim();

  if (!party || candidateNameMatchesParty(candidate, state)) {
    return party || name;
  }

  return `${name} (${party})`;
}
