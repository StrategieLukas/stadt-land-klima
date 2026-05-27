import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFileSync, unlinkSync } from "fs";
import { randomUUID } from "crypto";
import { convert } from "html-to-text";
import type { Request, Response, Router } from "express";
import type { ItemsService, Schema } from "@directus/types";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MunicipalityScore {
  date_updated: string;
  score_total: number;
  score_buildings: number;
  score_energy: number;
  score_transport: number;
  score_industry: number;
  score_management: number;
  score_agriculture: number;
  percentage_rated: number;
  rank: number;
  municipality: {
    id: number;
    name: string;
    slug: string;
    localteam_id: number;
    municipality_type: string;
    state: string;
    overall_status_comment: string | null;
  };
}

interface Measure {
  id: number;
  sector: string;
}

interface RatingMeasure {
  measure_id: number;
  measure?: Measure;
}

interface AuthenticatedRequest extends Request {
  accountability?: { admin: boolean; role: string | null };
  params: { slug: string; version: string };
  body: { measure_text?: Array<{ description_benefit?: string }> };
}

interface ExtensionContext {
  services: { ItemsService: new (...args: any[]) => ItemsService };
  getSchema: () => Promise<Schema>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortMeasuresBySector(
  ratingMeasures: RatingMeasure[],
  measures: Measure[]
): Record<string, RatingMeasure[]> {
  if (!Array.isArray(ratingMeasures) || !Array.isArray(measures)) return {};

  const measureMap = new Map(measures.map((m) => [m.id, m]));
  const result: Record<string, RatingMeasure[]> = {};

  for (const item of ratingMeasures) {
    const measure = measureMap.get(item.measure_id);
    if (!measure) continue;
    item.measure = measure;
    (result[measure.sector] ??= []).push(item);
  }

  return result;
}

function convertDescriptionsToPlainText(
  data: Array<{ description_benefit?: string }>
): void {
  for (const item of data) {
    if (item.description_benefit) {
      item.description_benefit = convert(item.description_benefit);
    }
  }
}

/** Writes a set of named temp files and returns a cleanup function. */
function writeTempFiles(
  dir: string,
  files: Record<string, unknown>
): { paths: Record<string, string>; cleanup: () => void } {
  const id = randomUUID();
  const paths: Record<string, string> = {};

  for (const [key, data] of Object.entries(files)) {
    const filename = `${key}_${id}.json`;
    const filepath = path.join(dir, filename);
    writeFileSync(filepath, JSON.stringify(data));
    paths[key] = filepath;
  }

  const cleanup = () => {
    for (const filepath of Object.values(paths)) {
      try {
        unlinkSync(filepath);
      } catch (err) {
        console.error("[pdf-service] Failed to delete temp file:", filepath, err);
      }
    }
  };

  return { paths, cleanup };
}

// ---------------------------------------------------------------------------
// Data fetching — throws on error instead of writing to res directly
// ---------------------------------------------------------------------------

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function fetchReportData(
  req: AuthenticatedRequest,
  schema: Schema,
  ItemsServiceClass: new (...args: any[]) => ItemsService
): Promise<[MunicipalityScore, Record<string, RatingMeasure[]>]> {
  const { slug: municipalitySlug, version: catalogVersionName } = req.params;
  const accountability = req.accountability;

  const scoreService = new ItemsServiceClass("municipality_scores", { schema, accountability });
  const scores = (await scoreService.readByQuery({
    fields: [
      "date_updated", "score_total", "score_buildings", "score_energy",
      "score_transport", "score_industry", "score_management",
      "score_agriculture", "percentage_rated", "rank",
      "municipality.id", "municipality.name", "municipality.slug",
      "municipality.localteam_id", "municipality.municipality_type",
      "municipality.state", "municipality.overall_status_comment",
    ],
    filter: {
      catalog_version: { name: { _eq: catalogVersionName } },
      municipality: { slug: { _eq: municipalitySlug } },
    },
    limit: 1,
  })) as MunicipalityScore[];

  if (!scores?.[0]) {
    throw new HttpError(404, `No scores found for municipality "${municipalitySlug}" or access denied`);
  }

  const municipalityScore = scores[0];
  const { localteam_id } = municipalityScore.municipality;

  const measuresService = new ItemsServiceClass("measures", { schema, accountability });
  const measures = (await measuresService.readByQuery({
    filter: { catalog_version: { name: { _eq: catalogVersionName } } },
  })) as Measure[];

  if (!measures?.length) {
    throw new HttpError(404, "Measures not found or access denied");
  }

  const ratingMeasuresService = new ItemsServiceClass("ratings_measures", { schema, accountability });
  const ratingMeasures = (await ratingMeasuresService.readByQuery({
    filter: { localteam_id: { _eq: localteam_id } },
  })) as RatingMeasure[];

  if (!ratingMeasures) {
    throw new HttpError(404, "Rating measures not found or access denied");
  }

  return [municipalityScore, sortMeasuresBySector(ratingMeasures, measures)];
}

// ---------------------------------------------------------------------------
// PDF compilation
// ---------------------------------------------------------------------------

async function compilePdf(
  typstFilePath: string,
  typstDir: string,
  inputs: Record<string, string>,
  tempFiles: Record<string, string>
): Promise<Buffer> {
  const args = [
    "compile",
    ...Object.entries(inputs).flatMap(([k, v]) => ["--input", `${k}=${v}`]),
    "--font-path", path.join(typstDir, "fonts"),
    typstFilePath,
    "-",
  ];

  // execFile with encoding:buffer returns Buffer in stdout when promisified
  const { stdout, stderr } = await (execFileAsync as any)(
    "typst",
    args,
    { maxBuffer: 1024 * 1024 * 50, encoding: "buffer" }
  );

  if (stderr?.length) console.warn("[pdf-service] Typst warnings:", stderr.toString());
  return stdout as Buffer;
}

function sendPdf(res: Response, pdf: Buffer): void {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="output.pdf"');
  res.status(200).send(pdf);
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default {
  id: "pdf-service",

  handler: async (router: Router, { services, getSchema }: ExtensionContext) => {
    const { ItemsService } = services;
    const typstDir = path.join(
      process.cwd(),
      "extensions/directus-extension-endpoint-pdf-service/typst"
    );

    router.post("/municipality/:slug/:version", async (req: AuthenticatedRequest, res: Response) => {
      const schema = await getSchema();
      let municipalityScore: MunicipalityScore;
      let sortedMeasures: Record<string, RatingMeasure[]>;

      try {
        [municipalityScore, sortedMeasures] = await fetchReportData(req, schema, ItemsService);
      } catch (err) {
        if (err instanceof HttpError) return res.status(err.status).send(err.message);
        console.error("[pdf-service] Error fetching municipality data:", err);
        return res.status(500).send("Server error: failed to fetch municipality data");
      }

      const { paths, cleanup } = writeTempFiles(typstDir, {
        municipalityScore,
        measures: sortedMeasures,
      });

      try {
        const pdf = await compilePdf(
          path.join(typstDir, "municipality_summary.typ"),
          typstDir,
          {
            municipalityScore: path.basename(paths.municipalityScore),
            measures: path.basename(paths.measures),
          },
          paths
        );
        sendPdf(res, pdf);
      } catch (err) {
        console.error("[pdf-service] Typst compilation error:", err);
        res.status(500).send("PDF generation failed");
      } finally {
        cleanup();
      }
    });

    router.post("/elections/:slug/:version", async (req: AuthenticatedRequest, res: Response) => {
      const schema = await getSchema();
      const measureText = (req.body.measure_text ?? []) as Array<{ description_benefit?: string }>;
      console.log("[pdf-service] Elections PDF requested for:", req.params.slug);

      let municipalityScore: MunicipalityScore;
      let sortedMeasures: Record<string, RatingMeasure[]>;

      try {
        [municipalityScore, sortedMeasures] = await fetchReportData(req, schema, ItemsService);
      } catch (err) {
        if (err instanceof HttpError) return res.status(err.status).send(err.message);
        console.error("[pdf-service] Error fetching municipality data:", err);
        return res.status(500).send("Server error: failed to fetch municipality data");
      }

      convertDescriptionsToPlainText(measureText);

      const { paths, cleanup } = writeTempFiles(typstDir, {
        electionGuideText: { measure_text: measureText },
        municipalityScore,
        measures: sortedMeasures,
      });

      try {
        const pdf = await compilePdf(
          path.join(typstDir, "local_election_checklist_guide.typ"),
          typstDir,
          {
            municipality: req.params.slug,
            electionGuideText: path.basename(paths.electionGuideText),
            municipalityScore: path.basename(paths.municipalityScore),
            measures: path.basename(paths.measures),
          },
          paths
        );
        sendPdf(res, pdf);
      } catch (err) {
        console.error("[pdf-service] Typst compilation error:", err);
        res.status(500).send("PDF generation failed");
      } finally {
        cleanup();
      }
    });
  },
};
