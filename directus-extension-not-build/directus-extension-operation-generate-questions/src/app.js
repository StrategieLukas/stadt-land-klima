export default {
	id: 'operation-generate-questions',
	name: 'Generate Questions',
	icon: 'auto_awesome',
	description: 'This generates the top 10 theses for a municipality based on its rating',
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
