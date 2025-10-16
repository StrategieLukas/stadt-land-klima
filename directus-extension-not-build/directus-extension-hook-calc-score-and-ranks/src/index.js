export default {
  id: 'municipality-score-and-rank-handler',
  handlers: {
    // 1) Trigger when ratings_measures are created or updated
    'items.create.ratings_measures': async (meta, ctx) => {
      await calculateScoresHandler(meta, ctx);
    },
    'items.update.ratings_measures': async (meta, ctx) => {
      await calculateScoresHandler(meta, ctx);
    },

    // 2) Trigger when a municipality’s status changes → published
    'items.update.municipalities': async (meta, ctx) => {
      if (meta.payload?.status !== 'published') return;
      await calculateScoresHandler({}, ctx);
      await updateRanksHandler({}, ctx);
    },

    // 3) Trigger when deleting a measure — safe delete logic
    'items.delete.measures': async (meta, ctx) => {
      await safeMeasureDeleteHandler(meta, ctx);
    }
  }
};

async function calculateScoresHandler({ keys, measureIds }, { services, getSchema, accountability, logger }) {
  try {
    const { ItemsService } = services;
    const schema = await getSchema();
    accountability.admin = true;

    const ratingsMeasuresService = new ItemsService('ratings_measures', { schema, accountability });
    const measuresService = new ItemsService('measures', { schema, accountability });
    const municipalitiesService = new ItemsService('municipalities', { schema, accountability });

    const maxScore = 100;
    let query = { limit: -1 };
    const measures = await measuresService.readByQuery(query);

    const measureNotToConsiderForCalc = measureIds ?? [];
    let ratings_measures;

    if (measureNotToConsiderForCalc.length === 0 && keys) {
      ratings_measures = await ratingsMeasuresService.readMany(keys, query);
      const municipalitiesToRead = Object.values(ratings_measures).map((v) => v.localteam_id);
      if (municipalitiesToRead.length === 0) return;
      query = { filter: { localteam_id: { _in: municipalitiesToRead } } };
    }

    const municipalities = await municipalitiesService.readByQuery(query);
    for (const municipality of municipalities) {
      const scoreDict = {};
      const measuresToExclude = new Set(measureNotToConsiderForCalc);

      if (measuresToExclude.size === 0 && ratings_measures) {
        ratings_measures.forEach((rating) => {
          if (rating.localteam_id === municipality.localteam_id) {
            const measureForSector = measures.find((m) => m.id === rating.measure_id);
            if (measureForSector) scoreDict[measureForSector.sector] = { denominator: 0, numerator: 0 };
          }
        });
      } else {
        measures.forEach((m) => {
          if (measuresToExclude.has(m.id)) scoreDict[m.sector] = { denominator: 0, numerator: 0 };
        });
      }

      scoreDict.total = { denominator: 0, numerator: 0 };
      scoreDict.numberOfRated = { denominator: 0, numerator: 0 };

      const allRatingsMeasures = await ratingsMeasuresService.readByQuery({
        filter: {
          _and: [
            { localteam_id: { _eq: municipality.localteam_id } },
            { applicable: { _eq: true } }
          ]
        }
      });

      const ratingsMeasureDetail = allRatingsMeasures.map((item1) => {
        const item2 = measures.find((m) => m.id === item1.measure_id);
        return {
          ...item1,
          weight: item2?.weight ?? 0,
          sector: item2?.sector ?? 'total',
          measureStatus: item2?.status ?? 'draft'
        };
      });

      for (const { measure_id, applicable, weight, approved, status, rating, sector, measureStatus } of ratingsMeasureDetail) {
        if (applicable && measureStatus === 'published' && !measuresToExclude.has(measure_id)) {
          scoreDict.total.denominator += weight;
          scoreDict.numberOfRated.denominator += weight;
          if (scoreDict[sector]) scoreDict[sector].denominator += weight;
          if (approved && status === 'published') {
            scoreDict.total.numerator += Number(rating) * weight;
            scoreDict.numberOfRated.numerator += weight;
            if (scoreDict[sector]) scoreDict[sector].numerator += Number(rating) * weight;
          }
        }
      }

      const scoresToPush = {};
      for (const key in scoreDict) {
        const { numerator, denominator } = scoreDict[key];
        if (denominator > 0) {
          if (key === 'numberOfRated') {
            scoresToPush.percentage_rated = (numerator / denominator) * maxScore;
          } else {
            scoresToPush['score_' + key] = (numerator / denominator) * maxScore;
          }
        } else {
          scoresToPush[key === 'numberOfRated' ? 'percentage_rated' : 'score_' + key] = 0;
        }
      }

      await municipalitiesService.updateOne(municipality.id, scoresToPush);
    }
  } catch (e) {
    logger.error(e);
    throw e;
  }
}

async function updateRanksHandler(_, { database, logger }) {
  try {
    await database.raw(`
      BEGIN;
      SELECT FROM public.municipalities ORDER BY id FOR UPDATE;
      WITH RankedScores AS (
        SELECT id, DENSE_RANK() OVER (ORDER BY score_total DESC) AS place
        FROM public.municipalities
        WHERE status = 'published'
      )
      UPDATE public.municipalities AS m
      SET place = (
        CASE
          WHEN m.status = 'published' THEN (SELECT r.place FROM RankedScores r WHERE m.id = r.id)
          ELSE -1
        END
      );
      COMMIT;
    `);
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

async function safeMeasureDeleteHandler(meta, { services, getSchema, logger }) {
  const { ItemsService } = services;
  const schema = await getSchema();
  const accountability = { admin: true };
  const ratingsService = new ItemsService('ratings_measures', { schema, accountability });

  for (const measureId of meta.keys) {
    const publishedRatings = await ratingsService.readByQuery({
      filter: { measure_id: { _eq: measureId }, status: { _eq: 'published' } },
      limit: 1
    });

    if (publishedRatings?.length > 0) {
      throw new Error(`Cannot delete measure ${measureId}: published ratings exist.`);
    }

    await ratingsService.deleteByQuery({ filter: { measure_id: { _eq: measureId } } });
    logger.info(`Deleted draft ratings_measures for measure ${measureId}`);
  }

  return meta;
}
