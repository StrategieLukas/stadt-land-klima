import { resolveLocalteamId } from './resolve-localteam.js';

export const generateQuestionsApi = {
  id: 'operation-generate-questions',
  handler: async ({ localteam_id }, { logger, accountability, services, getSchema, data }) => {
    const { ItemsService } = services;
    const schema = await getSchema();
    const sysAcc = { ...accountability, admin: true };

    const resolved_id = await resolveLocalteamId(localteam_id, accountability, data, ItemsService, schema);

    const localteamSvc = new ItemsService('localteams',                 { schema, accountability: sysAcc });
    const measuresSvc  = new ItemsService('measures',                   { schema, accountability: sysAcc });
    const templateSvc  = new ItemsService('measure_questions_template', { schema, accountability: sysAcc });
    const questionsSvc = new ItemsService('questions',                  { schema, accountability: sysAcc });

    const localteam = await localteamSvc.readOne(resolved_id);
    if (!localteam?.municipality_name) {
      throw new Error('Lokalteam oder Gemeinde nicht gefunden.');
    }

    // 1. Fetch all measures for this municipality
    const measures = await measuresSvc.readByQuery({
      filter: { municipality_name: { _eq: localteam.municipality_name } },
      limit: -1,
    });
    if (!measures.length) {
      throw new Error(`Keine Maßnahmen für die Gemeinde "${localteam.municipality_name}" gefunden.`);
    }

    // 2. Fetch templates and build lookup by measure_id
    const allMeasureIds = measures.map((m) => m.measure_id).filter(Boolean);
    const templates = await templateSvc.readByQuery({
      filter: { measure_id: { _in: allMeasureIds } },
      limit: -1,
    });
    const templateMap = Object.fromEntries(templates.map((t) => [t.measure_id, t]));

    // 3. Filter to only measures that have a matching template
    const measuresWithTemplate = measures.filter((m) => templateMap[m.measure_id]);
    if (!measuresWithTemplate.length) {
      const msg =
        `Keine Maßnahmen mit passendem Template für Gemeinde "${localteam.municipality_name}" gefunden. ` +
        `${measures.length} Maßnahmen vorhanden, aber keine hat ein Template in measure_questions_template.`;
      logger.error(msg);
      throw new Error(msg);
    }

    // 4. Prioritise: highest potential → easiest → alphabetical measure_id
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

    // 5. Replace existing questions atomically
    const existing = await questionsSvc.readByQuery({
      filter: { localteam: { _eq: resolved_id } },
      fields: ['id'],
      limit: -1,
    });
    if (existing.length > 0) {
      await questionsSvc.deleteMany(existing.map((q) => q.id));
      logger.info(`generate-questions: deleted ${existing.length} existing question(s) for localteam ${resolved_id}`);
    }

    const created = await questionsSvc.createMany(
      top10.map((m, i) => ({
        localteam:  resolved_id,
        measure_id: m.measure_id,
        title:      templateMap[m.measure_id].title,
        thesis:     templateMap[m.measure_id].thesis || '',
        status:     'published',
        sort:       i + 1,
      }))
    );

    logger.info(`generate-questions: created ${created.length} question(s) for localteam ${resolved_id}`);

    return {
      success:      true,
      count:        created.length,
      measures:     top10.map((m) => m.measure_id),
      localteam_id: resolved_id,
    };
  },
};

export const generateQuestionsApp = {
  id: 'operation-generate-questions',
  name: 'Generate Questions',
  icon: 'auto_awesome',
  description: 'Generates the top 10 theses for a municipality based on measure ratings and weightings.',
  overview: ({ localteam_id }) => [
    { label: 'Localteam ID', text: localteam_id || '(resolved automatically)' },
  ],
  options: [
    {
      field: 'localteam_id',
      name: 'Localteam ID',
      type: 'string',
      meta: {
        width: 'full',
        interface: 'input',
        note: 'Leave blank to resolve from the flow trigger or the current user.',
      },
    },
  ],
};
