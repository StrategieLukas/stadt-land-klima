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
      filter: { localteam_id: { _eq: localteamId }, applicable: { _eq: true }, approved: { _eq: true } },
      fields: ['*', 'measure_id.*'],
      limit: -1,
    });
    if (!ratings.length) {
      throw new Error(`Keine Bewertungen (ratings_measures) für das Lokalteam gefunden.`);
    }

    // 2. Fetch templates — only measures WITH a matching template are considered
    const allMeasureIds = ratings.map((r) => typeof r.measure_id === 'object' ? r.measure_id.id : r.measure_id).filter(Boolean);
    const templates = await templateSvc.readByQuery({
      filter: { measure_id: { _in: allMeasureIds } },
      limit: -1,
    });
    const templateMap = Object.fromEntries(templates.map((t) => [t.measure_id, t]));

    const ratingsWithTemplate = ratings.filter((r) => {
      const mid = typeof r.measure_id === 'object' ? r.measure_id.id : r.measure_id;
      return templateMap[mid];
    });

    if (!ratingsWithTemplate.length) {
      const msg =
        `Keine Maßnahmen mit passendem Template für dieses Lokalteam gefunden. ` +
        `${ratings.length} Bewertungen vorhanden, aber keine hat ein Template in measure_questions_template.`;
      logger.error(msg);
      throw new Error(msg);
    }

    // 3. Prioritise: highest potential → easiest → stable alphabetical
    const prioritized = ratingsWithTemplate
      .map((r) => {
        const m = typeof r.measure_id === 'object' ? r.measure_id : {};
        const mid = m.id || r.measure_id;
        return {
          ...r,
          measure_uuid: mid,
          _potential:  (1 - (parseFloat(r.rating) || 0)) * (m.weighting || 0),
          _difficulty: ((m.political_feasibility || 0) + (m.economic_feasibility || 0)) / 2,
        };
      })
      .sort((a, b) => {
        if (b._potential !== a._potential) return b._potential - a._potential;
        if (a._difficulty !== b._difficulty) return a._difficulty - b._difficulty;
        return (a.measure_uuid ?? '').localeCompare(b.measure_uuid ?? '');
      });

    const top10 = prioritized.slice(0, 10);

    // 4. Replace existing questions for this election atomically
    const existing = await questionsSvc.readByQuery({
      filter: { election: { _eq: resolved_id } },
      fields: ['id'],
      limit: -1,
    });
    if (existing.length > 0) {
      await questionsSvc.deleteMany(existing.map((q) => q.id));
      logger.info(`generate-questions: deleted ${existing.length} existing question(s) for election ${resolved_id}`);
    }

    const created = await questionsSvc.createMany(
      top10.map((r, i) => ({
        election:   resolved_id,
        measure_id: r.measure_uuid,
        title:      templateMap[r.measure_uuid].title,
        thesis:     templateMap[r.measure_uuid].thesis || '',
        status:     'published',
        sort:       i + 1,
      }))
    );

    await electionSvc.updateOne(resolved_id, { already_generated_questions: true });

    logger.info(`generate-questions: created ${created.length} question(s) for election ${resolved_id}`);

    return {
      success:     true,
      count:       created.length,
      measures:    top10.map((m) => m.measure_id),
      election_id: resolved_id,
    };
  },
};
