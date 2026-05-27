import type { Logger, Accountability, Services, GetSchema, Database } from '@directus/extensions-sdk';

export default {
  id: 'operation-generate-questions',
  handler: async ({ election_id }: { election_id: string | number }, { logger, accountability, services, getSchema, data }: { logger: Logger; accountability: Accountability; services: Services; getSchema: GetSchema; data: Record<string, unknown> }) => {
    const { ItemsService } = services;
    const schema = await getSchema();
    const sysAcc = { ...accountability, admin: true };

    logger.info(`DEBUG [generate-questions]: Starting thesis generation for election_id: ${election_id}`);

    const electionSvc = new ItemsService('elections', { schema, accountability: sysAcc });
    const ratingsSvc = new ItemsService('ratings_measures', { schema, accountability: sysAcc });
    const templateSvc = new ItemsService('measure_questions_template', { schema, accountability: sysAcc });
    const questionsSvc = new ItemsService('questions', { schema, accountability: sysAcc });

    const election = await electionSvc.readOne(election_id, { fields: ['*', 'localteam.*'] });
    if (!election) throw new Error(`Wahl mit ID "${election_id}" nicht gefunden.`);
    logger.info(`DEBUG [generate-questions]: Election loaded: ${(election as Record<string, unknown>).descriptor || election_id}`);

    const localteamId = (election as Record<string, unknown>).localteam?.id || (election as Record<string, unknown>).localteam;
    if (!localteamId) throw new Error('Lokalteam der Wahl konnte nicht ermittelt werden.');
    logger.info(`DEBUG [generate-questions]: Localteam ID: ${localteamId}`);

    const municipalities = await new ItemsService('municipalities', { schema, accountability: sysAcc }).readByQuery({
      filter: { localteam_id: { _eq: localteamId } },
      limit: 1,
      fields: ['id']
    });

    const municipalityId = municipalities?.[0]?.id || null;
    logger.info(`DEBUG [generate-questions]: Municipality ID: ${municipalityId}`);
    let catalogVersionId: string | null = null;

    if (municipalityId) {
      // Get the current frontend catalog version (matching frontend logic)
      const catalogVersions = await new ItemsService('measure_catalog', { schema, accountability: sysAcc }).readByQuery({
        filter: { hidden: { _eq: false }, isCurrentFrontend: { _eq: true } },
        fields: ['id', 'name'],
        limit: 1,
      });
      const currentFrontendVersion = catalogVersions?.[0];
      logger.info(`DEBUG [generate-questions]: Current frontend catalog version: ${(currentFrontendVersion as Record<string, unknown>)?.id || 'none'}`);

      const allMunicipalityScores = await new ItemsService('municipality_scores', { schema, accountability: sysAcc }).readByQuery({
        filter: { municipality: { _eq: municipalityId } },
        sort: ['-date_created'],
        fields: ['*', 'catalog_version.*']
      });

      logger.info(`DEBUG [generate-questions]: Found ${allMunicipalityScores.length} municipality scores`);

      const sufficientlyRatedScores = allMunicipalityScores.filter((score: Record<string, unknown>) => (score.percentage_rated || 0) > 80);
      logger.info(`DEBUG [generate-questions]: ${sufficientlyRatedScores.length} scores with percentage_rated > 80`);

      if (sufficientlyRatedScores.length > 0) {
        // Try to find a score matching the current frontend catalog version
        let selectedScore = sufficientlyRatedScores.find((s: Record<string, unknown>) => (s.catalog_version as Record<string, unknown>)?.id === (currentFrontendVersion as Record<string, unknown>)?.id);

        if (!selectedScore) {
          logger.info(`DEBUG [generate-questions]: No sufficiently rated score for current frontend catalog, using most recent with catalog`);
          // Sort by date_created descending and take the first with a valid catalog_version
          const scoresWithCatalog = sufficientlyRatedScores.filter((s: Record<string, unknown>) => (s.catalog_version as Record<string, unknown>)?.id);
          selectedScore = scoresWithCatalog.length > 0
            ? scoresWithCatalog.slice().sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date(b.date_created as string).valueOf() - new Date(a.date_created as string).valueOf())[0]
            : sufficientlyRatedScores[0];
        }

        catalogVersionId = (selectedScore as Record<string, unknown>)?.catalog_version?.id as string || null;
        logger.info(`DEBUG [generate-questions]: Using catalog version: ${catalogVersionId}`);
      } else {
        logger.warn(`DEBUG [generate-questions]: No municipality scores with percentage_rated > 80 found`);
        catalogVersionId = (allMunicipalityScores?.[0] as Record<string, unknown>)?.catalog_version?.id as string || null;
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
      .map((r: Record<string, unknown>) => (typeof r.measure_id === 'object' ? (r.measure_id as Record<string, unknown>).measure_id : null))
      .filter(Boolean) as string[];

    const templates = await templateSvc.readByQuery({
      filter: { measure_id: { _in: allMeasureIdentifiers } },
      limit: -1,
    });
    const templateMap: Record<string, Record<string, unknown>> = Object.fromEntries(templates.map((t: Record<string, unknown>) => [t.measure_id as string, t]));

    console.log('DEBUG [generate-questions]: Total ratings to process:', ratings.length);
    console.log('DEBUG [generate-questions]: First 10 ratings:', ratings.slice(0, 10).map((r: Record<string, unknown>) => ({ measure_id: (typeof r.measure_id === 'object' ? (r.measure_id as Record<string, unknown>).measure_id : r.measure_id) || r.measure_id, catalog_version: (typeof r.measure_id === 'object' ? (r.measure_id as Record<string, unknown>).catalog_version?.name : 'null') || 'null' })));

    type PrioritizedRating = Record<string, unknown> & {
      measure_uuid?: string;
      measure_identifier?: string;
      _potential: number;
      _difficulty: number;
      _weight: number;
      _feasibility_political: number;
      _feasibility_economical: number;
      _template?: Record<string, unknown>;
    };

    const prioritized: PrioritizedRating[] = ratings
      .map((r: Record<string, unknown>) => {
        const m = typeof r.measure_id === 'object' ? (r.measure_id as Record<string, unknown>) : {};
        const mid_uuid = m.id || r.measure_id;
        const mid_string = m.measure_id as string | undefined;
        const template = mid_string && templateMap[mid_string];

        const weight = parseFloat(m.weight as string) || 0;
        const politicalFeasibility = parseFloat(m.feasibility_political as string) || 0;
        const economicFeasibility = parseFloat(m.feasibility_economical as string) || 0;
        const ratingValue = parseFloat(r.rating as string) || 0;

        const potential = (1 - ratingValue) * weight;
        const difficulty = (politicalFeasibility + economicFeasibility) / 2;

        return {
          ...r,
          measure_uuid: mid_uuid as string,
          measure_identifier: mid_string,
          _potential: potential,
          _difficulty: difficulty,
          _weight: weight,
          _feasibility_political: politicalFeasibility,
          _feasibility_economical: economicFeasibility,
          _template: template,
        };
      })
      .filter((r: PrioritizedRating) => {
        const hasTemplateWithThesis = r._template && (r._template as Record<string, unknown>).thesis;
        return r.applicable === true && r.rating !== null && hasTemplateWithThesis;
      })
      .sort((a: PrioritizedRating, b: PrioritizedRating) => {
        if (b._potential !== a._potential) return b._potential - a._potential;
        if (a._difficulty !== b._difficulty) return a._difficulty - b._difficulty;
        return (a.measure_identifier ?? '').localeCompare(b.measure_identifier ?? '');
      });

    console.log('DEBUG [generate-questions]: Prioritized measures:', prioritized.length);
    console.log('DEBUG [generate-questions]: Top 10 prioritized:', prioritized.slice(0, 10).map((p: PrioritizedRating) => ({ measure_id: p.measure_identifier, catalog_version: (typeof p.measure_id === 'object' ? (p.measure_id as Record<string, unknown>).catalog_version?.name : 'null') || 'null' })));

    // Deduplicate by measure_identifier, keeping the highest-priority entry for each measure
    const measureMap = new Map<string, PrioritizedRating>();
    for (const item of prioritized) {
      if (!measureMap.has(item.measure_identifier as string)) {
        measureMap.set(item.measure_identifier as string, item);
      }
    }
    const deduplicated = Array.from(measureMap.values());

    const sortedDeduped = deduplicated.sort((a: PrioritizedRating, b: PrioritizedRating) => {
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
      await questionsSvc.deleteMany(existing.map((q: Record<string, unknown>) => q.id as string | number));
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
      toCreate.map((r: PrioritizedRating, i: number) => {
        const m = typeof r.measure_id === 'object' ? (r.measure_id as Record<string, unknown>) : {};
        const template = r._template;

        return {
          election: election_id,
          title: ((template as Record<string, unknown>)?.title as string) || (m?.name as string) || (r.measure_identifier as string) || '',
          thesis: ((template as Record<string, unknown>)?.thesis as string) || (m?.description as string) || '',
          sector: ((template as Record<string, unknown>)?.sector as string) || (m?.sector as string) || null,
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
    logger.info(`DEBUG [generate-questions]: Top measure IDs:`, top10.map((m: PrioritizedRating) => m.measure_identifier));

    return {
      success: true,
      count: created.length,
      measures: top10.map((m: PrioritizedRating) => m.measure_id),
      election_id: election_id,
      updated_data: updatedElection,
    };
  },
};
