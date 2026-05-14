import { resolveElectionId } from '../resolve-election.js';

export default {
  id: 'operation-generate-questions',
  handler: async ({ election_id }, { logger, accountability, services, getSchema, data }) => {
    const { ItemsService } = services;
    const schema = await getSchema();
    const sysAcc = { ...accountability, admin: true };

    const resolved_id = await resolveElectionId(election_id, data, ItemsService, schema, accountability);

    const electionSvc  = new ItemsService('elections',                  { schema, accountability: sysAcc });
    const ratingsSvc   = new ItemsService('ratings_measures',           { schema, accountability: sysAcc });
    const templateSvc  = new ItemsService('measure_questions_template', { schema, accountability: sysAcc });
    const questionsSvc = new ItemsService('questions',                  { schema, accountability: sysAcc });

    const election = await electionSvc.readOne(resolved_id, { fields: ['*', 'localteam.*'] });
    if (!election) throw new Error(`Wahl mit ID "${resolved_id}" nicht gefunden.`);

    const localteamId = election.localteam?.id || election.localteam;
    if (!localteamId) throw new Error('Lokalteam der Wahl konnte nicht ermittelt werden.');

    // 1. Fetch all ratings for this localteam
    const ratings = await ratingsSvc.readByQuery({
      filter: {
        localteam_id: { _eq: localteamId },
        applicable: { _eq: true },
        approved: { _eq: true },
        measure_id: {
          status: { _eq: 'published' },
          catalog_version: {
            hidden: { _neq: true },
            _or: [
              { isCurrentBackend: { _eq: true } },
              { isCurrentFrontend: { _eq: true } },
            ],
          },
        },
      },
      fields: ['*', 'measure_id.*', 'measure_id.catalog_version.*'],
      limit: -1,
    });
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

    const ratingsWithTemplate = ratings.filter((r) => {
      const mid = typeof r.measure_id === 'object' ? r.measure_id.measure_id : null;
      return mid && templateMap[mid];
    });

    if (!ratingsWithTemplate.length) {
      const msg =
        `Keine Maßnahmen mit passendem Template für dieses Lokalteam gefunden. ` +
        `${ratings.length} Bewertungen vorhanden, aber keine hat ein passendes Template in measure_questions_template.`;
      logger.error(msg);
      throw new Error(msg);
    }

    // 3. Prioritise: highest improvement potential ((1 - rating) * weighting) → easiest → stable measure_id
    // This matches the frontend ElectionInfo component logic exactly
    const prioritized = ratingsWithTemplate
      .map((r) => {
        const m = typeof r.measure_id === 'object' ? r.measure_id : {};
        const mid_uuid = m.id || r.measure_id;
        const mid_string = m.measure_id;
        return {
          ...r,
          measure_uuid: mid_uuid,
          measure_identifier: mid_string,
          _potential: (1 - (parseFloat(r.rating) || 0)) * (m.weighting || 0),
          _difficulty: ((m.political_feasibility || 0) + (m.economic_feasibility || 0)) / 2,
        };
      })
      .sort((a, b) => {
        if (b._potential !== a._potential) return b._potential - a._potential;
        if (a._difficulty !== b._difficulty) return a._difficulty - b._difficulty;
        return (a.measure_identifier ?? '').localeCompare(b.measure_identifier ?? '');
      });

    const top10 = prioritized.slice(0, 10);

    // 4. Create questions for this election (append only)
    const existing = await questionsSvc.readByQuery({
      filter: { election: { _eq: resolved_id } },
      fields: ['measure_id'],
      limit: -1,
    });
    const existingMeasureUuids = new Set(existing.map(q => q.measure_id));

    // Only create questions for measures that don't have a question for this election yet
    const toCreate = top10.filter(r => !existingMeasureUuids.has(r.measure_uuid));

    if (toCreate.length === 0) {
      logger.info(`generate-questions: All top 10 questions already exist for election ${resolved_id}`);
      return {
        success: true,
        count: 0,
        message: 'Alle Thesen sind bereits vorhanden.',
        election_id: resolved_id,
      };
    }

    const created = await questionsSvc.createMany(
      toCreate.map((r, i) => ({
        election: resolved_id,
        measure_id: r.measure_uuid,
        title: templateMap[r.measure_identifier].title,
        thesis: templateMap[r.measure_identifier].thesis || '',
        sector: templateMap[r.measure_identifier].sector || null,
        status: 'published',
        sort: existing.length + i + 1,
      }))
    );

    await electionSvc.updateOne(resolved_id, { already_generated_questions: true });

    const updatedElection = await electionSvc.readOne(resolved_id, {
      fields: ['already_generated_questions', 'already_sent_mails'],
    });

    logger.info(`generate-questions: created ${created.length} question(s) for election ${resolved_id}`);

    return {
      success: true,
      count: created.length,
      measures: top10.map((m) => m.measure_id),
      election_id: resolved_id,
      updated_data: updatedElection,
    };
  },
};
