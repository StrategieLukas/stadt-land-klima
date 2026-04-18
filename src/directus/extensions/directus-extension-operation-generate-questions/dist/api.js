export default {
	id: 'operation-generate-questions',
	handler: async ({ localteam_id }, { logger, accountability, services, getSchema, data }) => {
		const { ItemsService } = services;
		const schema = await getSchema();
		const systemAccountability = { ...accountability, admin: true };

		let resolved_id = localteam_id;

		// If not provided in options, try to resolve from trigger
		if (!resolved_id && data.$trigger && data.$trigger.body) {
			const { collection, keys } = data.$trigger.body;
			if (keys && keys.length > 0) {
				const id = keys[0];
				if (collection === 'localteams') {
					resolved_id = id;
				} else if (collection) {
					const service = new ItemsService(collection, { schema, accountability: systemAccountability });
					const item = await service.readOne(id, { fields: ['localteam'] });
					if (item && item.localteam) resolved_id = item.localteam;
				}
			}
		}

		// Still no ID? Try current user's localteam
		if (!resolved_id && accountability && accountability.user) {
			const junctionService = new ItemsService('junction_directus_users_localteams', { schema, accountability: systemAccountability });
			const junctions = await junctionService.readByQuery({
				filter: { directus_users_id: { _eq: accountability.user } },
				limit: 1
			});
			if (junctions && junctions.length > 0) {
				resolved_id = junctions[0].localteam_id;
			}
		}

		if (!resolved_id) {
			throw new Error('Konnte kein Lokalteam identifizieren.');
		}

		const localteamService = new ItemsService('localteams', { schema, accountability: systemAccountability });
		const measuresService = new ItemsService('measures', { schema, accountability: systemAccountability });
		const templateService = new ItemsService('measure_questions_template', { schema, accountability: systemAccountability });
		const questionsService = new ItemsService('questions', { schema, accountability: systemAccountability });

		const localteam = await localteamService.readOne(resolved_id);
		if (!localteam || !localteam.municipality_name) {
			throw new Error('Lokalteam oder Gemeinde nicht gefunden.');
		}

		// 1. Get all measures for this municipality
		const measures = await measuresService.readByQuery({
			filter: { municipality_name: { _eq: localteam.municipality_name } },
			limit: -1
		});

		if (!measures.length) {
			throw new Error(`Keine Maßnahmen für die Gemeinde ${localteam.municipality_name} gefunden.`);
		}

		// 2. Prioritization logic (Potential, then Difficulty, then ID)
		const prioritizedMeasures = measures
			.map(m => {
				const rating = m.rating || 0;
				const weight = m.weighting || 0;
				const potential = (1 - rating) * weight;
				const difficulty = ((m.political_feasibility || 0) + (m.economic_feasibility || 0)) / 2;
				return { ...m, potential, difficulty };
			})
			.sort((a, b) => {
				if (b.potential !== a.potential) return b.potential - a.potential;
				if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty;
				return a.measure_id.localeCompare(b.measure_id);
			});

		const top10 = prioritizedMeasures.slice(0, 10);

		// 3. Get templates for these measures
		const measureIds = top10.map(m => m.measure_id);
		const templates = await templateService.readByQuery({
			filter: { measure_id: { _in: measureIds } },
			limit: -1
		});

		const templateMap = templates.reduce((acc, t) => {
			acc[t.measure_id] = t;
			return acc;
		}, {});

		// 4. Create questions
		const questionsToCreate = top10.map((m, index) => {
			const template = templateMap[m.measure_id] || {};
			return {
				localteam: resolved_id,
				measure_id: m.measure_id,
				title: template.title || m.measure_id,
				thesis: template.thesis || '',
				status: 'published',
				sort: index + 1
			};
		});

		// Delete existing questions for this localteam
		const existingQuestions = await questionsService.readByQuery({
			filter: { localteam: { _eq: resolved_id } },
			fields: ['id']
		});
		if (existingQuestions.length > 0) {
			await questionsService.deleteMany(existingQuestions.map(q => q.id));
		}

		const created = await questionsService.createMany(questionsToCreate);

		return {
			success: true,
			count: created.length,
			measures: measureIds,
			localteam_id: resolved_id
		};
	},
};
