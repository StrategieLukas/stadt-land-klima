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
  weight?: number;
  status?: string;
}

interface RatingMeasure {
  rating: number | null | undefined;
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
  denominator_all: number;
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

      // Fetch all approved, applicable, published ratings for this municipality + catalog version.
      // We do NOT filter by rating != null so we can count all candidate measures for percentage_rated.
      const allRatings = (await ratingsService.readByQuery({
        limit: -1,
        filter: {
          localteam_id: { _eq: localteamId },
          applicable: { _eq: true },
          approved: { _eq: true },
          measure_published: { _eq: true },
          measure_id: {
            catalog_version: { _eq: catalogVersionId },
            status: { _eq: 'published' },
          },
        },
        fields: ['rating', 'measure_id'],
      })) as RatingMeasure[];

      if (!allRatings?.length) {
        logger.info(`[calculateScores] No candidate ratings for municipality "${municipality.name}".`);
        continue;
      }

      // Score accumulators
      const totals: Totals = {
        numerator_rated_sum: 0, // sum(rating * weight) for rated entries
        denominator_rated: 0,   // sum(weight) for entries that have a numeric rating
        denominator_all: 0,     // sum(weight) for all candidate entries (for percentage_rated)
      };

      // Per-sector accumulators
      const sectors: Record<string, SectorScores> = {};
      for (const m of measures) {
        if (!sectors[m.sector]) {
          sectors[m.sector] = { numerator_rated: 0, denominator_rated: 0 };
        }
      }

      let totalRatedWeight = 0; // weight of measures that have a valid rating (numerator of percentage_rated)

      for (const r of allRatings) {
        const measureId = typeof r.measure_id === 'object' ? r.measure_id.id : r.measure_id;
        const measure = measureById.get(measureId);
        if (!measure) {
          // Rating references a measure not in the current published set — skip
          continue;
        }

        const weight = measure.weight ?? 0;
        if (weight <= 0) {
          // Zero-weight measures contribute nothing; exclude from both denominators
          continue;
        }

        const sector = measure.sector ?? 'total';

        // All candidate measures (with positive weight) count toward the total denominator
        totals.denominator_all += weight;

        // Ratings are stored as 0..1 numerics; guard against string coercion from DB
        const raw = r.rating;
        const numeric =
          raw !== null && raw !== undefined
            ? typeof raw === 'number'
              ? raw
              : parseFloat(raw as unknown as string)
            : NaN;

        if (!Number.isNaN(numeric)) {
          totals.numerator_rated_sum += numeric * weight;
          totals.denominator_rated += weight;
          totalRatedWeight += weight;

          if (!sectors[sector]) {
            sectors[sector] = { numerator_rated: 0, denominator_rated: 0 };
          }
          sectors[sector].numerator_rated += numeric * weight;
          sectors[sector].denominator_rated += weight;
        }
      }

      // Build the scores payload
      const scoresToPush: Record<string, number> = {};

      // percentage_rated: share of (by weight) measures that have been rated
      scoresToPush.percentage_rated =
        totals.denominator_all > 0 ? (totalRatedWeight / totals.denominator_all) * 100 : 0;

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
