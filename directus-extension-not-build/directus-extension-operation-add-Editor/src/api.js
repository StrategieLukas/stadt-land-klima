import { isEmpty } from 'lodash-es';
import { toArray } from '@directus/utils';
export default {
	id: 'operation-add-editor',
	handler: async ({ email, localteam_id }, { env, logger, accountability, services, getSchema },) => {
		accountability.admin = true;
		logger.info(email, "email");
		logger.info(localteam_id, "localteam_id");
		const { UsersService, RolesService, MailService,ItemsService } = services;
		const schema = await getSchema();
		const editorToLocalteamService = new ItemsService("junction_directus_users_localteams", {
			schema,
			accountability,
		  });
		const usersService = new UsersService({ schema });
		const rolesService = new RolesService({ schema, accountability });
		const mailService = new MailService({
			schema: schema,
			accountability: accountability,
		});
		usersService.validateEmail(email);
		let url = usersService.inviteUrl(email);
		const user = await usersService.getUserByEmail(email);
		// Create user first to verify uniqueness if unknown
		if (isEmpty(user)) {
			const roles = await rolesService.readByQuery({
				fields: ['*'],
				filter: {
					name: {
						_eq: 'EditorLocalteam'
					}
				}
			});
			
			logger.info(roles[0].id);
			const resultUser = await usersService.createOne({ email, role:roles[0].id, status: 'invited',localteams:[{localteam_id:localteam_id}]});

			//send Email
			
				const subjectLine =  "You've been invited to Stadt.Land.Klima!";

				await mailService.send({
					to: user?.email ?? email,
					subject: subjectLine,
					template: {
						name: 'user-invitation',
						data: {
							url: url,
							email:  email,
						},
					},
				});
			
		} else {
			throw new Error("User already exist2");
			
		}


		logger.info(url, "url");
		//await usersService.createOne({ email: email, password: password, role, ...defaultAdminUser });


	},
};

