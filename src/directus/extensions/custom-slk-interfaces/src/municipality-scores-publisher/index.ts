import type { DirectusInterfaceConfig } from '../types';
import InterfaceComponent from './interface.vue';

const config: DirectusInterfaceConfig = {
  id: 'municipality-scores-publisher',
  name: 'Municipality Scores Publisher',
  icon: 'fact_check',
  description: 'Shows score rows by measure catalog and toggles frontend publishing per version.',
  component: InterfaceComponent,
  types: ['alias'],
  localTypes: ['o2m'],
  group: 'relational',
  options: null,
};

export default config;
