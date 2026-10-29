import { Resvg } from "@resvg/resvg-js";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createError, defineEventHandler, getQuery, getRouterParam, setResponseHeader } from "h3";
import { loadMunicipalityPageData } from "~/server/utils/municipalityPageData";
import { createDirectusServerClient } from "~/server/utils/directusServerClient";
import { rateLimit } from "~/server/utils/rateLimit";
import { queryChoice, queryText } from "~/server/utils/publicQuery";
import { sectorPreviewSvg } from "~/server/utils/sectorPreview";
import { seoMessages } from "~/shared/seoMessages";
import { isMunicipalityScoreComplete } from "~/shared/municipality-score-publishing";

let fontFile: Promise<string> | undefined;
async function previewFont(): Promise<string> {
  fontFile ??= (async () => {
    const font = await useStorage("assets:server").getItemRaw<Buffer>("fonts/RobotoCondensed-Regular.ttf");
    if (!font) throw new Error("Preview font is unavailable");
    const path = join(await mkdtemp(join(tmpdir(), "slk-preview-")), "font.ttf");
    await writeFile(path, font, { mode: 0o600 });
    return path;
  })().catch((error: unknown) => {
    fontFile = undefined;
    throw error;
  });
  return fontFile;
}
export default defineEventHandler(async (event) => {
  await rateLimit(event, "municipality-social-image");
  const slug = getRouterParam(event, "slug") ?? "";
  const query = getQuery(event);
  if (!/^[a-z0-9-]{1,160}$/.test(slug) || Object.keys(query).some((key) => !["v", "lang"].includes(key)))
    throw createError({ statusCode: 400, statusMessage: "Invalid image request" });
  const locale = queryChoice(query.lang, ["de-DE", "en-GB", "it-IT"] as const, "de-DE") ?? "de-DE";
  const page = await loadMunicipalityPageData(createDirectusServerClient(), slug, queryText(query.v, 100));
  const score = page.directusData.municipalityScore;
  if (!score || !isMunicipalityScoreComplete(score) || score.municipality.status !== "published")
    throw createError({ statusCode: 404, statusMessage: "Assessment not found" });
  const labels = seoMessages[locale];
  const svg = sectorPreviewSvg(
    score.municipality.name,
    page.selectedCatalogVersion.name,
    score.score_total,
    [
      { label: labels["seo.preview.energy"], score: score.score_energy },
      { label: labels["seo.preview.transport"], score: score.score_transport },
      { label: labels["seo.preview.agriculture"], score: score.score_agriculture },
      { label: labels["seo.preview.industry"], score: score.score_industry },
      { label: labels["seo.preview.buildings"], score: score.score_buildings },
      { label: labels["seo.preview.management"], score: score.score_management },
    ],
    labels["seo.preview.assessment"],
  );
  const png = new Resvg(svg, {
    font: { loadSystemFonts: false, fontFiles: [await previewFont()], defaultFontFamily: "Roboto Condensed" },
  })
    .render()
    .asPng();
  setResponseHeader(event, "Content-Type", "image/png");
  setResponseHeader(event, "Cache-Control", "public, max-age=300");
  setResponseHeader(event, "X-Content-Type-Options", "nosniff");
  return png;
});
