console.log("Extension read");

export default ({ action, filter }, { services, database, getSchema, logger }) => {
  logger.info("Entering hook");

  const adminAccountability = { admin: true };

  // Helper: update ranking of municipalities
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
    await database.raw(sql);
  };

  // Business logic: calculate and update municipality_scores
  const calculateScores = async ({ keys = null, measureIds = null } = {}) => {
    const schema = await getSchema();
    const ratingsService       = new services.ItemsService('ratings_measures',      { schema, accountability: adminAccountability });
    const measuresService      = new services.ItemsService('measures',               { schema, accountability: adminAccountability });
    const municipalitiesService= new services.ItemsService('municipalities',         { schema, accountability: adminAccountability });
    const municipalityScoresService = new services.ItemsService('municipality_scores', { schema, accountability: adminAccountability });

    // 1) Load published measures with current catalog_version
    const measuresResp = await measuresService.readByQuery({
      limit: -1,
      filter: {
        status: { _eq: "published" },
        catalog_version: {
          isCurrentBackend: { _eq: true }
        }
      }
    });
    const measures = measuresResp?.data ?? [];
    logger.info(`[CalcScores] Loaded ${measures.length} measures`);

    // 2) Load ratings
    let ratings = [];
    logger.info({ keys });
    if (keys && keys.length) {
      const resp = await ratingsService.readMany(keys);
      ratings = resp?.data ?? [];
    } else {
      const resp = await ratingsService.readByQuery({ limit: -1 });
      ratings = resp?.data ?? [];
    }
    logger.info(`[CalcScores] Loaded ${ratings.length} ratings`);

    // 3) Determine municipality ids
    const municipalityIds = [...new Set(ratings.map(r => r.localteam_id).filter(Boolean))];
    if (!municipalityIds.length) {
      logger.info(`[CalcScores] No municipalities to process, exit.`);
      return;
    }

    // 4) Load municipalities
    const municipalities = (await municipalitiesService.readByQuery({
      filter: { localteam_id: { _in: municipalityIds } },
      limit: -1
    }))?.data ?? [];
    logger.info(`[CalcScores] Processing ${municipalities.length} municipalities`);

    // 5) Map measures by id for lookup
    const measureById = new Map(measures.map(m => [m.id, m]));

    // 6) For each municipality & catalog_version, compute and update
    // Identify distinct catalog_version ids present in measures
    const catalogVersionIds = [...new Set(measures.map(m => {
      const cv = (typeof m.catalog_version === 'object' ? m.catalog_version.id : m.catalog_version);
      return cv;
    }).filter(Boolean))];

    for (const mun of municipalities) {
      const mRatings = ratings.filter(r => r.localteam_id === mun.localteam_id);

      for (const cvId of catalogVersionIds) {
        // Initialize score buckets
        const scoreDict = {
          total:         { numerator:0, denominator:0 },
          numberOfRated: { numerator:0, denominator:0 },
          agriculture:   { numerator:0, denominator:0 },
          buildings:     { numerator:0, denominator:0 },
          management:    { numerator:0, denominator:0 },
          energy:        { numerator:0, denominator:0 },
          industry:      { numerator:0, denominator:0 },
          transport:     { numerator:0, denominator:0 }
        };

        for (const r of mRatings) {
          const measure = measureById.get(r.measure_id);
          if (!measure) continue;

          const mCvId = (typeof measure.catalog_version === 'object' ? measure.catalog_version.id : measure.catalog_version);
          if (mCvId !== cvId) continue;

          const sector = measure.sector;
          const weight = measure.weight ?? 0;

          scoreDict.total.denominator       += weight;
          scoreDict.numberOfRated.denominator += weight;
          if (scoreDict[sector]) {
            scoreDict[sector].denominator  += weight;
          } else {
            // in case of unforeseen sector
            scoreDict[sector] = { numerator: 0, denominator: weight };
          }

          if (r.approved && r.status === 'published') {
            scoreDict.total.numerator       += r.rating * weight;
            scoreDict.numberOfRated.numerator += weight;
            if (scoreDict[sector]) {
              scoreDict[sector].numerator  += r.rating * weight;
            }
          }
        }

        // Build update payload
        const toUpdate = {
          municipality:      mun.id,
          catalog_version:   cvId,
          score_total:       scoreDict.total.denominator       >0 ? (scoreDict.total.numerator       / scoreDict.total.denominator)       *100 : null,
          percentage_rated:  scoreDict.numberOfRated.denominator >0 ? (scoreDict.numberOfRated.numerator / scoreDict.numberOfRated.denominator) *100 : null,
          score_agriculture: scoreDict.agriculture.denominator   >0 ? (scoreDict.agriculture.numerator   / scoreDict.agriculture.denominator)   *100 : null,
          score_buildings:   scoreDict.buildings.denominator     >0 ? (scoreDict.buildings.numerator     / scoreDict.buildings.denominator)     *100 : null,
          score_management:  scoreDict.management.denominator    >0 ? (scoreDict.management.numerator    / scoreDict.management.denominator)    *100 : null,
          score_energy:      scoreDict.energy.denominator        >0 ? (scoreDict.energy.numerator        / scoreDict.energy.denominator)        *100 : null,
          score_industry:    scoreDict.industry.denominator      >0 ? (scoreDict.industry.numerator      / scoreDict.industry.denominator)      *100 : null,
          score_transport:   scoreDict.transport.denominator     >0 ? (scoreDict.transport.numerator     / scoreDict.transport.denominator)     *100 : null
        };

        // Only update existing municipality_scores record
        const existing = await municipalityScoresService.readByQuery({
          limit: 1,
          filter: {
            municipality:      { _eq: mun.id },
            catalog_version:   { _eq: cvId }
          }
        });
        const existingItems = existing?.data ?? [];
        if (existingItems.length) {
          const rec = existingItems[0];
          await municipalityScoresService.updateOne(rec.id, toUpdate);
          logger.info(`[CalcScores] Updated municipality_scores id=${rec.id} mun=${mun.id} cv=${cvId} → ${JSON.stringify(toUpdate)}`);
        } else {
          logger.warn(`[CalcScores] No municipality_scores found for mun=${mun.id}, cv=${cvId}. Skipping update.`);
        }
      }
    }
  };

  // Business logic: seed initial ratings when a measure is created or published
  const seedRatingsForMeasure = async (measureId, catalogVersionId) => {
    const schema = await getSchema();
    const municipalitiesService     = new services.ItemsService('municipalities',        { schema, accountability: adminAccountability });
    const ratingsService           = new services.ItemsService('ratings_measures',      { schema, accountability: adminAccountability });
    const measuresService          = new services.ItemsService('measures',               { schema, accountability: adminAccountability });

    const municipalitiesResp = await municipalitiesService.readByQuery({ limit:-1 });
    const municipalities = municipalitiesResp?.data ?? [];

    for (const mun of municipalities) {
      const toCreate = {
        measure_id:     measureId,
        catalog_version: catalogVersionId,
        localteam_id:   mun.localteam_id,
        status:         'draft',
        approved:       false,
        rating:         null
      };
      await ratingsService.createOne(toCreate);
      logger.info(`[SeedRatings] Created rating stub for measure=${measureId}, mun=${mun.localteam_id}, cv=${catalogVersionId}`);
    }
  };

  // Hook registration
  logger.info("Registering actions/hooks");

  // 1) municipality.create → seed municipality_scores for all catalog_versions, then link to municipality
  action('items.create', async (meta, context) => {
    if (meta.collection !== 'municipalities') return;

    logger.info('[Hook] municipalities.create triggered — creating initial scores');

    const schema = await getSchema();
    const measureCatalogService = new services.ItemsService('measure_catalog', { schema, accountability: adminAccountability });
    const municipalityScoresService = new services.ItemsService('municipality_scores', { schema, accountability: adminAccountability });

    const municipalityId = Array.isArray(meta.key) ? meta.key[0] : meta.key;
    const munService = new services.ItemsService('municipalities', { schema, accountability: adminAccountability });
    const mun = await munService.readOne(municipalityId);
    if (!mun) {
      logger.warn(`[Hook] municipalities.create: municipality id=${municipalityId} not found`);
      return;
    }

    const measureCatalogs = await measureCatalogService.readByQuery({ limit: -1 });

    const createdIds = [];
    for (const measureCatalog of measureCatalogs) {
      const toCreate = {
        municipality:     mun.id,
        catalog_version:  measureCatalog.id,
        score_total:       0,
        percentage_rated:  0,
        score_agriculture: 0,
        score_buildings:   0,
        score_management:  0,
        score_energy:      0,
        score_industry:    0,
        score_transport:   0
      };
      logger.info(toCreate);
      const createdId = await municipalityScoresService.createOne(toCreate);
      createdIds.push(createdId);
      logger.info(`[Hook] Created empty municipality_scores for mun=${mun.name}, measureCatalog=${measureCatalog.name}`);
    }

    // Now update the municipality's “scores” relational field (1:n) to include these new IDs
    // assuming collection “municipalities” has a relational field “scores” referencing municipality_scores
    await munService.updateOne(mun.id, {
      scores: createdIds
    });
    logger.info(`[Hook] Linked municipality.id=${mun.id} to scores ids=${createdIds}`);
  });

  // 2) measure.create when status = published → seed ratings for that measure
  action('items.create', async (meta, context) => {
    if (meta.collection !== 'measures') return;

    const schema = await getSchema();
    const measureService = new services.ItemsService('measures', { schema, accountability: adminAccountability });
    const measureId = Array.isArray(meta.keys) ? meta.keys[0] : meta.keys;
    const measure = await measureService.readOne(measureId);
    if (!measure) return;

    if (measure.status === 'published') {
      const catalogVersionId = (typeof measure.catalog_version === 'object' ? measure.catalog_version.id : measure.catalog_version);
      logger.info(`[Hook] measures.create published → seeding ratings for measure=${measureId}, cv=${catalogVersionId}`);
      await seedRatingsForMeasure(measureId, catalogVersionId);
    }
  });

  // 3) measure.update when status changes to published → seed ratings
  action('items.update', async (meta, context) => {
    if (meta.collection !== 'measures') return;

    const schema = await getSchema();
    const measureService = new services.ItemsService('measures', { schema, accountability: adminAccountability });
    const measureId = Array.isArray(meta.keys) ? meta.keys[0] : meta.keys;
    const measure = await measureService.readOne(measureId);
    if (!measure) return;

    // If the payload contains status and it is now published
    if (meta.payload && meta.payload.status === 'published') {
      const catalogVersionId = (typeof measure.catalog_version === 'object' ? measure.catalog_version.id : measure.catalog_version);
      logger.info(`[Hook] measures.update → status published for measure=${measureId}, cv=${catalogVersionId}`);
      await seedRatingsForMeasure(measureId, catalogVersionId);
    }
  });

  // 4) ratings_measures.create or update → recalc scores and update ranks (unchanged)
  action('items.create', async (meta, context) => {
    if (meta.collection !== 'ratings_measures') return;
    logger.info('[Hook] ratings_measures.create triggered');
    await calculateScores({ keys: meta.keys });
    await updateRanks();
  });

  action('items.update', async (meta, context) => {
    if (meta.collection !== 'ratings_measures') return;
    logger.info('[Hook] ratings_measures.update triggered');
    await calculateScores({ keys: meta.keys });
    await updateRanks();
  });

  // 5) delete measure — unchanged filter logic
  filter('items.delete', async (meta, context) => {
    if (meta.collection !== 'measures') return meta;

    const schema = await getSchema();
    const ratingsService = new services.ItemsService('ratings_measures', { schema, accountability: adminAccountability });
    for (const measureId of meta.keys) {
      const found = await ratingsService.readByQuery({
        filter: { measure_id: { _eq: measureId }, status: { _eq: 'published' } },
        limit: 1
      });
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
