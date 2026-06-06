import type { DirectusInterfaceConfig } from '../types';
import InterfaceComponent from './interface.vue';

const config: DirectusInterfaceConfig = {
  id: 'footer-nav-editor',
  name: 'Footer Navigation Editor',
  description: 'Column-based footer navigation editor with flat link lists per column',
  icon: 'view_column',
  component: InterfaceComponent,
  types: ['json'],
  options: null,
};

export default config;
