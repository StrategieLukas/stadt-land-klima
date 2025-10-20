console.log("Extension read");
export default ({ action, filter }, { services, database, getSchema, logger }) => {
  console.log("Entering hook consolelog");
  logger.info("Entering hook loggerinfo")
  const adminAccountability = { admin: true };

  const updateRanks = async () => {
    const sql = `
      BEGIN;
      SELECT FROM public.municipalities ORDER BY id FOR UPDATE;
      WITH RankedScores AS (
        SELECT id, DENSE_RANK() OVER (ORDER BY score_total DESC) AS place
        FROM public.municipalities
        WHERE status='published'
      )
      UPDATE public.municipalities AS m
      SET place = CASE WHEN m.status='published'
        THEN (SELECT r.place FROM RankedScores r WHERE r.id=m.id)
        ELSE -1
      END;
      COMMIT;
    `;
    logger.info(sql);
    const x = await database.raw(sql);
    logger.warn(x);
  };

  const calculateScores = async ({ keys = null, measureIds = null } = {}) => {
    const schema = await getSchema();
    const ratingsService = new services.ItemsService('ratings_measures', { schema, accountability: adminAccountability });
    const measuresService = new services.ItemsService('measures', { schema, accountability: adminAccountability });
    const municipalitiesService = new services.ItemsService('municipalities', { schema, accountability: adminAccountability });

    const measuresResp = await measuresService.readByQuery({
      limit: -1,
      filter: {
        status: { _eq: "published" },
        catalog_version: {
          isCurrentBackend: { _eq: true }
        }
      },
    });
    const measures = measuresResp?.data ?? measuresResp ?? [];
    logger.info(`[CalcScores] Loaded ${measures.length} measures`);

    // fetch ratings
    let ratings = [];
    if (keys && keys.length) {
      ratings = (await ratingsService.readMany(keys, { limit: -1 })).data ?? [];
    } else {
      ratings = (await ratingsService.readByQuery({ limit: -1 })).data ?? [];
    }

    const municipalitiesIds = [...new Set(ratings.map(r => r.localteam_id).filter(Boolean))];
    if (!municipalitiesIds.length) return;
    const municipalities = (await municipalitiesService.readByQuery({
      filter: { localteam_id: { _in: municipalitiesIds } },
      limit: -1,
    })).data ?? [];

    logger.info(`[CalcScores] Processing ${municipalities.length} municipalities`);

    for (const m of municipalities) {
      const scoreDict = { total: { numerator: 0, denominator: 0 }, numberOfRated: { numerator: 0, denominator: 0 } };
      measures.forEach(measure => { scoreDict[measure.sector] = { numerator: 0, denominator: 0 }; });

      const mRatings = ratings.filter(r => r.localteam_id === m.localteam_id);
      mRatings.forEach(r => {
        const measure = measures.find(mm => mm.id === r.measure_id);
        if (!measure) return;
        const sector = measure.sector;
        const weight = measure.weight ?? 0;
        scoreDict.total.denominator += weight;
        scoreDict.numberOfRated.denominator += weight;
        scoreDict[sector].denominator += weight;
        if (r.approved && r.status === 'published') {
          scoreDict.total.numerator += r.rating * weight;
          scoreDict.numberOfRated.numerator += weight;
          scoreDict[sector].numerator += r.rating * weight;
        }
      });

      const toPush = {};
      for (const key in scoreDict) {
        const { numerator, denominator } = scoreDict[key];
        toPush[key === 'numberOfRated' ? 'percentage_rated' : 'score_' + key] = denominator > 0 ? (numerator / denominator) * 100 : 0;
      }

      await municipalitiesService.updateOne(m.id, toPush);
      logger.info(`[CalcScores] Municipality ${m.id} updated: ${JSON.stringify(toPush)}`);
    }
  };

  logger.info("Registering actions/hooks");
  // --- Register actions ---
  action('items.create', async (meta, context) => {
    if(meta.collection !== "ratings_measures") return;
    logger.info('[Hook] ratings_measures.create triggered');
    await calculateScores({ keys: meta.keys });
    await updateRanks();
  });

  action('items.update', async (meta, context) => {
  if(meta.collection !== "ratings_measures") return;
    logger.info('[Hook] ratings_measures.update triggered');
    await calculateScores({ keys: meta.keys });
    await updateRanks();
  });

  action('items.update', async (meta, context) => {
    if(meta.collection !== "municipalities") return;

    if (!meta.payload || meta.payload.status !== 'published') return;
    logger.info('[Hook] municipalities.update triggered for published status');

    const schema = await getSchema();
    const ratingsService = new services.ItemsService('ratings_measures', { schema, accountability: adminAccountability });
    const munService = new services.ItemsService('municipalities', { schema, accountability: adminAccountability });

    const municipalityId = Array.isArray(meta.keys) ? meta.keys[0] : meta.keys;
    const mun = await munService.readOne(municipalityId);
    if (!mun) return;

    const ratingsResp = await ratingsService.readByQuery({ filter: { localteam_id: { _eq: mun.localteam_id } }, limit: -1 });
    const keys = (ratingsResp?.data ?? []).map(r => r.id);
    if (keys.length) await calculateScores({ keys });
    else await calculateScores({});

    await updateRanks();
  });

  // --- Block delete if published ratings exist ---
  filter('items.delete', async (meta, context) => {
      if(meta.collection !== "measures") return;
    const schema = await getSchema();
    const ratingsService = new services.ItemsService('ratings_measures', { schema, accountability: adminAccountability });
    for (const measureId of meta.keys) {
      const found = await ratingsService.readByQuery({ filter: { measure_id: { _eq: measureId }, status: { _eq: 'published' } }, limit: 1 });
      if ((found?.data ?? []).length) {
        const err = new Error(`Cannot delete measure ${measureId}: published ratings exist.`);
        err.code = 'FORBIDDEN';
        throw err;
      }
      await ratingsService.deleteByQuery({ filter: { measure_id: { _eq: measureId } } });
    }
    return meta;
  });
};
