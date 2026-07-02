import type { DirectusInterfaceConfig } from '../types';
import MeasurePreview from './interface.vue';

const config: DirectusInterfaceConfig = {
  id: 'measure-preview',
  name: 'Measure Preview',
  icon: 'info',
  description: 'Displays selected measure fields inline in ratings_measures',
  component: MeasurePreview,
  types: ['string', 'integer', 'bigInteger', 'json', 'text'],
  localTypes: ['standard'],
  group: 'other',
  options: [
    {
      field: 'measure_field',
      type: 'string',
      name: 'Measure Reference Field',
      meta: { 
        width: 'full', 
        note: 'Field in this collection that relates to measures',
        interface: 'input'
      },
      schema: { 
        default_value: 'measure_id' 
      }
    },
    {
      field: 'fields_to_display',
      type: 'json',
      name: 'Fields to Display',
      meta: { 
        width: 'full', 
        note: 'Fields from the measure to display (as JSON array)',
        interface: 'input-code',
        options: {
          language: 'json'
        }
      },
      schema: { 
        default_value: '["description_about","description_evaluation_criteria","description_verification"]'
      }
    }
  ]
};

export default config;
