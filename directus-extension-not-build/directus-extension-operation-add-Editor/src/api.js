import { isEmpty } from 'lodash-es';
import { toArray } from '@directus/utils';
export default {
	id: 'operation-add-editor',
	handler: async ({ email, localteam_id }, { env, logger, accountability, services, getSchema },) => {
		let roleName = "EditorLocalteam"
		accountability.admin = true;
		logger.info(email, "email");
		logger.info(localteam_id, "localteam_id");
		const { UsersService, RolesService, MailService } = services;
		const schema = await getSchema();
		const usersService = new UsersService({ schema,accountability});
		const rolesService = new RolesService({ schema, accountability });
		const mailService = new MailService({
			schema: schema,
			accountability: accountability,
		});
		usersService.validateEmail(email);
		let url = usersService.inviteUrl(email);
		const user = await usersService.getUserByEmail(email);
		const roles = await rolesService.readByQuery({
			fields: ['*'],
			filter: {
				name: {
					_eq: roleName
				}
			}
		});

		logger.info(roles[0].id);
		// Create user first to verify uniqueness if unknown
		if (isEmpty(user)) {
			

			//Create user
			const resultUser = await usersService.createOne({ email, role: roles[0].id, status: 'invited', localteams: [{ localteam_id: localteam_id }] });

			//send Email

			const subjectLine = "You've been invited to Stadt.Land.Klima! as an " + roleName;

			await mailService.send({
				to:  email,
				subject: subjectLine,
				template: {
					name: 'user-invitation',
					data: {
						url: url,
						email: email,
					},
				},
			}); 

		} else {
			
			if(user.role !== roles[0].id){
				throw new Error("User has different role");
			}
				//Possibility to also use for update Maybe also for multiple loalteams per editor
		}

	},
};

