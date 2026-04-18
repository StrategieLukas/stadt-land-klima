export default {
	id: 'operation-set-cutoff-date',
	name: 'Set Cutoff Date',
	icon: 'calendar_today',
	description: 'This sets the cutoff date for a localteam',
	overview: ({ localteam_id, cutoff_date }) => [
		{
			label: 'Localteam ID',
			text: localteam_id,
		},
		{
			label: 'Cutoff Date',
			text: cutoff_date,
		},
	],
	options: [
		{
			field: 'localteam_id',
			name: 'Localteam ID',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'input',
			},
		},
		{
			field: 'cutoff_date',
			name: 'Cutoff Date',
			type: 'string',
			meta: {
				width: 'half',
				interface: 'datetime',
			},
		},
	],
};
