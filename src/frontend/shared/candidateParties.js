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

export function formatCandidateNameAndParty(candidate, state = "") {
  const name = String(candidate?.name ?? "").trim();
  const rawParty = String(candidate?.party ?? "").trim();
  const party = getCandidatePartyLabel(rawParty, state).trim();
  const normalizedName = name.toLocaleLowerCase();

  if (!party || normalizedName === rawParty.toLocaleLowerCase() || normalizedName === party.toLocaleLowerCase()) {
    return name;
  }

  return `${name} (${party})`;
}
