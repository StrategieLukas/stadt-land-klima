/** Stable, readable report names; display names keep their Unicode characters. */
export function reportFilename(
  name: string,
  dates: (string | null | undefined)[],
  kind: "Bewertung" | "Wahlcheck",
): string {
  const municipality =
    Array.from(
      name
        .normalize("NFC")
        .replace(/[<>:"/\\|?*]|\p{C}/gu, " ")
        .trim()
        .replace(/\s+/g, "_"),
    )
      .slice(0, 100)
      .join("") || "Kommune";
  const timestamps = dates.map((date) => Date.parse(date ?? "")).filter(Number.isFinite);
  const date = timestamps.length
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Berlin",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(Math.max(...timestamps)))
    : "unbekannt";
  return `StadtLandKlima-${kind}_${municipality}_vom-${date}.pdf`;
}

export function inlinePdfDisposition(filename: string): string {
  const fallback = filename
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9_.-]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
