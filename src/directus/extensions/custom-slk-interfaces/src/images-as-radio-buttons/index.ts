import type { DirectusInterfaceConfig } from '../types';
import InterfaceIconRadio from './interface.vue';

const config: DirectusInterfaceConfig = {
  id: 'icon-radio',
  name: 'Icon Button Group',
  type: 'interface',
  description: 'Radio selection group with icon buttons',
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
                interface: 'system-input-translated-string',
                required: true,
              },
            },
            {
              field: 'value',
              type: 'string',
              name: 'Value',
              meta: {
                width: 'half',
                interface: 'input',
                required: true,
                options: {
                  font: 'monospace',
                },
              },
            },
            {
              field: 'svg_icon',
              type: 'text',
              name: 'SVG Icon',
              meta: {
                width: 'half',
                interface: 'code',
              },
            },
          ],
        },
      },
    },
  ],
};

export default config;
