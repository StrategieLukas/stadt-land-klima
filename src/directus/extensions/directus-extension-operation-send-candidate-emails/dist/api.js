import crypto from 'crypto';

export default {
	id: 'operation-send-candidate-emails',
	handler: async ({ localteam_id }, { logger, accountability, services, getSchema, data }) => {
		const { RolesService, ItemsService, MailService } = services;
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

		// Security: Only allow admins to send emails
		if (!accountability || !accountability.role) {
			throw new Error('Nicht autorisiert.');
		}

		const rolesService = new RolesService({ schema, accountability: systemAccountability });
		const adminRole = await rolesService.readByQuery({ filter: { name: { _eq: 'Administrator' } } });

		if (accountability.role !== adminRole[0].id) {
			throw new Error('Nur Administratoren können Kandidaten-E-Mails versenden.');
		}

		const localteamService = new ItemsService('localteams', { schema, accountability: systemAccountability });
		const candidateService = new ItemsService('candidate', { schema, accountability: systemAccountability });
		const questionsService = new ItemsService('questions', { schema, accountability: systemAccountability });
		const mailService = new MailService({ schema, accountability: systemAccountability });

		const localteam = await localteamService.readOne(resolved_id);
		if (!localteam) throw new Error('Lokalteam nicht gefunden.');

		// Validations
		if (!localteam.cutoff_date) {
			throw new Error('Bitte setzen Sie zuerst einen Stichtag.');
		}

		const questions = await questionsService.readByQuery({
			filter: { localteam: { _eq: resolved_id }, status: { _eq: 'published' } }
		});
		if (questions.length < 10) {
			throw new Error(`Nur ${questions.length} veröffentlichte Thesen gefunden. Es werden mindestens 10 benötigt.`);
		}

		const candidates = await candidateService.readByQuery({
			filter: { localteam: { _eq: resolved_id }, email: { _nnull: true } },
			limit: -1
		});
		if (candidates.length < 3) {
			throw new Error(`Nur ${candidates.length} Kandidaten mit E-Mail gefunden. Es werden mindestens 3 benötigt.`);
		}

		let sentCount = 0;
		for (const candidate of candidates) {
			let token = candidate.access_token;
			if (!token) {
				token = crypto.randomBytes(32).toString('hex');
				await candidateService.updateOne(candidate.id, { access_token: token });
			}

			const link = `https://stadt-land-klima.de/thesen/${localteam.id}/${token}`;

			try {
				await mailService.send({
					to: candidate.email,
					subject: `Einladung zum Klimawahl-Check: ${localteam.municipality_name}`,
					template: {
						name: 'email-template-candidate',
						data: {
							candidate_name: candidate.name,
							municipality_name: localteam.municipality_name,
							cutoff_date: new Date(localteam.cutoff_date).toLocaleString('de-DE'),
							personal_link: link
						}
					}
				});
				sentCount++;
			} catch (err) {
				logger.error(`Fehler beim Senden der E-Mail an ${candidate.email}: ${err.message}`);
			}
		}

		return {
			success: true,
			sentCount,
			totalCandidates: candidates.length,
			localteam_id: resolved_id
		};
	},
};
