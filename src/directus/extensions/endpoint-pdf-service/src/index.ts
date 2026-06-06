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
// Constants
// ---------------------------------------------------------------------------

const MAX_PDF_BUFFER = 50 * 1024 * 1024; // 50 MB

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

interface MeasureText {
  description_benefit?: string;
}

interface AuthenticatedRequest extends Request {
  accountability?: { admin: boolean; role: string | null };
  params: { slug: string; version: string };
  body: { measure_text?: MeasureText[] };
}

interface ExtensionContext {
  services: { ItemsService: new (...args: any[]) => ItemsService };
  getSchema: () => Promise<Schema>;
}

type SortedMeasures = Record<string, RatingMeasure[]>;
type ReportData = [MunicipalityScore, SortedMeasures];

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortMeasuresBySector(
  ratingMeasures: RatingMeasure[],
  measures: Measure[]
): SortedMeasures {
  if (!Array.isArray(ratingMeasures) || !Array.isArray(measures)) return {};

  const measureMap = new Map(measures.map((m) => [m.id, m]));
  const result: SortedMeasures = {};

  for (const item of ratingMeasures) {
    const measure = measureMap.get(item.measure_id);
    if (!measure) continue;
    item.measure = measure;
    (result[measure.sector] ??= []).push(item);
  }

  return result;
}

/** Returns a new array with HTML stripped from description_benefit (non-mutating). */
function withPlainTextDescriptions(data: MeasureText[]): MeasureText[] {
  return data.map((item) =>
    item.description_benefit
      ? { ...item, description_benefit: convert(item.description_benefit) }
      : item
  );
}

/**
 * Writes named temp files and returns their paths plus an idempotent cleanup
 * function. Safe to call cleanup() multiple times.
 */
function writeTempFiles(
  dir: string,
  files: Record<string, unknown>
): { paths: Record<string, string>; cleanup: () => void } {
  const id = randomUUID();
  const paths: Record<string, string> = {};

  for (const [key, data] of Object.entries(files)) {
    const filepath = path.join(dir, `${key}_${id}.json`);
    writeFileSync(filepath, JSON.stringify(data));
    paths[key] = filepath;
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
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
// Data fetching
// ---------------------------------------------------------------------------

async function fetchReportData(
  req: AuthenticatedRequest,
  schema: Schema,
  ItemsServiceClass: new (...args: any[]) => ItemsService
): Promise<ReportData> {
  const { slug: municipalitySlug, version: catalogVersionName } = req.params;
  const accountability = req.accountability;

  const makeService = (collection: string) =>
    new ItemsServiceClass(collection, { schema, accountability });

  // Scores and measures are independent — fetch in parallel.
  const [scores, measures] = await Promise.all([
    makeService("municipality_scores").readByQuery({
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
    }) as Promise<MunicipalityScore[]>,

    makeService("measures").readByQuery({
      filter: { catalog_version: { name: { _eq: catalogVersionName } } },
    }) as Promise<Measure[]>,
  ]);

  if (!scores?.[0]) {
    throw new HttpError(
      404,
      `No scores found for municipality "${municipalitySlug}" or access denied`
    );
  }
  if (!measures?.length) {
    throw new HttpError(404, "Measures not found or access denied");
  }

  const municipalityScore = scores[0];
  const { localteam_id } = municipalityScore.municipality;

  const ratingMeasures = (await makeService("ratings_measures").readByQuery({
    filter: { localteam_id: { _eq: localteam_id } },
  })) as RatingMeasure[];

  // An empty array is valid (municipality has no rated measures yet).
  if (ratingMeasures == null) {
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
  inputs: Record<string, string>
): Promise<Buffer> {
  const args = [
    "compile",
    ...Object.entries(inputs).flatMap(([k, v]) => ["--input", `${k}=${v}`]),
    "--font-path", path.join(typstDir, "fonts"),
    typstFilePath,
    "-",
  ];

  // execFile with encoding:"buffer" returns Buffer; the promisified overload
  // loses that detail so we cast the result, not the function.
  const result = await execFileAsync("typst", args, {
    maxBuffer: MAX_PDF_BUFFER,
    encoding: "buffer",
  });
  const { stdout, stderr } = result as unknown as { stdout: Buffer; stderr: Buffer };

  if (stderr?.length) {
    console.warn("[pdf-service] Typst warnings:", stderr.toString());
  }

  return stdout;
}

function sendPdf(res: Response, pdf: Buffer, filename = "output.pdf"): void {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.status(200).send(pdf);
}

// ---------------------------------------------------------------------------
// Shared route logic
// ---------------------------------------------------------------------------

type RouteHandler = (req: AuthenticatedRequest, res: Response) => Promise<void>;

function makeRouteHandler(
  ItemsService: new (...args: any[]) => ItemsService,
  getSchema: () => Promise<Schema>,
  buildPdf: (
    data: ReportData,
    req: AuthenticatedRequest,
    typstDir: string
  ) => Promise<{ pdf: Buffer; filename?: string }>
): RouteHandler {
  return async (req, res) => {
    const schema = await getSchema();
    let data: ReportData;

    try {
      data = await fetchReportData(req, schema, ItemsService);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).send(err.message);
        return;
      }
      console.error("[pdf-service] Error fetching municipality data:", err);
      res.status(500).send("Server error: failed to fetch municipality data");
      return;
    }

    const typstDir = path.join(
      process.cwd(),
      "extensions/directus-extension-endpoint-pdf-service/typst"
    );

    try {
      const { pdf, filename } = await buildPdf(data, req, typstDir);
      sendPdf(res, pdf, filename);
    } catch (err) {
      console.error("[pdf-service] Typst compilation error:", err);
      res.status(500).send("PDF generation failed");
    }
  };
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

    // ── Municipality summary ──────────────────────────────────────────────

    router.post(
      "/municipality/:slug/:version",
      makeRouteHandler(ItemsService, getSchema, async ([municipalityScore, sortedMeasures], _req, typstDir) => {
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
            }
          );
          return { pdf, filename: `${municipalityScore.municipality.slug}_summary.pdf` };
        } finally {
          cleanup();
        }
      })
    );

    // ── Election guide ────────────────────────────────────────────────────

    router.post(
      "/elections/:slug/:version",
      makeRouteHandler(ItemsService, getSchema, async ([municipalityScore, sortedMeasures], req, typstDir) => {
        console.log("[pdf-service] Elections PDF requested for:", req.params.slug);

        const rawMeasureText: MeasureText[] = req.body.measure_text ?? [];
        const measureText = withPlainTextDescriptions(rawMeasureText);

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
            }
          );
          return { pdf, filename: `${req.params.slug}_election_guide.pdf` };
        } finally {
          cleanup();
        }
      })
    );
  },
};
