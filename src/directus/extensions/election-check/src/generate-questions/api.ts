import type {
  Logger,
  Accountability,
  Services,
  GetSchema,
} from '@directus/extensions-sdk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HandlerContext {
  logger: Logger;
  accountability: Accountability;
  services: Services;
  getSchema: GetSchema;
  data: Record<string, unknown>;
}

interface Election {
  id: string | number;
  descriptor?: string;
  already_generated_questions?: boolean;
  already_sent_mails?: boolean;
  localteam?: { id: string | number } | string | number;
}

interface Measure {
  id: string | number;
  measure_id: string;
  name?: string;
  description?: string;
  sector?: string;
  weight?: string | number;
  feasibility_political?: string | number;
  feasibility_economical?: string | number;
  catalog_version?: { id: string; name?: string } | null;
}

interface Rating {
  id: string | number;
  measure_id: Measure | string | number;
  rating: string | number | null;
  applicable: boolean;
}

interface MeasureTemplate {
  measure_id: string;
  title?: string;
  thesis?: string;
  sector?: string;
}

interface MunicipalityScore {
  id: string | number;
  date_created: string;
  percentage_rated?: number;
  catalog_version?: { id: string; name?: string } | null;
}

interface ScoredRating {
  rating: Rating;
  measure: Measure;
  template: MeasureTemplate;
  potential: number;
  difficulty: number;
}

interface GenerateQuestionsResult {
  success: boolean;
  count: number;
  message?: string;
  election_id: string | number;
  measures?: (string | number)[];
  updated_data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toFloat(value: unknown): number {
  const n = parseFloat(String(value));
  return isNaN(n) ? 0 : n;
}

function extractMeasure(rating: Rating): Measure | null {
  if (typeof rating.measure_id === 'object' && rating.measure_id !== null) {
    return rating.measure_id as Measure;
  }
  return null;
}

/**
 * Selects the best catalog version ID for a given municipality.
 *
 * Priority order:
 *   1. A score with percentage_rated > 80 that matches the current frontend catalog version.
 *   2. The most recent score with percentage_rated > 80 that has any catalog version.
 *   3. The most recent score overall (regardless of percentage_rated).
 *   4. null — no municipality scores exist.
 */
async function resolveCatalogVersionId(
  municipalityId: string | number,
  services: Services,
  schema: Awaited<ReturnType<GetSchema>>,
  accountability: Accountability,
  logger: Logger,
): Promise<string | null> {
  const sysAcc = { ...accountability, admin: true };
  const catalogSvc = new services.ItemsService('measure_catalog', { schema, accountability: sysAcc });
  const scoreSvc = new services.ItemsService('municipality_scores', { schema, accountability: sysAcc });

  const [frontendCatalogs, allScores] = await Promise.all([
    catalogSvc.readByQuery({
      filter: { hidden: { _eq: false }, isCurrentFrontend: { _eq: true } },
      fields: ['id', 'name'],
      limit: 1,
    }) as Promise<Array<{ id: string; name?: string }>>,
    scoreSvc.readByQuery({
      filter: { municipality: { _eq: municipalityId } },
      sort: ['-date_created'],
      fields: ['id', 'date_created', 'percentage_rated', 'catalog_version.*'],
      limit: -1,
    }) as Promise<MunicipalityScore[]>,
  ]);

  const currentFrontendCatalogId = frontendCatalogs[0]?.id ?? null;
  logger.info(`[generate-questions] Current frontend catalog: ${currentFrontendCatalogId ?? 'none'}`);
  logger.info(`[generate-questions] Municipality scores found: ${allScores.length}`);

  const sufficientlyRated = allScores.filter((s) => (s.percentage_rated ?? 0) > 80);
  logger.info(`[generate-questions] Scores with percentage_rated > 80: ${sufficientlyRated.length}`);

  if (sufficientlyRated.length === 0) {
    const fallback = allScores[0]?.catalog_version?.id ?? null;
    logger.warn(`[generate-questions] No well-rated scores; falling back to most recent catalog: ${fallback}`);
    return fallback;
  }

  // Prefer the score that matches the current frontend catalog version.
  const frontendMatch = currentFrontendCatalogId
    ? sufficientlyRated.find((s) => s.catalog_version?.id === currentFrontendCatalogId)
    : null;

  if (frontendMatch) {
    logger.info(`[generate-questions] Matched frontend catalog version: ${frontendMatch.catalog_version?.id}`);
    return frontendMatch.catalog_version?.id ?? null;
  }

  // Fall back to the most recent well-rated score that has a catalog version.
  const withCatalog = sufficientlyRated.filter((s) => s.catalog_version?.id);
  const selected = withCatalog[0] ?? sufficientlyRated[0];
  const resolved = selected?.catalog_version?.id ?? null;
  logger.info(`[generate-questions] Using most recent well-rated catalog version: ${resolved}`);
  return resolved;
}

/**
 * Scores and ranks a rating by improvement potential and implementation difficulty.
 * Returns null if the rating is not eligible (no template with thesis, not applicable, no rating value).
 */
function scoreRating(
  rating: Rating,
  templateMap: Map<string, MeasureTemplate>,
): ScoredRating | null {
  if (!rating.applicable || rating.rating === null) return null;

  const measure = extractMeasure(rating);
  if (!measure?.measure_id) return null;

  const template = templateMap.get(measure.measure_id);
  if (!template?.thesis) return null;

  const weight = toFloat(measure.weight);
  const ratingValue = toFloat(rating.rating);
  const political = toFloat(measure.feasibility_political);
  const economical = toFloat(measure.feasibility_economical);

  const potential = (1 - ratingValue) * weight;
  const difficulty = (political + economical) / 2;

  return { rating, measure, template, potential, difficulty };
}

function compareByPriorityThenDifficulty(a: ScoredRating, b: ScoredRating): number {
  if (b.potential !== a.potential) return b.potential - a.potential;
  if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
  return a.measure.measure_id.localeCompare(b.measure.measure_id);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default {
  id: 'operation-generate-questions',
  handler: async (
    { election_id }: { election_id: string | number },
    { logger, accountability, services, getSchema }: HandlerContext,
  ): Promise<GenerateQuestionsResult> => {
    const schema = await getSchema();
    const sysAcc = { ...accountability, admin: true };
    const { ItemsService } = services;

    logger.info(`[generate-questions] Starting for election_id: ${election_id}`);

    // -----------------------------------------------------------------------
    // 1. Load election
    // -----------------------------------------------------------------------

    const electionSvc = new ItemsService('elections', { schema, accountability: sysAcc });
    const election = await electionSvc.readOne(election_id, {
      fields: ['*', 'localteam.*'],
    }) as Election | null;

    if (!election) {
      throw new Error(`Election with ID "${election_id}" not found.`);
    }

    const localteamId =
      typeof election.localteam === 'object' && election.localteam !== null
        ? (election.localteam as { id: string | number }).id
        : election.localteam;

    if (!localteamId) {
      throw new Error(`Election "${election_id}" has no associated local team.`);
    }

    logger.info(`[generate-questions] Election: "${election.descriptor ?? election_id}", localteam: ${localteamId}`);

    // -----------------------------------------------------------------------
    // 2. Resolve catalog version (via municipality → scores)
    // -----------------------------------------------------------------------

    const municipalitySvc = new ItemsService('municipalities', { schema, accountability: sysAcc });
    const municipalities = await municipalitySvc.readByQuery({
      filter: { localteam_id: { _eq: localteamId } },
      limit: 1,
      fields: ['id'],
    }) as Array<{ id: string | number }>;

    const municipalityId = municipalities[0]?.id ?? null;
    logger.info(`[generate-questions] Municipality: ${municipalityId ?? 'none'}`);

    const catalogVersionId = municipalityId
      ? await resolveCatalogVersionId(municipalityId, services, schema, sysAcc, logger)
      : null;

    if (!catalogVersionId) {
      logger.warn('[generate-questions] No catalog version resolved; fetching without catalog filter.');
    }

    // -----------------------------------------------------------------------
    // 3. Fetch ratings and templates
    // -----------------------------------------------------------------------

    const ratingsSvc = new ItemsService('ratings_measures', { schema, accountability: sysAcc });
    const templateSvc = new ItemsService('measure_questions_template', { schema, accountability: sysAcc });

    const ratings = await ratingsSvc.readByQuery({
      filter: {
        localteam_id: { _eq: localteamId },
        applicable: { _eq: true },
        ...(catalogVersionId
          ? { measure_id: { catalog_version: { _eq: catalogVersionId } } }
          : {}),
      },
      fields: ['*', 'measure_id.*', 'measure_id.catalog_version.*'],
      limit: -1,
    }) as Rating[];

    logger.info(`[generate-questions] Ratings fetched: ${ratings.length}`);

    if (ratings.length === 0) {
      throw new Error(`No applicable ratings found for local team ${localteamId}.`);
    }

    const measureIdentifiers = [
      ...new Set(
        ratings
          .map((r) => extractMeasure(r)?.measure_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const templates = await templateSvc.readByQuery({
      filter: { measure_id: { _in: measureIdentifiers } },
      limit: -1,
    }) as MeasureTemplate[];

    const templateMap = new Map(templates.map((t) => [t.measure_id, t]));
    logger.info(`[generate-questions] Templates fetched: ${templates.length}`);

    // -----------------------------------------------------------------------
    // 4. Score, deduplicate, pick top 10
    // -----------------------------------------------------------------------

    const scored = ratings
      .map((r) => scoreRating(r, templateMap))
      .filter((s): s is ScoredRating => s !== null)
      .sort(compareByPriorityThenDifficulty);

    // Keep only the highest-priority entry per measure identifier.
    const deduped = new Map<string, ScoredRating>();
    for (const item of scored) {
      if (!deduped.has(item.measure.measure_id)) {
        deduped.set(item.measure.measure_id, item);
      }
    }

    const top10 = [...deduped.values()]
      .sort(compareByPriorityThenDifficulty)
      .slice(0, 10);

    logger.info(`[generate-questions] Eligible after dedup: ${deduped.size}, taking top ${top10.length}`);
    logger.info(`[generate-questions] Top measure IDs: ${top10.map((s) => s.measure.measure_id).join(', ')}`);

    if (top10.length === 0) {
      logger.warn(`[generate-questions] No valid measures found for election ${election_id}`);
      return {
        success: false,
        count: 0,
        message: 'No valid measures found.',
        election_id,
      };
    }

    // -----------------------------------------------------------------------
    // 5. Replace existing questions
    // -----------------------------------------------------------------------

    const questionsSvc = new ItemsService('questions', { schema, accountability: sysAcc });

    const existing = await questionsSvc.readByQuery({
      filter: { election: { _eq: election_id } },
      fields: ['id'],
      limit: -1,
    }) as Array<{ id: string | number }>;

    if (existing.length > 0) {
      logger.info(`[generate-questions] Deleting ${existing.length} existing questions`);
      await questionsSvc.deleteMany(existing.map((q) => q.id));
    }

    const created = await questionsSvc.createMany(
      top10.map(({ measure, template }, i) => ({
        election: election_id,
        title: template.title ?? measure.name ?? measure.measure_id,
        thesis: template.thesis,
        sector: template.sector ?? measure.sector ?? null,
        status: 'published',
        sort: i + 1,
      })),
    ) as Array<string | number>;

    await electionSvc.updateOne(election_id, { already_generated_questions: true });

    const updatedElection = await electionSvc.readOne(election_id, {
      fields: ['already_generated_questions', 'already_sent_mails'],
    }) as Record<string, unknown>;

    logger.info(`[generate-questions] Created ${created.length} question(s) for election ${election_id}`);

    return {
      success: true,
      count: created.length,
      measures: top10.map((s) => s.measure.id),
      election_id,
      updated_data: updatedElection,
    };
  },
};
