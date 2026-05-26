export default {
  id: 'operation-generate-questions',
  handler: async ({ election_id }, { logger, accountability, services, getSchema, data }) => {
    const { ItemsService } = services;
    const schema = await getSchema();
    const sysAcc = { ...accountability, admin: true };

    logger.info(`DEBUG [generate-questions]: Starting thesis generation for election_id: ${election_id}`);

    const electionSvc  = new ItemsService('elections',                  { schema, accountability: sysAcc });
    const ratingsSvc   = new ItemsService('ratings_measures',           { schema, accountability: sysAcc });
    const templateSvc  = new ItemsService('measure_questions_template', { schema, accountability: sysAcc });
    const questionsSvc = new ItemsService('questions',                  { schema, accountability: sysAcc });

    const election = await electionSvc.readOne(election_id, { fields: ['*', 'localteam.*'] });
    if (!election) throw new Error(`Wahl mit ID "${election_id}" nicht gefunden.`);
    logger.info(`DEBUG [generate-questions]: Election loaded: ${election.descriptor || election.id}`);

    const localteamId = election.localteam?.id || election.localteam;
    if (!localteamId) throw new Error('Lokalteam der Wahl konnte nicht ermittelt werden.');
    logger.info(`DEBUG [generate-questions]: Localteam ID: ${localteamId}`);

    const municipalities = await new ItemsService('municipalities', { schema, accountability: sysAcc }).readByQuery({
      filter: { localteam_id: { _eq: localteamId } },
      limit: 1,
      fields: ['id']
    });

    const municipalityId = municipalities?.[0]?.id || null;
    logger.info(`DEBUG [generate-questions]: Municipality ID: ${municipalityId}`);
    let catalogVersionId = null;

    if (municipalityId) {
      // Get the current frontend catalog version (matching frontend logic)
      const catalogVersions = await new ItemsService('measure_catalog', { schema, accountability: sysAcc }).readByQuery({
        filter: { hidden: { _eq: false }, isCurrentFrontend: { _eq: true } },
        fields: ['id', 'name'],
        limit: 1,
      });
      const currentFrontendVersion = catalogVersions?.[0];
      logger.info(`DEBUG [generate-questions]: Current frontend catalog version: ${currentFrontendVersion?.id || 'none'}`);

      const allMunicipalityScores = await new ItemsService('municipality_scores', { schema, accountability: sysAcc }).readByQuery({
        filter: { municipality: { _eq: municipalityId } },
        sort: ['-date_created'],
        fields: ['*', 'catalog_version.*']
      });

      logger.info(`DEBUG [generate-questions]: Found ${allMunicipalityScores.length} municipality scores`);

      const sufficientlyRatedScores = allMunicipalityScores.filter(score => (score.percentage_rated || 0) > 80);
      logger.info(`DEBUG [generate-questions]: ${sufficientlyRatedScores.length} scores with percentage_rated > 80`);

      if (sufficientlyRatedScores.length > 0) {
        // Try to find a score matching the current frontend catalog version
        let selectedScore = sufficientlyRatedScores.find(s => s.catalog_version?.id === currentFrontendVersion?.id);

        if (!selectedScore) {
          logger.info(`DEBUG [generate-questions]: No sufficiently rated score for current frontend catalog, using most recent with catalog`);
          // Sort by date_created descending and take the first with a valid catalog_version
          const scoresWithCatalog = sufficientlyRatedScores.filter(s => s.catalog_version?.id);
          selectedScore = scoresWithCatalog.length > 0
            ? scoresWithCatalog.slice().sort((a, b) => new Date(b.date_created) - new Date(a.date_created))[0]
            : sufficientlyRatedScores[0];
        }

        catalogVersionId = selectedScore?.catalog_version?.id || null;
        logger.info(`DEBUG [generate-questions]: Using catalog version: ${catalogVersionId}`);
      } else {
        logger.warn(`DEBUG [generate-questions]: No municipality scores with percentage_rated > 80 found`);
        catalogVersionId = allMunicipalityScores?.[0]?.catalog_version?.id || null;
        logger.info(`DEBUG [generate-questions]: Falling back to most recent catalog version: ${catalogVersionId}`);
      }
    } else {
      logger.info(`DEBUG [generate-questions]: No municipality found for localteam`);
    }

    console.log('DEBUG [generate-questions]: Fetching ratings with catalogVersionId:', catalogVersionId);
    const ratings = await ratingsSvc.readByQuery({
      filter: {
        localteam_id: { _eq: localteamId },
        applicable: { _eq: true },
        measure_id: {
          ...(catalogVersionId ? { catalog_version: { _eq: catalogVersionId } } : {}),
        },
      },
      fields: ['*', 'measure_id.*', 'measure_id.catalog_version.*'],
      limit: -1,
    });

    console.log('DEBUG [generate-questions]: Fetched ratings count:', ratings.length);
    if (!ratings.length) {
      throw new Error(`Keine passenden Bewertungen (ratings_measures) für das Lokalteam gefunden.`);
    }

    const allMeasureIdentifiers = ratings
      .map((r) => (typeof r.measure_id === 'object' ? r.measure_id.measure_id : null))
      .filter(Boolean);

    const templates = await templateSvc.readByQuery({
      filter: { measure_id: { _in: allMeasureIdentifiers } },
      limit: -1,
    });
    const templateMap = Object.fromEntries(templates.map((t) => [t.measure_id, t]));

    console.log('DEBUG [generate-questions]: Total ratings to process:', ratings.length);
    console.log('DEBUG [generate-questions]: First 10 ratings:', ratings.slice(0, 10).map(r => ({ measure_id: r.measure_id?.measure_id || r.measure_id, catalog_version: r.measure_id?.catalog_version?.name || 'null' })));

    const prioritized = ratings
      .map((r) => {
        const m = typeof r.measure_id === 'object' ? r.measure_id : {};
        const mid_uuid = m.id || r.measure_id;
        const mid_string = m.measure_id;
        const template = mid_string && templateMap[mid_string];

        const weight = parseFloat(m.weight) || 0;
        const politicalFeasibility = parseFloat(m.feasibility_political) || 0;
        const economicFeasibility = parseFloat(m.feasibility_economical) || 0;
        const ratingValue = parseFloat(r.rating) || 0;

        const potential = (1 - ratingValue) * weight;
        const difficulty = (politicalFeasibility + economicFeasibility) / 2;

        return {
          ...r,
          measure_uuid: mid_uuid,
          measure_identifier: mid_string,
          _potential: potential,
          _difficulty: difficulty,
          _weight: weight,
          _feasibility_political: politicalFeasibility,
          _feasibility_economical: economicFeasibility,
          _template: template,
        };
      })
      .filter(r => {
        const hasTemplateWithThesis = r._template && r._template.thesis;
        return r.applicable === true && r.rating !== null && hasTemplateWithThesis;
      })
      .sort((a, b) => {
        if (b._potential !== a._potential) return b._potential - a._potential;
        if (a._difficulty !== b._difficulty) return a._difficulty - b._difficulty;
        return (a.measure_identifier ?? '').localeCompare(b.measure_identifier ?? '');
      });

    console.log('DEBUG [generate-questions]: Prioritized measures:', prioritized.length);
    console.log('DEBUG [generate-questions]: Top 10 prioritized:', prioritized.slice(0, 10).map(p => ({ measure_id: p.measure_identifier, catalog_version: (typeof p.measure_id === 'object' ? p.measure_id?.catalog_version?.name : 'null') || 'null' })));

    // Deduplicate by measure_identifier, keeping the highest-priority entry for each measure
    const measureMap = new Map();
    for (const item of prioritized) {
      if (!measureMap.has(item.measure_identifier)) {
        measureMap.set(item.measure_identifier, item);
      }
    }
    const deduplicated = Array.from(measureMap.values());

    const sortedDeduped = deduplicated.sort((a, b) => {
      if (b._potential !== a._potential) return b._potential - a._potential;
      if (a._difficulty !== b._difficulty) return a._difficulty - b._difficulty;
      return (a.measure_identifier ?? '').localeCompare(b.measure_identifier ?? '');
    });

    const top10 = sortedDeduped.slice(0, 10);
    console.log('DEBUG [generate-questions]: Deduplicated measures:', sortedDeduped.length);

    const existing = await questionsSvc.readByQuery({
      filter: { election: { _eq: election_id } },
      fields: ['id'],
      limit: -1,
    });

    if (existing.length > 0) {
      logger.info(`generate-questions: Deleting ${existing.length} existing questions for election ${election_id}`);
      await questionsSvc.deleteMany(existing.map(q => q.id));
    }

    const toCreate = top10;

    if (toCreate.length === 0) {
      logger.warn(`generate-questions: No valid measures found for election ${election_id}`);
      return {
        success: false,
        count: 0,
        message: 'Keine gültigen Maßnahmen gefunden.',
        election_id: election_id,
      };
    }

    const created = await questionsSvc.createMany(
      toCreate.map((r, i) => {
        const m = typeof r.measure_id === 'object' ? r.measure_id : {};
        const template = r._template;

        return {
          election: election_id,
          title: template?.title || m?.name || r.measure_identifier || '',
          thesis: template?.thesis || m?.description || '',
          sector: template?.sector || m?.sector || null,
          status: 'published',
          sort: i + 1,
        };
      })
    );

    await electionSvc.updateOne(election_id, { already_generated_questions: true });

    const updatedElection = await electionSvc.readOne(election_id, {
      fields: ['already_generated_questions', 'already_sent_mails'],
    });

    logger.info(`generate-questions: created ${created.length} question(s) for election ${election_id}`);
    logger.info(`DEBUG [generate-questions]: Final result - created ${created.length} questions from ${top10.length} prioritized measures`);
    logger.info(`DEBUG [generate-questions]: Top measure IDs:`, top10.map(m => m.measure_identifier));

    return {
      success: true,
      count: created.length,
      measures: top10.map((m) => m.measure_id),
      election_id: election_id,
      updated_data: updatedElection,
    };
  },
};
