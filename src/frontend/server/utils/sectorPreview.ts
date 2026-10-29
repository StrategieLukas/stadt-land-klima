const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character,
  );
const bounded = (value: number | null) => Math.min(100, Math.max(0, Number.isFinite(value) ? Number(value) : 0));
const color = (value: number) =>
  value < 20 ? "#E30613" : value < 40 ? "#F39200" : value < 60 ? "#FFD400" : value < 80 ? "#AFCA0B" : "#1EA64A";
/** No external images, markup or URLs are accepted by this renderer. */
export function sectorPreviewSvg(
  name: string,
  catalog: string,
  total: number | null,
  sectors: { label: string; score: number | null }[],
  caption: string,
): string {
  const title = Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(name),
    (item) => item.segment,
  )
    .slice(0, 65)
    .join("");
  const fontSize = title.length > 35 ? 42 : 58;
  const cards = sectors
    .slice(0, 6)
    .map((sector, index) => {
      const x = 48 + (index % 3) * 374,
        y = 257 + Math.floor(index / 3) * 144;
      const value = bounded(sector.score);
      return `<g transform="translate(${x} ${y})"><rect width="356" height="124" rx="12" fill="#ffffff"/><text x="20" y="37" font-size="25" fill="#334155">${escapeXml(sector.label)}</text><text x="20" y="82" font-size="36" fill="#152815">${value.toFixed(1)}%</text><rect x="20" y="100" width="316" height="8" rx="4" fill="#e7eddf"/><rect x="20" y="100" width="${(316 * value) / 100}" height="8" rx="4" fill="${color(value)}"/></g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#f4f7e8"/><rect width="1200" height="12" fill="#AFCA0B"/><g font-family="Roboto Condensed, sans-serif"><text x="48" y="62" font-size="28" fill="#476020">Stadt.Land.Klima!</text><text x="48" y="137" font-size="${fontSize}" fill="#152815">${escapeXml(title)}</text><text x="48" y="191" font-size="28" fill="#334155">${escapeXml(caption)} · ${escapeXml(catalog.slice(0, 80))}</text><text x="1138" y="90" text-anchor="end" font-size="42" fill="#476020">${bounded(total).toFixed(1)}%</text>${cards}<text x="48" y="594" font-size="23" fill="#476020">stadt-land-klima.de</text></g></svg>`;
}
