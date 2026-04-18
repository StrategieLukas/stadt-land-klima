export default {
	id: 'operation-set-cutoff-date',
	handler: async ({ localteam_id, cutoff_date }, { logger, accountability, services, getSchema, data }) => {
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

		// If cutoff_date is not in options, maybe it's in trigger data
		let final_date = cutoff_date;
		if (!final_date && data.$trigger && data.$trigger.data) {
			final_date = data.$trigger.data.cutoff_date;
		}

		if (!final_date) {
			throw new Error('Kein Stichtag (cutoff_date) angegeben.');
		}

		logger.info(`Setting cutoff date for localteam ${resolved_id} to ${final_date}`);

		const localteamService = new ItemsService('localteams', {
			schema,
			accountability: systemAccountability,
		});

		await localteamService.updateOne(resolved_id, {
			cutoff_date: final_date,
		});

		return {
			success: true,
			localteam_id: resolved_id,
			cutoff_date: final_date,
		};
	},
};
