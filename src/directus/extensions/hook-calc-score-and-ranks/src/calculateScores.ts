import type { Logger, Schema, Services } from '@directus/types';

interface CalculateScoresParams {
  municipalityIds?: number[] | null;
  catalogVersionId: number | string;
}

interface Context {
  services: Services;
  getSchema: () => Promise<Schema>;
  logger: Logger;
}

interface Measure {
  id: number;
  sector: string;
  weight?: number | string | null;
  status?: string;
}

interface RatingMeasure {
  applicable: boolean | null | undefined;
  rating: number | string | null | undefined;
  measure_id: number | { id: number };
}

interface Municipality {
  id: number;
  localteam_id: number;
  name: string;
}

interface MunicipalityScore {
  id: number;
  municipality: number;
  catalog_version: number;
  score_total?: number;
  score_points?: number;
  score_max?: number;
  percentage_rated?: number;
  score_agriculture?: number;
  score_buildings?: number;
  score_management?: number;
  score_energy?: number;
  score_industry?: number;
  score_transport?: number;
}

interface SectorScores {
  numerator_rated: number;
  denominator_rated: number;
}

interface Totals {
  numerator_rated_sum: number;
  denominator_rated: number;
}

function parseFiniteNumber(value: number | string | null | undefined): number {
  const number = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(number) ? number : 0;
}

function parseOptionalNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return NaN;
  const number = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(number) ? number : NaN;
}

export async function calculateScores(
  { municipalityIds = null, catalogVersionId }: CalculateScoresParams,
  { services, getSchema, logger }: Context
): Promise<void> {
  logger.info(
    `Recalculating scores for ${municipalityIds?.length ? municipalityIds.length : 'all'} municipalities and catalogVersion: ${catalogVersionId}`
  );

  const schema = await getSchema();

  const ratingsService = new services.ItemsService('ratings_measures', {
    schema,
    accountability: { admin: true },
  });

  const measuresService = new services.ItemsService('measures', {
    schema,
    accountability: { admin: true },
  });

  const municipalitiesService = new services.ItemsService('municipalities', {
    schema,
    accountability: { admin: true },
  });

  const municipalityScoresService = new services.ItemsService('municipality_scores', {
    schema,
    accountability: { admin: true },
  });

  try {
    // Load published measures for this catalog version
    const measures = (await measuresService.readByQuery({
      limit: -1,
      filter: {
        catalog_version: { _eq: catalogVersionId },
        status: { _eq: 'published' },
      },
      fields: ['id', 'sector', 'weight'],
    })) as Measure[];

    if (!measures?.length) {
      logger.info(`[calculateScores] No published measures for catalog ${catalogVersionId}.`);
      return;
    }

    // Map measures for O(1) lookup
    const measureById = new Map<number, Measure>(measures.map((m) => [m.id, m]));
    const totalCatalogWeight = measures.reduce((sum, measure) => {
      const weight = parseFiniteNumber(measure.weight);
      return weight > 0 ? sum + weight : sum;
    }, 0);

    // Load municipalities (optionally filtered)
    const municipalities = (await municipalitiesService.readByQuery({
      limit: -1,
      ...(municipalityIds?.length ? { filter: { id: { _in: municipalityIds } } } : {}),
      fields: ['id', 'localteam_id', 'name'],
    })) as Municipality[];

    if (!municipalities?.length) {
      logger.info(`[calculateScores] No municipalities to process.`);
      return;
    }

    logger.info(
      `[calculateScores] Processing ${municipalities.length} municipalities for catalog ${catalogVersionId}.`
    );

    for (const municipality of municipalities) {
      const localteamId = municipality.localteam_id;
      if (!localteamId) {
        logger.warn(`[calculateScores] Municipality "${municipality.name}" has no localteam_id, skipping.`);
        continue;
      }

      // Fetch all approved, published ratings for this municipality + catalog version.
      // We do NOT filter by applicability or rating so score math can skip not-applicable measures
      // while percentage_rated counts both rated and explicitly not-applicable measures as complete.
      const allRatings = (await ratingsService.readByQuery({
        limit: -1,
        filter: {
          localteam_id: { _eq: localteamId },
          approved: { _eq: true },
          measure_published: { _eq: true },
          measure_id: {
            catalog_version: { _eq: catalogVersionId },
            status: { _eq: 'published' },
          },
        },
        fields: ['applicable', 'rating', 'measure_id'],
      })) as RatingMeasure[];

      // Score accumulators
      const totals: Totals = {
        numerator_rated_sum: 0, // sum(rating * weight) for rated entries
        denominator_rated: 0,   // sum(weight) for rated applicable entries
      };

      // Per-sector accumulators
      const sectors: Record<string, SectorScores> = {};
      for (const m of measures) {
        if (!sectors[m.sector]) {
          sectors[m.sector] = { numerator_rated: 0, denominator_rated: 0 };
        }
      }

      const completedMeasureIds = new Set<number>();

      for (const r of allRatings) {
        const measureId = typeof r.measure_id === 'object' ? r.measure_id.id : r.measure_id;
        const measure = measureById.get(measureId);
        if (!measure) {
          // Rating references a measure not in the current published set — skip
          continue;
        }

        const weight = parseFiniteNumber(measure.weight);
        const numeric = parseOptionalNumber(r.rating);

        if (!Number.isNaN(numeric) || r.applicable === false) {
          completedMeasureIds.add(measureId);
        }

        if (r.applicable !== true || Number.isNaN(numeric)) {
          continue;
        }

        if (weight <= 0) {
          // Zero-weight measures contribute nothing to score percentages.
          continue;
        }

        const sector = measure.sector ?? 'total';

        totals.numerator_rated_sum += numeric * weight;
        totals.denominator_rated += weight;

        if (!sectors[sector]) {
          sectors[sector] = { numerator_rated: 0, denominator_rated: 0 };
        }
        sectors[sector].numerator_rated += numeric * weight;
        sectors[sector].denominator_rated += weight;
      }

      // Build the scores payload
      const scoresToPush: Record<string, number> = {};

      // percentage_rated: unweighted share of published measures that are rated or not applicable.
      scoresToPush.percentage_rated =
        measures.length > 0 ? (completedMeasureIds.size / measures.length) * 100 : 0;

      scoresToPush.score_points =
        totalCatalogWeight > 0 ? (totals.numerator_rated_sum / totalCatalogWeight) * 100 : 0;
      scoresToPush.score_max =
        totalCatalogWeight > 0 ? (totals.denominator_rated / totalCatalogWeight) * 100 : 0;

      // score_total: weighted-average rating expressed as a percentage (0–100)
      scoresToPush.score_total =
        totals.denominator_rated > 0
          ? (totals.numerator_rated_sum / totals.denominator_rated) * 100
          : 0;

      // Per-sector scores
      for (const [sector, entry] of Object.entries(sectors)) {
        scoresToPush[`score_${sector}`] =
          entry.denominator_rated > 0
            ? (entry.numerator_rated / entry.denominator_rated) * 100
            : 0;
      }

      // Persist: find the existing municipality_scores record and update it
      const [scoreRecord] = (await municipalityScoresService.readByQuery({
        limit: 1,
        filter: {
          municipality: { _eq: municipality.id },
          catalog_version: { _eq: catalogVersionId },
        },
        fields: ['id'],
      })) as MunicipalityScore[];

      if (scoreRecord?.id) {
        await municipalityScoresService.updateOne(scoreRecord.id, scoresToPush);
      } else {
        logger.warn(
          `[calculateScores] No municipality_scores record found for "${municipality.name}" (catalogVersion=${catalogVersionId}). Scores not saved.`
        );
      }
    }

    logger.info(`[calculateScores] Completed calculations for catalog ${catalogVersionId}.`);
  } catch (e: unknown) {
    logger.error(e);
    throw e;
  }
}
