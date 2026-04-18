export default {
	id: 'operation-send-candidate-emails',
	name: 'Send Candidate Emails',
	icon: 'mail',
	description: 'This sends personalized email invitations to candidates with a secure link',
	overview: ({ localteam_id }) => [
		{
			label: 'Localteam ID',
			text: localteam_id,
		},
	],
	options: [
		{
			field: 'localteam_id',
			name: 'Localteam ID',
			type: 'string',
			meta: {
				width: 'full',
				interface: 'input',
			},
		},
	],
};
