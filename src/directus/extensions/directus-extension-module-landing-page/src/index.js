import ModuleComponent from './module.vue';

export default {
	id: 'landing-page', // root URI
	name: 'Landing Page',
	icon: 'rocket_launch',
	routes: [
		{
			path: '',
			props: true,
			component: ModuleComponent,
		},
		{
			name: 'page',
			path: ':page',
			props: true,
			component: ModuleComponent,
		},
	],
};