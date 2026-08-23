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
  Sonstige: { label: "Sonstige", color: "#cccccc", textColor: "#ffffff" },
};

export function getCandidatePartyLabel(party, state = "") {
  if (!party) return "";

  if (party === "Union") {
    return state === "Bayern" ? "CSU" : "CDU";
  }

  return candidateParties[party]?.label || party;
}

function getCandidateName(candidate) {
  const explicitName = String(candidate?.name ?? "").trim();
  if (explicitName) return explicitName;

  return `${candidate?.first_name || ""} ${candidate?.last_name || ""}`.trim();
}

function normalizeCandidateLabel(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

export function candidateNameMatchesParty(candidate, state = "") {
  const name = normalizeCandidateLabel(getCandidateName(candidate));
  const rawParty = String(candidate?.party ?? "").trim();
  const party = normalizeCandidateLabel(getCandidatePartyLabel(rawParty, state));

  if (!name || !rawParty) return false;

  return name === normalizeCandidateLabel(rawParty) || name === party;
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
