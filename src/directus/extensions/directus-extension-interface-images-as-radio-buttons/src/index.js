import InterfaceIconRadio from './interface.vue';

export default {
	id: 'icon-radio',
	name: 'Icon Button Group',
	type: 'interface',
	description: 'Radio selction group with icon buttons',
	icon: 'view_carousel',
	component: InterfaceIconRadio,
	types: ['string'],
	recommendedDisplays: ['badge'],
	options: [
		{
			field: 'choices',
			type: 'json',
			name: 'Choices',
			meta: {
				width: 'full',
				interface: 'list',
				options: {
					template: '{{ text }}',
					fields: [
						{
							field: 'text',
							type: 'string',
							name: 'Text',
							meta: {
								width: 'half',
								interface: 'input',
							},
						},
						{
							field: 'value',
							type: 'string',
							name: 'Value',
							meta: {
								width: 'half',
								interface: 'input',
								options: {
									font: 'monospace',
								},
							},
						},
						{
							field: 'image',
							name: 'Image',
							type: 'string',
							meta: {
								width: 'half',
								interface: 'file-image',
							},
						},
						
					],
				},
			},
		},
	],
};