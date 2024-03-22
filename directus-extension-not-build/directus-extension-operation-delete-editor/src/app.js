export default {
	id: 'delete-editor',
	name: 'delete Editor',
	icon: 'box',
	description: 'This deletes the user for the correspond keys from the editor',
	overview: ({ keys }) => [
		{
			label: "Keys",
			text: keys,
		},
	],
	options: [
		{
			field: "keys",
			name: "EditorLocalteam Keys",
			type: "json",
			meta: {
				width: "full",
				interface: "input",
			},
		},
	],
};
