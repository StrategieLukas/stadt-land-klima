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

    // Get the municipality from the localteam using the m2o relation
    // municipalities.localteam_id points to localteams.id
    const municipalities = await new ItemsService('municipalities', { schema, accountability: sysAcc }).readByQuery({
      filter: { localteam_id: { _eq: localteamId } },
      limit: 1,
      fields: ['id']
    });

    const municipalityId = municipalities?.[0]?.id || null;
    logger.info(`DEBUG [generate-questions]: Municipality ID: ${municipalityId}`);
    let catalogVersionId = null;

    if (municipalityId) {
      // Get the most recent municipality_score for this municipality with percentage_rated > 80
      // This matches the frontend behavior
      const allMunicipalityScores = await new ItemsService('municipality_scores', { schema, accountability: sysAcc }).readByQuery({
        filter: { municipality: { _eq: municipalityId } },
        sort: ['-date_created'],
        fields: ['catalog_version', 'percentage_rated']
      });

      logger.info(`DEBUG [generate-questions]: Found ${allMunicipalityScores.length} municipality scores`);

      // Filter by percentage_rated > 80, matching frontend
      const sufficientlyRatedScores = allMunicipalityScores.filter(score => (score.percentage_rated || 0) > 80);
      logger.info(`DEBUG [generate-questions]: ${sufficientlyRatedScores.length} scores with percentage_rated > 80`);

      if (sufficientlyRatedScores.length > 0) {
        // Prefer the current catalog version, fallback to most recent
        catalogVersionId = sufficientlyRatedScores[0].catalog_version?.id || null;
        logger.info(`DEBUG [generate-questions]: Using catalog version from sufficiently rated score: ${catalogVersionId}`);
      } else {
        logger.warn(`DEBUG [generate-questions]: No municipality scores with percentage_rated > 80 found`);
        catalogVersionId = allMunicipalityScores?.[0]?.catalog_version?.id || null;
        logger.info(`DEBUG [generate-questions]: Falling back to most recent catalog version: ${catalogVersionId}`);
      }
    } else {
      logger.info(`DEBUG [generate-questions]: No municipality found for localteam`);
    }

    // 1. Fetch ratings for this localteam, filtered by the same catalog_version as frontend
    console.log('DEBUG [generate-questions]: Fetching ratings with catalogVersionId:', catalogVersionId);
    const ratings = await ratingsSvc.readByQuery({
      filter: {
        localteam_id: { _eq: localteamId },
        applicable: { _eq: true },
        // Note: We removed approved and measure_id.status filters to match frontend behavior
        // Frontend filters in JavaScript, not in the query
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

    // 2. Fetch templates — match using the measure's string identifier (e.g. EN_01)
    const allMeasureIdentifiers = ratings
      .map((r) => (typeof r.measure_id === 'object' ? r.measure_id.measure_id : null))
      .filter(Boolean);

    const templates = await templateSvc.readByQuery({
      filter: { measure_id: { _in: allMeasureIdentifiers } },
      limit: -1,
    });
    const templateMap = Object.fromEntries(templates.map((t) => [t.measure_id, t]));

    // 3. Prioritise: highest improvement potential ((1 - rating) * weight) → easiest → stable measure_id
    // This matches the frontend ElectionInfo component logic exactly
    // Use template if available, otherwise use measure directly
    console.log('DEBUG [generate-questions]: Total ratings to process:', ratings.length);
    console.log('DEBUG [generate-questions]: First 3 ratings:', JSON.stringify(ratings.slice(0, 3), null, 2));

    const prioritized = ratings
      .map((r) => {
        const m = typeof r.measure_id === 'object' ? r.measure_id : {};
        const mid_uuid = m.id || r.measure_id;
        const mid_string = m.measure_id;
        const template = mid_string && templateMap[mid_string];

        // Use the correct field names that match the frontend
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
        // Match frontend filtering: only include items with applicable=true, rating not null
        // and that have both currentProgress and politicalDemand template strings
        const hasTemplate = r._template && r._template.currentProgress && r._template.politicalDemand;
        console.log('DEBUG [generate-questions]: Filtering item:', {
          measure_identifier: r.measure_identifier,
          applicable: r.applicable,
          rating: r.rating,
          hasTemplate: hasTemplate,
          templateKeys: r._template ? Object.keys(r._template) : 'null'
        });
        return r.applicable === true && r.rating !== null && hasTemplate;
      })
      .sort((a, b) => {
        console.log('DEBUG [generate-questions]: Sorting items:', {
          a_id: a.measure_identifier, a_potential: a._potential, a_difficulty: a._difficulty,
          b_id: b.measure_identifier, b_potential: b._potential, b_difficulty: b._difficulty
        });
        if (b._potential !== a._potential) return b._potential - a._potential;
        if (a._difficulty !== b._difficulty) return a._difficulty - b._difficulty;
        return (a.measure_identifier ?? '').localeCompare(b.measure_identifier ?? '');
      });

    console.log('DEBUG [generate-questions]: Prioritized measures:', prioritized.length);
    console.log('DEBUG [generate-questions]: Top 3 prioritized:', JSON.stringify(prioritized.slice(0, 3), null, 2));

    const top10 = prioritized.slice(0, 10);

    // 4. Create questions for this election (append only)
    const existing = await questionsSvc.readByQuery({
      filter: { election: { _eq: election_id } },
      fields: ['measure_id'],
      limit: -1,
    });
    const existingMeasureUuids = new Set(existing.map(q => q.measure_id));

    // Only create questions for measures that don't have a question for this election yet
    const toCreate = top10.filter(r => !existingMeasureUuids.has(r.measure_uuid));

    if (toCreate.length === 0) {
      logger.info(`generate-questions: All top 10 questions already exist for election ${election_id}`);
      return {
        success: true,
        count: 0,
        message: 'Alle Thesen sind bereits vorhanden.',
        election_id: election_id,
      };
    }

    const created = await questionsSvc.createMany(
      toCreate.map((r, i) => {
        const m = typeof r.measure_id === 'object' ? r.measure_id : {};
        const template = r._template;
        const measure = m;

        return {
          election: election_id,
          measure_id: r.measure_uuid,
          title: template?.title || measure?.name || r.measure_identifier || '',
          thesis: template?.thesis || measure?.description || '',
          sector: template?.sector || measure?.sector || null,
          status: 'published',
          sort: existing.length + i + 1,
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
