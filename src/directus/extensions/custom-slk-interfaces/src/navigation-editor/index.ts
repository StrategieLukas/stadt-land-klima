import type { DirectusInterfaceConfig } from '../types';
import InterfaceComponent from './interface.vue';

const config: DirectusInterfaceConfig = {
  id: 'navigation-editor',
  name: 'Navigation Editor',
  icon: 'menu',
  description: 'Visueller Editor für Navigationsmenüs (Header/Footer)',
  component: InterfaceComponent,
  types: ['json'],
  group: 'other',
  options: null,
};

export default config;
