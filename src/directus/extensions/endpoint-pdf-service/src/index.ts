import { extensionDiagnostic } from "../../shared/securityLogger.ts";
import { municipalityType } from "../../../../frontend/shared/municipalityClassification.ts";
import path from "path";
import { reportFilename, inlinePdfDisposition } from "./filename.ts";
import { execFile } from "child_process";
import { promisify } from "util";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { convert } from "html-to-text";
import type { Request, Response, Router } from "express";
import type { SchemaOverview, AbstractService } from "@directus/types";

type ItemsService = AbstractService;
type Schema = SchemaOverview;

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PDF_BUFFER = 50 * 1024 * 1024; // 50 MB
const PDF_COMPILE_TIMEOUT_MS = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MunicipalityScore {
  published: boolean;
  catalog_version: { hidden: boolean };
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
    status: string;
    id: number;
    name: string;
    slug: string;
    localteam_id: number;
    municipality_type: string;
    population?: number | string | null;
    state: string;
    overall_status_comment: string | null;
  };
}

interface Measure {
  id: number;
  sector: string;
}

interface RatingMeasure {
  date_updated?: string | null;
  date_created?: string | null;
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
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortMeasuresBySector(ratingMeasures: RatingMeasure[], measures: Measure[]): SortedMeasures {
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
    item.description_benefit ? { ...item, description_benefit: convert(item.description_benefit) } : item,
  );
}

/**
 * Creates a writable per-request Typst root with static assets plus JSON inputs.
 * The source Typst extension directory can stay read-only in production.
 */
function createTypstWorkspace(
  typstAssetsDir: string,
  files: Record<string, unknown>,
): { typstRoot: string; inputs: Record<string, string>; cleanup: () => void } {
  const baseDir = resolveTempBaseDir();
  mkdirSync(baseDir, { recursive: true });

  const requestDir = mkdtempSync(path.join(baseDir, "request-"));
  const typstRoot = path.join(requestDir, "typst-root");
  const inputsDir = path.join(typstRoot, "inputs");
  const inputs: Record<string, string> = {};

  try {
    cpSync(typstAssetsDir, typstRoot, { recursive: true });
    mkdirSync(inputsDir, { recursive: true });

    for (const [key, data] of Object.entries(files)) {
      const filepath = path.join(inputsDir, `${key}.json`);
      writeFileSync(filepath, JSON.stringify(data));
      inputs[key] = toTypstRootPath(filepath, typstRoot);
    }
  } catch (err) {
    rmSync(requestDir, { recursive: true, force: true });
    throw err;
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    try {
      rmSync(requestDir, { recursive: true, force: true });
    } catch {
      extensionDiagnostic("error", "app.endpoint-pdf-service.index.createTypstWorkspace.failed");
    }
  };

  return { typstRoot, inputs, cleanup };
}

function resolveTempBaseDir(): string {
  const tempPath = process.env.TEMP_PATH ? path.resolve(process.env.TEMP_PATH) : path.join(process.cwd(), ".tmp");
  return path.join(tempPath, "pdf-service");
}

function toTypstRootPath(filePath: string, typstRoot: string): string {
  const relativePath = path.relative(typstRoot, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`PDF temp path "${filePath}" must be inside Typst root "${typstRoot}"`);
  }

  return `/${relativePath.split(path.sep).join("/")}`;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchReportData(
  req: AuthenticatedRequest,
  schema: Schema,
  ItemsServiceClass: new (...args: any[]) => ItemsService,
): Promise<ReportData> {
  const { slug: municipalitySlug, version: catalogVersionName } = req.params;
  const accountability = req.accountability;

  const makeService = (collection: string) => new ItemsServiceClass(collection, { schema, accountability });

  // Scores and measures are independent — fetch in parallel.
  const [scores, measures] = await Promise.all([
    makeService("municipality_scores").readByQuery({
      fields: [
        "published",
        "catalog_version.hidden",
        "municipality.status",
        "date_updated",
        "score_total",
        "score_buildings",
        "score_energy",
        "score_transport",
        "score_industry",
        "score_management",
        "score_agriculture",
        "percentage_rated",
        "rank",
        "municipality.id",
        "municipality.name",
        "municipality.slug",
        "municipality.localteam_id",
        "municipality.municipality_type",
        "municipality.population",
        "municipality.state",
        "municipality.overall_status_comment",
      ],
      filter: {
        published: { _eq: true },
        percentage_rated: { _gte: 100 },
        catalog_version: { name: { _eq: catalogVersionName }, hidden: { _eq: false } },
        municipality: { slug: { _eq: municipalitySlug }, status: { _eq: "published" } },
      },
      limit: 1,
    }) as Promise<MunicipalityScore[]>,

    makeService("measures").readByQuery({
      filter: {
        catalog_version: { name: { _eq: catalogVersionName }, hidden: { _eq: false } },
        status: { _eq: "published" },
      },
      fields: [
        "id",
        "measure_id",
        "name",
        "sector",
        "weight",
        "impact",
        "feasibility_political",
        "feasibility_economical",
      ],
      limit: 501,
    }) as Promise<Measure[]>,
  ]);

  if (
    !scores?.[0] ||
    scores[0].published !== true ||
    Number(scores[0].percentage_rated) < 100 ||
    scores[0].municipality.status !== "published" ||
    scores[0].catalog_version.hidden !== false
  ) {
    throw new HttpError(404, `No scores found for municipality "${municipalitySlug}" or access denied`);
  }
  if (!measures?.length) {
    throw new HttpError(404, "Measures not found or access denied");
  }

  const municipalityScore = scores[0];
  municipalityScore.municipality.municipality_type = municipalityType(municipalityScore.municipality) ?? "";
  const { localteam_id } = municipalityScore.municipality;

  const ratingMeasures = (await makeService("ratings_measures").readByQuery({
    filter: {
      localteam_id: { _eq: localteam_id },
      approved: { _eq: true },
      status: { _eq: "published" },
      measure_id: { catalog_version: { name: { _eq: catalogVersionName } }, status: { _eq: "published" } },
    },
    fields: ["measure_id", "rating", "applicable", "date_updated", "date_created"],
    limit: 501,
  })) as RatingMeasure[];

  // An empty array is valid (municipality has no rated measures yet).
  if (ratingMeasures == null) {
    throw new HttpError(404, "Rating measures not found or access denied");
  }

  if (measures.length > 500 || ratingMeasures.length > 500) throw new HttpError(502, "Report data limit exceeded");
  return [municipalityScore, sortMeasuresBySector(ratingMeasures, measures)];
}

// ---------------------------------------------------------------------------
// PDF compilation
// ---------------------------------------------------------------------------

async function compilePdf(
  typstFilePath: string,
  typstRoot: string,
  typstDir: string,
  inputs: Record<string, string>,
): Promise<Buffer> {
  const args = [
    "compile",
    "--root",
    typstRoot,
    ...Object.entries(inputs).flatMap(([k, v]) => ["--input", `${k}=${v}`]),
    "--font-path",
    path.join(typstDir, "fonts"),
    typstFilePath,
    "-",
  ];

  const result = await execFileAsync("typst", args, {
    maxBuffer: MAX_PDF_BUFFER,
    encoding: "buffer",
    timeout: PDF_COMPILE_TIMEOUT_MS,
    killSignal: "SIGKILL",
  });
  if (result.stderr.length) extensionDiagnostic("warn", "app.endpoint-pdf-service.index.compilePdf.degraded");
  return result.stdout;
}

function reportDates(measures: SortedMeasures, fallback: string): string[] {
  const dates = Object.values(measures)
    .flat()
    .map((measure) => measure.date_updated || measure.date_created)
    .filter((value): value is string => Boolean(value));
  return dates.length ? dates : [fallback];
}

function sendPdf(res: Response, pdf: Buffer, filename = "output.pdf"): void {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", inlinePdfDisposition(filename));
  res.status(200).send(pdf);
}

function resolveTypstDir(): string {
  const candidates = [
    path.join(process.cwd(), "extensions/directus-extension-endpoint-pdf-service/typst"),
    path.join(process.cwd(), "extensions/endpoint-pdf-service/typst"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new HttpError(500, "Typst assets directory not found for PDF generation");
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
    typstDir: string,
  ) => Promise<{ pdf: Buffer; filename?: string }>,
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
      extensionDiagnostic("error", "app.endpoint-pdf-service.index.makeRouteHandler.failed");
      res.status(500).send("Server error: failed to fetch municipality data");
      return;
    }

    let typstDir: string;
    try {
      typstDir = resolveTypstDir();
    } catch {
      extensionDiagnostic("error", "app.endpoint-pdf-service.index.makeRouteHandler.failed");
      res.status(500).send("PDF generation failed");
      return;
    }

    try {
      const { pdf, filename } = await buildPdf(data, req, typstDir);
      sendPdf(res, pdf, filename);
    } catch {
      extensionDiagnostic("error", "app.endpoint-pdf-service.index.makeRouteHandler.failed");
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

    // ── Municipality summary ──────────────────────────────────────────────

    router.post(
      "/municipality/:slug/:version",
      makeRouteHandler(ItemsService, getSchema, async ([municipalityScore, sortedMeasures], _req, typstDir) => {
        const { typstRoot, inputs, cleanup } = createTypstWorkspace(typstDir, {
          municipalityScore,
          measures: sortedMeasures,
        });
        try {
          const pdf = await compilePdf(path.join(typstRoot, "municipality_summary.typ"), typstRoot, typstRoot, {
            municipalityScore: inputs.municipalityScore,
            measures: inputs.measures,
          });
          return {
            pdf,
            filename: reportFilename(
              municipalityScore.municipality.name,
              reportDates(sortedMeasures, municipalityScore.date_updated),
              "Bewertung",
            ),
          };
        } finally {
          cleanup();
        }
      }),
    );

    // ── Election guide ────────────────────────────────────────────────────

    router.post(
      "/elections/:slug/:version",
      makeRouteHandler(ItemsService, getSchema, async ([municipalityScore, sortedMeasures], req, typstDir) => {
        const rawMeasureText: MeasureText[] = req.body.measure_text ?? [];
        const measureText = withPlainTextDescriptions(rawMeasureText);

        const { typstRoot, inputs, cleanup } = createTypstWorkspace(typstDir, {
          electionGuideText: { measure_text: measureText },
          municipalityScore,
          measures: sortedMeasures,
        });
        try {
          const pdf = await compilePdf(
            path.join(typstRoot, "local_election_checklist_guide.typ"),
            typstRoot,
            typstRoot,
            {
              municipality: req.params.slug,
              electionGuideText: inputs.electionGuideText,
              municipalityScore: inputs.municipalityScore,
              measures: inputs.measures,
            },
          );
          return {
            pdf,
            filename: reportFilename(
              municipalityScore.municipality.name,
              reportDates(sortedMeasures, municipalityScore.date_updated),
              "Wahlcheck",
            ),
          };
        } finally {
          cleanup();
        }
      }),
    );
  },
};
