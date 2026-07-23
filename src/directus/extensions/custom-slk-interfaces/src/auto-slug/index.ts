import type { DirectusInterfaceConfig } from '../types';
import InterfaceComponent from './interface.vue';

const config: DirectusInterfaceConfig = {
  id: 'auto-slug',
  name: 'Auto Slug',
  icon: 'link',
  description: 'Slug input that derives its value from another field while editing.',
  component: InterfaceComponent,
  types: ['string'],
  group: 'standard',
  options: [
    {
      field: 'source_field',
      type: 'string',
      name: 'Source Field',
      meta: {
        width: 'half',
        interface: 'input',
      },
      schema: {
        default_value: 'name',
      },
    },
    {
      field: 'sync_existing',
      type: 'boolean',
      name: 'Sync Existing Values',
      meta: {
        width: 'half',
        interface: 'boolean',
      },
      schema: {
        default_value: false,
      },
    },
  ],
};

export default config;
