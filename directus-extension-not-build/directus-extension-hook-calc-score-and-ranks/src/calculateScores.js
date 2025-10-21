// extensions/hooks/auto-calc-scores/calculateScores.js

export const calculateScores = async ({ keys = null, measureIds = null } = {}, { services, getSchema, logger }) => {
  const adminAccountability = { admin: true };
  const schema = await getSchema();

  const ratingsService            = new services.ItemsService('ratings_measures',       { schema, accountability: adminAccountability });
  const measuresService           = new services.ItemsService('measures',               { schema, accountability: adminAccountability });
  const municipalitiesService     = new services.ItemsService('municipalities',         { schema, accountability: adminAccountability });
  const municipalityScoresService = new services.ItemsService('municipality_scores',    { schema, accountability: adminAccountability });

  logger.info(`[CalcScores] Starting calculation with keys=${JSON.stringify(keys)} measureIds=${JSON.stringify(measureIds)}`);

  // 1️⃣ Load all published measures with current catalog version
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
  if (!measures.length) {
    logger.warn("[CalcScores] No published measures found, exiting.");
    return;
  }

  logger.info(`[CalcScores] Loaded ${measures.length} measures`);

  // 2️⃣ Load relevant ratings
  let ratings = [];
  if (keys && keys.length) {
    const resp = await ratingsService.readMany(keys);
    ratings = resp?.data ?? [];
  } else {
    const resp = await ratingsService.readByQuery({ limit: -1 });
    ratings = resp?.data ?? [];
  }

  logger.info(`[CalcScores] Loaded ${ratings.length} ratings`);

  if (!ratings.length) {
    logger.info("[CalcScores] No ratings found, skipping.");
    return;
  }

  // 3️⃣ Determine affected municipalities
  const municipalityIds = [...new Set(ratings.map(r => r.localteam_id).filter(Boolean))];
  if (!municipalityIds.length) {
    logger.info("[CalcScores] No municipalities to process.");
    return;
  }

  const municipalitiesResp = await municipalitiesService.readByQuery({
    limit: -1,
    filter: { localteam_id: { _in: municipalityIds } }
  });

  const municipalities = municipalitiesResp?.data ?? [];
  if (!municipalities.length) {
    logger.info("[CalcScores] No matching municipality records found.");
    return;
  }

  logger.info(`[CalcScores] Processing ${municipalities.length} municipalities`);

  // 4️⃣ Prepare lookup maps
  const measureById = new Map(measures.map(m => [m.id, m]));
  const catalogVersionIds = [...new Set(
    measures.map(m => typeof m.catalog_version === "object" ? m.catalog_version.id : m.catalog_version)
  )];

  // 5️⃣ Accumulate score updates
  const updates = [];

  for (const mun of municipalities) {
    const mRatings = ratings.filter(r => r.localteam_id === mun.localteam_id);

    for (const cvId of catalogVersionIds) {
      const scoreDict = {
        total:         { num: 0, den: 0 },
        numberOfRated: { num: 0, den: 0 },
        agriculture:   { num: 0, den: 0 },
        buildings:     { num: 0, den: 0 },
        management:    { num: 0, den: 0 },
        energy:        { num: 0, den: 0 },
        industry:      { num: 0, den: 0 },
        transport:     { num: 0, den: 0 }
      };

      for (const r of mRatings) {
        const measure = measureById.get(r.measure_id);
        if (!measure) continue;

        const mCvId = typeof measure.catalog_version === "object" ? measure.catalog_version.id : measure.catalog_version;
        if (mCvId !== cvId) continue;

        const sector = measure.sector;
        const weight = measure.weight ?? 0;

        scoreDict.total.den += weight;
        scoreDict.numberOfRated.den += weight;
        if (scoreDict[sector]) scoreDict[sector].den += weight;

        if (r.approved && r.status === "published") {
          scoreDict.total.num += r.rating * weight;
          scoreDict.numberOfRated.num += weight;
          if (scoreDict[sector]) scoreDict[sector].num += r.rating * weight;
        }
      }

      const toUpdate = {
        municipality:      mun.id,
        catalog_version:   cvId,
        score_total:       scoreDict.total.den ? (scoreDict.total.num / scoreDict.total.den) * 100 : null,
        percentage_rated:  scoreDict.numberOfRated.den ? (scoreDict.numberOfRated.num / scoreDict.numberOfRated.den) * 100 : null,
        score_agriculture: scoreDict.agriculture.den ? (scoreDict.agriculture.num / scoreDict.agriculture.den) * 100 : null,
        score_buildings:   scoreDict.buildings.den ? (scoreDict.buildings.num / scoreDict.buildings.den) * 100 : null,
        score_management:  scoreDict.management.den ? (scoreDict.management.num / scoreDict.management.den) * 100 : null,
        score_energy:      scoreDict.energy.den ? (scoreDict.energy.num / scoreDict.energy.den) * 100 : null,
        score_industry:    scoreDict.industry.den ? (scoreDict.industry.num / scoreDict.industry.den) * 100 : null,
        score_transport:   scoreDict.transport.den ? (scoreDict.transport.num / scoreDict.transport.den) * 100 : null
      };

      // Only update existing municipality_scores
      const existing = await municipalityScoresService.readByQuery({
        limit: 1,
        filter: {
          municipality: { _eq: mun.id },
          catalog_version: { _eq: cvId }
        }
      });

      const existingRec = existing?.data?.[0];
      if (existingRec) {
        updates.push({ id: existingRec.id, data: toUpdate });
      }
    }
  }

  logger.info(`[CalcScores] Prepared ${updates.length} municipality_scores updates`);

  // 6️⃣ Bulk update municipality_scores
  for (const chunk of chunkArray(updates, 50)) {
    await municipalityScoresService.updateMany(chunk.map(u => u.id), chunk.map(u => u.data));
  }

  logger.info(`[CalcScores] Updated ${updates.length} municipality_scores successfully`);
};

// Utility to chunk updates to avoid request limits
function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}
