import { resolveElectionId } from '../resolve-election.js';

export default {
  id: 'operation-generate-questions',
  handler: async ({ election_id }, { logger, accountability, services, getSchema, data }) => {
    const { ItemsService } = services;
    const schema = await getSchema();
    const sysAcc = { ...accountability, admin: true };

    const resolved_id = await resolveElectionId(election_id, data, ItemsService, schema, accountability);

    const electionSvc  = new ItemsService('elections',                  { schema, accountability: sysAcc });
    const measuresSvc  = new ItemsService('measures',                   { schema, accountability: sysAcc });
    const templateSvc  = new ItemsService('measure_questions_template', { schema, accountability: sysAcc });
    const questionsSvc = new ItemsService('questions',                  { schema, accountability: sysAcc });

    const election = await electionSvc.readOne(resolved_id, { fields: ['*', 'localteam.*'] });
    if (!election) throw new Error(`Wahl mit ID "${resolved_id}" nicht gefunden.`);

    const municipalityName = election.localteam?.municipality_name;
    if (!municipalityName) throw new Error('Lokalteam oder Gemeindename nicht gefunden.');

    // 1. Fetch all measures for this municipality
    const measures = await measuresSvc.readByQuery({
      filter: { municipality_name: { _eq: municipalityName } },
      limit: -1,
    });
    if (!measures.length) {
      throw new Error(`Keine Maßnahmen für die Gemeinde "${municipalityName}" gefunden.`);
    }

    // 2. Fetch templates — only measures WITH a matching template are considered
    const allMeasureIds = measures.map((m) => m.measure_id).filter(Boolean);
    const templates = await templateSvc.readByQuery({
      filter: { measure_id: { _in: allMeasureIds } },
      limit: -1,
    });
    const templateMap = Object.fromEntries(templates.map((t) => [t.measure_id, t]));

    const measuresWithTemplate = measures.filter((m) => templateMap[m.measure_id]);
    if (!measuresWithTemplate.length) {
      const msg =
        `Keine Maßnahmen mit passendem Template für "${municipalityName}" gefunden. ` +
        `${measures.length} Maßnahmen vorhanden, aber keine hat ein Template in measure_questions_template.`;
      logger.error(msg);
      throw new Error(msg);
    }

    // 3. Prioritise: highest potential → easiest → stable alphabetical
    const prioritized = measuresWithTemplate
      .map((m) => ({
        ...m,
        _potential:  (1 - (m.rating ?? 0)) * (m.weighting ?? 0),
        _difficulty: ((m.political_feasibility ?? 0) + (m.economic_feasibility ?? 0)) / 2,
      }))
      .sort((a, b) => {
        if (b._potential !== a._potential) return b._potential - a._potential;
        if (a._difficulty !== b._difficulty) return a._difficulty - b._difficulty;
        return (a.measure_id ?? '').localeCompare(b.measure_id ?? '');
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
      top10.map((m, i) => ({
        election:   resolved_id,
        measure_id: m.measure_id,
        title:      templateMap[m.measure_id].title,
        thesis:     templateMap[m.measure_id].thesis || '',
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
